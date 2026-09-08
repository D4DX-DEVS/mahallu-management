import { Response } from 'express';
import {
  CounsellingCase,
  DisputeCase,
  InheritanceCase,
} from '../models/Counselling';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

/**
 * Generate the next case number for a given collection and tenant.
 * Format: CNS-0001, MSL-0001, INH-0001, etc.
 */
const generateCaseNo = async (
  model: any,
  tenantId: string,
  prefix: string
): Promise<string> => {
  const lastCase = await model
    .findOne({ tenantId })
    .sort({ _id: -1 })
    .select('caseNo');

  if (!lastCase) {
    return `${prefix}-0001`;
  }

  const match = lastCase.caseNo.match(/(\d+)$/);
  if (!match) {
    return `${prefix}-0001`;
  }

  const nextNum = (parseInt(match[1], 10) + 1).toString().padStart(4, '0');
  return `${prefix}-${nextNum}`;
};

// ====== COUNSELLING CASES ======

export const getAllCounsellingCases = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.category) query.category = req.query.category;
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) {
      query.$or = [
        { caseNo: { $regex: regexLiteral(String(req.query.search)), $options: 'i' } },
        { counsellorName: { $regex: regexLiteral(String(req.query.search)), $options: 'i' } },
        { clientName: { $regex: regexLiteral(String(req.query.search)), $options: 'i' } },
      ];
    }

    const [cases, total] = await Promise.all([
      CounsellingCase.find(query)
        .populate('clientMemberId', 'name phone')
        .sort({ appointmentDate: -1 })
        .skip(skip)
        .limit(limit),
      CounsellingCase.countDocuments(query),
    ]);

    res.json(createPaginationResponse(cases, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the counselling cases right now. Please try again.');
  }
};

export const getCounsellingCaseById = async (req: AuthRequest, res: Response) => {
  try {
    const caseRecord = await CounsellingCase.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    }).populate('clientMemberId', 'name phone');

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that case. It may have been removed." });
    }

    res.json({ success: true, data: caseRecord });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the counselling case right now. Please try again.');
  }
};

export const createCounsellingCase = async (req: AuthRequest, res: Response) => {
  try {
    const { category, clientMemberId, clientName, counsellorName, appointmentDate } = req.body;

    // Require at least one of clientMemberId or clientName
    if (!clientMemberId && !clientName) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a member, or enter the client’s name.',
      });
    }

    const caseNo = await generateCaseNo(
      CounsellingCase,
      req.tenantId?.toString() || '',
      'CNS'
    );

    const newCase = new CounsellingCase({
      tenantId: req.tenantId,
      caseNo,
      category,
      clientMemberId: clientMemberId || undefined,
      clientName: clientName || undefined,
      counsellorName,
      appointmentDate,
      status: 'open',
    });

    await newCase.save();
    await newCase.populate('clientMemberId', 'name phone');

    res.status(201).json({ success: true, data: newCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the counselling case. Please try again.');
  }
};

export const updateCounsellingCase = async (req: AuthRequest, res: Response) => {
  try {
    const updateData = stripImmutable(req.body);

    const caseRecord = await CounsellingCase.findOneAndUpdate(
      { _id: req.params.id, ...tenantScope(req) },
      updateData,
      { new: true, runValidators: true }
    ).populate('clientMemberId', 'name phone');

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that case. It may have been removed." });
    }

    res.json({ success: true, data: caseRecord });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the counselling case. Please try again.');
  }
};

export const deleteCounsellingCase = async (req: AuthRequest, res: Response) => {
  try {
    const caseRecord = await CounsellingCase.findOneAndDelete({
      _id: req.params.id,
      ...tenantScope(req),
    });

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that case. It may have been removed." });
    }

    res.json({ success: true, message: 'Case deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the counselling case. Please try again.');
  }
};

/**
 * Add a session note to an existing counselling case.
 */
export const addCounsellingNote = async (req: AuthRequest, res: Response) => {
  try {
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a note.',
      });
    }

    const caseRecord = await CounsellingCase.findOneAndUpdate(
      { _id: req.params.id, ...tenantScope(req) },
      {
        $push: {
          sessionNotes: {
            date: new Date(),
            note,
            addedBy: req.user?.name || 'Unknown',
          },
        },
      },
      { new: true }
    ).populate('clientMemberId', 'name phone');

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that case. It may have been removed." });
    }

    res.json({ success: true, data: caseRecord });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the counselling note. Please try again.');
  }
};

// ====== DISPUTE CASES (MASLAHAT) ======

export const getAllDisputeCases = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.type) query.type = req.query.type;
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) {
      query.$or = [
        { caseNo: { $regex: regexLiteral(String(req.query.search)), $options: 'i' } },
        { parties: { $regex: regexLiteral(String(req.query.search)), $options: 'i' } },
      ];
    }

    const [cases, total] = await Promise.all([
      DisputeCase.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DisputeCase.countDocuments(query),
    ]);

    res.json(createPaginationResponse(cases, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the dispute cases right now. Please try again.');
  }
};

