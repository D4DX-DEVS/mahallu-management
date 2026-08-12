import { Request, Response } from 'express';
import Institute from '../models/Institute';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

export const getAllPrograms = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, tenantId, audience, programType } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { type: 'program' };

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (status) query.status = status;
    if (audience) query.audience = audience;
    if (programType) query.programType = programType;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { place: { $regex: search, $options: 'i' } },
      ];
    }

    const [programs, total] = await Promise.all([
      Institute.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Institute.countDocuments(query),
    ]);

    res.json(createPaginationResponse(programs, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProgramById = async (req: Request, res: Response) => {
  try {
    const program = await Institute.findOne({ _id: req.params.id, type: 'program' });
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    res.json({ success: true, data: program });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProgram = async (req: AuthRequest, res: Response) => {
  try {
    const programData = {
      ...req.body,
      type: 'program',
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!programData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    const program = new Institute(programData);
    await program.save();
    res.status(201).json({ success: true, data: program });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProgram = async (req: Request, res: Response) => {
  try {
    const program = await Institute.findOneAndUpdate(
      { _id: req.params.id, type: 'program' },
      { ...req.body, type: 'program' },
      { new: true, runValidators: true }
    );
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    res.json({ success: true, data: program });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProgram = async (req: Request, res: Response) => {
  try {
    const program = await Institute.findOneAndDelete({ _id: req.params.id, type: 'program' });
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    res.json({ success: true, message: 'Program deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

