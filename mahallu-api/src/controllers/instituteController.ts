import { Request, Response } from 'express';
import Institute from '../models/Institute';
import { AuthRequest } from '../middleware/authMiddleware';
import { stripImmutable, clearableUpdate } from '../utils/sanitizeUpdate';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { verifyTenantOwnership } from '../utils/tenantCheck';

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
        { name: { $regex: search, $options: 'i' } },
        { place: { $regex: search, $options: 'i' } },
      ];
    }

    const [institutes, total] = await Promise.all([
      Institute.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Institute.countDocuments(query),
    ]);

    res.json(createPaginationResponse(institutes, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getInstituteById = async (req: AuthRequest, res: Response) => {
  try {
    const institute = await Institute.findById(req.params.id);
    if (!institute) {
      return res.status(404).json({ success: false, message: 'Institute not found' });
    }
    
    // Verify tenant ownership
    if (!verifyTenantOwnership(req, res, institute.tenantId, 'Institute')) {
      return;
    }
    
    res.json({ success: true, data: institute });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
        message: 'Tenant ID is required',
      });
    }

    const institute = new Institute(instituteData);
    await institute.save();
    res.status(201).json({ success: true, data: institute });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInstitute = async (req: AuthRequest, res: Response) => {
  try {
    // First check if institute exists and belongs to tenant
    const existingInstitute = await Institute.findById(req.params.id);
    if (!existingInstitute) {
      return res.status(404).json({ success: false, message: 'Institute not found' });
    }
    
    // Verify tenant ownership
    if (!verifyTenantOwnership(req, res, existingInstitute.tenantId, 'Institute')) {
      return;
    }

    const institute = await Institute.findByIdAndUpdate(
      req.params.id,
      clearableUpdate(stripImmutable(req.body)),
      { new: true, runValidators: true }
    );
    if (!institute) {
      return res.status(404).json({ success: false, message: 'Institute not found' });
    }
    res.json({ success: true, data: institute });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteInstitute = async (req: AuthRequest, res: Response) => {
  try {
    // First check if institute exists and belongs to tenant
    const institute = await Institute.findById(req.params.id);
    if (!institute) {
      return res.status(404).json({ success: false, message: 'Institute not found' });
    }
    
    // Verify tenant ownership
    if (!verifyTenantOwnership(req, res, institute.tenantId, 'Institute')) {
      return;
    }

    await Institute.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Institute deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