export const getDisputeCaseById = async (req: AuthRequest, res: Response) => {
  try {
    const caseRecord = await DisputeCase.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    });

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that case. It may have been removed." });
    }

    res.json({ success: true, data: caseRecord });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the dispute case right now. Please try again.');
  }
};

export const createDisputeCase = async (req: AuthRequest, res: Response) => {
  try {
    const { type, parties, description, mediators } = req.body;

    if (!parties || parties.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one party.',
      });
    }

    const caseNo = await generateCaseNo(DisputeCase, req.tenantId?.toString() || '', 'MSL');

    const newCase = new DisputeCase({
      tenantId: req.tenantId,
      caseNo,
      type,
      parties,
      description,
      mediators: mediators || [],
      status: 'registered',
    });

    await newCase.save();

    res.status(201).json({ success: true, data: newCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the dispute case. Please try again.');
  }
};

export const updateDisputeCase = async (req: AuthRequest, res: Response) => {
  try {
    const updateData = stripImmutable(req.body);

    const caseRecord = await DisputeCase.findOneAndUpdate(
      { _id: req.params.id, ...tenantScope(req) },
      updateData,
      { new: true, runValidators: true }
    );

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that case. It may have been removed." });
    }

    res.json({ success: true, data: caseRecord });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the dispute case. Please try again.');
  }
};

export const deleteDisputeCase = async (req: AuthRequest, res: Response) => {
  try {
    const caseRecord = await DisputeCase.findOneAndDelete({
      _id: req.params.id,
      ...tenantScope(req),
    });

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that case. It may have been removed." });
    }

    res.json({ success: true, message: 'Case deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the dispute case. Please try again.');
  }
};

// ====== INHERITANCE CASES ======

export const getAllInheritanceCases = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.status) query.status = req.query.status;
    if (req.query.search) {
      query.$or = [
        { caseNo: { $regex: regexLiteral(String(req.query.search)), $options: 'i' } },
        { deceasedName: { $regex: regexLiteral(String(req.query.search)), $options: 'i' } },
      ];
    }

    const [cases, total] = await Promise.all([
      InheritanceCase.find(query)
        .populate('deceasedMemberId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      InheritanceCase.countDocuments(query),
    ]);

    res.json(createPaginationResponse(cases, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the inheritance cases right now. Please try again.');
  }
};

export const getInheritanceCaseById = async (req: AuthRequest, res: Response) => {
  try {
    const caseRecord = await InheritanceCase.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    }).populate('deceasedMemberId', 'name');

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that case. It may have been removed." });
    }

    res.json({ success: true, data: caseRecord });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the inheritance case right now. Please try again.');
  }
};

export const createInheritanceCase = async (req: AuthRequest, res: Response) => {
  try {
    const { deceasedMemberId, deceasedName, deathRegistrationId, heirs } = req.body;

    // Require at least one of deceasedMemberId or deceasedName
    if (!deceasedMemberId && !deceasedName) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a member, or enter the deceased person’s name.',
      });
    }

    if (!heirs || heirs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please add at least one heir.',
      });
    }

    const caseNo = await generateCaseNo(InheritanceCase, req.tenantId?.toString() || '', 'INH');

    const newCase = new InheritanceCase({
      tenantId: req.tenantId,
      caseNo,
      deceasedMemberId: deceasedMemberId || undefined,
      deceasedName: deceasedName || undefined,
      deathRegistrationId: deathRegistrationId || undefined,
      heirs,
      status: 'reported',
    });

    await newCase.save();
    await newCase.populate('deceasedMemberId', 'name');

    res.status(201).json({ success: true, data: newCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the inheritance case. Please try again.');
  }
};

export const updateInheritanceCase = async (req: AuthRequest, res: Response) => {
  try {
    const updateData = stripImmutable(req.body);

    const caseRecord = await InheritanceCase.findOneAndUpdate(
      { _id: req.params.id, ...tenantScope(req) },
      updateData,
      { new: true, runValidators: true }
    ).populate('deceasedMemberId', 'name');

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that case. It may have been removed." });
    }

    res.json({ success: true, data: caseRecord });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the inheritance case. Please try again.');
  }
};

export const deleteInheritanceCase = async (req: AuthRequest, res: Response) => {
  try {
    const caseRecord = await InheritanceCase.findOneAndDelete({
      _id: req.params.id,
      ...tenantScope(req),
    });

    if (!caseRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that case. It may have been removed." });
    }

    res.json({ success: true, message: 'Case deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the inheritance case. Please try again.');
  }
};
