import { Response } from 'express';
import mongoose from 'mongoose';
import { ZakatBeneficiary, ZakatDistribution } from '../models/Zakat';
import { Zakat, RECEIVED_PAYMENT_STATUS } from '../models/Collectible';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';
import Member from '../models/Member';
import Family from '../models/Family';
import { postLedgerEntry, reverseLedgerEntry } from '../services/ledgerPostingService';
import { runAtomic } from '../utils/transaction';
import { isDuplicateKeyError } from '../utils/idCounter';
import { parseAmountInRange, round2 } from '../utils/money';
import { MSG, isValidId, requireScope } from '../utils/scope';

import { sendFailure, UserFacingError } from '../utils/userMessages';
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

/**
 * Does this record belong to the caller's Mahallu? Fails closed: a non-super-admin with no Mahallu
 * owns nothing (the old `req.tenantId && ...` check let them through).
 */
const ownsRecord = (req: AuthRequest, recordTenantId: unknown): boolean =>
  req.tenantId ? String(recordTenantId) === String(req.tenantId) : !!req.isSuperAdmin;

/** 403 unless the caller is a super admin or has a Mahallu. Returns false after answering. */
const requireCaller = (req: AuthRequest, res: Response): boolean => !!requireScope(req, res);

const sendBad = (res: Response, message: string) => res.status(400).json({ success: false, message });

// ---------------------------------------------------------------------------
// Beneficiaries
// ---------------------------------------------------------------------------

export const getAllBeneficiaries = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireCaller(req, res)) return;
    const { page, limit, skip } = getPaginationParams(req);
    const { verificationStatus, category, status, search } = req.query;
    const query: any = scopedQuery(req);
    if (verificationStatus) query.verificationStatus = verificationStatus;
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) query.name = { $regex: regexLiteral(search), $options: 'i' };

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
    sendFailure(res, error, 'We couldn\'t load the beneficiaries right now. Please try again.');
  }
};

