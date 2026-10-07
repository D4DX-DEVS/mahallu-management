import { Response } from 'express';
import mongoose from 'mongoose';
import {
  WelfareScheme,
  WelfareApplication,
  WELFARE_TRANSITIONS,
  WELFARE_STATUSES,
  WELFARE_DISBURSE_METHODS,
  WELFARE_MONEY_EDITABLE_STATUSES,
  WelfareStatus,
} from '../models/Welfare';
import Family from '../models/Family';
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
import { postLedgerEntry } from '../services/ledgerPostingService';

import { sendFailure, logFailure } from '../utils/userMessages';
import { ReconciliationRequiredError, runUndos, sendReconciliationRequired } from '../utils/reconciliation';
import { regexLiteral } from '../utils/queryGuard';

const APPLICATION_NOT_FOUND = "We couldn't find that application. It may have been removed.";
const CHANGED = 'This application was changed by someone else a moment ago. Please refresh and try again.';

/** What a new application may carry. Approval, disbursement and history are server-owned. */
const CREATE_FIELDS = [
  'schemeId',
  'familyId',
  'memberId',
  'requestedAmount',
  'reason',
  'priority',
  'verificationNotes',
] as const;

/** Details editable through the generic update (the requested amount is checked separately). */
const DETAIL_FIELDS = ['schemeId', 'familyId', 'memberId', 'reason', 'priority', 'verificationNotes'] as const;

const tenantScope = (req: AuthRequest) => {
  if (req.tenantId) return req.tenantId;
  if (req.isSuperAdmin && req.query.tenantId) return req.query.tenantId as string;
  return undefined;
};

const scopedQuery = (req: AuthRequest): Record<string, any> => {
  const tenantId = tenantScope(req);
  return tenantId ? { tenantId } : {};
};

// ---------------------------------------------------------------------------
// Schemes
// ---------------------------------------------------------------------------

export const getAllSchemes = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, category, search } = req.query;
    const query: any = scopedQuery(req);
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) query.name = { $regex: regexLiteral(search), $options: 'i' };

    const [data, total] = await Promise.all([
      WelfareScheme.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      WelfareScheme.countDocuments(query),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the schemes right now. Please try again.');
  }
};

export const getSchemeById = async (req: AuthRequest, res: Response) => {
  try {
    const scheme = await WelfareScheme.findById(req.params.id);
    if (!scheme || (req.tenantId && scheme.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that scheme. It may have been removed." });
    }
    res.json({ success: true, data: scheme });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the scheme right now. Please try again.');
  }
};

export const createScheme = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    const scheme = await WelfareScheme.create({ ...stripImmutable(req.body), tenantId });
    res.status(201).json({ success: true, data: scheme });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the scheme. Please try again.');
  }
};

export const updateScheme = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await WelfareScheme.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that scheme. It may have been removed." });
    }
    const scheme = await WelfareScheme.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: scheme });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the scheme. Please try again.');
  }
};

export const deleteScheme = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await WelfareScheme.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that scheme. It may have been removed." });
    }
    const inUse = await WelfareApplication.countDocuments({ schemeId: existing._id });
    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        message: `This scheme has ${inUse} application(s), so it can't be deleted. Please close it instead.`,
      });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Scheme deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the scheme. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export const getAllApplications = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, priority, schemeId, familyId, search } = req.query;
    const query: any = scopedQuery(req);
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (schemeId) query.schemeId = schemeId;
    if (familyId) query.familyId = familyId;
    if (search) query.reason = { $regex: regexLiteral(search), $options: 'i' };

    const [data, total] = await Promise.all([
      WelfareApplication.find(query)
        .populate('schemeId', 'name category')
        .populate('familyId', 'houseName familyHead contactNo')
        .populate('memberId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      WelfareApplication.countDocuments(query),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the applications right now. Please try again.');
  }
};

export const getApplicationById = async (req: AuthRequest, res: Response) => {
  try {
    const application = await WelfareApplication.findById(req.params.id)
      .populate('schemeId', 'name category')
      .populate('familyId', 'houseName familyHead contactNo area')
      .populate('memberId', 'name phone');
    if (!application || (req.tenantId && application.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that application. It may have been removed." });
    }
    res.json({ success: true, data: application });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the application right now. Please try again.');
  }
};

export const createApplication = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return sendInvalid(res, 'Please select a Mahallu before continuing.');

    const scheme = await WelfareScheme.findById(req.body.schemeId);
    if (!scheme || scheme.tenantId.toString() !== tenantId.toString()) {
      return sendInvalid(res, 'Please select a valid scheme.');
    }

    if (!req.body.familyId) {
      return sendInvalid(res, 'Please select a family.');
    }
    if (!(await refBelongsToTenant(Family, req.body.familyId, tenantId))) {
      return sendInvalid(res, 'Please select a valid family.');
    }

    // Only the request itself is taken from the body. Approval, disbursement and history are
    // written by the status endpoint, so a new application can never arrive already approved.
    const application = await WelfareApplication.create({
      ...pick(req.body, CREATE_FIELDS),
      tenantId,
      status: 'pending',
      createdBy: req.user?._id,
      history: [{ status: 'pending', changedAt: new Date(), changedBy: req.user?._id }],
    });

    // Keep the family welfare register in step with the application
    if (application.familyId) {
      await Family.findByIdAndUpdate(application.familyId, { welfareStatus: 'applied' });
    }

    res.status(201).json({ success: true, data: application });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the application. Please try again.');
  }
};

