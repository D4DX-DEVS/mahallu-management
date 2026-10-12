import { Request, Response } from 'express';
import Institute from '../models/Institute';
import { AuthRequest } from '../middleware/authMiddleware';
import Member from '../models/Member';
import { tenantScope } from '../utils/tenantScope';
import { stripImmutable } from '../utils/sanitizeUpdate';
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

export const getProgramById = async (req: AuthRequest, res: Response) => {
  try {
    const program = await Institute.findOne({ _id: req.params.id, type: 'program', ...tenantScope(req) });
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
      ...(stripImmutable(req.body) as Record<string, any>),
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

export const updateProgram = async (req: AuthRequest, res: Response) => {
  try {
    const program = await Institute.findOneAndUpdate(
      { _id: req.params.id, type: 'program', ...tenantScope(req) },
      { ...(stripImmutable(req.body) as Record<string, any>), type: 'program' },
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

export const deleteProgram = async (req: AuthRequest, res: Response) => {
  try {
    const program = await Institute.findOneAndDelete({ _id: req.params.id, type: 'program', ...tenantScope(req) });
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    res.json({ success: true, message: 'Program deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * Task C3 — event registrations on a program.
 * ponytail: registrations live as a subdocument array on the program, not a
 * separate collection. Gatherings are tens-to-hundreds of rows; split it out
 * only if a single event ever outgrows one document.
 */
const findProgram = async (req: AuthRequest) => {
  const query: any = { _id: req.params.id, type: 'program' };
  if (req.tenantId) query.tenantId = req.tenantId;
  return Institute.findOne(query);
};

export const getProgramRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const program = await findProgram(req);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    const all = program.registrations || [];
    const populated = await Institute.populate(all, { path: 'memberId', select: 'name nameMl phone age gender' });
    const pageItems = populated.slice(skip, skip + limit);

    res.json(createPaginationResponse(pageItems, all.length, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const registerMemberForProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).json({ success: false, message: 'memberId is required' });
    }

    const program = await findProgram(req);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    if (typeof memberId !== 'string' || !(await Member.exists({ _id: memberId, tenantId: program.tenantId }))) {
      return res.status(400).json({ success: false, message: 'Member does not belong to this Mahallu' });
    }

    const already = (program.registrations || []).some((r) => r.memberId.toString() === memberId);
    if (already) {
      return res.status(409).json({ success: false, message: 'Member is already registered' });
    }

    program.registrations = [...(program.registrations || []), { memberId: memberId as any, attended: false }];
    await program.save();

    res.status(201).json({ success: true, data: program.registrations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setProgramAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { attended } = req.body;
    if (typeof attended !== 'boolean') {
      return res.status(400).json({ success: false, message: 'attended must be a boolean' });
    }

    const program = await findProgram(req);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    const registration = (program.registrations || []).find(
      (r) => r.memberId.toString() === req.params.memberId
    );
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    registration.attended = attended;
    program.markModified('registrations');
    await program.save();

    res.json({ success: true, data: registration });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeProgramRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const program = await findProgram(req);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    const before = (program.registrations || []).length;
    program.registrations = (program.registrations || []).filter(
      (r) => r.memberId.toString() !== req.params.memberId
    );
    if (program.registrations.length === before) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    await program.save();
    res.json({ success: true, message: 'Registration removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
