import { Response } from 'express';
import MosqueProfile from '../models/MosqueProfile';
import { AuthRequest } from '../middleware/authMiddleware';

const tenantScope = (req: AuthRequest) => {
  if (req.tenantId) return req.tenantId;
  if (req.isSuperAdmin && req.query.tenantId) return req.query.tenantId as string;
  return undefined;
};

/** One profile per tenant; returns null (not 404) before the first save. */
export const getMosqueProfile = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });

    const profile = await MosqueProfile.findOne({ tenantId }).populate('imamMemberId', 'name phone');
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const upsertMosqueProfile = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });

    const { tenantId: _ignored, ...payload } = req.body;
    const profile = await MosqueProfile.findOneAndUpdate(
      { tenantId },
      { ...payload, tenantId },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