export const getBeneficiaryById = async (req: AuthRequest, res: Response) => {
  try {
    const beneficiary = await ZakatBeneficiary.findById(req.params.id)
      .populate('memberId', 'name phone familyName')
      .populate('familyId', 'houseName');
    if (!beneficiary || !ownsRecord(req, beneficiary.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that beneficiary. It may have been removed." });
    }

    const distributions = await ZakatDistribution.find({ beneficiaryId: beneficiary._id })
      .sort({ distributionDate: -1 })
      .limit(50);

    res.json({ success: true, data: { beneficiary, distributions } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the beneficiary right now. Please try again.');
  }
};

export const createBeneficiary = async (req: AuthRequest, res: Response) => {
  try {
    // Only a super admin without a selected Mahallu may name one in the body.
    const tenantId = tenantScope(req) || (req.isSuperAdmin ? req.body.tenantId : undefined);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    if (!req.body.memberId && !req.body.name) {
      return res.status(400).json({ success: false, message: 'Please choose a member, or enter a name.' });
    }
    if (
      !(await refBelongsToTenant(Member, req.body.memberId, tenantId)) ||
      !(await refBelongsToTenant(Family, req.body.familyId, tenantId))
    ) {
      return res.status(400).json({ success: false, message: 'Please select a valid member and family.' });
    }

    // Verification is a separate, deliberate step - never granted on create
    const beneficiary = await ZakatBeneficiary.create({
      ...stripImmutable(req.body),
      tenantId,
      verificationStatus: 'pending',
      verifiedBy: undefined,
      verifiedDate: undefined,
    });

    // Keep the member-side register flag in sync so the beneficiary shows up
    // in the "Zakat Beneficiaries" dashboard/register count immediately.
    if (beneficiary.memberId) {
      try {
        await Member.updateOne({ _id: beneficiary.memberId }, { isZakatEligible: true });
      } catch (memberError) {
        console.error('Failed to flag member as zakat-eligible:', memberError);
      }
    }

    res.status(201).json({ success: true, data: beneficiary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the beneficiary. Please try again.');
  }
};

export const updateBeneficiary = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await ZakatBeneficiary.findById(req.params.id);
    if (!existing || !ownsRecord(req, existing.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that beneficiary. It may have been removed." });
    }
    // Verification only moves through the dedicated endpoint, and tenant /
    // identity fields are never client-settable
    const { verificationStatus, verifiedBy, verifiedDate, ...rest } = req.body;
    const payload = stripImmutable(rest);

    if (
      !(await refBelongsToTenant(Member, payload.memberId, existing.tenantId)) ||
      !(await refBelongsToTenant(Family, payload.familyId, existing.tenantId))
    ) {
      return res.status(400).json({ success: false, message: 'Please select a valid member and family.' });
    }
    const beneficiary = await ZakatBeneficiary.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: beneficiary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the beneficiary. Please try again.');
  }
};

/** Verify or reject a beneficiary - the gate distributions check against. */
export const verifyBeneficiary = async (req: AuthRequest, res: Response) => {
  try {
    const status = req.body.verificationStatus;
    if (!['verified', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please choose a valid verification status.' });
    }

    const beneficiary = await ZakatBeneficiary.findById(req.params.id);
    if (!beneficiary || !ownsRecord(req, beneficiary.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that beneficiary. It may have been removed." });
    }

    if (status === 'rejected') {
      const paid = await ZakatDistribution.countDocuments({ beneficiaryId: beneficiary._id });
      if (paid > 0) {
        return res.status(400).json({
          success: false,
          message: `${paid} distribution(s) are already recorded, so this can't be rejected. Please mark it inactive instead.`,
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
    sendFailure(res, error, 'We couldn\'t verify the beneficiary. Please try again.');
  }
};

export const deleteBeneficiary = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await ZakatBeneficiary.findById(req.params.id);
    if (!existing || !ownsRecord(req, existing.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that beneficiary. It may have been removed." });
    }
    const paid = await ZakatDistribution.countDocuments({ beneficiaryId: existing._id });
    if (paid > 0) {
      return res.status(400).json({
        success: false,
        message: "This beneficiary has distributions on record, so it can't be deleted. Mark it inactive instead.",
      });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Beneficiary deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the beneficiary. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

export const getAllDistributions = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireCaller(req, res)) return;
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
    sendFailure(res, error, 'We couldn\'t load the distributions right now. Please try again.');
  }
};

const DISTRIBUTION_TYPES = ['regular', 'monthly', 'fitr', 'qurbani'];
const CLIENT_REQUEST_ID = /^[A-Za-z0-9_\-:.]{8,64}$/;
const AMOUNT_MESSAGE = 'Please enter an amount greater than zero (at most two decimal places).';

const cleanText = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' ? value.trim().slice(0, max) : undefined;

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** The ledger entry a posted distribution corresponds to (an expense: money leaves the Mahallu). */
const distributionLedgerParams = (distribution: any, beneficiaryName?: string) => ({
  tenantId: distribution.tenantId,
  ledgerName: 'Zakat Distribution',
  ledgerType: 'expense' as const,
  amount: distribution.amount,
  description: `Zakat distribution (${distribution.type}) to ${beneficiaryName || 'beneficiary'}`,
  date: distribution.distributionDate,
  source: 'zakat_distribution' as const,
  sourceId: distribution._id as mongoose.Types.ObjectId,
  paymentMethod: distribution.paymentMethod,
  referenceNo: distribution.receiptNo,
});

const beneficiaryNameOf = async (beneficiaryId: unknown): Promise<string | undefined> => {
  try {
    const found: any = await ZakatBeneficiary.findById(beneficiaryId).select('name').lean();
    return found?.name;
  } catch {
    return undefined;
  }
};

/**
 * Distributions are only allowed against a VERIFIED beneficiary. The member
 * `isZakatEligible` flag is a candidate marker and grants nothing on its own.
 *
 * With `postToLedger` the row and its ledger entry are written together (one MongoDB transaction when
 * the cluster supports it, otherwise row first and the row is removed again if posting fails), so a
 * failed post can no longer leave a saved row behind a 500 for a retry to duplicate. A `clientRequestId`
 * makes a retry return the existing distribution (200, `idempotent: true`) and, if the first attempt was
 * interrupted before posting, finishes the posting (posting is idempotent per distribution).
 */
export const createDistribution = async (req: AuthRequest, res: Response) => {
  try {
    const scope = requireScope(req, res);
    if (!scope) return;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    // A super admin without a selected Mahallu may name one in the body; nobody else can.
    const tenantId = scope.tenantId || (scope.isSuperAdmin && isValidId(body.tenantId) ? body.tenantId : undefined);
    if (!tenantId) return sendBad(res, MSG.noTenant);

    if (!isValidId(body.beneficiaryId)) return sendBad(res, 'Please select a valid beneficiary.');
    const beneficiary = await ZakatBeneficiary.findById(body.beneficiaryId);
    if (!beneficiary || beneficiary.tenantId.toString() !== tenantId.toString()) {
      return sendBad(res, 'Please select a valid beneficiary.');
    }
    if (beneficiary.verificationStatus !== 'verified') {
      return res.status(400).json({
        success: false,
        message: `Only verified beneficiaries can receive distributions. This beneficiary is ${beneficiary.verificationStatus}.`,
      });
    }

    const amount = parseAmountInRange(body.amount, 0.01);
    if (amount === null) return sendBad(res, AMOUNT_MESSAGE);
    let distributionDate = new Date();
    if (body.distributionDate !== undefined && body.distributionDate !== null && body.distributionDate !== '') {
      const parsed = parseDate(body.distributionDate);
      if (!parsed) return sendBad(res, 'Please choose a valid distribution date.');
      distributionDate = parsed;
    }
    const type = body.type === undefined || body.type === '' ? 'regular' : body.type;
    if (!DISTRIBUTION_TYPES.includes(type)) return sendBad(res, 'Please choose a valid distribution type.');
    let clientRequestId: string | undefined;
    if (body.clientRequestId !== undefined && body.clientRequestId !== null && body.clientRequestId !== '') {
      if (typeof body.clientRequestId !== 'string' || !CLIENT_REQUEST_ID.test(body.clientRequestId)) {
        return sendBad(res, 'The request id must be 8 to 64 letters, numbers, dashes or underscores.');
      }
      clientRequestId = body.clientRequestId;
    }

    const tenantOid = new mongoose.Types.ObjectId(String(tenantId));
    const postToLedger = body.postToLedger === true || body.postToLedger === 'true';

    // Only whitelisted fields; tenantId / createdBy / clientRequestId are set here, never taken as sent.
    const data: Record<string, any> = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: tenantOid,
      beneficiaryId: beneficiary._id,
      amount,
      distributionDate,
      type,
      paymentMethod: cleanText(body.paymentMethod, 100),
      receiptNo: cleanText(body.receiptNo, 64),
      remarks: cleanText(body.remarks, 2000),
      postToLedger,
      createdBy: req.user?._id,
    };
    if (clientRequestId) data.clientRequestId = clientRequestId;

    const respondExisting = async (existing: any) => {
      if (
        Number(existing.amount) !== amount ||
        String(existing.beneficiaryId) !== String(beneficiary._id)
      ) {
        return res.status(409).json({
          success: false,
          message: 'That request id was already used for a different distribution. Please start a new one.',
        });
      }
      // The first attempt may have stopped after saving the row but before posting: finish it. No-op if posted.
      if (existing.postToLedger) {
        await postLedgerEntry(distributionLedgerParams(existing, beneficiary.name));
      }
      return res.status(200).json({ success: true, data: existing, idempotent: true });
    };

    if (clientRequestId) {
      const existing = await ZakatDistribution.findOne({ tenantId: tenantOid, clientRequestId });
      if (existing) return await respondExisting(existing);
    }

    try {
      const distribution = await runAtomic(
        async (session, comp) => {
          const [created]: any[] = await ZakatDistribution.create([data], { session });
          comp.push('distribution row', async () => {
            await ZakatDistribution.deleteOne({ _id: data._id });
          });
          if (postToLedger) {
            await postLedgerEntry(distributionLedgerParams(created, beneficiary.name), { session });
            // (nothing after this step can fail, so it needs no undo of its own)
          }
          return created;
        },
        { description: 'zakat distribution create', reconcile: { entity: 'ZakatDistribution', entityId: data._id, tenantId: tenantOid } }
      );
      return res.status(201).json({ success: true, data: distribution });
    } catch (err) {
      if (clientRequestId && isDuplicateKeyError(err, 'clientRequestId')) {
        const existing = await ZakatDistribution.findOne({ tenantId: tenantOid, clientRequestId });
        if (existing) return await respondExisting(existing);
      }
      throw err;
    }
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the distribution. Please try again.');
  }
};

/**
 * Beneficiary is immutable here - re-pointing a distribution goes through delete + re-create.
 *
 * Once a distribution has been posted to the ledger, changing its amount, date, method or receipt number
 * REPLACES the ledger entry (reverse the old one, post the new one) in the same atomic step, so the
 * ledger and the bank balance always match the distribution. The reversal and the post are each
 * idempotent and the whole step is undone if either fails; the chosen alternative (rejecting the edit)
 * would only push people to delete and re-create, which is the riskier path. An edit racing another edit
 * of the amount is refused with 409 (optimistic check on the amount that was read).
 */
export const updateDistribution = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireCaller(req, res)) return;
    if (!isValidId(req.params.id)) return sendBad(res, MSG.badId);
    const existing: any = await ZakatDistribution.findById(req.params.id);
    if (!existing || !ownsRecord(req, existing.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that distribution. It may have been removed." });
    }

    // Whitelist: tenantId, beneficiaryId, createdBy, postToLedger and clientRequestId can never be edited.
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const changes: Record<string, any> = {};
    if (body.amount !== undefined) {
      const amount = parseAmountInRange(body.amount, 0.01);
      if (amount === null) return sendBad(res, AMOUNT_MESSAGE);
      changes.amount = amount;
    }
    if (body.distributionDate !== undefined) {
      const date = parseDate(body.distributionDate);
      if (!date) return sendBad(res, 'Please choose a valid distribution date.');
      changes.distributionDate = date;
    }
    if (body.type !== undefined) {
      if (!DISTRIBUTION_TYPES.includes(body.type)) return sendBad(res, 'Please choose a valid distribution type.');
      changes.type = body.type;
    }
    for (const field of ['paymentMethod', 'receiptNo', 'remarks'] as const) {
      if (body[field] !== undefined) {
        const value = body[field] === null ? '' : cleanText(body[field], field === 'remarks' ? 2000 : 100);
        if (value === undefined) return sendBad(res, 'Please check the details and try again.');
        changes[field] = value;
      }
    }

    const populateBeneficiary = (query: any) =>
      query.populate({
        path: 'beneficiaryId',
        select: 'name category memberId',
        populate: { path: 'memberId', select: 'name' },
      });

    const ledgerRelevant = ['amount', 'distributionDate', 'paymentMethod', 'receiptNo', 'type'].some(
      (field) => field in changes
    );

    if (!existing.postToLedger || !ledgerRelevant) {
      const updated = await ZakatDistribution.findByIdAndUpdate(existing._id, changes, { new: true, runValidators: true });
      if (!updated) {
        return res.status(404).json({ success: false, message: "We couldn't find that distribution. It may have been removed." });
      }
    } else {
      const oldPlain = typeof existing.toObject === 'function' ? existing.toObject() : { ...existing };
      const name = await beneficiaryNameOf(existing.beneficiaryId);
      await runAtomic(
        async (session, comp) => {
          const updated: any = await ZakatDistribution.findOneAndUpdate(
            { _id: existing._id, tenantId: existing.tenantId, amount: oldPlain.amount },
            { $set: changes },
            { new: true, runValidators: true, session }
          );
          if (!updated) {
            throw new UserFacingError('This distribution was changed by someone else. Please refresh and try again.', 409);
          }
          comp.push('distribution fields', async () => {
            const restore: Record<string, any> = {};
            for (const field of Object.keys(changes)) restore[field] = oldPlain[field];
            await ZakatDistribution.updateOne({ _id: existing._id }, { $set: restore });
          });

          const removed = await reverseLedgerEntry('zakat_distribution', existing._id, {
            session,
            tenantId: existing.tenantId,
          });
          if (removed.length > 0) {
            comp.push('previous ledger entry', async () => {
              await postLedgerEntry(distributionLedgerParams(oldPlain, name));
            });
          }
          await postLedgerEntry(distributionLedgerParams(updated, name), { session });
          comp.push('new ledger entry', async () => {
            await reverseLedgerEntry('zakat_distribution', existing._id, { tenantId: existing.tenantId });
          });
        },
        { description: 'zakat distribution update', reconcile: { entity: 'ZakatDistribution', entityId: existing._id, tenantId: existing.tenantId } }
      );
    }

    const distribution = await populateBeneficiary(ZakatDistribution.findById(existing._id));
    res.json({ success: true, data: distribution });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the distribution. Please try again.');
  }
};

/**
 * Deleting a distribution reverses its ledger entry and puts the debited bank balance back. The row is
 * claimed by deleting it (one winner), the reversal is applied once, and if it fails the row is restored
 * and the error reported, so a half-done delete cannot leave an expense with no distribution.
 */
export const deleteDistribution = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireCaller(req, res)) return;
    if (!isValidId(req.params.id)) return sendBad(res, MSG.badId);
    const existing: any = await ZakatDistribution.findById(req.params.id);
    if (!existing || !ownsRecord(req, existing.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that distribution. It may have been removed." });
    }
    const name = await beneficiaryNameOf(existing.beneficiaryId);

    const outcome = await runAtomic(
      async (session, comp) => {
        const removedRow: any = await ZakatDistribution.findOneAndDelete(
          { _id: existing._id, tenantId: existing.tenantId },
          { session }
        );
        if (!removedRow) return 'missing' as const;
        const plain = typeof removedRow.toObject === 'function' ? removedRow.toObject() : { ...removedRow };
        comp.push('distribution row', async () => {
          await ZakatDistribution.create([plain]);
        });

        // Always reverse by (source, sourceId): a no-op when nothing was posted, and it also clears an
        // entry whose postToLedger flag was lost.
        const removed = await reverseLedgerEntry('zakat_distribution', existing._id, {
          session,
          tenantId: existing.tenantId,
        });
        if (removed.length > 0) {
          comp.push('ledger entry', async () => {
            await postLedgerEntry(distributionLedgerParams(plain, name));
          });
        }
        return 'deleted' as const;
      },
      { description: 'zakat distribution delete', reconcile: { entity: 'ZakatDistribution', entityId: existing._id, tenantId: existing.tenantId } }
    );

    if (outcome === 'missing') {
      return res.status(404).json({ success: false, message: "We couldn't find that distribution. It may have been removed." });
    }
    res.json({ success: true, message: 'Distribution deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the distribution. Please try again.');
  }
};

/**
 * Collected (existing Zakat collections) vs distributed, for a given year.
 * Only VERIFIED zakat counts as collected: a pending member submission is money nobody has confirmed
 * receiving. (A payment with no status at all predates the field and was always received, so it counts.)
 */
export const getZakatSummary = async (req: AuthRequest, res: Response) => {
  try {
    /*
     * No tenant scope is not an error here. A super admin lands on this page
     * before touching the tenant switcher, and refusing with a 400 turned that
     * ordinary first view into "We couldn't load summary". Every other summary
     * endpoint - qard, welfare, relief - answers across all Mahallus in that
     * state, and the beneficiary and distribution lists behind this page
     * already do too. This one was the outlier.
     * Anyone who is NOT a super admin and has no Mahallu is refused (403) instead.
     */
    if (!requireCaller(req, res)) return;
    const tenantId = tenantScope(req);
    const scope = scopedQuery(req);
    // Aggregation does not cast strings to ObjectId the way find() does.
    const tenantMatch: Record<string, any> = tenantId
      ? { tenantId: new mongoose.Types.ObjectId(tenantId.toString()) }
      : {};

    const year = Number(req.query.year) || new Date().getFullYear();
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);

    const [collectedAgg, pendingAgg, distributedAgg, byType, beneficiaryCounts] = await Promise.all([
      Zakat.aggregate([
        { $match: { ...tenantMatch, status: RECEIVED_PAYMENT_STATUS, paymentDate: { $gte: from, $lt: to } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Zakat.aggregate([
        { $match: { ...tenantMatch, status: 'pending', paymentDate: { $gte: from, $lt: to } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      ZakatDistribution.aggregate([
        { $match: { ...tenantMatch, distributionDate: { $gte: from, $lt: to } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      ZakatDistribution.aggregate([
        { $match: { ...tenantMatch, distributionDate: { $gte: from, $lt: to } } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Promise.all([
        ZakatBeneficiary.countDocuments({ ...scope, verificationStatus: 'verified', status: 'active' }),
        ZakatBeneficiary.countDocuments({ ...scope, verificationStatus: 'pending' }),
      ]),
    ]);

    const collected = round2(collectedAgg[0]?.total || 0);
    const distributed = round2(distributedAgg[0]?.total || 0);

    res.json({
      success: true,
      data: {
        year,
        collected,
        distributed,
        balance: round2(collected - distributed),
        collectionCount: collectedAgg[0]?.count || 0,
        distributionCount: distributedAgg[0]?.count || 0,
        // Submitted by members but not yet verified: NOT part of `collected`.
        pendingCollected: round2(pendingAgg[0]?.total || 0),
        pendingCollectionCount: pendingAgg[0]?.count || 0,
        verifiedBeneficiaries: beneficiaryCounts[0],
        pendingBeneficiaries: beneficiaryCounts[1],
        byType: byType.map((row: any) => ({ type: row._id, total: row.total, count: row.count })),
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the zakat summary right now. Please try again.');
  }
};
