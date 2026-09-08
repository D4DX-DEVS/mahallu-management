import { Response } from 'express';
import MedicalCamp from '../models/MedicalCamp';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable } from '../utils/sanitizeUpdate';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

/**
 * GET /api/medical-camps
 * List medical camps with optional filters.
 */
export const getAllMedicalCamps = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.status) query.status = req.query.status;
    if (req.query.search) query.name = { $regex: regexLiteral(String(req.query.search)), $options: 'i' };

    const [camps, total] = await Promise.all([
      MedicalCamp.find(query)
        .sort({ campDate: -1 })
        .skip(skip)
        .limit(limit),
      MedicalCamp.countDocuments(query),
    ]);

    res.json(createPaginationResponse(camps, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the medical camps right now. Please try again.');
  }
};

/**
 * GET /api/medical-camps/:id
 */
export const getMedicalCampById = async (req: AuthRequest, res: Response) => {
  try {
    const camp = await MedicalCamp.findOne({ _id: req.params.id, ...tenantScope(req) });

    if (!camp) {
      return res.status(404).json({ success: false, message: "We couldn't find that medical camp. It may have been removed." });
    }

    res.json({ success: true, data: camp });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the medical camp right now. Please try again.');
  }
};

/**
 * POST /api/medical-camps
 * Create a new medical camp.
 */
export const createMedicalCamp = async (req: AuthRequest, res: Response) => {
  try {
    const camp = await MedicalCamp.create({
      tenantId: req.tenantId,
      ...req.body,
    });

    res.status(201).json({ success: true, data: camp });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the medical camp. Please try again.');
  }
};

/**
 * PUT /api/medical-camps/:id
 * Update a medical camp.
 */
export const updateMedicalCamp = async (req: AuthRequest, res: Response) => {
  try {
    const camp = await MedicalCamp.findOne({ _id: req.params.id, ...tenantScope(req) });

    if (!camp) {
      return res.status(404).json({ success: false, message: "We couldn't find that medical camp. It may have been removed." });
    }

    const updated = await MedicalCamp.findByIdAndUpdate(
      req.params.id,
      stripImmutable(req.body),
      {
        new: true,
        runValidators: true,
      }
    );

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the medical camp. Please try again.');
  }
};

/**
 * DELETE /api/medical-camps/:id
 * Hard delete a medical camp.
 */
export const deleteMedicalCamp = async (req: AuthRequest, res: Response) => {
  try {
    const camp = await MedicalCamp.findOne({ _id: req.params.id, ...tenantScope(req) });

    if (!camp) {
      return res.status(404).json({ success: false, message: "We couldn't find that medical camp. It may have been removed." });
    }

    await MedicalCamp.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Medical camp deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the medical camp. Please try again.');
  }
};
