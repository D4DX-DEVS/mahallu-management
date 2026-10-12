import { Response } from 'express';
import mongoose from 'mongoose';
import {
  ZakatBeneficiary,
  ZakatDistribution,
  ZakatSettings,
  ASNAF_CATEGORIES,
  nextDistributionVoucherNo,
} from '../models/Zakat';
import User from '../models/User';
import { ensurePeriodOpen, handlePeriodError } from '../utils/periodLock';
import { Zakat, APPROVED_FILTER } from '../models/Collectible';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';
import Member from '../models/Member';
import Family from '../models/Family';
import { postLedgerEntry, reverseLedgerEntry } from '../services/ledgerPostingService';

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
// Beneficiaries
// ---------------------------------------------------------------------------

export const getAllBeneficiaries = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { verificationStatus, category, status, search } = req.query;
    const query: any = scopedQuery(req);
    if (verificationStatus) query.verificationStatus = verificationStatus;
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };

    const [data, total] = await Promise.all([
      ZakatBeneficiary.find(query)
        .populate('memberId', 'name phone familyName')
        .populate('familyId', 'houseName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ZakatBeneficiary.countDocuments(query),
    ]);

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBeneficiaryById = async (req: AuthRequest, res: Response) => {
  try {
    const beneficiary = await ZakatBeneficiary.findById(req.params.id)
      .populate('memberId', 'name phone familyName')
      .populate('familyId', 'houseName');
    if (!beneficiary || (req.tenantId && beneficiary.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    const distributions = await ZakatDistribution.find({ beneficiaryId: beneficiary._id })
      .sort({ distributionDate: -1 })
      .limit(50);

    res.json({ success: true, data: { beneficiary, distributions } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBeneficiary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    if (!req.body.memberId && !req.body.name) {
      return res.status(400).json({ success: false, message: 'Either a member or a name is required' });
    }
    if (
      !(await refBelongsToTenant(Member, req.body.memberId, tenantId)) ||
      !(await refBelongsToTenant(Family, req.body.familyId, tenantId))
    ) {
      return res.status(400).json({ success: false, message: 'Linked member or family is invalid' });
    }

    // Verification is a separate, deliberate step - never granted on create
    const beneficiary = await ZakatBeneficiary.create({
      ...req.body,
      tenantId,
      verificationStatus: 'pending',
      verifiedBy: undefined,
      verifiedDate: undefined,
    });
    res.status(201).json({ success: true, data: beneficiary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBeneficiary = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await ZakatBeneficiary.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }
    // Verification only moves through the dedicated endpoint, and tenant /
    // identity fields are never client-settable
    const { verificationStatus, verifiedBy, verifiedDate, ...rest } = req.body;
    const payload = stripImmutable(rest);

    if (
      !(await refBelongsToTenant(Member, payload.memberId, existing.tenantId)) ||
      !(await refBelongsToTenant(Family, payload.familyId, existing.tenantId))
    ) {
      return res.status(400).json({ success: false, message: 'Linked member or family is invalid' });
    }
    const beneficiary = await ZakatBeneficiary.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: beneficiary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Verify or reject a beneficiary - the gate distributions check against. */
export const verifyBeneficiary = async (req: AuthRequest, res: Response) => {
  try {
    const status = req.body.verificationStatus;
    if (!['verified', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid verification status' });
    }

    const beneficiary = await ZakatBeneficiary.findById(req.params.id);
    if (!beneficiary || (req.tenantId && beneficiary.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    if (status === 'rejected') {
      const paid = await ZakatDistribution.countDocuments({ beneficiaryId: beneficiary._id });
      if (paid > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot reject: ${paid} distribution(s) already recorded. Mark inactive instead.`,
        });
      }
    }

    beneficiary.verificationStatus = status;
    beneficiary.verifiedBy = status === 'verified' ? req.user?._id : undefined;
    beneficiary.verifiedDate = status === 'verified' ? new Date() : undefined;
    if (req.body.notes) beneficiary.notes = req.body.notes;
    await beneficiary.save();

    res.json({ success: true, data: beneficiary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBeneficiary = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await ZakatBeneficiary.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }
    const paid = await ZakatDistribution.countDocuments({ beneficiaryId: existing._id });
    if (paid > 0) {
      return res.status(400).json({
        success: false,
        message: 'Beneficiary has distributions on record; mark inactive instead of deleting',
      });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Beneficiary deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

export const getAllDistributions = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { type, beneficiaryId, year, status } = req.query;
    const query: any = scopedQuery(req);
    if (type) query.type = type;
    if (status) query.status = status === 'approved' ? { $nin: ['proposed', 'rejected', 'cancelled'] } : status;
    if (beneficiaryId) query.beneficiaryId = beneficiaryId;
    if (year) {
      const y = Number(year);
      query.distributionDate = { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) };
    }

    const [data, total] = await Promise.all([
      ZakatDistribution.find(query)
        .populate({
          path: 'beneficiaryId',
          select: 'name category memberId',
          populate: { path: 'memberId', select: 'name' },
        })
        .sort({ distributionDate: -1 })
        .skip(skip)
        .limit(limit),
      ZakatDistribution.countDocuments(query),
    ]);

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Fund, settings and approval helpers
// ---------------------------------------------------------------------------

const inr = (n: number) => `₹${Math.round(n * 100) / 100}`;

/** Statuses that no longer hold any money. Legacy documents (no status) count as approved. */
const COMMITTED_FILTER = { status: { $nin: ['rejected', 'cancelled'] } } as const;

/**
 * Zakat fund = approved, non-cancelled zakat collected (same APPROVED_FILTER as the
 * summary) minus distributions that are proposed or approved. It carries forward across
 * years - zakat that has not been distributed is not lost at 31 December.
 */
export const computeZakatFund = async (
  tenantId: string | mongoose.Types.ObjectId,
  excludeDistributionId?: mongoose.Types.ObjectId | string
) => {
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());
  const distMatch: any = { tenantId: tenantObjectId, ...COMMITTED_FILTER };
  if (excludeDistributionId) distMatch._id = { $ne: new mongoose.Types.ObjectId(excludeDistributionId.toString()) };

  const [collectedAgg, committedAgg] = await Promise.all([
    Zakat.aggregate([
      { $match: { tenantId: tenantObjectId, ...APPROVED_FILTER } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    ZakatDistribution.aggregate([
      { $match: distMatch },
      { $group: { _id: '$status', total: { $sum: '$amount' } } },
    ]),
  ]);
  const collected = collectedAgg[0]?.total || 0;
  let proposed = 0;
  let approved = 0;
  for (const row of committedAgg) {
    if (row._id === 'proposed') proposed += row.total;
    else approved += row.total;
  }
  return { collected, approved, proposed, committed: approved + proposed, available: collected - approved - proposed };
};

const getZakatSettingsFor = async (tenantId: string | mongoose.Types.ObjectId) => {
  const doc = await ZakatSettings.findOne({ tenantId }).lean();
  return {
    requireApproval: doc?.requireApproval ?? true,
    approvalThreshold: doc?.approvalThreshold ?? 0,
    requireDifferentApprover: doc?.requireDifferentApprover ?? true,
  };
};

const countTenantAdmins = (tenantId: string | mongoose.Types.ObjectId) =>
  User.countDocuments({ tenantId, role: 'mahall', status: 'active' });

const findDistribution = async (req: AuthRequest, res: Response) => {
  const existing = await ZakatDistribution.findById(req.params.id);
  if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
    res.status(404).json({ success: false, message: 'Distribution not found' });
    return null;
  }
  return existing;
};

const postDistributionToLedger = async (distribution: any, beneficiaryName?: string) => {
  const ledgerItemId = await postLedgerEntry({
    tenantId: distribution.tenantId,
    ledgerName: 'Zakat Distribution',
    ledgerType: 'expense',
    amount: distribution.amount,
    description: `Zakat distribution (${distribution.type}) to ${beneficiaryName || 'beneficiary'}`,
    date: distribution.distributionDate,
    source: 'zakat_distribution',
    sourceId: distribution._id as mongoose.Types.ObjectId,
    paymentMethod: distribution.paymentMethod,
    referenceNo: distribution.voucherNo || distribution.receiptNo,
  });
  distribution.ledgerItemId = ledgerItemId;
  await distribution.save();
};

export const getZakatFund = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    const [fund, settings, admins] = await Promise.all([
      computeZakatFund(tenantId),
      getZakatSettingsFor(tenantId),
      countTenantAdmins(tenantId),
    ]);
    res.json({ success: true, data: { ...fund, settings, adminCount: admins, asnafCategories: ASNAF_CATEGORIES } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getZakatSettings = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    res.json({ success: true, data: await getZakatSettingsFor(tenantId) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateZakatSettings = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    const update: Record<string, any> = {};
    if (typeof req.body.requireApproval === 'boolean') update.requireApproval = req.body.requireApproval;
    if (typeof req.body.requireDifferentApprover === 'boolean') {
      update.requireDifferentApprover = req.body.requireDifferentApprover;
    }
    if (req.body.approvalThreshold !== undefined) {
      const t = Number(req.body.approvalThreshold);
      if (!Number.isFinite(t) || t < 0) {
        return res.status(400).json({ success: false, message: 'Approval threshold must be zero or more' });
      }
      update.approvalThreshold = t;
    }
    await ZakatSettings.findOneAndUpdate({ tenantId }, { $set: update, $setOnInsert: { tenantId } }, { upsert: true });
    res.json({ success: true, data: await getZakatSettingsFor(tenantId) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Distribution lifecycle: propose -> approve/reject -> (cancel)
// ---------------------------------------------------------------------------

/**
 * Distributions are only allowed against a VERIFIED, active beneficiary with an asnaf
 * category, and never for more than the available zakat fund. Depending on the tenant's
 * settings they are created as 'proposed' (money not yet out) or directly 'approved'.
 */
export const createDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter an amount greater than zero' });
    }

    const beneficiary = await ZakatBeneficiary.findById(req.body.beneficiaryId);
    if (!beneficiary || beneficiary.tenantId.toString() !== tenantId.toString()) {
      return res.status(400).json({ success: false, message: 'Invalid beneficiary' });
    }
    if (beneficiary.verificationStatus !== 'verified') {
      return res.status(400).json({
        success: false,
        message: `Beneficiary is ${beneficiary.verificationStatus}; only verified beneficiaries can receive distributions`,
      });
    }
    if (beneficiary.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This beneficiary is inactive. Mark them active again before distributing.',
      });
    }

    // Asnaf eligibility: the recipient must belong to one of the eight categories.
    const asnafCategory: string = req.body.asnafCategory || beneficiary.category;
    if (!(ASNAF_CATEGORIES as readonly string[]).includes(asnafCategory)) {
      return res.status(400).json({
        success: false,
        message: 'Choose the asnaf category this zakat is given under (fuqara, masakin, amil, muallafat al-qulub, riqab, gharimin, fi sabilillah or ibn al-sabil).',
      });
    }
    if (
      beneficiary.category !== 'other' &&
      beneficiary.category !== asnafCategory
    ) {
      return res.status(400).json({
        success: false,
        message: `This beneficiary is registered under "${beneficiary.category}". Update their category first if their situation has changed.`,
      });
    }

    const distributionDate = req.body.distributionDate ? new Date(req.body.distributionDate) : new Date();
    if (Number.isNaN(distributionDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Enter a valid distribution date' });
    }
    if (!(await ensurePeriodOpen(res, tenantId, distributionDate))) return;

    // Fund check
    const fund = await computeZakatFund(tenantId);
    if (amount > fund.available) {
      return res.status(409).json({
        success: false,
        code: 'ZAKAT_FUND_EXCEEDED',
        message:
          `The zakat fund has ${inr(Math.max(fund.available, 0))} available ` +
          `(collected ${inr(fund.collected)}, already distributed or proposed ${inr(fund.committed)}). ` +
          `You are trying to distribute ${inr(amount)}. Reduce the amount to ${inr(Math.max(fund.available, 0))} or less.`,
        data: { available: fund.available, collected: fund.collected, committed: fund.committed, requested: amount },
      });
    }

    const settings = await getZakatSettingsFor(tenantId);
    const needsApproval = settings.requireApproval && amount > settings.approvalThreshold;
    const voucherNo = await nextDistributionVoucherNo(tenantId);

    const { status: _s, approvedBy: _a, approvedAt: _aa, ledgerItemId: _l, voucherNo: _v, cancelledAt: _c, ...body } = req.body;
    const distribution = await ZakatDistribution.create({
      ...body,
      tenantId,
      amount,
      distributionDate,
      asnafCategory,
      voucherNo,
      postToLedger: req.body.postToLedger === false ? false : true,
      status: needsApproval ? 'proposed' : 'approved',
      approvedBy: needsApproval ? undefined : req.user?._id,
      approvedAt: needsApproval ? undefined : new Date(),
      createdBy: req.user?._id,
    });

    if (!needsApproval && distribution.postToLedger) {
      try {
        await postDistributionToLedger(distribution, beneficiary.name);
      } catch (err) {
        await distribution.deleteOne();
        throw err;
      }
    }

    res.status(201).json({
      success: true,
      data: distribution,
      message: needsApproval
        ? 'Distribution proposed. It will be paid out and posted to the ledger once another admin approves it.'
        : 'Distribution recorded.',
    });
  } catch (error: any) {
    if (handlePeriodError(res, error)) return;
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await findDistribution(req, res);
    if (!existing) return;
    if (existing.status !== 'proposed') {
      return res.status(409).json({ success: false, message: `This distribution is already ${existing.status}.` });
    }

    const settings = await getZakatSettingsFor(existing.tenantId);
    const admins = await countTenantAdmins(existing.tenantId);
    if (
      settings.requireDifferentApprover &&
      admins > 1 &&
      existing.createdBy &&
      existing.createdBy.toString() === String(req.user?._id)
    ) {
      return res.status(403).json({
        success: false,
        code: 'SAME_APPROVER',
        message: 'You proposed this distribution, so another admin needs to approve it.',
      });
    }

    if (!(await ensurePeriodOpen(res, existing.tenantId, existing.distributionDate))) return;

    // Re-check the fund against everything else that is already committed
    const fund = await computeZakatFund(existing.tenantId, existing._id as any);
    if (existing.amount > fund.available) {
      return res.status(409).json({
        success: false,
        code: 'ZAKAT_FUND_EXCEEDED',
        message: `Only ${inr(Math.max(fund.available, 0))} of zakat is available now, so ${inr(existing.amount)} cannot be approved. Reject it or propose a smaller amount.`,
        data: { available: fund.available },
      });
    }

    existing.status = 'approved';
    existing.approvedBy = req.user?._id;
    existing.approvedAt = new Date();
    await existing.save();

    if (existing.postToLedger) {
      try {
        const beneficiary = await ZakatBeneficiary.findById(existing.beneficiaryId).select('name');
        await postDistributionToLedger(existing, beneficiary?.name);
      } catch (err) {
        existing.status = 'proposed';
        existing.approvedBy = undefined;
        existing.approvedAt = undefined;
        await existing.save();
        throw err;
      }
    }
    res.json({ success: true, data: existing, message: 'Distribution approved.' });
  } catch (error: any) {
    if (handlePeriodError(res, error)) return;
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await findDistribution(req, res);
    if (!existing) return;
    if (existing.status !== 'proposed') {
      return res.status(409).json({ success: false, message: `This distribution is already ${existing.status}.` });
    }
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 3) {
      return res.status(400).json({ success: false, message: 'Add a short reason so the proposer knows why.' });
    }
    existing.status = 'rejected';
    existing.rejectedBy = req.user?._id;
    existing.rejectedAt = new Date();
    existing.rejectionReason = reason;
    await existing.save();
    res.json({ success: true, data: existing, message: 'Distribution rejected.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const cancelApproved = async (req: AuthRequest, res: Response, existing: any, reason: string) => {
  if (reason.length < 3) {
    res.status(400).json({ success: false, message: 'Add a short reason for cancelling this distribution.' });
    return;
  }
  if (!(await ensurePeriodOpen(res, existing.tenantId, existing.distributionDate))) return;
  await reverseLedgerEntry('zakat_distribution', existing._id as mongoose.Types.ObjectId);
  existing.status = 'cancelled';
  existing.cancelledBy = req.user?._id;
  existing.cancelledAt = new Date();
  existing.cancelReason = reason;
  existing.ledgerItemId = undefined;
  await existing.save();
  res.json({
    success: true,
    data: existing,
    message: 'Distribution cancelled and its ledger entry reversed. The amount is back in the zakat fund.',
  });
};

export const cancelDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await findDistribution(req, res);
    if (!existing) return;
    if (existing.status === 'cancelled' || existing.status === 'rejected') {
      return res.status(409).json({ success: false, message: `This distribution is already ${existing.status}.` });
    }
    await cancelApproved(req, res, existing, String(req.body?.reason || '').trim());
  } catch (error: any) {
    if (handlePeriodError(res, error)) return;
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Proposed or rejected distributions never moved money and can be removed. An approved
 * distribution is never erased: DELETE with a `reason` cancels it (ledger reversed) and
 * keeps the row for audit.
 */
export const deleteDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await findDistribution(req, res);
    if (!existing) return;

    if (existing.status === 'proposed' || existing.status === 'rejected') {
      await existing.deleteOne();
      return res.json({ success: true, message: 'Distribution deleted' });
    }
    if (existing.status === 'cancelled') {
      return res.status(409).json({ success: false, message: 'This distribution is already cancelled.' });
    }
    const reason = String(req.body?.reason || req.query?.reason || '').trim();
    if (!reason) {
      return res.status(409).json({
        success: false,
        message: 'An approved distribution cannot be erased. Cancel it with a reason instead.',
      });
    }
    await cancelApproved(req, res, existing, reason);
  } catch (error: any) {
    if (handlePeriodError(res, error)) return;
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Collected (existing Zakat collections) vs distributed, for a given year. */
export const getZakatSummary = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });

    const year = Number(req.query.year) || new Date().getFullYear();
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());

    const [collectedAgg, distributedAgg, byType, beneficiaryCounts] = await Promise.all([
      Zakat.aggregate([
        { $match: { tenantId: tenantObjectId, ...APPROVED_FILTER, paymentDate: { $gte: from, $lt: to } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      ZakatDistribution.aggregate([
        { $match: { tenantId: tenantObjectId, ...COMMITTED_FILTER, distributionDate: { $gte: from, $lt: to } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      ZakatDistribution.aggregate([
        { $match: { tenantId: tenantObjectId, ...COMMITTED_FILTER, distributionDate: { $gte: from, $lt: to } } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Promise.all([
        ZakatBeneficiary.countDocuments({ tenantId, verificationStatus: 'verified', status: 'active' }),
        ZakatBeneficiary.countDocuments({ tenantId, verificationStatus: 'pending' }),
      ]),
    ]);

    const collected = collectedAgg[0]?.total || 0;
    const distributed = distributedAgg[0]?.total || 0;
    const fund = await computeZakatFund(tenantId);

    res.json({
      success: true,
      data: {
        year,
        collected,
        distributed,
        balance: collected - distributed,
        // All-time fund available for new distributions (carries forward across years)
        fundAvailable: fund.available,
        pendingApproval: fund.proposed,
        collectionCount: collectedAgg[0]?.count || 0,
        distributionCount: distributedAgg[0]?.count || 0,
        verifiedBeneficiaries: beneficiaryCounts[0],
        pendingBeneficiaries: beneficiaryCounts[1],
        byType: byType.map((row: any) => ({ type: row._id, total: row.total, count: row.count })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
