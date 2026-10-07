import { Response } from 'express';
import mongoose from 'mongoose';
import {
  Scholarship,
  ScholarshipAward,
  AcademicSupportCase,
  AwardStatus,
  AWARD_STATUSES,
  AWARD_TRANSITIONS,
  AWARD_INITIAL_STATUS,
  AWARD_LOCKED_STATUSES,
} from '../models/Scholarship';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';
import {
  round2,
  isMoney,
  pick,
  differs,
  requireMahallWriter,
  sendConflict,
  sendInvalid,
  sendNotFound,
} from '../utils/workflow';
import { MAX_AMOUNT } from '../validations/common';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

const AWARD_NOT_FOUND = "We couldn't find that award. It may have been removed.";
const AWARD_CHANGED = 'This award was changed by someone else a moment ago. Please refresh and try again.';

/** What a new award may carry. Status is always the initial one; it is never taken from the body. */
const AWARD_CREATE_FIELDS = ['scholarshipId', 'memberId', 'awardedDate', 'amount', 'remarks'] as const;

/** Details editable at any state. */
const AWARD_DETAIL_FIELDS = ['awardedDate', 'remarks'] as const;

/** Fixed once an award is approved: who gets how much, from which scholarship. */
const AWARD_LOCKED_FIELDS = ['amount', 'memberId', 'scholarshipId'] as const;

/** Validate member reference belongs to tenant */
const validateMemberRef = async (req: AuthRequest): Promise<string | null> => {
  const { memberId } = req.body;
  if (memberId && !(await refBelongsToTenant(Member, memberId, req.tenantId))) {
    return 'This member belongs to another Mahallu.';
  }
  return null;
};

/** Validate scholarship reference belongs to tenant */
const validateScholarshipRef = async (req: AuthRequest): Promise<string | null> => {
  const { scholarshipId } = req.body;
  if (scholarshipId && !(await refBelongsToTenant(Scholarship, scholarshipId, req.tenantId))) {
    return 'Scholarship does not belong to this Mahallu';
  }
  return null;
};

// ===== SCHOLARSHIPS CRUD =====

export const getAllScholarships = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.academicYear) query.academicYear = req.query.academicYear;
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) query.name = { $regex: regexLiteral(String(req.query.search)), $options: 'i' };

    const [scholarships, total] = await Promise.all([
      Scholarship.find(query)
        .sort({ academicYear: -1, name: 1 })
        .skip(skip)
        .limit(limit),
      Scholarship.countDocuments(query),
    ]);

    res.json(createPaginationResponse(scholarships, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the scholarships right now. Please try again.');
  }
};

export const getScholarshipById = async (req: AuthRequest, res: Response) => {
  try {
    const scholarship = await Scholarship.findOne({ _id: req.params.id, ...tenantScope(req) });

    if (!scholarship) {
      return res.status(404).json({ success: false, message: "We couldn't find that scholarship. It may have been removed." });
    }

    res.json({ success: true, data: scholarship });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the scholarship right now. Please try again.');
  }
};

export const createScholarship = async (req: AuthRequest, res: Response) => {
  try {
    const scholarship = await Scholarship.create({
      ...stripImmutable(req.body),
      tenantId: req.tenantId,
    });
    res.status(201).json({ success: true, data: scholarship });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the scholarship. Please try again.');
  }
};

export const updateScholarship = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Scholarship.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that scholarship. It may have been removed." });
    }

    const scholarship = await Scholarship.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: scholarship });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the scholarship. Please try again.');
  }
};

export const deleteScholarship = async (req: AuthRequest, res: Response) => {
  try {
    const scholarship = await Scholarship.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!scholarship) {
      return res.status(404).json({ success: false, message: "We couldn't find that scholarship. It may have been removed." });
    }

    const awardCount = await ScholarshipAward.countDocuments({ scholarshipId: scholarship._id });
    if (awardCount > 0) {
      return res.status(400).json({
        success: false,
        message: `This scholarship has ${awardCount} award(s), so it can't be deleted. Please mark it closed instead.`,
      });
    }

    await Scholarship.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Scholarship deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the scholarship. Please try again.');
  }
};

// ===== SCHOLARSHIP AWARDS CRUD =====

export const getAllAwards = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.scholarshipId) query.scholarshipId = req.query.scholarshipId;
    if (req.query.status) query.status = req.query.status;
    if (req.query.memberId) query.memberId = req.query.memberId;

    const [awards, total] = await Promise.all([
      ScholarshipAward.find(query)
        .populate('scholarshipId', 'name amount academicYear')
        .populate('memberId', 'name nameMl contactNo')
        .sort({ awardedDate: -1 })
        .skip(skip)
        .limit(limit),
      ScholarshipAward.countDocuments(query),
    ]);

    res.json(createPaginationResponse(awards, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the awards right now. Please try again.');
  }
};

