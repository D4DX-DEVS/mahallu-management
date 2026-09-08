import { Request, Response } from 'express';
import Institute from '../models/Institute';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { verifyTenantOwnership } from '../utils/tenantCheck';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

export const getAllInstitutes = async (req: AuthRequest, res: Response) => {
  try {
    const { type, status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: regexLiteral(search), $options: 'i' } },
        { place: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [institutes, total] = await Promise.all([
      Institute.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Institute.countDocuments(query),
    ]);

    res.json(createPaginationResponse(institutes, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the institutes right now. Please try again.');
  }
};

export const getInstituteById = async (req: AuthRequest, res: Response) => {
  try {
    const institute = await Institute.findById(req.params.id);
    if (!institute) {
      return res.status(404).json({ success: false, message: "We couldn't find that institute. It may have been removed." });
    }
    
    // Verify tenant ownership
    if (!verifyTenantOwnership(req, res, institute.tenantId, 'Institute')) {
      return;
    }
    
    res.json({ success: true, data: institute });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the institute right now. Please try again.');
  }
};

export const createInstitute = async (req: AuthRequest, res: Response) => {
  try {
    const instituteData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!instituteData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const institute = new Institute(instituteData);
    await institute.save();
    res.status(201).json({ success: true, data: institute });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the institute. Please try again.');
  }
};

export const updateInstitute = async (req: AuthRequest, res: Response) => {
  try {
    // First check if institute exists and belongs to tenant
    const existingInstitute = await Institute.findById(req.params.id);
    if (!existingInstitute) {
      return res.status(404).json({ success: false, message: "We couldn't find that institute. It may have been removed." });
    }
    
    // Verify tenant ownership
    if (!verifyTenantOwnership(req, res, existingInstitute.tenantId, 'Institute')) {
      return;
    }

    const institute = await Institute.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!institute) {
      return res.status(404).json({ success: false, message: "We couldn't find that institute. It may have been removed." });
    }
    res.json({ success: true, data: institute });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the institute. Please try again.');
  }
};

export const deleteInstitute = async (req: AuthRequest, res: Response) => {
  try {
    // First check if institute exists and belongs to tenant
    const institute = await Institute.findById(req.params.id);
    if (!institute) {
      return res.status(404).json({ success: false, message: "We couldn't find that institute. It may have been removed." });
    }
    
    // Verify tenant ownership
    if (!verifyTenantOwnership(req, res, institute.tenantId, 'Institute')) {
      return;
    }

    await Institute.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Institute deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the institute. Please try again.');
  }
};

