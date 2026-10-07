import { Response } from 'express';
import mongoose from 'mongoose';
import ReliefCase, {
  RELIEF_TRANSITIONS,
  RELIEF_STATUSES,
  RELIEF_MONEY_LOCKED_STATUSES,
  ReliefStatus,
} from '../models/ReliefCase';
import Member from '../models/Member';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { refBelongsToTenant } from '../utils/sanitizeUpdate';
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

const NOT_FOUND = "We couldn't find that relief case. It may have been removed.";
const CHANGED = 'This case was changed by someone else a moment ago. Please refresh and try again.';

/** What a report may carry. Assistance, amount and status are recorded later, by the status endpoint. */
const CREATE_FIELDS = [
  'familyId',
  'memberId',
  'title',
  'titleMl',
  'description',
  'urgency',
  'followUpDate',
  'notes',
] as const;

/** Details editable at any state. The amount is checked separately; status is never here. */
const DETAIL_FIELDS = [
  'familyId',
  'memberId',
  'title',
  'titleMl',
  'description',
  'urgency',
  'assistanceGiven',
  'followUpDate',
  'notes',
] as const;

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

/** Confirm any member/family reference on the body belongs to the caller's tenant. */
const validateRefs = async (req: AuthRequest): Promise<string | null> => {
  const { memberId, familyId } = req.body;
  if (memberId && !(await refBelongsToTenant(Member, memberId, req.tenantId))) {
    return 'This member belongs to another Mahallu.';
  }
  if (familyId && !(await refBelongsToTenant(Family, familyId, req.tenantId))) {
    return 'Family does not belong to this Mahallu';
  }
  return null;
};

