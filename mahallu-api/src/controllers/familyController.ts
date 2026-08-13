import { Request, Response } from 'express';
import Family from '../models/Family';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import mongoose from 'mongoose';

export const getAllFamilies = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, area, sortBy, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter
    // req.tenantId is set by authMiddleware and includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }
    // If neither, super admin sees all families

    if (status) query.status = status;
    if (area) query.area = area;
    if (search) {
      query.$or = [
        { houseName: { $regex: search, $options: 'i' } },
        { mahallId: { $regex: search, $options: 'i' } },
        { contactNo: { $regex: search, $options: 'i' } },
      ];
    }

    const sort: any = {};
    if (sortBy === 'mahallId') sort.mahallId = 1;
    else sort.createdAt = -1;

    const [families, total] = await Promise.all([
      Family.find(query).sort(sort).skip(skip).limit(limit),
      Family.countDocuments(query),
    ]);

    res.json(createPaginationResponse(families, total, page, limit));
  } catch (error: any) {
    console.error('Error fetching families:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFamilyById = async (req: AuthRequest, res: Response) => {
  try {
    const family = await Family.findById(req.params.id);
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    if (!req.isSuperAdmin && req.tenantId && family.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Family does not belong to your tenant',
      });
    }

    res.json({ success: true, data: family });
  } catch (error: any) {
    console.error('Error fetching family:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createFamily = async (req: AuthRequest, res: Response) => {
  try {
    // Ensure tenantId is set
    const familyData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!familyData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    // Auto-generate mahallId (Family ID) in format FID{number}
    const lastFamily = await Family.findOne({ tenantId: familyData.tenantId })
      .sort({ createdAt: -1 })
      .select('mahallId');
    
    let nextNumber = 1;
    if (lastFamily && lastFamily.mahallId) {
      // Extract number from last family ID (e.g., "FID123" -> 123)
      const match = lastFamily.mahallId.match(/FID(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    familyData.mahallId = `FID${nextNumber}`;

    const family = new Family(familyData);
    await family.save();
    res.status(201).json({ success: true, data: family });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFamily = async (req: Request, res: Response) => {
  try {
    const family = await Family.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }
    res.json({ success: true, data: family });
  } catch (error: any) {
    console.error('Error updating family:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFamily = async (req: Request, res: Response) => {
  try {
    const family = await Family.findByIdAndDelete(req.params.id);
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }
    res.json({ success: true, message: 'Family deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFamilyStats = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId: queryTenantId } = req.query;
    const query: any = { status: { $ne: 'deleted' } };

    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (queryTenantId && req.isSuperAdmin) {
      query.tenantId = queryTenantId;
    }

    const [totalMembers, maleCount, femaleCount] = await Promise.all([
      Member.countDocuments(query),
      Member.countDocuments({ ...query, gender: 'male' }),
      Member.countDocuments({ ...query, gender: 'female' }),
    ]);

    res.json({ success: true, data: { totalMembers, maleCount, femaleCount } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Bulk import families (CSV parsed client-side into a JSON array). Max 500 rows. */
export const bulkImportFamilies = async (req: AuthRequest, res: Response) => {
  try {
    const { families } = req.body;
    if (!Array.isArray(families) || families.length === 0) {
      return res.status(400).json({ success: false, message: 'families array is required' });
    }
    if (families.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 families per import' });
    }

    const errors: { row: number; message: string }[] = [];
    const docs: any[] = [];

    // Get highest existing mahallId to auto-generate new ones
    const lastFamily = await Family.findOne({ tenantId: req.tenantId })
      .sort({ createdAt: -1 })
      .select('mahallId')
      .lean();

    let nextNumber = 1;
    if (lastFamily && lastFamily.mahallId) {
      const match = lastFamily.mahallId.match(/FID(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    families.forEach((f: any, i: number) => {
      if (!f.houseName || typeof f.houseName !== 'string' || !f.houseName.trim()) {
        errors.push({ row: i + 1, message: 'houseName is required' });
        return;
      }

      docs.push({
        houseName: f.houseName.trim(),
        houseNameMl: f.houseNameMl || f.house_name_ml || undefined,
        familyHead: f.familyHead || f.family_head || undefined,
        familyHeadMl: f.familyHeadMl || f.family_head_ml || undefined,
        contactNo: f.contactNo || f.contact_no || undefined,
        area: f.area || undefined,
        areaMl: f.areaMl || f.area_ml || undefined,
        place: f.place || undefined,
        placeMl: f.placeMl || f.place_ml || undefined,
        varisangyaGrade: f.varisangyaGrade || f.varisangyaGrade_grade || undefined,
        tenantId: req.tenantId,
        status: 'approved',
        mahallId: `FID${nextNumber + docs.length}`,
      });
    });

    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const created = await Family.insertMany(docs);
    res.status(201).json({ success: true, data: { imported: created.length } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

