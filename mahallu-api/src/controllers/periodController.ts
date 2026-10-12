import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import { FinancialPeriod, IFinancialPeriod } from '../models/FinancialPeriod';
import { Ledger, LedgerItem, MahalluAccount, InstituteAccount } from '../models/MasterAccount';
import { Varisangya, Zakat } from '../models/Collectible';
import { ZakatDistribution } from '../models/Zakat';

const tenantOf = (req: AuthRequest): string | undefined => {
  if (req.tenantId) return req.tenantId;
  if (req.isSuperAdmin && req.query.tenantId) return String(req.query.tenantId);
  return undefined;
};

const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
const endOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ledger totals by ledger, plus income / expense / net for a date range. Shared with budgets. */
export const computeLedgerActuals = async (tenantId: string, start: Date, end: Date) => {
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const rows = await LedgerItem.aggregate([
    { $match: { tenantId: tenantObjectId, date: { $gte: start, $lte: end } } },
    { $group: { _id: { ledgerId: '$ledgerId', type: '$type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const ledgerIds = rows.map((r) => r._id.ledgerId);
  const ledgers = await Ledger.find({ _id: { $in: ledgerIds } }).select('name type').lean();
  const names = new Map(ledgers.map((l: any) => [String(l._id), l.name as string]));

  const ledgerTotals = rows
    .map((r) => ({
      ledgerId: r._id.ledgerId as mongoose.Types.ObjectId,
      name: names.get(String(r._id.ledgerId)) || 'Unknown ledger',
      type: r._id.type as 'income' | 'expense',
      total: round2(r.total),
      count: r.count as number,
    }))
    .sort((a, b) => b.total - a.total);
  const income = round2(ledgerTotals.filter((l) => l.type === 'income').reduce((s, l) => s + l.total, 0));
  const expense = round2(ledgerTotals.filter((l) => l.type === 'expense').reduce((s, l) => s + l.total, 0));
  return { ledgerTotals, totals: { income, expense, net: round2(income - expense) } };
};

const snapshotAccounts = async (tenantId: string) => {
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const [mahallu, institute] = await Promise.all([
    MahalluAccount.find({ tenantId: tenantObjectId }).lean(),
    InstituteAccount.find({ tenantId: tenantObjectId }).lean(),
  ]);
  return [
    ...mahallu.map((a: any) => ({ accountId: a._id, accountType: 'mahallu' as const, name: a.accountName, balance: a.balance || 0 })),
    ...institute.map((a: any) => ({ accountId: a._id, accountType: 'institute' as const, name: a.accountName, balance: a.balance || 0 })),
  ];
};

const buildChecklist = async (period: IFinancialPeriod) => {
  const tenantId = period.tenantId;
  const range = { $gte: period.startDate, $lte: period.endDate };
  const [pendingVarisangya, pendingZakat, proposedDistributions, earlierOpen] = await Promise.all([
    Varisangya.countDocuments({ tenantId, status: 'pending', paymentDate: range }),
    Zakat.countDocuments({ tenantId, status: 'pending', paymentDate: range }),
    ZakatDistribution.countDocuments({ tenantId, status: 'proposed', distributionDate: range }),
    FinancialPeriod.countDocuments({ tenantId, status: 'open', endDate: { $lt: period.startDate } }),
  ]);
  const pendingReceipts = pendingVarisangya + pendingZakat;
  return [
    {
      key: 'pending_receipts',
      label: 'All receipts in this period are approved or rejected',
      ok: pendingReceipts === 0,
      blocking: true,
      detail: pendingReceipts === 0 ? 'No receipts are waiting for approval.' : `${pendingReceipts} receipt(s) are still waiting for approval.`,
    },
    {
      key: 'proposed_distributions',
      label: 'All zakat distributions are approved or rejected',
      ok: proposedDistributions === 0,
      blocking: true,
      detail: proposedDistributions === 0 ? 'No zakat distributions are waiting for approval.' : `${proposedDistributions} zakat distribution(s) are still proposed.`,
    },
    {
      key: 'earlier_periods',
      label: 'Earlier periods are closed',
      ok: earlierOpen === 0,
      blocking: false,
      detail: earlierOpen === 0 ? 'No earlier period is open.' : `${earlierOpen} earlier period(s) are still open. Closing them first keeps balances in order.`,
    },
  ];
};

const sanitize = (p: any) => p;

export const listPeriods = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantOf(req);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    const periods = await FinancialPeriod.find({ tenantId })
      .populate('closedBy', 'name')
      .sort({ startDate: -1 })
      .lean();
    res.json({ success: true, data: periods.map(sanitize) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPeriod = async (req: AuthRequest, res: Response) => {
  try {
    const period = await FinancialPeriod.findById(req.params.id).populate('closedBy', 'name').lean();
    if (!period || (req.tenantId && period.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Period not found' });
    }
    res.json({ success: true, data: period });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPeriod = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantOf(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });

    const name = String(req.body.name || '').trim();
    const s = new Date(req.body.startDate);
    const e = new Date(req.body.endDate);
    if (!name) return res.status(400).json({ success: false, message: 'Give the financial year a name, for example "FY 2026-27".' });
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return res.status(400).json({ success: false, message: 'Enter a valid start and end date.' });
    }
    const startDate = startOfDay(s);
    const endDate = endOfDay(e);
    if (endDate <= startDate) {
      return res.status(400).json({ success: false, message: 'The end date must be after the start date.' });
    }

    const overlap = await FinancialPeriod.findOne({
      tenantId,
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    }).select('name');
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: `These dates overlap with ${overlap.name}. Adjust the start or end date so periods do not share days.`,
      });
    }
    if (await FinancialPeriod.exists({ tenantId, name })) {
      return res.status(409).json({ success: false, message: `A period named "${name}" already exists.` });
    }

    const period = await FinancialPeriod.create({
      tenantId,
      name,
      startDate,
      endDate,
      status: 'open',
      createdBy: req.user?._id,
      history: [{ action: 'created', by: req.user?._id, byName: req.user?.name, at: new Date() }],
    });
    res.status(201).json({ success: true, data: period });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const loadOwned = async (req: AuthRequest, res: Response) => {
  const period = await FinancialPeriod.findById(req.params.id);
  if (!period || (req.tenantId && period.tenantId.toString() !== req.tenantId)) {
    res.status(404).json({ success: false, message: 'Period not found' });
    return null;
  }
  return period;
};

/** Checklist and the snapshot that closing would write, without changing anything. */
export const previewClose = async (req: AuthRequest, res: Response) => {
  try {
    const period = await loadOwned(req, res);
    if (!period) return;
    const [checklist, actuals, accounts] = await Promise.all([
      buildChecklist(period),
      computeLedgerActuals(period.tenantId.toString(), period.startDate, period.endDate),
      snapshotAccounts(period.tenantId.toString()),
    ]);
    res.json({
      success: true,
      data: {
        period,
        checklist,
        canClose: period.status === 'open' && checklist.every((c) => !c.blocking || c.ok),
        confirmationText: `CLOSE ${period.name}`,
        totals: actuals.totals,
        ledgerTotals: actuals.ledgerTotals,
        openingBalances: accounts,
        balancesAsOf: new Date(),
        balancesNote:
          period.endDate < new Date()
            ? 'Account balances are as of today, not the last day of the period.'
            : undefined,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const closePeriod = async (req: AuthRequest, res: Response) => {
  try {
    const period = await loadOwned(req, res);
    if (!period) return;
    if (period.status === 'closed') {
      return res.status(409).json({ success: false, message: `${period.name} is already closed.` });
    }

    const expected = `CLOSE ${period.name}`;
    if (String(req.body?.confirmation || '').trim() !== expected) {
      return res.status(400).json({
        success: false,
        message: `To confirm, type exactly: ${expected}`,
      });
    }

    const checklist = await buildChecklist(period);
    const blockers = checklist.filter((c) => c.blocking && !c.ok);
    if (blockers.length) {
      return res.status(409).json({
        success: false,
        code: 'PERIOD_CLOSE_BLOCKED',
        message: `${period.name} cannot be closed yet. ${blockers.map((b) => b.detail).join(' ')}`,
        data: { checklist },
      });
    }

    const [actuals, accounts] = await Promise.all([
      computeLedgerActuals(period.tenantId.toString(), period.startDate, period.endDate),
      snapshotAccounts(period.tenantId.toString()),
    ]);

    const now = new Date();
    period.status = 'closed';
    period.closedAt = now;
    period.closedBy = req.user?._id;
    period.closingNote = req.body?.note ? String(req.body.note).trim() : undefined;
    period.totals = actuals.totals;
    period.ledgerTotals = actuals.ledgerTotals as any;
    period.openingBalances = accounts as any;
    period.balancesAsOf = now;
    period.history.push({ action: 'closed', by: req.user?._id, byName: req.user?.name, at: now, note: period.closingNote });
    await period.save();

    console.log(`[audit] period closed: ${period.name} (${period._id}) tenant=${period.tenantId} by=${req.user?._id}`);
    res.json({ success: true, data: period, message: `${period.name} is closed. Entries dated ${fmt(period.startDate)} to ${fmt(period.endDate)} are now locked.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const reopenPeriod = async (req: AuthRequest, res: Response) => {
  try {
    const allowed = req.isSuperAdmin || req.user?.permissions?.financeAdmin === true;
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'Only a super admin or a finance admin can reopen a closed period. Ask one of them to reopen it.',
      });
    }
    const period = await loadOwned(req, res);
    if (!period) return;
    if (period.status !== 'closed') {
      return res.status(409).json({ success: false, message: `${period.name} is already open.` });
    }
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) {
      return res.status(400).json({ success: false, message: 'Explain why this period is being reopened (at least a few words). It is kept in the audit trail.' });
    }

    const now = new Date();
    period.status = 'open';
    period.history.push({ action: 'reopened', by: req.user?._id, byName: req.user?.name, at: now, note: reason });
    await period.save();

    console.log(`[audit] period reopened: ${period.name} (${period._id}) tenant=${period.tenantId} by=${req.user?._id} reason=${reason}`);
    res.json({ success: true, data: period, message: `${period.name} is open again. Close it once your corrections are done.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Only an open period can be removed (typo, wrong dates); a closed one must be reopened first. Audit-logged. */
export const deletePeriod = async (req: AuthRequest, res: Response) => {
  try {
    const period = await loadOwned(req, res);
    if (!period) return;
    if (period.status === 'closed') {
      return res.status(409).json({ success: false, message: 'A closed period cannot be deleted. Reopen it first (with a reason) if it was created by mistake.' });
    }
    console.log(`[audit] period deleted: ${period.name} (${period._id}) tenant=${period.tenantId} by=${req.user?._id}`);
    await period.deleteOne();
    res.json({ success: true, message: 'Period deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
