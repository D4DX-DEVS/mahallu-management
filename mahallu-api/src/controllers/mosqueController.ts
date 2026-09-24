import { Response } from 'express';
import MosqueProfile from '../models/MosqueProfile';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable } from '../utils/sanitizeUpdate';
import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

const tenantScope = (req: AuthRequest) => {
  if (req.tenantId) return req.tenantId;
  if (req.isSuperAdmin && req.query.tenantId) return req.query.tenantId as string;
  return undefined;
};

export const getAllMosques = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { search } = req.query;
    const query: any = {};
    const tenantId = tenantScope(req);
    if (tenantId) query.tenantId = tenantId;
    if (search) {
      query.$or = [
        { name: { $regex: regexLiteral(search), $options: 'i' } },
        { nameMl: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      MosqueProfile.find(query).sort({ name: 1 }).skip(skip).limit(limit),
      MosqueProfile.countDocuments(query),
    ]);

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the mosques right now. Please try again.');
  }
};

export const getMosqueById = async (req: AuthRequest, res: Response) => {
  try {
    const mosque = await MosqueProfile.findById(req.params.id).populate('imamMemberId', 'name phone');
    if (!mosque || (req.tenantId && mosque.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that mosque. It may have been removed." });
    }
    res.json({ success: true, data: mosque });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the mosque right now. Please try again.');
  }
};

export const createMosque = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });

    const mosque = await MosqueProfile.create({ ...req.body, tenantId });
    res.status(201).json({ success: true, data: mosque });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the mosque. Please try again.');
  }
};

export const updateMosque = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await MosqueProfile.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that mosque. It may have been removed." });
    }
    const mosque = await MosqueProfile.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: mosque });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the mosque. Please try again.');
  }
};

export const deleteMosque = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await MosqueProfile.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that mosque. It may have been removed." });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Mosque deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the mosque. Please try again.');
  }
};
