import { Response } from 'express';
import mongoose from 'mongoose';
import {
  MarriageAssistance,
  MARRIAGE_ASSISTANCE_STATUSES,
  MARRIAGE_ASSISTANCE_TRANSITIONS,
  MARRIAGE_ASSISTANCE_INITIAL_STATUS,
  MarriageAssistanceStatus,
} from '../models/MarriageAssistance';
import Member from '../models/Member';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
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

const tenantScope = (req: AuthRequest) => {
  if (req.tenantId) return req.tenantId;
  if (req.isSuperAdmin && req.query.tenantId) return req.query.tenantId as string;
  return undefined;
};

const scopedQuery = (req: AuthRequest): Record<string, any> => {
  const tenantId = tenantScope(req);
  return tenantId ? { tenantId } : {};
};

const NOT_FOUND = "We couldn't find that assistance record. It may have been removed.";
const CHANGED = 'This request was changed by someone else a moment ago. Please refresh and try again.';

/** What a new request may carry. Status is always `requested`. */
const CREATE_FIELDS = ['memberId', 'familyId', 'type', 'amount', 'notes'] as const;

/** Details editable through the generic update (the amount is checked separately). */
const DETAIL_FIELDS = ['memberId', 'familyId', 'type', 'notes'] as const;

export const getAllAssistances = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, type, search, memberId, familyId } = req.query;
    const query: any = scopedQuery(req);

    if (status) query.status = status;
    if (type) query.type = type;
    if (memberId) query.memberId = memberId;
    if (familyId) query.familyId = familyId;
    if (search) query.notes = { $regex: regexLiteral(search), $options: 'i' };

    const [data, total] = await Promise.all([
      MarriageAssistance.find(query)
        .populate('memberId', 'name phone')
        .populate('familyId', 'houseName familyHead contactNo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MarriageAssistance.countDocuments(query),
    ]);

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the assistances right now. Please try again.');
  }
};

export const getAssistanceById = async (req: AuthRequest, res: Response) => {
  try {
    const assistance = await MarriageAssistance.findById(req.params.id)
      .populate('memberId', 'name phone gender')
      .populate('familyId', 'houseName familyHead contactNo area');

    if (
      !assistance ||
      (req.tenantId && assistance.tenantId.toString() !== req.tenantId)
    ) {
      return res
        .status(404)
        .json({ success: false, message: "We couldn't find that assistance record. It may have been removed." });
    }

    res.json({ success: true, data: assistance });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the assistance right now. Please try again.');
  }
};

export const createAssistance = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return sendInvalid(res, 'Please select a Mahallu before continuing.');

    const { memberId, familyId } = req.body;
    if (!memberId && !familyId) {
      return sendInvalid(res, 'Please choose a member or a family.');
    }

    // Validate tenant scope if IDs provided
    if (memberId) {
      const member = await Member.findById(memberId);
      if (!member || member.tenantId.toString() !== tenantId.toString()) {
        return sendInvalid(res, 'This member belongs to another Mahallu.');
      }
    }

    if (familyId) {
      const family = await Family.findById(familyId);
      if (!family || family.tenantId.toString() !== tenantId.toString()) {
        return sendInvalid(res, 'This family belongs to another Mahallu.');
      }
    }

    // A request always starts as `requested`; approval and completion go through the status endpoint.
    const assistance = await MarriageAssistance.create({
      ...pick(req.body, CREATE_FIELDS),
      tenantId,
      status: MARRIAGE_ASSISTANCE_INITIAL_STATUS,
    });

    await assistance.populate('memberId', 'name phone');
    await assistance.populate('familyId', 'houseName familyHead contactNo');

    res.status(201).json({ success: true, data: assistance });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the assistance. Please try again.');
  }
};

