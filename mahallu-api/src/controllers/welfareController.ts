import { Response } from 'express';
import mongoose from 'mongoose';
import {
  WelfareScheme,
  WelfareApplication,
  WELFARE_TRANSITIONS,
  WelfareStatus,
} from '../models/Welfare';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant, clearableUpdate } from '../utils/sanitizeUpdate';
import { postLedgerEntry, reverseLedgerEntry } from '../services/ledgerPostingService';
import { ensurePeriodOpen } from '../utils/periodLock';
import Member from '../models/Member';

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
    if (search) query.name = { $regex: search, $options: 'i' };

    const [data, total] = await Promise.all([
      WelfareScheme.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      WelfareScheme.countDocuments(query),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSchemeById = async (req: AuthRequest, res: Response) => {
  try {
    const scheme = await WelfareScheme.findById(req.params.id);
    if (!scheme || (req.tenantId && scheme.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Scheme not found' });
    }
    res.json({ success: true, data: scheme });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createScheme = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    const scheme = await WelfareScheme.create({ ...req.body, tenantId });
    res.status(201).json({ success: true, data: scheme });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateScheme = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await WelfareScheme.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Scheme not found' });
    }
    const scheme = await WelfareScheme.findByIdAndUpdate(req.params.id, clearableUpdate(stripImmutable(req.body)), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: scheme });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteScheme = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await WelfareScheme.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Scheme not found' });
    }
    const inUse = await WelfareApplication.countDocuments({ schemeId: existing._id });
    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        message: `Scheme has ${inUse} application(s); close it instead of deleting`,
      });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Scheme deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    if (search) query.reason = { $regex: search, $options: 'i' };

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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getApplicationById = async (req: AuthRequest, res: Response) => {
  try {
    const application = await WelfareApplication.findById(req.params.id)
      .populate('schemeId', 'name category')
      .populate('familyId', 'houseName familyHead contactNo area')
      .populate('memberId', 'name phone');
    if (!application || (req.tenantId && application.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, data: application });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createApplication = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });

    const scheme = await WelfareScheme.findById(req.body.schemeId);
    if (!scheme || scheme.tenantId.toString() !== tenantId.toString()) {
      return res.status(400).json({ success: false, message: 'Invalid scheme' });
    }

    // Linked family / member must belong to this tenant (never write welfareStatus on a foreign family)
    if (
      !(await refBelongsToTenant(Family, req.body.familyId, tenantId)) ||
      !(await refBelongsToTenant(Member, req.body.memberId, tenantId))
    ) {
      return res.status(400).json({ success: false, message: 'Linked family or member is invalid' });
    }

    // Money / workflow fields are set only by the status endpoint
    const { approvedAmount: _a, disbursedDate: _d, disbursedVia: _v, ledgerItemId: _l, verificationNotes: _n, history: _h, ...body } = req.body;
    const application = await WelfareApplication.create({
      ...body,
      tenantId,
      status: 'pending',
      createdBy: req.user?._id,
      history: [{ status: 'pending', changedAt: new Date(), changedBy: req.user?._id }],
    });

    // Keep the family welfare register in step with the application
    if (application.familyId) {
      await Family.updateOne({ _id: application.familyId, tenantId }, { welfareStatus: 'applied' });
    }

    res.status(201).json({ success: true, data: application });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateApplication = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await WelfareApplication.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    // Status only moves through the status endpoint, never a blind update,
    // and tenant / identity fields are never client-settable
    // approvedAmount / disbursed* / ledgerItemId move only through the status endpoint (it posts the ledger)
    const { status, history, approvedAmount, disbursedDate, disbursedVia, ledgerItemId, ...rest } = req.body;
    const payload = stripImmutable(rest);

    if (
      !(await refBelongsToTenant(Family, payload.familyId, existing.tenantId)) ||
      !(await refBelongsToTenant(WelfareScheme, payload.schemeId, existing.tenantId))
    ) {
      return res.status(400).json({ success: false, message: 'Linked family or scheme is invalid' });
    }

    const application = await WelfareApplication.findByIdAndUpdate(req.params.id, clearableUpdate(payload), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: application });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Status machine (spec 7.6): pending -> verified -> approved -> disbursed -> closed,
 * with rejection allowed until disbursement. Skipping a step is a 400.
 */
