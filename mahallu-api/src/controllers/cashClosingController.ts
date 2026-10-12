import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import CashClosing from '../models/CashClosing';
import Collector from '../models/Collector';
import { computeExpectedCash } from '../services/cashExpectedService';
import { dayWindow, isDateKey, todayKey } from '../utils/dayWindow';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

const isId = (v: any) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

const needTenant = (req: AuthRequest, res: Response): string | null => {
  if (!req.tenantId) {
    res.status(400).json({ success: false, message: 'Select a mahallu first' });
    return null;
  }
  return req.tenantId;
};

const scopeFrom = (src: any): { collectorId?: string; userId?: string; scopeKey: string } | { error: string } => {
  const collectorId = src.collectorId || undefined;
  const userId = src.userId || undefined;
  if (collectorId && userId) return { error: 'Choose either a collector or a user, not both' };
  if (collectorId && !isId(String(collectorId))) return { error: 'Invalid collector' };
  if (userId && !isId(String(userId))) return { error: 'Invalid user' };
  return {
    collectorId: collectorId && String(collectorId),
    userId: userId && String(userId),
    scopeKey: collectorId ? `c:${collectorId}` : userId ? `u:${userId}` : 'all',
  };
};

const dateFrom = (v: any): string | null => (v === undefined || v === '' ? todayKey() : isDateKey(v) ? v : null);

const DENOM_VALUES = ['2000', '500', '200', '100', '50', '20', '10', '5', '2', '1'];
const parseDenominations = (d: any): { counted: number; map: Record<string, number> } | null => {
  if (!d || typeof d !== 'object') return null;
  const map: Record<string, number> = {};
  let counted = 0;
  for (const k of Object.keys(d)) {
    if (!DENOM_VALUES.includes(k)) continue;
    const n = Math.floor(Number(d[k]));
    if (!Number.isFinite(n) || n < 0) continue;
    if (n > 0) {
      map[k] = n;
      counted += n * Number(k);
    }
  }
  return { counted, map };
};

export const previewCashClosing = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    const date = dateFrom(req.query.date);
    if (!date) return res.status(400).json({ success: false, message: 'Date must look like 2026-10-12' });
    const scope = scopeFrom(req.query);
    if ('error' in scope) return res.status(400).json({ success: false, message: scope.error });
    const [expected, existing] = await Promise.all([
      computeExpectedCash(tenantId, date, scope),
      CashClosing.findOne({ tenantId, dateKey: date, scopeKey: scope.scopeKey }),
    ]);
    res.json({ success: true, data: { date, scopeKey: scope.scopeKey, ...expected, existing } });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const listCashClosings = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    const { page, limit, skip } = getPaginationParams(req);
    const q: any = { tenantId };
    if (req.query.status) q.status = req.query.status;
    if (req.query.collectorId && isId(String(req.query.collectorId))) q.collectorId = req.query.collectorId;
    if (isDateKey(req.query.from) || isDateKey(req.query.to)) {
      q.dateKey = {};
      if (isDateKey(req.query.from)) q.dateKey.$gte = req.query.from;
      if (isDateKey(req.query.to)) q.dateKey.$lte = req.query.to;
    }
    if (req.query.variance === 'true') q.difference = { $ne: 0 };
    const [rows, total, agg] = await Promise.all([
      CashClosing.find(q).sort({ dateKey: -1, createdAt: -1 }).skip(skip).limit(limit)
        .populate('collectorId', 'name').populate('submittedBy verifiedBy', 'name'),
      CashClosing.countDocuments(q),
      CashClosing.aggregate([
        { $match: { ...q, tenantId: new mongoose.Types.ObjectId(tenantId) } },
        { $group: { _id: null, short: { $sum: { $cond: [{ $lt: ['$difference', 0] }, '$difference', 0] } }, excess: { $sum: { $cond: [{ $gt: ['$difference', 0] }, '$difference', 0] } }, withVariance: { $sum: { $cond: [{ $ne: ['$difference', 0] }, 1, 0] } } } },
      ]),
    ]);
    const body: any = createPaginationResponse(rows, total, page, limit);
    body.summary = { totalShort: agg[0]?.short || 0, totalExcess: agg[0]?.excess || 0, closingsWithVariance: agg[0]?.withVariance || 0 };
    res.json(body);
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getCashClosing = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Closing not found' });
    const c = await CashClosing.findOne({ _id: req.params.id, tenantId })
      .populate('collectorId', 'name').populate('submittedBy verifiedBy reopenedBy', 'name');
    if (!c) return res.status(404).json({ success: false, message: 'Closing not found' });
    res.json({ success: true, data: c });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** Submit (or re-submit after a reopen). Expected cash is always recomputed on the server. */