export const getAllReliefCases = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.status) query.status = req.query.status;
    if (req.query.urgency) query.urgency = req.query.urgency;
    if (req.query.familyId) query.familyId = req.query.familyId;
    if (req.query.search) query.title = { $regex: regexLiteral(String(req.query.search)), $options: 'i' };

    const [cases, total] = await Promise.all([
      ReliefCase.find(query)
        .populate('memberId', 'name nameMl contactNo')
        .populate('familyId', 'houseName mahallId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ReliefCase.countDocuments(query),
    ]);

    res.json(createPaginationResponse(cases, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the relief cases right now. Please try again.');
  }
};

export const getReliefCaseById = async (req: AuthRequest, res: Response) => {
  try {
    const reliefCase = await ReliefCase.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate('memberId', 'name nameMl contactNo')
      .populate('familyId', 'houseName mahallId');

    if (!reliefCase) {
      return res.status(404).json({ success: false, message: "We couldn't find that relief case. It may have been removed." });
    }
    res.json({ success: true, data: reliefCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the relief case right now. Please try again.');
  }
};

export const createReliefCase = async (req: AuthRequest, res: Response) => {
  try {
    const refError = await validateRefs(req);
    if (refError) {
      return sendInvalid(res, refError);
    }

    // Every case starts at `reported`; verification is a separate step. Only the report itself is
    // taken from the body: assistance, amount and status are recorded by the status endpoint.
    const reliefCase = await ReliefCase.create({
      ...pick(req.body, CREATE_FIELDS),
      tenantId: req.tenantId,
      status: 'reported',
    });

    res.status(201).json({ success: true, data: reliefCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the relief case. Please try again.');
  }
};

export const updateReliefCase = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const existing = await ReliefCase.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return sendNotFound(res, NOT_FOUND);
    }

    const refError = await validateRefs(req);
    if (refError) {
      return sendInvalid(res, refError);
    }

    // Status moves only through the dedicated endpoint (it is not in the allow-list).
    const payload = pick(req.body, DETAIL_FIELDS);

    // Once assistance has been given the amount is a fact about money that left the Mahallu.
    if (differs(req.body.amount, existing.amount)) {
      if (RELIEF_MONEY_LOCKED_STATUSES.includes(existing.status)) {
        return sendConflict(res, `The amount can't be changed once a case is ${existing.status}.`);
      }
      if (!isMoney(req.body.amount) || !(Number(req.body.amount) > 0) || Number(req.body.amount) > MAX_AMOUNT) {
        return sendInvalid(res, 'Please enter a valid amount, with at most 2 decimals.');
      }
      payload.amount = round2(Number(req.body.amount));
    }

    const reliefCase = await ReliefCase.findOneAndUpdate(
      { _id: req.params.id, tenantId: existing.tenantId, status: existing.status },
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!reliefCase) return sendConflict(res, CHANGED);

    res.json({ success: true, data: reliefCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the relief case. Please try again.');
  }
};

export const updateReliefStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const { status, assistanceGiven, amount, followUpDate, notes } = req.body;

    if (!RELIEF_STATUSES.includes(status)) {
      return sendInvalid(res, 'Please choose a valid status.');
    }
    for (const [text, max] of [
      [assistanceGiven, 500],
      [notes, 2000],
    ] as Array<[unknown, number]>) {
      if (text !== undefined && text !== null && (typeof text !== 'string' || text.length > max)) {
        return sendInvalid(res, `Please keep the text to ${max} characters or less.`);
      }
    }
    if (
      amount !== undefined &&
      amount !== null &&
      amount !== '' &&
      (!isMoney(amount) || !(Number(amount) > 0) || Number(amount) > MAX_AMOUNT)
    ) {
      return sendInvalid(res, 'Please enter a valid amount, with at most 2 decimals.');
    }
    let followUp: Date | undefined;
    if (followUpDate !== undefined && followUpDate !== null && followUpDate !== '') {
      followUp = new Date(followUpDate);
      if (Number.isNaN(followUp.getTime())) return sendInvalid(res, 'Please choose a valid follow-up date.');
    }

    const reliefCase = await ReliefCase.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!reliefCase) {
      return sendNotFound(res, NOT_FOUND);
    }

    const next = status as ReliefStatus;
    const allowed = RELIEF_TRANSITIONS[reliefCase.status] || [];
    if (!allowed.includes(next)) {
      return sendConflict(
        res,
        `Cannot move a relief case from ${reliefCase.status} to ${next}. Allowed: ${
          allowed.join(', ') || 'none'
        }`
      );
    }

    if (next === 'assisted' && !assistanceGiven && !reliefCase.assistanceGiven) {
      return sendInvalid(
        res,
        'Please record what assistance was given before marking this case as assisted.'
      );
    }

    const set: Record<string, any> = { status: next };
    if (assistanceGiven !== undefined) set.assistanceGiven = assistanceGiven;
    if (amount !== undefined && amount !== null && amount !== '') {
      // The amount is fixed once assistance has been given.
      if (RELIEF_MONEY_LOCKED_STATUSES.includes(reliefCase.status) && differs(amount, reliefCase.amount)) {
        return sendConflict(res, `The amount can't be changed once a case is ${reliefCase.status}.`);
      }
      set.amount = round2(Number(amount));
    }
    if (followUp) set.followUpDate = followUp;
    if (notes !== undefined) set.notes = notes;

    const updated = await ReliefCase.findOneAndUpdate(
      { _id: req.params.id, tenantId: reliefCase.tenantId, status: reliefCase.status },
      { $set: set },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return sendConflict(res, 'This case has already been processed or changed. Please refresh and try again.');
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the relief status. Please try again.');
  }
};

export const deleteReliefCase = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const existing = await ReliefCase.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return sendNotFound(res, NOT_FOUND);
    }

    // Assistance already given is a record of money that left the Mahallu: it stays.
    const assistanceRecorded =
      existing.status === 'assisted' ||
      (existing.status === 'closed' && (Number(existing.amount) > 0 || !!existing.assistanceGiven));
    if (assistanceRecorded) {
      return sendConflict(res, "A case where assistance was given is kept on record and can't be deleted.");
    }

    const deleted = await ReliefCase.findOneAndDelete({
      _id: existing._id,
      tenantId: existing.tenantId,
      status: existing.status,
    });
    if (!deleted) return sendConflict(res, CHANGED);
    res.json({ success: true, message: 'Relief case deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the relief case. Please try again.');
  }
};

export const getReliefSummary = async (req: AuthRequest, res: Response) => {
  try {
    const match: any = {};
    // Aggregation does not cast strings to ObjectId the way find() does.
    if (req.tenantId) match.tenantId = new mongoose.Types.ObjectId(req.tenantId);

    const [byStatus, byUrgency, assisted] = await Promise.all([
      ReliefCase.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      ReliefCase.aggregate([{ $match: match }, { $group: { _id: '$urgency', count: { $sum: 1 } } }]),
      ReliefCase.aggregate([
        { $match: { ...match, status: { $in: ['assisted', 'closed'] } } },
        { $group: { _id: null, totalAmount: { $sum: '$amount' }, cases: { $sum: 1 } } },
      ]),
    ]);

    const tally = (rows: Array<{ _id: string; count: number }>) =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {});

    const statusCounts = tally(byStatus);
    const urgencyCounts = tally(byUrgency);

    res.json({
      success: true,
      data: {
        openCases:
          (statusCounts.reported ?? 0) + (statusCounts.verified ?? 0) + (statusCounts.approved ?? 0),
        criticalCases: urgencyCounts.critical ?? 0,
        assistedCases: assisted[0]?.cases ?? 0,
        totalAssistance: assisted[0]?.totalAmount ?? 0,
        byStatus: statusCounts,
        byUrgency: urgencyCounts,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the relief summary right now. Please try again.');
  }
};
