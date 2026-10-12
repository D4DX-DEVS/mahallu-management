import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import Collector from '../models/Collector';
import CashClosing from '../models/CashClosing';
import User from '../models/User';
import Member from '../models/Member';
import { computeExpectedCash } from '../services/cashExpectedService';
import { isDateKey, todayKey } from '../utils/dayWindow';

const isId = (v: any) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
const needTenant = (req: AuthRequest, res: Response): string | null => {
  if (!req.tenantId) {
    res.status(400).json({ success: false, message: 'Select a mahallu first' });
    return null;
  }
  return req.tenantId;
};

const clean = async (body: any, tenantId: string): Promise<{ data?: any; error?: string }> => {
  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.phone !== undefined) data.phone = String(body.phone).trim();
  if (body.active !== undefined) data.active = !!body.active;
  if (body.wards !== undefined) {
    const w = Array.isArray(body.wards) ? body.wards : String(body.wards).split(',');
    data.wards = [...new Set(w.map((x: any) => String(x).trim()).filter(Boolean))];
  }
  if (body.userId !== undefined) {
    if (body.userId && (!isId(String(body.userId)) || !(await User.exists({ _id: body.userId, tenantId })))) return { error: 'User not found in this mahallu' };
    data.userId = body.userId || undefined;
  }
  if (body.memberId !== undefined) {
    if (body.memberId && (!isId(String(body.memberId)) || !(await Member.exists({ _id: body.memberId, tenantId })))) return { error: 'Member not found in this mahallu' };
    data.memberId = body.memberId || undefined;
  }
  return { data };
};

export const listCollectors = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    const q: any = { tenantId };
    if (req.query.active === 'true') q.active = true;
    if (req.query.active === 'false') q.active = false;
    const data = await Collector.find(q).sort({ active: -1, name: 1 }).limit(500);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const createCollector = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    const { data, error } = await clean(req.body, tenantId);
    if (error) return res.status(400).json({ success: false, message: error });
    if (!data.name) return res.status(400).json({ success: false, message: 'Collector name is required' });
    const c = await Collector.create({ ...data, tenantId });
    res.status(201).json({ success: true, data: c });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const updateCollector = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Collector not found' });
    const { data, error } = await clean(req.body, tenantId);
    if (error) return res.status(400).json({ success: false, message: error });
    if (data.name === '') return res.status(400).json({ success: false, message: 'Collector name is required' });
    const c = await Collector.findOneAndUpdate({ _id: req.params.id, tenantId }, data, { new: true, runValidators: true });
    if (!c) return res.status(404).json({ success: false, message: 'Collector not found' });
    res.json({ success: true, data: c });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const deleteCollector = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Collector not found' });
    const c = await Collector.findOne({ _id: req.params.id, tenantId });
    if (!c) return res.status(404).json({ success: false, message: 'Collector not found' });
    if (await CashClosing.exists({ tenantId, collectorId: c._id })) {
      return res.status(400).json({ success: false, message: 'This collector has day-closing records. Mark them inactive instead of deleting.' });
    }
    await c.deleteOne();
    res.json({ success: true, message: 'Collector deleted' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** Cash a collector is expected to hand over for a day (default today). */
export const collectorDay = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = needTenant(req, res);
    if (!tenantId) return;
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Collector not found' });
    const c = await Collector.findOne({ _id: req.params.id, tenantId });
    if (!c) return res.status(404).json({ success: false, message: 'Collector not found' });
    const date = req.query.date === undefined ? todayKey() : req.query.date;
    if (!isDateKey(date)) return res.status(400).json({ success: false, message: 'Date must look like 2026-10-12' });
    const expected = await computeExpectedCash(tenantId, date, { collectorId: String(c._id) });
    const closing = await CashClosing.findOne({ tenantId, dateKey: date, scopeKey: `c:${c._id}` });
    res.json({ success: true, data: { collector: c, date, ...expected, closing } });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
};