export const updateApplication = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const existing = await WelfareApplication.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return sendNotFound(res, APPLICATION_NOT_FOUND);
    }

    // Status, history and approval/disbursement details move only through the status endpoint.
    // They are not in the allow-list, and an attempt to *change* one is refused rather than ignored.
    const outcomeChange = (['approvedAmount', 'disbursedDate', 'disbursedVia'] as const).filter((field) =>
      differs(req.body[field], (existing as any)[field])
    );
    if (outcomeChange.length > 0) {
      return sendConflict(
        res,
        'The approved amount and disbursement details are set only when the application is approved or disbursed.'
      );
    }

    const payload = pick(req.body, DETAIL_FIELDS);

    // The requested amount is the base of the approval cap and of the posted expense: it can be
    // corrected until the application is approved, and not after.
    if (differs(req.body.requestedAmount, existing.requestedAmount)) {
      if (!WELFARE_MONEY_EDITABLE_STATUSES.includes(existing.status)) {
        return sendConflict(
          res,
          `The requested amount can't be changed once an application is ${existing.status}.`
        );
      }
      if (!isMoney(req.body.requestedAmount) || !(Number(req.body.requestedAmount) > 0) || Number(req.body.requestedAmount) > MAX_AMOUNT) {
        return sendInvalid(res, 'Please enter a valid requested amount, with at most 2 decimals.');
      }
      payload.requestedAmount = round2(Number(req.body.requestedAmount));
    }

    if (
      !(await refBelongsToTenant(Family, payload.familyId, existing.tenantId)) ||
      !(await refBelongsToTenant(WelfareScheme, payload.schemeId, existing.tenantId))
    ) {
      return sendInvalid(res, 'Please select a valid family and scheme.');
    }

    // The status is part of the filter: an edit that races a transition fails instead of
    // overwriting the money of an application that was just approved.
    const application = await WelfareApplication.findOneAndUpdate(
      { _id: req.params.id, tenantId: existing.tenantId, status: existing.status },
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!application) return sendConflict(res, CHANGED);

    res.json({ success: true, data: application });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the application. Please try again.');
  }
};

/**
 * Status machine (spec 7.6): pending -> verified -> approved -> disbursed -> closed,
 * with rejection allowed until disbursement. Skipping a step is a 409.
 *
 * Each move is claimed with one conditional update on the status that was read. For a ledger
 * disbursement the claim comes FIRST and the expense entry second: two concurrent requests can
 * only post once, and if posting fails the claim is handed back so the application is not left
 * "disbursed" with nothing in the books.
 */
