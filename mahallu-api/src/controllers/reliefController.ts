import { Response } from 'express';
import mongoose from 'mongoose';
import ReliefCase, { RELIEF_TRANSITIONS, ReliefStatus } from '../models/ReliefCase';
import Member from '../models/Member';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

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
      return res.status(400).json({ success: false, message: refError });
    }

    // Every case starts at `reported`; verification is a separate step.
    const reliefCase = await ReliefCase.create({
      ...stripImmutable(req.body),
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
    const existing = await ReliefCase.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that relief case. It may have been removed." });
    }

    const refError = await validateRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    // Status moves only through the dedicated endpoint.
    const payload = stripImmutable(req.body);
    delete payload.status;

    const reliefCase = await ReliefCase.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: reliefCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the relief case. Please try again.');
  }
};

export const updateReliefStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, assistanceGiven, amount, followUpDate, notes } = req.body;

    const reliefCase = await ReliefCase.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!reliefCase) {
      return res.status(404).json({ success: false, message: "We couldn't find that relief case. It may have been removed." });
    }

    const next = status as ReliefStatus;
    const allowed = RELIEF_TRANSITIONS[reliefCase.status] || [];
    if (!allowed.includes(next)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move a relief case from ${reliefCase.status} to ${next}. Allowed: ${
          allowed.join(', ') || 'none'
        }`,
      });
    }

    if (next === 'assisted' && !assistanceGiven && !reliefCase.assistanceGiven) {
      return res.status(400).json({
        success: false,
        message: 'Please record what assistance was given before marking this case as assisted.',
      });
    }

    reliefCase.status = next;
    if (assistanceGiven !== undefined) reliefCase.assistanceGiven = assistanceGiven;
    if (amount !== undefined) reliefCase.amount = Number(amount);
    if (followUpDate !== undefined) reliefCase.followUpDate = new Date(followUpDate);
    if (notes !== undefined) reliefCase.notes = notes;
    await reliefCase.save();

    res.json({ success: true, data: reliefCase });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the relief status. Please try again.');
  }
};

export const deleteReliefCase = async (req: AuthRequest, res: Response) => {
  try {
    const reliefCase = await ReliefCase.findOneAndDelete({
      _id: req.params.id,
      ...tenantScope(req),
    });
    if (!reliefCase) {
      return res.status(404).json({ success: false, message: "We couldn't find that relief case. It may have been removed." });
    }
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