export const getAwardsByScholarship = async (req: AuthRequest, res: Response) => {
  try {
    const { id: scholarshipId } = req.params;
    const { page, limit, skip } = getPaginationParams(req);

    const scholarship = await Scholarship.findOne({
      _id: scholarshipId,
      ...tenantScope(req),
    });

    if (!scholarship) {
      return res.status(404).json({ success: false, message: "We couldn't find that scholarship. It may have been removed." });
    }

    const [awards, total] = await Promise.all([
      ScholarshipAward.find({
        scholarshipId,
        ...tenantScope(req),
      })
        .populate('memberId', 'name nameMl contactNo')
        .sort({ awardedDate: -1 })
        .skip(skip)
        .limit(limit),
      ScholarshipAward.countDocuments({
        scholarshipId,
        ...tenantScope(req),
      }),
    ]);

    res.json(createPaginationResponse(awards, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the awards right now. Please try again.');
  }
};

export const createAward = async (req: AuthRequest, res: Response) => {
  try {
    const memberError = await validateMemberRef(req);
    if (memberError) {
      return sendInvalid(res, memberError);
    }

    const scholarshipError = await validateScholarshipRef(req);
    if (scholarshipError) {
      return sendInvalid(res, scholarshipError);
    }

    // A new award is always `applied`, whatever `status` the body carried: approval and payment
    // are separate steps with their own transition rules.
    const award = await ScholarshipAward.create({
      ...pick(req.body, AWARD_CREATE_FIELDS),
      tenantId: req.tenantId,
      status: AWARD_INITIAL_STATUS,
    });

    const populated = await ScholarshipAward.findById(award._id)
      .populate('scholarshipId', 'name amount academicYear')
      .populate('memberId', 'name nameMl contactNo');

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the award. Please try again.');
  }
};

export const updateAward = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const existing = await ScholarshipAward.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return sendNotFound(res, AWARD_NOT_FOUND);
    }

    // A status in the body is a transition request: it must be a legal move (the same status is a
    // harmless no-op, so a form that sends the whole record back still works).
    const requested = req.body.status;
    let moving: AwardStatus | undefined;
    if (requested !== undefined && requested !== null && requested !== '' && requested !== existing.status) {
      if (!AWARD_STATUSES.includes(requested)) {
        return sendInvalid(res, 'Please choose a valid status.');
      }
      if (!AWARD_TRANSITIONS[existing.status]?.includes(requested)) {
        return sendConflict(res, `This can't be moved from ${existing.status} to ${requested}.`);
      }
      moving = requested as AwardStatus;
    }

    // Amount and beneficiary are fixed once the award is approved.
    const changedLocked = AWARD_LOCKED_FIELDS.filter((field) => differs(req.body[field], (existing as any)[field]));
    if (changedLocked.length > 0 && AWARD_LOCKED_STATUSES.includes(existing.status)) {
      return sendConflict(
        res,
        `The amount, student and scholarship can't be changed once an award is ${existing.status}.`
      );
    }
    if (differs(req.body.amount, existing.amount)) {
      const amount = req.body.amount;
      if (!isMoney(amount) || !(Number(amount) > 0) || Number(amount) > MAX_AMOUNT) {
        return sendInvalid(res, 'Please enter a valid amount, with at most 2 decimals.');
      }
    }

    const memberError = await validateMemberRef(req);
    if (memberError) {
      return sendInvalid(res, memberError);
    }

    const scholarshipError = await validateScholarshipRef(req);
    if (scholarshipError) {
      return sendInvalid(res, scholarshipError);
    }

    const payload: Record<string, any> = pick(req.body, AWARD_DETAIL_FIELDS);
    for (const field of changedLocked) {
      payload[field] = field === 'amount' ? round2(Number(req.body.amount)) : req.body[field];
    }
    if (moving) payload.status = moving;

    // The status that was read is part of the filter, so an edit can't overwrite an award that
    // was approved or paid a moment ago, and two requests can't both make the same move.
    const award = await ScholarshipAward.findOneAndUpdate(
      { _id: req.params.id, tenantId: existing.tenantId, status: existing.status },
      { $set: payload },
      { new: true, runValidators: true }
    )
      .populate('scholarshipId', 'name amount academicYear')
      .populate('memberId', 'name nameMl contactNo');
    if (!award) return sendConflict(res, AWARD_CHANGED);

    res.json({ success: true, data: award });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the award. Please try again.');
  }
};

