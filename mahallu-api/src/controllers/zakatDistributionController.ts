import { Response } from 'express';
import mongoose from 'mongoose';
import { ZakatBeneficiary, ZakatDistribution } from '../models/Zakat';
import { Zakat } from '../models/Collectible';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';
import Member from '../models/Member';
import Family from '../models/Family';
import { postLedgerEntry } from '../services/ledgerPostingService';

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
    const { type, beneficiaryId, year } = req.query;
    const query: any = scopedQuery(req);
    if (type) query.type = type;
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

/**
 * Distributions are only allowed against a VERIFIED beneficiary. The member
 * `isZakatEligible` flag is a candidate marker and grants nothing on its own.
 */
export const createDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });

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

    const distribution = await ZakatDistribution.create({
      ...req.body,
      tenantId,
      createdBy: req.user?._id,
    });

    if (req.body.postToLedger) {
      await postLedgerEntry({
        tenantId,
        ledgerName: 'Zakat Distribution',
        ledgerType: 'expense',
        amount: distribution.amount,
        description: `Zakat distribution (${distribution.type}) to ${beneficiary.name || 'beneficiary'}`,
        date: distribution.distributionDate,
        source: 'zakat_distribution',
        sourceId: distribution._id as mongoose.Types.ObjectId,
        paymentMethod: distribution.paymentMethod,
        referenceNo: distribution.receiptNo,
      });
    }

    res.status(201).json({ success: true, data: distribution });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await ZakatDistribution.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Distribution not found' });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Distribution deleted' });
  } catch (error: any) {
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
        { $match: { tenantId: tenantObjectId, paymentDate: { $gte: from, $lt: to } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      ZakatDistribution.aggregate([
        { $match: { tenantId: tenantObjectId, distributionDate: { $gte: from, $lt: to } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      ZakatDistribution.aggregate([
        { $match: { tenantId: tenantObjectId, distributionDate: { $gte: from, $lt: to } } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Promise.all([
        ZakatBeneficiary.countDocuments({ tenantId, verificationStatus: 'verified', status: 'active' }),
        ZakatBeneficiary.countDocuments({ tenantId, verificationStatus: 'pending' }),
      ]),
    ]);

    const collected = collectedAgg[0]?.total || 0;
    const distributed = distributedAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        year,
        collected,
        distributed,
        balance: collected - distributed,
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
