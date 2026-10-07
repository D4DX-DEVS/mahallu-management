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
import Member from '../models/Member';
import { DeathRegistration } from '../models/Registration';
import { isValidId, MSG } from '../utils/scope';
import { createWithSequence, maxNumericSuffix } from '../utils/idCounter';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

/**
 * A member / registration a body links to must be a well-formed id of a record in the caller's own
 * Mahallu (a foreign one would be shown back through populate). Answers 400/404 and returns false.
 */
const linkedRecordsOk = async (
  req: AuthRequest,
  res: Response,
  refs: Array<[model: any, id: unknown, label: string]>
): Promise<boolean> => {
  for (const [model, id, label] of refs) {
    if (id === undefined || id === null || id === '') continue;
    if (!isValidId(id)) {
      res.status(400).json({ success: false, message: MSG.badId });
      return false;
    }
    if (!(await refBelongsToTenant(model, id, req.tenantId))) {
      res.status(404).json({ success: false, message: `We couldn't find that ${label} in this Mahallu.` });
      return false;
    }
  }
  return true;
};

const NO_MAHALLU = { success: false, message: 'Please select a Mahallu before continuing.' };

/**
 * Create a case with the next case number for this Mahallu and collection.
 * Format: CNS-0001, MSL-0001, INH-0001, etc.
 *
 * The number comes from an atomic per-(Mahallu, prefix) counter (see utils/idCounter), seeded on
 * first use from the highest number already issued, so concurrent creates and deletes can never be
 * handed the same number. If the database still reports it as taken (unique index on
 * tenantId + caseNo), the next number is used.
 */
const createCase = async (
  model: any,
  tenantId: string,
  prefix: string,
  fields: Record<string, any>
): Promise<any> =>
  createWithSequence(
    `case:${prefix}:${tenantId}`,
    {
      field: 'caseNo',
      seed: () => maxNumericSuffix(model, { tenantId }, 'caseNo', new RegExp(`^${prefix}-(\\d+)$`)),
    },
    async (n) => {
      const doc = new model({ ...fields, tenantId, caseNo: `${prefix}-${String(n).padStart(4, '0')}` });
      await doc.save();
      return doc;
    }
  );

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

    if (!req.tenantId) return res.status(400).json(NO_MAHALLU);
    if (!(await linkedRecordsOk(req, res, [[Member, clientMemberId, 'member']]))) return;

    const newCase = await createCase(CounsellingCase, String(req.tenantId), 'CNS', {
      category,
      clientMemberId: clientMemberId || undefined,
      clientName: clientName || undefined,
      counsellorName,
      appointmentDate,
      status: 'open',
    });
    await newCase.populate('clientMemberId', 'name phone');

    res.status(201).json({ success: true, data: newCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the counselling case. Please try again.');
  }
};

export const updateCounsellingCase = async (req: AuthRequest, res: Response) => {
  try {
    // A case number is assigned once, by the server.
    const updateData: Record<string, any> = stripImmutable(req.body);
    delete updateData.caseNo;
    if (!(await linkedRecordsOk(req, res, [[Member, updateData.clientMemberId, 'member']]))) return;

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

    if (!req.tenantId) return res.status(400).json(NO_MAHALLU);

    const newCase = await createCase(DisputeCase, String(req.tenantId), 'MSL', {
      type,
      parties,
      description,
      mediators: mediators || [],
      status: 'registered',
    });

    res.status(201).json({ success: true, data: newCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the dispute case. Please try again.');
  }
};

export const updateDisputeCase = async (req: AuthRequest, res: Response) => {
  try {
    // A case number is assigned once, by the server.
    const updateData: Record<string, any> = stripImmutable(req.body);
    delete updateData.caseNo;

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

    if (!req.tenantId) return res.status(400).json(NO_MAHALLU);
    if (!(await linkedRecordsOk(req, res, [
      [Member, deceasedMemberId, 'member'],
      [DeathRegistration, deathRegistrationId, 'death registration'],
    ]))) return;

    const newCase = await createCase(InheritanceCase, String(req.tenantId), 'INH', {
      deceasedMemberId: deceasedMemberId || undefined,
      deceasedName: deceasedName || undefined,
      deathRegistrationId: deathRegistrationId || undefined,
      heirs,
      status: 'reported',
    });
    await newCase.populate('deceasedMemberId', 'name');

    res.status(201).json({ success: true, data: newCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the inheritance case. Please try again.');
  }
};

export const updateInheritanceCase = async (req: AuthRequest, res: Response) => {
  try {
    // A case number is assigned once, by the server.
    const updateData: Record<string, any> = stripImmutable(req.body);
    delete updateData.caseNo;
    if (!(await linkedRecordsOk(req, res, [
      [Member, updateData.deceasedMemberId, 'member'],
      [DeathRegistration, updateData.deathRegistrationId, 'death registration'],
    ]))) return;

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