export const updateAssistance = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const existing = await MarriageAssistance.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return sendNotFound(res, NOT_FOUND);
    }

    // Validate referenced records if updating member/family
    if (req.body.memberId && req.body.memberId !== existing.memberId?.toString()) {
      const member = await Member.findById(req.body.memberId);
      if (!member || member.tenantId.toString() !== existing.tenantId.toString()) {
        return sendInvalid(res, 'This member belongs to another Mahallu.');
      }
    }

    if (req.body.familyId && req.body.familyId !== existing.familyId?.toString()) {
      const family = await Family.findById(req.body.familyId);
      if (!family || family.tenantId.toString() !== existing.tenantId.toString()) {
        return sendInvalid(res, 'This family belongs to another Mahallu.');
      }
    }

    // `status` is deliberately not in the allow-list: a PUT can never skip the transition map.
    const payload = pick(req.body, DETAIL_FIELDS);

    // The amount is what gets paid out: it can be corrected while the request is still open.
    if (differs(req.body.amount, existing.amount)) {
      if (existing.status !== MARRIAGE_ASSISTANCE_INITIAL_STATUS) {
        return sendConflict(res, `The amount can't be changed once a request is ${existing.status}.`);
      }
      if (!isMoney(req.body.amount) || Number(req.body.amount) < 0 || Number(req.body.amount) > MAX_AMOUNT) {
        return sendInvalid(res, 'Please enter a valid amount, with at most 2 decimals.');
      }
      payload.amount = round2(Number(req.body.amount));
    }

    const assistance = await MarriageAssistance.findOneAndUpdate(
      { _id: req.params.id, tenantId: existing.tenantId, status: existing.status },
      { $set: payload },
      { new: true, runValidators: true }
    )
      .populate('memberId', 'name phone')
      .populate('familyId', 'houseName familyHead contactNo');
    if (!assistance) return sendConflict(res, CHANGED);

    res.json({ success: true, data: assistance });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the assistance. Please try again.');
  }
};

/**
 * The only way an assistance request changes status. The move is checked against
 * MARRIAGE_ASSISTANCE_TRANSITIONS and applied with a conditional update on the status that was
 * read, so a request can't be approved or completed twice.
 */
export const updateAssistanceStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;

    const newStatus = req.body.status as MarriageAssistanceStatus;
    if (!MARRIAGE_ASSISTANCE_STATUSES.includes(newStatus)) {
      return sendInvalid(res, 'Please choose a valid status.');
    }
    const notes = req.body.notes;
    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
      return sendInvalid(res, 'Please keep the notes to 2000 characters or less.');
    }

    const existing = await MarriageAssistance.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return sendNotFound(res, NOT_FOUND);
    }

    // Validate transition
    const allowedTransitions = MARRIAGE_ASSISTANCE_TRANSITIONS[existing.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      return sendConflict(res, `This can't be moved from ${existing.status} to ${newStatus}.`);
    }

    const set: Record<string, any> = { status: newStatus };
    if (typeof notes === 'string' && notes.trim()) set.notes = notes.trim();

    const updated = await MarriageAssistance.findOneAndUpdate(
      { _id: req.params.id, tenantId: existing.tenantId, status: existing.status },
      { $set: set },
      { new: true, runValidators: true }
    )
      .populate('memberId', 'name phone')
      .populate('familyId', 'houseName familyHead contactNo');
    if (!updated) {
      return sendConflict(res, 'This request has already been processed or changed. Please refresh and try again.');
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the assistance status. Please try again.');
  }
};

export const deleteAssistance = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const existing = await MarriageAssistance.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return sendNotFound(res, NOT_FOUND);
    }

    // A completed request is a record of assistance that was given.
    if (existing.status === 'completed') {
      return sendConflict(res, "A completed request is kept on record and can't be deleted.");
    }

    const deleted = await MarriageAssistance.findOneAndDelete({
      _id: existing._id,
      tenantId: existing.tenantId,
      status: { $ne: 'completed' },
    });
    if (!deleted) return sendConflict(res, CHANGED);

    res.json({ success: true, message: 'Assistance record deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the assistance. Please try again.');
  }
};
