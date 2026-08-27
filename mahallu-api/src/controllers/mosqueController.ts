import { Response } from 'express';
import MosqueProfile from '../models/MosqueProfile';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable } from '../utils/sanitizeUpdate';

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
        { name: { $regex: search, $options: 'i' } },
        { nameMl: { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      MosqueProfile.find(query).sort({ name: 1 }).skip(skip).limit(limit),
      MosqueProfile.countDocuments(query),
    ]);

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMosqueById = async (req: AuthRequest, res: Response) => {
  try {
    const mosque = await MosqueProfile.findById(req.params.id).populate('imamMemberId', 'name phone');
    if (!mosque || (req.tenantId && mosque.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Mosque not found' });
    }
    res.json({ success: true, data: mosque });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createMosque = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });

    const mosque = await MosqueProfile.create({ ...req.body, tenantId });
    res.status(201).json({ success: true, data: mosque });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMosque = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await MosqueProfile.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Mosque not found' });
    }
    const mosque = await MosqueProfile.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: mosque });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMosque = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await MosqueProfile.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Mosque not found' });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Mosque deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
