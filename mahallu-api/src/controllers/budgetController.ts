import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import { Budget } from '../models/Budget';
import { FinancialPeriod } from '../models/FinancialPeriod';
import { LedgerItem, Ledger } from '../models/MasterAccount';
import { computeLedgerActuals } from './periodController';

const tenantOf = (req: AuthRequest): string | undefined => {
  if (req.tenantId) return req.tenantId;
  if (req.isSuperAdmin && req.query.tenantId) return String(req.query.tenantId);
  return undefined;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

const cleanLines = (lines: any): { ok: true; lines: any[] } | { ok: false; message: string } => {
  if (!Array.isArray(lines)) return { ok: false, message: 'Budget lines must be a list.' };
  const out: any[] = [];
  for (const [i, l] of lines.entries()) {
    const name = String(l?.name || '').trim();
    const amount = Number(l?.amount);
    if (!name) return { ok: false, message: `Line ${i + 1} needs a name.` };
    if (!['income', 'expense'].includes(l?.type)) return { ok: false, message: `Line "${name}" must be income or expense.` };
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, message: `Line "${name}" needs an amount of zero or more.` };
    const line: any = { name, type: l.type, amount: round2(amount) };
    if (l.ledgerId && mongoose.Types.ObjectId.isValid(l.ledgerId)) line.ledgerId = l.ledgerId;
    if (l.categoryId && mongoose.Types.ObjectId.isValid(l.categoryId)) line.categoryId = l.categoryId;
    out.push(line);
  }
  return { ok: true, lines: out };
};

export const listBudgets = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantOf(req);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    const q: any = { tenantId };
    if (req.query.periodId) q.periodId = req.query.periodId;
    const budgets = await Budget.find(q).populate('periodId', 'name startDate endDate status').sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: budgets });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const loadOwned = async (req: AuthRequest, res: Response) => {
  const budget = await Budget.findById(req.params.id);
  if (!budget || (req.tenantId && budget.tenantId.toString() !== req.tenantId)) {
    res.status(404).json({ success: false, message: 'Budget not found' });
    return null;
  }
  return budget;
};

