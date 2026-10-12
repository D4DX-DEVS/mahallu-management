import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  Campaign,
  CampaignContribution,
  UdhiyaBooking,
  CAMPAIGN_TYPES,
  nextCampaignReceiptNo,
} from '../models/Campaign';
import Family from '../models/Family';
import Member from '../models/Member';
import { Ledger } from '../models/MasterAccount';
import { postLedgerEntry, reverseLedgerEntry } from '../services/ledgerPostingService';
import { assertPeriodOpen, ensurePeriodOpen } from '../utils/periodLock';
import { upcomingIslamicEvents } from '../utils/hijri';
import { stripImmutable } from '../utils/sanitizeUpdate';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { ACTIVE_FAMILY_FILTER } from '../utils/archiveFilters';

const oid = (v: any) => new mongoose.Types.ObjectId(String(v));
const isId = (v: any) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

const needTenant = (req: AuthRequest, res: Response): string | null => {
  if (!req.tenantId) {
    res.status(400).json({ success: false, message: 'Select a mahallu first' });
    return null;
  }
  return req.tenantId;
};

const loadCampaign = async (req: AuthRequest, res: Response, id = req.params.id) => {
  const tenantId = needTenant(req, res);
  if (!tenantId) return null;
  if (!isId(id)) {
    res.status(404).json({ success: false, message: 'Campaign not found' });
    return null;
  }
  const c = await Campaign.findOne({ _id: id, tenantId });
  if (!c) {
    res.status(404).json({ success: false, message: 'Campaign not found' });
    return null;
  }
  return c;
};

const ALLOWED_FIELDS = ['type', 'name', 'nameMl', 'description', 'startDate', 'endDate', 'targetAmount', 'perHeadAmount', 'ledgerId'];
const pickCampaign = (body: any) => {
  const out: any = {};
  for (const k of ALLOWED_FIELDS) if (body[k] !== undefined) out[k] = body[k] === '' ? undefined : body[k];
  return out;
};

const validateCampaign = async (data: any, tenantId: string): Promise<string | null> => {
  if (data.type && !CAMPAIGN_TYPES.includes(data.type)) return 'Unknown campaign type';
  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) return 'End date cannot be before the start date';
  if (data.targetAmount !== undefined && Number(data.targetAmount) < 0) return 'Target cannot be negative';
  if (data.ledgerId) {
    if (!isId(String(data.ledgerId))) return 'Invalid ledger';
    const ledger = await Ledger.findOne({ _id: data.ledgerId, tenantId });
    if (!ledger) return 'Ledger not found in this mahallu';
    if (ledger.type !== 'income') return 'Pick an income ledger for a collection campaign';
  }
  return null;
};