export const updateApplicationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const nextStatus = req.body.status as WelfareStatus;
    const application = await WelfareApplication.findById(req.params.id);

    if (!application || (req.tenantId && application.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const allowed = WELFARE_TRANSITIONS[application.status] || [];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move from ${application.status} to ${nextStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
      });
    }

    if (nextStatus === 'approved') {
      const approvedAmount = req.body.approvedAmount ?? application.requestedAmount;
      if (approvedAmount > application.requestedAmount && !req.body.override) {
        return res.status(400).json({
          success: false,
          message: 'Approved amount exceeds the requested amount',
        });
      }
      application.approvedAmount = approvedAmount;
    }

    if (nextStatus === 'verified' && req.body.verificationNotes) {
      application.verificationNotes = req.body.verificationNotes;
    }

    if (nextStatus === 'disbursed') {
      const disbursedDate = req.body.disbursedDate ? new Date(req.body.disbursedDate) : new Date();
      if (Number.isNaN(disbursedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Disbursed date must be a valid date' });
      }
      const disbursedVia = req.body.disbursedVia || 'cash';
      // A ledger disbursement posts money dated disbursedDate: refuse up front if that period is closed
      if (disbursedVia === 'ledger' && !(await ensurePeriodOpen(res, application.tenantId, disbursedDate))) return;

      // Atomic claim (approved -> disbursed) so two clicks / two admins can never post the expense twice
      const entry = { status: 'disbursed', changedAt: new Date(), changedBy: req.user?._id, note: req.body.note };
      const claimed = await WelfareApplication.findOneAndUpdate(
        { _id: application._id, tenantId: application.tenantId, status: 'approved' },
        { $set: { status: 'disbursed', disbursedDate, disbursedVia }, $push: { history: entry } },
        { new: true }
      );
      if (!claimed) {
        return res.status(409).json({ success: false, message: 'This application was just changed by someone else. Refresh and try again.' });
      }

      if (disbursedVia === 'ledger') {
        try {
          // Disbursement through finance leaves an auditable expense entry
          const ledgerItemId = await postLedgerEntry({
            tenantId: claimed.tenantId,
            ledgerName: 'Welfare Disbursement',
            ledgerType: 'expense',
            amount: claimed.approvedAmount || claimed.requestedAmount,
            description: `Welfare disbursement for application ${claimed._id}`,
            date: disbursedDate,
            source: 'welfare',
            sourceId: claimed._id as mongoose.Types.ObjectId,
            paymentMethod: 'ledger',
          });
          claimed.ledgerItemId = ledgerItemId;
          await claimed.save();
        } catch (err: any) {
          // Roll the claim back: no half-disbursed application without its expense
          await WelfareApplication.updateOne(
            { _id: claimed._id },
            { $set: { status: 'approved' }, $unset: { disbursedDate: '', disbursedVia: '', ledgerItemId: '' }, $pop: { history: 1 } }
          );
          try { await reverseLedgerEntry('welfare', claimed._id as mongoose.Types.ObjectId); } catch { /* nothing posted */ }
          const code = err?.statusCode === 423 ? 423 : 500;
          return res.status(code).json({ success: false, message: `Disbursement was not recorded: ${err.message}` });
        }
      }

      if (claimed.familyId) {
        await Family.updateOne({ _id: claimed.familyId, tenantId: claimed.tenantId }, { welfareStatus: 'receiving' });
      }
      return res.json({ success: true, data: claimed });
    }

    if ((nextStatus === 'rejected' || nextStatus === 'closed') && application.familyId) {
      // Reset the family register unless the family still has another live application
      const other = await WelfareApplication.exists({
        tenantId: application.tenantId,
        familyId: application.familyId,
        _id: { $ne: application._id },
        status: { $in: ['pending', 'verified', 'approved', 'disbursed'] },
      });
      if (!other) await Family.updateOne({ _id: application.familyId, tenantId: application.tenantId }, { welfareStatus: 'none' });
    }

    application.status = nextStatus;
    application.history.push({
      status: nextStatus,
      changedAt: new Date(),
      changedBy: req.user?._id,
      note: req.body.note,
    });
    await application.save();

    res.json({ success: true, data: application });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteApplication = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await WelfareApplication.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (existing.status === 'disbursed' || existing.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Disbursed applications are kept for the audit trail',
      });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Application deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};
