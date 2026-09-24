import { Request, Response } from 'express';
import Institute from '../models/Institute';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

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
        { name: { $regex: regexLiteral(search), $options: 'i' } },
        { place: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [programs, total] = await Promise.all([
      Institute.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Institute.countDocuments(query),
    ]);

    res.json(createPaginationResponse(programs, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the programs right now. Please try again.');
  }
};

export const getProgramById = async (req: Request, res: Response) => {
  try {
    const program = await Institute.findOne({ _id: req.params.id, type: 'program' });
    if (!program) {
      return res.status(404).json({ success: false, message: "We couldn't find that program. It may have been removed." });
    }
    res.json({ success: true, data: program });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the program right now. Please try again.');
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
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const program = new Institute(programData);
    await program.save();
    res.status(201).json({ success: true, data: program });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the program. Please try again.');
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
      return res.status(404).json({ success: false, message: "We couldn't find that program. It may have been removed." });
    }
    res.json({ success: true, data: program });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the program. Please try again.');
  }
};

export const deleteProgram = async (req: Request, res: Response) => {
  try {
    const program = await Institute.findOneAndDelete({ _id: req.params.id, type: 'program' });
    if (!program) {
      return res.status(404).json({ success: false, message: "We couldn't find that program. It may have been removed." });
    }
    res.json({ success: true, message: 'Program deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the program. Please try again.');
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
      return res.status(404).json({ success: false, message: "We couldn't find that program. It may have been removed." });
    }

    const all = program.registrations || [];
    const populated = await Institute.populate(all, { path: 'memberId', select: 'name nameMl phone age gender' });
    const pageItems = populated.slice(skip, skip + limit);

    res.json(createPaginationResponse(pageItems, all.length, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the program registrations right now. Please try again.');
  }
};

export const registerMemberForProgram = async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Please select a member.' });
    }

    const program = await findProgram(req);
    if (!program) {
      return res.status(404).json({ success: false, message: "We couldn't find that program. It may have been removed." });
    }

    const already = (program.registrations || []).some((r) => r.memberId.toString() === memberId);
    if (already) {
      return res.status(409).json({ success: false, message: 'This member is already registered.' });
    }

    program.registrations = [...(program.registrations || []), { memberId, attended: false }];
    await program.save();

    res.status(201).json({ success: true, data: program.registrations });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the member for program. Please try again.');
  }
};

export const setProgramAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { attended } = req.body;
    if (typeof attended !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Please mark attendance as present or absent.' });
    }

    const program = await findProgram(req);
    if (!program) {
      return res.status(404).json({ success: false, message: "We couldn't find that program. It may have been removed." });
    }

    const registration = (program.registrations || []).find(
      (r) => r.memberId.toString() === req.params.memberId
    );
    if (!registration) {
      return res.status(404).json({ success: false, message: "We couldn't find that registration. It may have been removed." });
    }

    registration.attended = attended;
    program.markModified('registrations');
    await program.save();

    res.json({ success: true, data: registration });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the program attendance. Please try again.');
  }
};

export const removeProgramRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const program = await findProgram(req);
    if (!program) {
      return res.status(404).json({ success: false, message: "We couldn't find that program. It may have been removed." });
    }

    const before = (program.registrations || []).length;
    program.registrations = (program.registrations || []).filter(
      (r) => r.memberId.toString() !== req.params.memberId
    );
    if (program.registrations.length === before) {
      return res.status(404).json({ success: false, message: "We couldn't find that registration. It may have been removed." });
    }

    await program.save();
    res.json({ success: true, message: 'Registration removed' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the program registration. Please try again.');
  }
};