export const updateApplicationStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const { status, approvedAmount, override, note, verificationNotes, disbursedDate, disbursedVia } =
      req.body;

    if (!WELFARE_STATUSES.includes(status)) {
      return sendInvalid(res, 'Please choose a valid status.');
    }
    const nextStatus = status as WelfareStatus;
    if (override !== undefined && typeof override !== 'boolean') {
      return sendInvalid(res, 'Please choose yes or no for approving more than requested.');
    }
    if (disbursedVia !== undefined && !WELFARE_DISBURSE_METHODS.includes(disbursedVia)) {
      return sendInvalid(res, 'Please choose a valid payment method.');
    }
    for (const text of [note, verificationNotes]) {
      if (text !== undefined && text !== null && (typeof text !== 'string' || text.length > 2000)) {
        return sendInvalid(res, 'Please keep the notes to 2000 characters or less.');
      }
    }

    const application = await WelfareApplication.findById(req.params.id);

    if (!application || (req.tenantId && application.tenantId.toString() !== req.tenantId)) {
      return sendNotFound(res, APPLICATION_NOT_FOUND);
    }

    const allowed = WELFARE_TRANSITIONS[application.status] || [];
    if (!allowed.includes(nextStatus)) {
      return sendConflict(res, `This can't be moved from ${application.status} to ${nextStatus}.`);
    }

    const set: Record<string, any> = { status: nextStatus };

    if (nextStatus === 'approved') {
      const amount =
        approvedAmount === undefined || approvedAmount === null || approvedAmount === ''
          ? application.requestedAmount
          : approvedAmount;
      if (!isMoney(amount) || !(Number(amount) > 0) || Number(amount) > MAX_AMOUNT) {
        return sendInvalid(
          res,
          'Please enter an approved amount greater than zero, with at most 2 decimals.'
        );
      }
      if (Number(amount) > application.requestedAmount && override !== true) {
        return sendInvalid(res, 'The approved amount is more than the amount requested.');
      }
      set.approvedAmount = round2(Number(amount));
    }

    if (nextStatus === 'verified' && typeof verificationNotes === 'string' && verificationNotes) {
      set.verificationNotes = verificationNotes;
    }

    if (nextStatus === 'disbursed') {
      const when = disbursedDate ? new Date(disbursedDate) : new Date();
      if (Number.isNaN(when.getTime())) {
        return sendInvalid(res, 'Please choose a valid disbursement date.');
      }
      set.disbursedDate = when;
      set.disbursedVia = disbursedVia || 'cash';
    }

    const entry = {
      status: nextStatus,
      changedAt: new Date(),
      changedBy: req.user?._id,
      note: typeof note === 'string' && note ? note : undefined,
    };

    const claimed = await WelfareApplication.findOneAndUpdate(
      { _id: req.params.id, tenantId: application.tenantId, status: application.status },
      { $set: set, $push: { history: entry } },
      { new: true, runValidators: true }
    );
    if (!claimed) {
      return sendConflict(res, 'This application has already been processed or changed. Please refresh and try again.');
    }

    if (nextStatus === 'disbursed') {
      if (claimed.disbursedVia === 'ledger') {
        try {
          // Disbursement through finance leaves an auditable expense entry. The entry is keyed on
          // (source, sourceId) = this application, so a retry never duplicates it.
          await postLedgerEntry({
            tenantId: claimed.tenantId,
            ledgerName: 'Welfare Disbursement',
            ledgerType: 'expense',
            amount: claimed.approvedAmount || claimed.requestedAmount,
            description: `Welfare disbursement for application ${claimed._id}`,
            date: claimed.disbursedDate as Date,
            source: 'welfare',
            sourceId: claimed._id as mongoose.Types.ObjectId,
            paymentMethod: 'ledger',
          });
        } catch (error: any) {
          const { failed } = await runUndos(
            { flow: 'welfare disbursement', entity: 'WelfareApplication', entityId: claimed._id, tenantId: claimed.tenantId, state: { applicationStatus: 'disbursed', ledgerPosted: false } },
            [
              {
                label: 'revert disbursed status',
                undo: () =>
                  WelfareApplication.findOneAndUpdate(
                    { _id: claimed._id, tenantId: claimed.tenantId, status: 'disbursed' },
                    {
                      $set: { status: 'approved' },
                      $unset: { disbursedDate: 1, disbursedVia: 1 },
                      $pull: { history: { status: 'disbursed', changedAt: entry.changedAt } },
                    }
                  ),
              },
            ],
            error
          );
          // Plain, fixed copy: the ledger's own error text stays in the server log.
          logFailure('PUT welfare disbursement', error);
          // Marked disbursed with nothing in the ledger (or a half-posted ledger): an administrator must look.
          if (failed.length > 0 || error instanceof ReconciliationRequiredError) return sendReconciliationRequired(res);
          return res.status(500).json({
            success: false,
            message:
              "We couldn't record the disbursement in the ledger, so the application is still approved. Please try again.",
          });
        }
      }

      if (claimed.familyId) {
        try {
          await Family.findByIdAndUpdate(claimed.familyId, { welfareStatus: 'receiving' });
        } catch (error) {
          console.error(`[welfare] could not update the family register for application ${String(claimed._id)}`);
        }
      }
    }

    res.json({ success: true, data: claimed });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the application status. Please try again.');
  }
};

export const deleteApplication = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const existing = await WelfareApplication.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return sendNotFound(res, APPLICATION_NOT_FOUND);
    }
    if (existing.status === 'disbursed' || existing.status === 'closed') {
      return sendConflict(res, "Disbursed applications are kept on record and can't be deleted.");
    }
    // Status in the filter: a disbursement that lands right now turns this into a no-op.
    const deleted = await WelfareApplication.findOneAndDelete({
      _id: existing._id,
      tenantId: existing.tenantId,
      status: { $nin: ['disbursed', 'closed'] },
    });
    if (!deleted) return sendConflict(res, CHANGED);
    res.json({ success: true, message: 'Application deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the application. Please try again.');
  }
};

/** Card counts for the applications list. */
export const getWelfareSummary = async (req: AuthRequest, res: Response) => {
  try {
    const query = scopedQuery(req);
    const [total, pending, approved, disbursed, disbursedTotal] = await Promise.all([
      WelfareApplication.countDocuments(query),
      WelfareApplication.countDocuments({ ...query, status: 'pending' }),
      WelfareApplication.countDocuments({ ...query, status: 'approved' }),
      WelfareApplication.countDocuments({ ...query, status: { $in: ['disbursed', 'closed'] } }),
      WelfareApplication.aggregate([
        // aggregate does not cast strings, so the tenant id must be an ObjectId here
        {
          $match: {
            ...(query.tenantId ? { tenantId: new mongoose.Types.ObjectId(query.tenantId) } : {}),
            status: { $in: ['disbursed', 'closed'] },
          },
        },
        { $group: { _id: null, sum: { $sum: '$approvedAmount' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        disbursed,
        disbursedAmount: disbursedTotal[0]?.sum || 0,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the welfare summary right now. Please try again.');
  }
};