export const submitCashClosing = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    const date = dateFrom(req.body.date);
    if (!date) return res.status(400).json({ success: false, message: 'Date must look like 2026-10-12' });
    if (date > todayKey()) return res.status(400).json({ success: false, message: 'You cannot close a day that has not happened yet' });
    const scope = scopeFrom(req.body);
    if ('error' in scope) return res.status(400).json({ success: false, message: scope.error });
    if (scope.collectorId && !(await Collector.exists({ _id: scope.collectorId, tenantId }))) {
      return res.status(404).json({ success: false, message: 'Collector not found' });
    }

    const denoms = parseDenominations(req.body.denominations);
    let counted = req.body.countedCash !== undefined && req.body.countedCash !== '' ? Number(req.body.countedCash) : denoms ? denoms.counted : NaN;
    if (!Number.isFinite(counted) || counted < 0) return res.status(400).json({ success: false, message: 'Enter the cash you counted' });
    if (denoms && Object.keys(denoms.map).length && denoms.counted !== counted) {
      return res.status(400).json({ success: false, message: `The notes and coins add up to ${denoms.counted}, but the counted cash is ${counted}` });
    }

    const expected = await computeExpectedCash(tenantId, date, scope);
    const difference = Math.round((counted - expected.expectedCash) * 100) / 100;
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    if (difference !== 0 && !note) {
      return res.status(400).json({
        success: false,
        message: `The count is ${difference < 0 ? 'short' : 'over'} by ${Math.abs(difference)}. Add a note to explain the difference.`,
      });
    }

    const existing: any = await CashClosing.findOne({ tenantId, dateKey: date, scopeKey: scope.scopeKey });
    if (existing && existing.status !== 'reopened') {
      return res.status(409).json({ success: false, message: `This day is already ${existing.status}. Ask a verifier to reopen it to change it.` });
    }
    const fields: any = {
      expectedCash: expected.expectedCash,
      breakdown: expected.breakdown,
      countedCash: counted,
      difference,
      denominations: denoms && Object.keys(denoms.map).length ? denoms.map : undefined,
      note,
      status: 'submitted',
      submittedBy: req.user?._id,
      submittedAt: new Date(),
      verifiedBy: undefined,
      verifiedAt: undefined,
    };
    let doc: any;
    if (existing) {
      existing.set(fields);
      existing.verifiedBy = undefined;
      existing.verifiedAt = undefined;
      doc = await existing.save();
    } else {
      doc = await CashClosing.create({
        ...fields, tenantId, dateKey: date, date: dayWindow(date).start,
        collectorId: scope.collectorId, userId: scope.userId, scopeKey: scope.scopeKey,
      });
    }
    res.status(existing ? 200 : 201).json({ success: true, data: doc });
  } catch (e: any) {
    if (e.code === 11000) return res.status(409).json({ success: false, message: 'This day was just closed by someone else' });
    res.status(500).json({ success: false, message: e.message });
  }
};

/** A second person confirms the closing. The submitter cannot verify their own count. */
export const verifyCashClosing = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Closing not found' });
    const c: any = await CashClosing.findOne({ _id: req.params.id, tenantId });
    if (!c) return res.status(404).json({ success: false, message: 'Closing not found' });
    if (c.status !== 'submitted') return res.status(400).json({ success: false, message: `Only a submitted closing can be verified (this one is ${c.status})` });
    if (c.submittedBy && String(c.submittedBy) === String(req.user?._id)) {
      return res.status(403).json({ success: false, message: 'Another admin must verify this closing. You submitted it.' });
    }
    c.status = 'verified';
    c.verifiedBy = req.user?._id;
    c.verifiedAt = new Date();
    await c.save();
    res.json({ success: true, data: c });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const reopenCashClosing = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Closing not found' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ success: false, message: 'Give a reason for reopening this day' });
    const c: any = await CashClosing.findOne({ _id: req.params.id, tenantId });
    if (!c) return res.status(404).json({ success: false, message: 'Closing not found' });
    if (c.status === 'reopened') return res.status(400).json({ success: false, message: 'This day is already reopened' });
    c.status = 'reopened';
    c.reopenedBy = req.user?._id;
    c.reopenedAt = new Date();
    c.reopenReason = reason;
    await c.save();
    res.json({ success: true, data: c });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