export const getBudget = async (req: AuthRequest, res: Response) => {
  try {
    const budget = await loadOwned(req, res);
    if (!budget) return;
    res.json({ success: true, data: budget });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBudget = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantOf(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    const period = await FinancialPeriod.findById(req.body.periodId);
    if (!period || period.tenantId.toString() !== tenantId.toString()) {
      return res.status(400).json({ success: false, message: 'Choose a financial period for this budget.' });
    }
    if (await Budget.exists({ tenantId, periodId: period._id })) {
      return res.status(409).json({ success: false, message: `${period.name} already has a budget. Open it to make changes.` });
    }
    const cleaned = cleanLines(req.body.lines ?? []);
    if (!cleaned.ok) return res.status(400).json({ success: false, message: cleaned.message });

    const budget = await Budget.create({
      tenantId,
      periodId: period._id,
      name: req.body.name || `${period.name} budget`,
      lines: cleaned.lines,
      status: 'draft',
      createdBy: req.user?._id,
    });
    res.status(201).json({ success: true, data: budget });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBudget = async (req: AuthRequest, res: Response) => {
  try {
    const budget = await loadOwned(req, res);
    if (!budget) return;
    if (req.body.name !== undefined) budget.name = String(req.body.name).trim();
    if (req.body.lines !== undefined) {
      const cleaned = cleanLines(req.body.lines);
      if (!cleaned.ok) return res.status(400).json({ success: false, message: cleaned.message });
      budget.lines = cleaned.lines as any;
    }
    if (req.body.status && ['draft', 'approved'].includes(req.body.status)) {
      if (req.body.status === 'approved' && budget.status !== 'approved') {
        budget.approvedBy = req.user?._id;
        budget.approvedAt = new Date();
      }
      budget.status = req.body.status;
    }
    await budget.save();
    res.json({ success: true, data: budget });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBudget = async (req: AuthRequest, res: Response) => {
  try {
    const budget = await loadOwned(req, res);
    if (!budget) return;
    await budget.deleteOne();
    res.json({ success: true, message: 'Budget deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Suggested lines for a period, from the previous period's actual ledger totals.
 * `periodId` is the period being budgeted; the previous one is the latest that ended before it.
 */
export const getPriorActuals = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantOf(req);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    const period = await FinancialPeriod.findById(req.query.periodId);
    if (!period || period.tenantId.toString() !== tenantId) {
      return res.status(404).json({ success: false, message: 'Period not found' });
    }
    const prior = await FinancialPeriod.findOne({ tenantId, endDate: { $lt: period.startDate } }).sort({ endDate: -1 });
    if (!prior) {
      return res.status(404).json({ success: false, message: 'There is no earlier period to copy actuals from. Create last year\'s period first.' });
    }
    const actuals = await computeLedgerActuals(tenantId, prior.startDate, prior.endDate);
    res.json({
      success: true,
      data: {
        fromPeriod: { _id: prior._id, name: prior.name },
        lines: actuals.ledgerTotals.map((l) => ({ ledgerId: l.ledgerId, name: l.name, type: l.type, amount: Math.round(l.total) })),
        totals: actuals.totals,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBudgetVsActual = async (req: AuthRequest, res: Response) => {
  try {
    const budget = await loadOwned(req, res);
    if (!budget) return;
    const period = await FinancialPeriod.findById(budget.periodId);
    if (!period) return res.status(404).json({ success: false, message: 'The period for this budget no longer exists.' });

    const tenantObjectId = budget.tenantId;
    const range = { $gte: period.startDate, $lte: period.endDate };

    const byLedger = await LedgerItem.aggregate([
      { $match: { tenantId: tenantObjectId, date: range } },
      { $group: { _id: { ledgerId: '$ledgerId', type: '$type' }, total: { $sum: '$amount' } } },
    ]);
    const byCategory = await LedgerItem.aggregate([
      { $match: { tenantId: tenantObjectId, date: range, categoryId: { $ne: null } } },
      { $group: { _id: { categoryId: '$categoryId', type: '$type' }, total: { $sum: '$amount' } } },
    ]);
    const ledgerActual = new Map(byLedger.map((r) => [`${r._id.ledgerId}:${r._id.type}`, r.total as number]));
    const categoryActual = new Map(byCategory.map((r) => [`${r._id.categoryId}:${r._id.type}`, r.total as number]));

    const now = Date.now();
    const total = period.endDate.getTime() - period.startDate.getTime();
    const elapsed = Math.min(1, Math.max(0, (now - period.startDate.getTime()) / total));

    const usedLedgers = new Set<string>();
    const lines = budget.lines.map((l) => {
      let actual = 0;
      if (l.ledgerId) {
        usedLedgers.add(`${l.ledgerId}:${l.type}`);
        actual = ledgerActual.get(`${l.ledgerId}:${l.type}`) || 0;
      } else if (l.categoryId) {
        actual = categoryActual.get(`${l.categoryId}:${l.type}`) || 0;
      }
      actual = round2(actual);
      const benchmark = round2(l.amount * elapsed);
      const variance = round2(actual - l.amount);
      const variancePct = l.amount > 0 ? round2((variance / l.amount) * 100) : null;
      let status: 'on-track' | 'over' | 'under' = 'on-track';
      if (actual > benchmark * 1.05 && actual > 0) status = 'over';
      else if (actual < benchmark * 0.95) status = 'under';
      // Over on expense is the worrying direction; over on income is good news.
      const favourable = l.type === 'expense' ? status !== 'over' : status !== 'under';
      return {
        _id: l._id,
        ledgerId: l.ledgerId,
        categoryId: l.categoryId,
        name: l.name,
        type: l.type,
        budget: l.amount,
        actual,
        benchmark,
        variance,
        variancePct,
        percentUsed: l.amount > 0 ? round2((actual / l.amount) * 100) : null,
        status,
        favourable,
      };
    });

    // Ledgers with activity but no budget line
    const unbudgetedRows = byLedger.filter((r) => !usedLedgers.has(`${r._id.ledgerId}:${r._id.type}`));
    const ledgerDocs = await Ledger.find({ _id: { $in: unbudgetedRows.map((r) => r._id.ledgerId) } }).select('name').lean();
    const nameOf = new Map(ledgerDocs.map((l: any) => [String(l._id), l.name as string]));
    const unbudgeted = unbudgetedRows
      .map((r) => ({
        ledgerId: r._id.ledgerId,
        name: nameOf.get(String(r._id.ledgerId)) || 'Unknown ledger',
        type: r._id.type as 'income' | 'expense',
        actual: round2(r.total),
      }))
      .sort((a, b) => b.actual - a.actual);

    const sum = (type: 'income' | 'expense', key: 'budget' | 'actual') =>
      round2(lines.filter((l) => l.type === type).reduce((s, l) => s + l[key], 0));
    const summary = {
      incomeBudget: sum('income', 'budget'),
      incomeActual: sum('income', 'actual'),
      expenseBudget: sum('expense', 'budget'),
      expenseActual: sum('expense', 'actual'),
      unbudgetedIncome: round2(unbudgeted.filter((u) => u.type === 'income').reduce((s, u) => s + u.actual, 0)),
      unbudgetedExpense: round2(unbudgeted.filter((u) => u.type === 'expense').reduce((s, u) => s + u.actual, 0)),
    };

    res.json({
      success: true,
      data: {
        budget: { _id: budget._id, name: budget.name, status: budget.status },
        period: { _id: period._id, name: period.name, startDate: period.startDate, endDate: period.endDate, status: period.status },
        elapsedPercent: round2(elapsed * 100),
        lines,
        unbudgeted,
        summary,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