/** Raised totals per campaign id: approved contributions only. */
const raisedByCampaign = async (tenantId: string, ids?: mongoose.Types.ObjectId[]) => {
  const match: any = { tenantId: oid(tenantId), status: 'approved' };
  if (ids) match.campaignId = { $in: ids };
  const rows = await CampaignContribution.aggregate([
    { $match: match },
    { $group: { _id: '$campaignId', raised: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return new Map<string, { raised: number; count: number }>(rows.map((r: any) => [String(r._id), { raised: r.raised, count: r.count }]));
};

const withProgress = (c: any, stats?: { raised: number; count: number }) => {
  const raised = stats?.raised || 0;
  const target = c.targetAmount || 0;
  return {
    ...(c.toObject ? c.toObject() : c),
    raised,
    contributionCount: stats?.count || 0,
    percent: target > 0 ? Math.min(100, Math.round((raised / target) * 1000) / 10) : null,
    remaining: target > 0 ? Math.max(0, target - raised) : null,
  };
};

export const listCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    const { status, type } = req.query;
    const q: any = { tenantId };
    if (status) q.status = status;
    if (type) q.type = type;
    const campaigns = await Campaign.find(q).sort({ createdAt: -1 }).limit(200);
    const stats = await raisedByCampaign(tenantId, campaigns.map((c) => c._id as mongoose.Types.ObjectId));
    res.json({ success: true, data: campaigns.map((c) => withProgress(c, stats.get(String(c._id)))) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const c = await loadCampaign(req, res);
    if (!c) return;
    const stats = await raisedByCampaign(req.tenantId!, [c._id as mongoose.Types.ObjectId]);
    res.json({ success: true, data: withProgress(c, stats.get(String(c._id))) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const createCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    const data = pickCampaign(req.body);
    if (!data.name || !String(data.name).trim()) return res.status(400).json({ success: false, message: 'Campaign name is required' });
    const err = await validateCampaign(data, tenantId);
    if (err) return res.status(400).json({ success: false, message: err });
    if (data.type === 'fitr' && !(Number(data.perHeadAmount) > 0)) {
      return res.status(400).json({ success: false, message: 'Enter the Zakat al-Fitr amount per person' });
    }
    const c = await Campaign.create({ ...data, tenantId, status: 'draft', createdBy: req.user?._id });
    res.status(201).json({ success: true, data: withProgress(c) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const updateCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const c = await loadCampaign(req, res);
    if (!c) return;
    const data = pickCampaign(stripImmutable(req.body));
    const merged = { ...c.toObject(), ...data };
    const err = await validateCampaign(merged, req.tenantId!);
    if (err) return res.status(400).json({ success: false, message: err });
    Object.assign(c, data);
    await c.save();
    const stats = await raisedByCampaign(req.tenantId!, [c._id as mongoose.Types.ObjectId]);
    res.json({ success: true, data: withProgress(c, stats.get(String(c._id))) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const setCampaignStatus = async (req: AuthRequest, res: Response) => {
  try {
    const c = await loadCampaign(req, res);
    if (!c) return;
    const status = req.body.status;
    if (!['draft', 'active', 'closed'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    c.status = status;
    await c.save();
    res.json({ success: true, data: withProgress(c) });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const deleteCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const c = await loadCampaign(req, res);
    if (!c) return;
    const n = await CampaignContribution.countDocuments({ tenantId: req.tenantId, campaignId: c._id });
    if (n > 0) {
      return res.status(400).json({
        success: false,
        message: 'This campaign already has receipts, so it cannot be deleted. Close it instead.',
      });
    }
    await UdhiyaBooking.deleteMany({ tenantId: req.tenantId, campaignId: c._id });
    await c.deleteOne();
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** Hijri-aware suggestions: Ramadan / Eid dates coming up and the campaign each one suits. */
export const campaignSuggestions = async (_req: AuthRequest, res: Response) => {
  const events = upcomingIslamicEvents(new Date(), 400).filter((e) => e.suggestedCampaignType);
  res.json({ success: true, data: events });
};

// ---------------------------------------------------------------- contributions

const postContributionToLedger = async (campaign: any, contribution: any): Promise<boolean> => {
  if (!campaign.ledgerId) return false;
  const ledger = await Ledger.findOne({ _id: campaign.ledgerId, tenantId: campaign.tenantId });
  if (!ledger || ledger.type !== 'income') return false;
  await postLedgerEntry({
    tenantId: campaign.tenantId,
    instituteId: (ledger as any).instituteId || undefined,
    ledgerName: ledger.name,
    ledgerType: 'income',
    amount: contribution.amount,
    description: `${campaign.name} - ${contribution.donorName || 'contribution'} (${contribution.receiptNo})`,
    date: contribution.paymentDate,
    // The shared source enum has no 'campaign' value; 'manual' + sourceId keeps it reversible.
    source: 'manual',
    sourceId: contribution._id,
    paymentMethod: contribution.method,
    referenceNo: contribution.receiptNo,
  });
  return true;
};

interface ContributionInput {
  familyId?: string;
  memberId?: string;
  donorName?: string;
  anonymous?: boolean;
  amount: number;
  method?: string;
  paymentDate?: string | Date;
  collectorId?: string;
  remarks?: string;
  udhiyaBookingId?: any;
}

const createContribution = async (campaign: any, input: ContributionInput, req: AuthRequest) => {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error('Amount must be greater than zero'), { status: 400 });
  if (campaign.status === 'closed') throw Object.assign(new Error('This campaign is closed. Re-open it to add receipts.'), { status: 400 });
  const tenantId = String(campaign.tenantId);

  let donorName = (input.donorName || '').trim();
  if (input.familyId) {
    if (!isId(input.familyId)) throw Object.assign(new Error('Invalid family'), { status: 400 });
    const fam = await Family.findOne({ _id: input.familyId, tenantId }).select('houseName familyHead');
    if (!fam) throw Object.assign(new Error('Family not found in this mahallu'), { status: 404 });
    if (!donorName) donorName = fam.familyHead ? `${fam.familyHead} (${fam.houseName})` : fam.houseName;
  }
  if (input.memberId) {
    if (!isId(input.memberId)) throw Object.assign(new Error('Invalid member'), { status: 400 });
    const mem = await Member.findOne({ _id: input.memberId, tenantId }).select('name');
    if (!mem) throw Object.assign(new Error('Member not found in this mahallu'), { status: 404 });
    if (!donorName) donorName = mem.name;
  }
  if (!donorName) donorName = 'Anonymous donor';

  // Period lock up front (before any receipt number or record exists); PeriodLockedError carries statusCode 423
  await assertPeriodOpen(tenantId, input.paymentDate ? new Date(input.paymentDate) : new Date());

  const receiptNo = await nextCampaignReceiptNo(tenantId);
  const c: any = await CampaignContribution.create({
    tenantId,
    campaignId: campaign._id,
    familyId: input.familyId || undefined,
    memberId: input.memberId || undefined,
    donorName,
    anonymous: !!input.anonymous,
    amount,
    method: (input.method || 'cash').toLowerCase(),
    paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
    receiptNo,
    collectorId: input.collectorId && isId(input.collectorId) ? input.collectorId : undefined,
    remarks: input.remarks,
    udhiyaBookingId: input.udhiyaBookingId,
    status: 'approved',
    createdBy: req.user?._id,
  });
  try {
    const posted = await postContributionToLedger(campaign, c);
    if (posted) {
      c.ledgerPosted = true;
      await c.save();
    }
  } catch (e) {
    // The receipt exists and counts; the ledger can be reconciled. Never lose a receipt over it.
    console.error('[campaign] ledger posting failed for', c.receiptNo, (e as Error).message);
  }
  return c;
};

export const addContribution = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await loadCampaign(req, res);
    if (!campaign) return;
    const c = await createContribution(campaign, req.body, req);
    res.status(201).json({ success: true, data: c });
  } catch (e: any) {
    res.status(e.status || e.statusCode || (e.code === 11000 ? 409 : 500)).json({ success: false, code: e.code === 'PERIOD_CLOSED' ? e.code : undefined, message: e.message });
  }
};

export const listContributions = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await loadCampaign(req, res);
    if (!campaign) return;
    const { page, limit, skip } = getPaginationParams(req);
    const q: any = { tenantId: req.tenantId, campaignId: campaign._id };
    if (req.query.status) q.status = req.query.status;
    if (req.query.method) q.method = req.query.method;
    const [data, total] = await Promise.all([
      CampaignContribution.find(q).sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(limit),
      CampaignContribution.countDocuments(q),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const cancelContribution = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    if (!isId(req.params.cid)) return res.status(404).json({ success: false, message: 'Receipt not found' });
    const c: any = await CampaignContribution.findOne({ _id: req.params.cid, tenantId });
    if (!c) return res.status(404).json({ success: false, message: 'Receipt not found' });
    if (c.status === 'cancelled') return res.status(400).json({ success: false, message: 'This receipt is already cancelled' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ success: false, message: 'Give a reason for cancelling this receipt' });
    if (!(await ensurePeriodOpen(res, c.tenantId, c.paymentDate))) return;
    c.status = 'cancelled';
    c.cancelReason = reason;
    c.cancelledBy = req.user?._id;
    c.cancelledAt = new Date();
    await c.save();
    if (c.ledgerPosted) {
      await reverseLedgerEntry('manual' as any, c._id);
      c.ledgerPosted = false;
      await c.save();
    }
    // Free the Udhiya participant, if any, so it can be collected again.
    if (c.udhiyaBookingId) {
      await UdhiyaBooking.updateOne(
        { _id: c.udhiyaBookingId, tenantId, 'participants.contributionId': c._id },
        { $set: { 'participants.$.paid': false }, $unset: { 'participants.$.contributionId': '' } }
      );
    }
    res.json({ success: true, data: c });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------------------------------------------------------------- progress

export const campaignProgress = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await loadCampaign(req, res);
    if (!campaign) return;
    const match = { tenantId: oid(req.tenantId), campaignId: campaign._id, status: 'approved' };
    const [totals, byDay, byMethod, top] = await Promise.all([
      CampaignContribution.aggregate([{ $match: match }, { $group: { _id: null, raised: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      CampaignContribution.aggregate([
        { $match: match },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate', timezone: '+05:30' } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      CampaignContribution.aggregate([{ $match: match }, { $group: { _id: '$method', amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
      CampaignContribution.aggregate([
        { $match: match },
        { $group: { _id: { f: '$familyId', n: '$donorName', a: '$anonymous' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { amount: -1 } },
        { $limit: 5 },
      ]),
    ]);
    const raised = totals[0]?.raised || 0;
    const target = campaign.targetAmount || 0;
    const days = byDay.map((d: any) => ({ date: d._id, amount: d.amount, count: d.count }));
    let running = 0;
    const cumulative = days.map((d: any) => ({ ...d, cumulative: (running += d.amount) }));
    res.json({
      success: true,
      data: {
        campaignId: campaign._id,
        raised,
        target,
        percent: target > 0 ? Math.min(100, Math.round((raised / target) * 1000) / 10) : null,
        remaining: target > 0 ? Math.max(0, target - raised) : null,
        contributionCount: totals[0]?.count || 0,
        byDay: cumulative,
        byMethod: byMethod.map((m: any) => ({ method: m._id || 'other', amount: m.amount, count: m.count })),
        // Donors who asked for anonymity are never named here.
        topContributors: top.map((t: any, i: number) => ({
          rank: i + 1,
          name: t._id.a ? 'Anonymous' : t._id.n || 'Anonymous',
          amount: t.amount,
          count: t.count,
        })),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ---------------------------------------------------------------- Fitr

/** Per-family expected Fitr = perHead x living members, with paid / partial / unpaid. */
export const fitrChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await loadCampaign(req, res);
    if (!campaign) return;
    if (campaign.type !== 'fitr') return res.status(400).json({ success: false, message: 'This is not a Zakat al-Fitr campaign' });
    const perHead = campaign.perHeadAmount || 0;
    const tenantId = oid(req.tenantId);
    const includeAll = req.query.includeUnapproved === 'true';

    const familyQ: any = { tenantId: req.tenantId };
    if (!includeAll) familyQ.status = 'approved';
    const [families, memberCounts, paidRows] = await Promise.all([
      Family.find({ ...familyQ, ...ACTIVE_FAMILY_FILTER }).select('houseName familyHead contactNo wardNumber status').sort({ houseName: 1 }).lean(),
      // Living, non-removed members only
      Member.aggregate([
        { $match: { tenantId, status: 'active', isDead: { $ne: true } } },
        { $group: { _id: '$familyId', count: { $sum: 1 } } },
      ]),
      CampaignContribution.aggregate([
        { $match: { tenantId, campaignId: campaign._id, status: 'approved', familyId: { $ne: null } } },
        { $group: { _id: '$familyId', paid: { $sum: '$amount' }, receiptNo: { $last: '$receiptNo' } } },
      ]),
    ]);
    const counts = new Map(memberCounts.map((r: any) => [String(r._id), r.count]));
    const paid = new Map(paidRows.map((r: any) => [String(r._id), r]));

    const rows = families.map((f: any) => {
      const members = counts.get(String(f._id)) || 0;
      const expected = members * perHead;
      const p = paid.get(String(f._id));
      const paidAmount = p?.paid || 0;
      const status = paidAmount <= 0 ? 'unpaid' : paidAmount >= expected ? 'paid' : 'partial';
      return {
        familyId: f._id,
        houseName: f.houseName,
        familyHead: f.familyHead,
        contactNo: f.contactNo,
        wardNumber: f.wardNumber,
        members,
        expected,
        paid: paidAmount,
        balance: Math.max(0, expected - paidAmount),
        status,
        receiptNo: p?.receiptNo,
      };
    });
    const filter = req.query.status as string | undefined;
    const filtered = filter && ['paid', 'partial', 'unpaid'].includes(filter) ? rows.filter((r) => r.status === filter) : rows;
    const sum = (k: 'expected' | 'paid') => rows.reduce((a, r) => a + r[k], 0);
    res.json({
      success: true,
      data: {
        perHeadAmount: perHead,
        summary: {
          families: rows.length,
          members: rows.reduce((a, r) => a + r.members, 0),
          expectedTotal: sum('expected'),
          paidTotal: sum('paid'),
          paidFamilies: rows.filter((r) => r.status === 'paid').length,
          partialFamilies: rows.filter((r) => r.status === 'partial').length,
          unpaidFamilies: rows.filter((r) => r.status === 'unpaid').length,
        },
        families: filtered,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** "Mark paid": records a contribution for the family's remaining expected Fitr. */
export const fitrMarkPaid = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await loadCampaign(req, res);
    if (!campaign) return;
    if (campaign.type !== 'fitr') return res.status(400).json({ success: false, message: 'This is not a Zakat al-Fitr campaign' });
    const { familyId } = req.params;
    if (!isId(familyId)) return res.status(404).json({ success: false, message: 'Family not found' });
    const tenantId = oid(req.tenantId);
    const [members, paidRows] = await Promise.all([
      Member.countDocuments({ tenantId, familyId: oid(familyId), status: 'active', isDead: { $ne: true } }),
      CampaignContribution.aggregate([
        { $match: { tenantId, campaignId: campaign._id, familyId: oid(familyId), status: 'approved' } },
        { $group: { _id: null, paid: { $sum: '$amount' } } },
      ]),
    ]);
    const expected = members * (campaign.perHeadAmount || 0);
    const balance = expected - (paidRows[0]?.paid || 0);
    const amount = req.body.amount !== undefined ? Number(req.body.amount) : balance;
    if (!(amount > 0)) {
      return res.status(400).json({ success: false, message: balance <= 0 ? 'This family has already paid in full' : 'Enter an amount' });
    }
    const c = await createContribution(campaign, { ...req.body, familyId, amount }, req);
    res.status(201).json({ success: true, data: c });
  } catch (e: any) {
    res.status(e.status || e.statusCode || 500).json({ success: false, message: e.message });
  }
};

// ---------------------------------------------------------------- Udhiya

export const listUdhiya = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await loadCampaign(req, res);
    if (!campaign) return;
    const data = await UdhiyaBooking.find({ tenantId: req.tenantId, campaignId: campaign._id }).sort({ createdAt: 1 });
    res.json({
      success: true,
      data: data.map((b: any) => {
        const booked = b.participants.reduce((a: number, p: any) => a + p.shares, 0);
        return { ...b.toObject(), bookedShares: booked, openShares: Math.max(0, b.shareCount - booked), total: b.shareCount * b.perSharePrice };
      }),
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const cleanParticipants = (list: any, shareCount: number) => {
  if (!Array.isArray(list)) return { error: 'Participants must be a list' } as const;
  const out = list.map((p: any) => ({
    ...(p._id && isId(String(p._id)) ? { _id: p._id } : {}),
    name: String(p.name || '').trim(),
    familyId: p.familyId && isId(String(p.familyId)) ? p.familyId : undefined,
    shares: Math.max(1, parseInt(p.shares, 10) || 1),
    paid: !!p.paid,
    contributionId: p.contributionId && isId(String(p.contributionId)) ? p.contributionId : undefined,
  }));
  if (out.some((p) => !p.name)) return { error: 'Every participant needs a name' } as const;
  if (out.reduce((a, p) => a + p.shares, 0) > shareCount) return { error: 'Participants hold more shares than the animal has' } as const;
  return { value: out } as const;
};

export const createUdhiya = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await loadCampaign(req, res);
    if (!campaign) return;
    if (campaign.type !== 'udhiya') return res.status(400).json({ success: false, message: 'This is not an Udhiya campaign' });
    const { animal = 'cow', perSharePrice, collectionDay, note } = req.body;
    const shareCount = animal === 'goat' || animal === 'sheep' ? 1 : parseInt(req.body.shareCount, 10) || 7;
    if (!(Number(perSharePrice) >= 0)) return res.status(400).json({ success: false, message: 'Enter the price per share' });
    const parts = cleanParticipants(req.body.participants || [], shareCount);
    if ('error' in parts) return res.status(400).json({ success: false, message: parts.error });
    // Paid state is only ever set by recording a receipt.
    const participants = parts.value.map((p) => ({ ...p, paid: false, contributionId: undefined }));
    const b = await UdhiyaBooking.create({
      tenantId: req.tenantId, campaignId: campaign._id, animal, shareCount, perSharePrice: Number(perSharePrice),
      participants, collectionDay: collectionDay || undefined, note,
    });
    res.status(201).json({ success: true, data: b });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const updateUdhiya = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await loadCampaign(req, res);
    if (!campaign) return;
    if (!isId(req.params.bid)) return res.status(404).json({ success: false, message: 'Booking not found' });
    const b: any = await UdhiyaBooking.findOne({ _id: req.params.bid, tenantId: req.tenantId, campaignId: campaign._id });
    if (!b) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (req.body.perSharePrice !== undefined) b.perSharePrice = Number(req.body.perSharePrice);
    if (req.body.collectionDay !== undefined) b.collectionDay = req.body.collectionDay || undefined;
    if (req.body.note !== undefined) b.note = req.body.note;
    if (req.body.participants !== undefined) {
      const parts = cleanParticipants(req.body.participants, b.shareCount);
      if ('error' in parts) return res.status(400).json({ success: false, message: parts.error });
      // Keep paid state server-side: carry it over only for participants that already existed.
      const existing = new Map<string, any>(b.participants.map((p: any) => [String(p._id), p]));
      b.participants = parts.value.map((p: any) => {
        const old = p._id ? existing.get(String(p._id)) : undefined;
        return { ...p, paid: old?.paid || false, contributionId: old?.contributionId };
      });
    }
    await b.save();
    res.json({ success: true, data: b });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const deleteUdhiya = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await loadCampaign(req, res);
    if (!campaign) return;
    if (!isId(req.params.bid)) return res.status(404).json({ success: false, message: 'Booking not found' });
    const b: any = await UdhiyaBooking.findOne({ _id: req.params.bid, tenantId: req.tenantId, campaignId: campaign._id });
    if (!b) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (b.participants.some((p: any) => p.paid)) {
      return res.status(400).json({ success: false, message: 'Some shares are already paid. Cancel those receipts first.' });
    }
    await b.deleteOne();
    res.json({ success: true, message: 'Booking deleted' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** Records the receipt for one participant (shares x per-share price) and marks it paid. */
export const udhiyaParticipantPay = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await loadCampaign(req, res);
    if (!campaign) return;
    if (!isId(req.params.bid) || !isId(req.params.pid)) return res.status(404).json({ success: false, message: 'Booking not found' });
    const b: any = await UdhiyaBooking.findOne({ _id: req.params.bid, tenantId: req.tenantId, campaignId: campaign._id });
    const p = b?.participants.id(req.params.pid);
    if (!b || !p) return res.status(404).json({ success: false, message: 'Participant not found' });
    if (p.paid) return res.status(400).json({ success: false, message: 'This participant has already paid' });
    const c = await createContribution(
      campaign,
      { ...req.body, familyId: p.familyId?.toString(), donorName: p.name, amount: p.shares * b.perSharePrice, udhiyaBookingId: b._id },
      req
    );
    p.paid = true;
    p.contributionId = c._id;
    await b.save();
    res.status(201).json({ success: true, data: { contribution: c, booking: b } });
  } catch (e: any) {
    res.status(e.status || e.statusCode || 500).json({ success: false, message: e.message });
  }
};