/** The explicit transition endpoint: applied -> approved -> paid, each move claimed atomically. */
export const updateAwardStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const next = req.body.status;
    if (!AWARD_STATUSES.includes(next)) {
      return sendInvalid(res, 'Please choose a valid status.');
    }
    const remarks = req.body.remarks;
    if (remarks !== undefined && remarks !== null && (typeof remarks !== 'string' || remarks.length > 500)) {
      return sendInvalid(res, 'Please keep the remarks to 500 characters or less.');
    }

    const existing = await ScholarshipAward.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return sendNotFound(res, AWARD_NOT_FOUND);
    }
    if (!AWARD_TRANSITIONS[existing.status]?.includes(next)) {
      return sendConflict(res, `This can't be moved from ${existing.status} to ${next}.`);
    }

    const set: Record<string, any> = { status: next };
    if (typeof remarks === 'string' && remarks.trim()) set.remarks = remarks.trim();

    const award = await ScholarshipAward.findOneAndUpdate(
      { _id: req.params.id, tenantId: existing.tenantId, status: existing.status },
      { $set: set },
      { new: true, runValidators: true }
    )
      .populate('scholarshipId', 'name amount academicYear')
      .populate('memberId', 'name nameMl contactNo');
    if (!award) {
      return sendConflict(res, 'This award has already been processed or changed. Please refresh and try again.');
    }

    res.json({ success: true, data: award });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the award status. Please try again.');
  }
};

export const deleteAward = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const award = await ScholarshipAward.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!award) {
      return sendNotFound(res, AWARD_NOT_FOUND);
    }

    // A paid award is a record of money that left the Mahallu.
    if (award.status === 'paid') {
      return sendConflict(res, "A paid award is kept on record and can't be deleted.");
    }

    const deleted = await ScholarshipAward.findOneAndDelete({
      _id: award._id,
      tenantId: award.tenantId,
      status: { $ne: 'paid' },
    });
    if (!deleted) return sendConflict(res, AWARD_CHANGED);

    res.json({ success: true, message: 'Award deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the award. Please try again.');
  }
};

// ===== ACADEMIC SUPPORT CASES CRUD =====

export const getAllSupportCases = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.type) query.type = req.query.type;
    if (req.query.status) query.status = req.query.status;
    if (req.query.memberId) query.memberId = req.query.memberId;
    if (req.query.search) {
      const search = String(req.query.search);
      const matchingMembers = await Member.find({
        ...tenantScope(req),
        name: { $regex: regexLiteral(search), $options: 'i' },
      }).select('_id');
      query.$or = [
        { description: { $regex: regexLiteral(search), $options: 'i' } },
        { memberId: { $in: matchingMembers.map((m) => m._id) } },
      ];
    }

    const [cases, total] = await Promise.all([
      AcademicSupportCase.find(query)
        .populate('memberId', 'name nameMl contactNo')
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit),
      AcademicSupportCase.countDocuments(query),
    ]);

    res.json(createPaginationResponse(cases, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the support cases right now. Please try again.');
  }
};

export const getSupportCaseById = async (req: AuthRequest, res: Response) => {
  try {
    const supportCase = await AcademicSupportCase.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    }).populate('memberId', 'name nameMl contactNo');

    if (!supportCase) {
      return res.status(404).json({ success: false, message: "We couldn't find that support case. It may have been removed." });
    }

    res.json({ success: true, data: supportCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the support case right now. Please try again.');
  }
};

export const createSupportCase = async (req: AuthRequest, res: Response) => {
  try {
    const memberError = await validateMemberRef(req);
    if (memberError) {
      return res.status(400).json({ success: false, message: memberError });
    }

    const supportCase = await AcademicSupportCase.create({
      ...stripImmutable(req.body),
      tenantId: req.tenantId,
    });

    const populated = await AcademicSupportCase.findById(supportCase._id).populate(
      'memberId',
      'name nameMl contactNo'
    );

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the support case. Please try again.');
  }
};

export const updateSupportCase = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await AcademicSupportCase.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that support case. It may have been removed." });
    }

    const memberError = await validateMemberRef(req);
    if (memberError) {
      return res.status(400).json({ success: false, message: memberError });
    }

    const supportCase = await AcademicSupportCase.findByIdAndUpdate(
      req.params.id,
      stripImmutable(req.body),
      { new: true, runValidators: true }
    ).populate('memberId', 'name nameMl contactNo');

    res.json({ success: true, data: supportCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the support case. Please try again.');
  }
};

export const deleteSupportCase = async (req: AuthRequest, res: Response) => {
  try {
    const supportCase = await AcademicSupportCase.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!supportCase) {
      return res.status(404).json({ success: false, message: "We couldn't find that support case. It may have been removed." });
    }

    await AcademicSupportCase.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Support case deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the support case. Please try again.');
  }
};
