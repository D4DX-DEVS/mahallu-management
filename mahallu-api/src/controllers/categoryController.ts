import { Response } from 'express';
import { MasterCategory as Category, MasterCategoryValue as CategoryValue } from '../models/MasterCategory';
import Member from '../models/Member';
import Family from '../models/Family';
import { WelfareScheme } from '../models/Welfare';
import { ZakatBeneficiary } from '../models/Zakat';
import HealthResource from '../models/HealthResource';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

// Maps a category key to the model fields whose values it backs, so an
// in-use CategoryValue can never be hard-deleted out from under real records.
const USAGE_MAP: Record<string, { model: any; field: string; noun: string }[]> = {
  gender: [{ model: Member, field: 'gender', noun: 'member(s)' }],
  blood_group: [
    { model: Member, field: 'bloodGroup', noun: 'member(s)' },
    { model: HealthResource, field: 'bloodGroup', noun: 'blood donor(s)' },
  ],
  marital_status: [{ model: Member, field: 'maritalStatus', noun: 'member(s)' }],
  relationship: [{ model: Member, field: 'relationship', noun: 'member(s)' }],
  occupation_sector: [{ model: Member, field: 'occupationSector', noun: 'member(s)' }],
  monthly_income_range: [{ model: Member, field: 'monthlyIncomeRange', noun: 'member(s)' }],
  education: [{ model: Member, field: 'education', noun: 'member(s)' }],
  health_status: [{ model: Member, field: 'healthStatus', noun: 'member(s)' }],
  economic_status: [{ model: Family, field: 'economicStatus', noun: 'family/families' }],
  housing_type: [{ model: Family, field: 'housingType', noun: 'family/families' }],
  welfare_category: [{ model: WelfareScheme, field: 'category', noun: 'welfare scheme(s)' }],
  zakat_asnaf_category: [{ model: ZakatBeneficiary, field: 'category', noun: 'zakat beneficiary(ies)' }],
};

const duplicateMessage = (error: any): string | null => {
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || {}).find((k) => k !== 'categoryId');
    return field ? `A value with this ${field} already exists in this category` : 'Duplicate value';
  }
  return null;
};

// ==================== CATEGORY CRUD ====================

export const getAllCategories = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: regexLiteral(search), $options: 'i' } },
        { key: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [categories, total] = await Promise.all([
      Category.find(query).sort({ name: 1 }).skip(skip).limit(limit),
      Category.countDocuments(query),
    ]);

    const counts = await CategoryValue.aggregate([
      { $match: { categoryId: { $in: categories.map((c) => c._id) } } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    const data = categories.map((c) => ({
      ...c.toObject(),
      valueCount: countMap.get((c._id as any).toString()) || 0,
    }));

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the categories right now. Please try again.');
  }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const category = new Category({ ...req.body, isSystem: false });
    await category.save();
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    const dup = duplicateMessage(error);
    if (dup) return res.status(400).json({ success: false, message: dup });
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    sendFailure(res, error, 'We couldn\'t save the category. Please try again.', statusCode);
  }
};

export const getCategoryById = async (req: AuthRequest, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "We couldn't find that category. It may have been removed." });
    }
    const valueCount = await CategoryValue.countDocuments({ categoryId: category._id });
    res.json({ success: true, data: { ...category.toObject(), valueCount } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the category right now. Please try again.');
  }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    // key is immutable — never accept a change to it, even by accident
    const { key, isSystem, ...updates } = req.body;
    const category = await Category.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!category) {
      return res.status(404).json({ success: false, message: "We couldn't find that category. It may have been removed." });
    }
    res.json({ success: true, data: category });
  } catch (error: any) {
    const dup = duplicateMessage(error);
    if (dup) return res.status(400).json({ success: false, message: dup });
    sendFailure(res, error, 'We couldn\'t update the category. Please try again.');
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "We couldn't find that category. It may have been removed." });
    }
    if (category.isSystem) {
      return res.status(400).json({
        success: false,
        message: "This is a built-in category and can't be deleted.",
      });
    }
    await CategoryValue.deleteMany({ categoryId: category._id });
    await category.deleteOne();
    res.json({ success: true, message: 'Category deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the category. Please try again.');
  }
};

// ==================== CATEGORY VALUES ====================

export const getCategoryValues = async (req: AuthRequest, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "We couldn't find that category. It may have been removed." });
    }
    const values = await CategoryValue.find({ categoryId: category._id }).sort({ sortOrder: 1, label: 1 });
    res.json({ success: true, data: values });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the category values right now. Please try again.');
  }
};

export const getCategoryValuesByKey = async (req: AuthRequest, res: Response) => {
  try {
    const values = await CategoryValue.find({
      categoryKey: req.params.key.toLowerCase(),
      status: 'active',
    }).sort({ sortOrder: 1, label: 1 });
    res.json({ success: true, data: values });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the category values right now. Please try again.');
  }
};

export const createCategoryValue = async (req: AuthRequest, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "We couldn't find that category. It may have been removed." });
    }
    const value = new CategoryValue({
      ...req.body,
      categoryId: category._id,
      categoryKey: category.key,
    });
    await value.save();
    res.status(201).json({ success: true, data: value });
  } catch (error: any) {
    const dup = duplicateMessage(error);
    if (dup) return res.status(400).json({ success: false, message: dup });
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    sendFailure(res, error, 'We couldn\'t save the category value. Please try again.', statusCode);
  }
};

export const createCategoryValueByKey = async (req: AuthRequest, res: Response) => {
  try {
    const category = await Category.findOne({ key: req.params.key.toLowerCase() });
    if (!category) {
      return res.status(404).json({ success: false, message: "We couldn't find that category. It may have been removed." });
    }
    const value = new CategoryValue({
      ...req.body,
      categoryId: category._id,
      categoryKey: category.key,
    });
    await value.save();
    res.status(201).json({ success: true, data: value });
  } catch (error: any) {
    const dup = duplicateMessage(error);
    if (dup) return res.status(400).json({ success: false, message: dup });
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    sendFailure(res, error, 'We couldn\'t save the category value. Please try again.', statusCode);
  }
};

export const updateCategoryValue = async (req: AuthRequest, res: Response) => {
  try {
    // code is immutable — it's what's stored on existing records
    const { code, categoryId, categoryKey, ...updates } = req.body;
    const value = await CategoryValue.findOneAndUpdate(
      { _id: req.params.valueId, categoryId: req.params.id },
      updates,
      { new: true, runValidators: true }
    );
    if (!value) {
      return res.status(404).json({ success: false, message: "We couldn't find that category value. It may have been removed." });
    }
    res.json({ success: true, data: value });
  } catch (error: any) {
    const dup = duplicateMessage(error);
    if (dup) return res.status(400).json({ success: false, message: dup });
    sendFailure(res, error, 'We couldn\'t update the category value. Please try again.');
  }
};

export const deleteCategoryValue = async (req: AuthRequest, res: Response) => {
  try {
    const value = await CategoryValue.findOne({ _id: req.params.valueId, categoryId: req.params.id });
    if (!value) {
      return res.status(404).json({ success: false, message: "We couldn't find that category value. It may have been removed." });
    }

    const usages = USAGE_MAP[value.categoryKey] || [];
    for (const usage of usages) {
      const count = await usage.model.countDocuments({ [usage.field]: value.code });
      if (count > 0) {
        return res.status(409).json({
          success: false,
          message: `This is used by ${count} ${usage.noun}, so it can't be deleted. Please deactivate it instead.`,
        });
      }
    }

    await value.deleteOne();
    res.json({ success: true, message: 'Category value deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the category value. Please try again.');
  }
};
