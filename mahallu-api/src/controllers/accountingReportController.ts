import { Response } from 'express';
import { LedgerItem, Ledger, Category, InstituteAccount, MahalluAccount } from '../models/MasterAccount';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';
import { getPaginationParams } from '../utils/pagination';
import { round2 } from '../utils/money';

import { sendFailure } from '../utils/userMessages';
import {
  requireScope,
  parseIdParam,
  parseIdList,
  parseDateRange,
  verifyRecordAccess,
  isValidId,
  sendBadRequest,
  MSG,
} from '../utils/scope';

const oid = (id: string) => new mongoose.Types.ObjectId(id);

/**
 * What a report request is allowed to look at, derived from the caller and only then narrowed by
 * the query string.
 *
 *  - institute role: ALWAYS their own institute. `scope`, `includeEntities`, `instituteId` and
 *    `ledgerId`-style hints from the client are ignored, so scope=mahallu, a combined list naming
 *    a sibling institute, or someone else's instituteId can never widen the report.
 *  - mahall / super_admin: scope=mahallu, scope=combined&includeEntities=mahallu,<id>,... and a
 *    plain instituteId work as before (always inside the caller's Mahallu).
 *
 * Every id and date taken from the query is validated here, so a bad value is a 400 with a plain
 * message rather than a BSON error surfacing as a 500.
 */
interface ReportScope {
  isInstitute: boolean;
  tenant: { tenantId?: mongoose.Types.ObjectId };
  scope?: string;
  instituteId?: string;
  entities?: { mahallu: boolean; ids: string[] };
  dates?: { $gte?: Date; $lte?: Date };
}

function resolveReportScope(req: AuthRequest, res: Response): ReportScope | null {
  const caller = requireScope(req, res);
  if (!caller) return null;

  const dates = parseDateRange(req.query);
  if (!dates.ok) {
    sendBadRequest(res, dates.message);
    return null;
  }

  const tenant = caller.tenantId ? { tenantId: oid(caller.tenantId) } : {};

  if (caller.isInstitute) {
    return { isInstitute: true, tenant, scope: 'institute', instituteId: caller.instituteId, dates: dates.range };
  }

  const instituteId = parseIdParam(req.query.instituteId);
  const include = parseIdList(req.query.includeEntities, ['mahallu']);
  if (!instituteId.ok || !include.ok) {
    sendBadRequest(res, MSG.badId);
    return null;
  }
  const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;

  return {
    isInstitute: false,
    tenant,
    scope,
    instituteId: instituteId.value,
    entities: { mahallu: include.keywords.includes('mahallu'), ids: include.ids },
    dates: dates.range,
  };
}

const dateMatch = (rs: ReportScope): any => (rs.dates ? { date: { ...rs.dates } } : {});

/**
 * Build a MongoDB filter for LedgerItems based on the resolved scope.
 *
 * scope='mahallu'    → { instituteId: null }
 * scope='institute'  → { instituteId: <id> }  (requires instituteId param)
 * scope='combined'   → { $or: [{instituteId: null}, {instituteId: {$in: [...]}}] }
 *                       where includeEntities is comma-separated "mahallu,id1,id2,..."
 * (default / no scope) → existing behaviour: filter by instituteId if provided
 */
function buildScopeFilter(rs: ReportScope): any {
  if (rs.scope === 'mahallu') {
    return { instituteId: null };
  }
  if (rs.scope === 'combined' && rs.entities) {
    const hasMahallu = rs.entities.mahallu;
    const ids = rs.entities.ids.map(oid);
    if (hasMahallu && ids.length > 0) {
      return { $or: [{ instituteId: null }, { instituteId: { $in: ids } }] };
    }
    if (hasMahallu) return { instituteId: null };
    if (ids.length > 0) return { instituteId: { $in: ids } };
  }
  // Default: institute scope (existing behaviour)
  if (rs.instituteId) return { instituteId: oid(rs.instituteId) };
  return {};
}

/**
 * Build an account query for bank accounts based on the resolved scope.
 * Returns a query object to pass to InstituteAccount / MahalluAccount.
 */
/** A bank-account list on a report is bounded: no tenant has this many accounts, a runaway query should not be possible. */
const MAX_BANK_ACCOUNTS = 200;

/**
 * Page and size for a report listing. A report with no `limit` returns the first 100 rows (the most the
 * pager allows); `?page=` and `?limit=` (max 100) walk the rest. Totals never depend on the page.
 */
const reportPage = (req: AuthRequest) => {
  const { page, limit, skip } = getPaginationParams(req);
  const hasLimit = req.query.limit !== undefined && req.query.limit !== '';
  if (hasLimit) return { page, limit, skip };
  return { page, limit: 100, skip: (page - 1) * 100 };
};

const pageInfo = (page: number, limit: number, total: number) => ({
  page,
  limit,
  skip: (page - 1) * limit,
  total,
  totalPages: Math.ceil(total / limit),
});

/** Same order everywhere a report is paged, with _id as the final tie-break so pages never overlap or skip. */
const REPORT_ORDER: Record<string, 1 | -1> = { date: 1, createdAt: 1, _id: 1 };

async function getBankAccounts(tenantId: mongoose.Types.ObjectId, rs: ReportScope) {
  if (rs.scope === 'mahallu') {
    return MahalluAccount.find({ tenantId, status: 'active' }).select('accountName bankName balance').limit(MAX_BANK_ACCOUNTS);
  }
  if (rs.scope === 'combined' && rs.entities && (rs.entities.mahallu || rs.entities.ids.length > 0)) {
    const results: any[] = [];
    if (rs.entities.mahallu) {
      const ma = await MahalluAccount.find({ tenantId, status: 'active' }).select('accountName bankName balance').limit(MAX_BANK_ACCOUNTS);
      results.push(...ma.map((a: any) => ({ accountName: a.accountName, bankName: a.bankName, balance: a.balance, entity: 'Mahallu' })));
    }
    if (rs.entities.ids.length > 0) {
      const ia = await InstituteAccount.find({ tenantId, instituteId: { $in: rs.entities.ids.map(oid) }, status: 'active' })
        .populate('instituteId', 'name')
        .select('accountName bankName balance instituteId')
        .limit(MAX_BANK_ACCOUNTS);
      results.push(...ia.map((a: any) => ({ accountName: a.accountName, bankName: a.bankName, balance: a.balance, entity: (a.instituteId as any)?.name || 'Institute' })));
    }
    return results;
  }
  // Default: institute scope
  const query: any = { tenantId, status: 'active' };
  if (rs.instituteId) query.instituteId = oid(rs.instituteId);
  return InstituteAccount.find(query).populate('instituteId', 'name').select('accountName bankName balance instituteId').limit(MAX_BANK_ACCOUNTS);
}

/** Sum of the bank balances getBankAccounts lists, over the whole set (the listing is capped, a total must not be). */
async function getBankBalanceTotal(tenantId: mongoose.Types.ObjectId, rs: ReportScope): Promise<number> {
  const sum = async (Model: any, match: Record<string, any>): Promise<number> => {
    const [row] = await Model.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$balance' } } }]);
    return Number(row?.total) || 0;
  };
  if (rs.scope === 'mahallu') return sum(MahalluAccount, { tenantId, status: 'active' });
  if (rs.scope === 'combined' && rs.entities && (rs.entities.mahallu || rs.entities.ids.length > 0)) {
    let total = 0;
    if (rs.entities.mahallu) total += await sum(MahalluAccount, { tenantId, status: 'active' });
    if (rs.entities.ids.length > 0) {
      total += await sum(InstituteAccount, { tenantId, instituteId: { $in: rs.entities.ids.map(oid) }, status: 'active' });
    }
    return total;
  }
  const match: Record<string, any> = { tenantId, status: 'active' };
  if (rs.instituteId) match.instituteId = oid(rs.instituteId);
  return sum(InstituteAccount, match);
}

/**
 * Day Book: chronological list of the transactions in a date range, one page at a time.
 *
 * Income vs expense is the item's own `type`, the same field the posting service writes
 * (postLedgerEntry stores `type: ledgerType` and moves the bank balance by it). It used to be read from
 * the ledger the item sits in, which can disagree for a hand-made entry.
 *
 * `summary` (totalIncome, totalExpense, netBalance, totalEntries) is computed by the database over the
 * WHOLE filtered set, so it is the same on every page; `pagination` describes the page of `entries`.
 */
export const getDayBook = async (req: AuthRequest, res: Response) => {
  try {
    const rs = resolveReportScope(req, res);
    if (!rs) return;

    const query: any = { ...rs.tenant, ...buildScopeFilter(rs), ...dateMatch(rs) };
    const { page, limit, skip } = reportPage(req);

    const [items, totals] = await Promise.all([
      LedgerItem.find(query)
        .populate('ledgerId', 'name type')
        .populate('categoryId', 'name type')
        .populate('instituteId', 'name type')
        .sort(REPORT_ORDER)
        .skip(skip)
        .limit(limit),
      LedgerItem.aggregate([
        { $match: query },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const sumOf = (type: string) => round2((totals as any[]).find((t) => t._id === type)?.total || 0);
    const totalIncome = sumOf('income');
    const totalExpense = sumOf('expense');
    const totalEntries = (totals as any[]).reduce((n, t) => n + (t.count || 0), 0);

    const entries = items.map((item: any) => ({
      _id: item._id,
      date: item.date,
      description: item.description,
      ledger: item.ledgerId?.name,
      ledgerType: item.ledgerId?.type,
      category: item.categoryId?.name,
      institute: item.instituteId?.name,
      amount: item.amount,
      paymentMethod: item.paymentMethod,
      referenceNo: item.referenceNo,
      type: item.type,
    }));

    res.json({
      success: true,
      data: {
        entries,
        summary: {
          totalIncome,
          totalExpense,
          netBalance: round2(totalIncome - totalExpense),
          totalEntries,
        },
        pagination: pageInfo(page, limit, totalEntries),
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the day book right now. Please try again.');
  }
};

/**
 * Trial Balance: Aggregate income vs expense totals by ledger
 */
export const getTrialBalance = async (req: AuthRequest, res: Response) => {
  try {
    const rs = resolveReportScope(req, res);
    if (!rs) return;

    const matchQuery: any = { ...rs.tenant, ...buildScopeFilter(rs), ...dateMatch(rs) };

    const result = await LedgerItem.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'ledgers',
          localField: 'ledgerId',
          foreignField: '_id',
          as: 'ledger',
        },
      },
      { $unwind: { path: '$ledger', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            ledgerId: '$ledgerId',
            ledgerName: { $ifNull: ['$ledger.name', 'Unknown ledger'] },
            ledgerType: '$type',
          },
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          ledgerId: '$_id.ledgerId',
          ledgerName: '$_id.ledgerName',
          ledgerType: '$_id.ledgerType',
          debit: {
            $cond: [{ $eq: ['$_id.ledgerType', 'expense'] }, '$totalAmount', 0],
          },
          credit: {
            $cond: [{ $eq: ['$_id.ledgerType', 'income'] }, '$totalAmount', 0],
          },
          totalAmount: 1,
          transactionCount: 1,
        },
      },
      { $sort: { ledgerType: 1, ledgerName: 1 } },
    ]);

    const totalDebit = round2(result.reduce((sum: number, r: any) => sum + r.debit, 0));
    const totalCredit = round2(result.reduce((sum: number, r: any) => sum + r.credit, 0));

    res.json({
      success: true,
      data: {
        ledgers: result,
        totals: {
          totalDebit,
          totalCredit,
          difference: round2(totalCredit - totalDebit),
        },
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the trial balance right now. Please try again.');
  }
};

/**
 * Balance Sheet: Assets (bank balances) vs Liabilities, Income summary vs Expense summary
 */
export const getBalanceSheet = async (req: AuthRequest, res: Response) => {
  try {
    const rs = resolveReportScope(req, res);
    if (!rs) return;

    const instituteFilter: any = { ...rs.tenant, ...buildScopeFilter(rs) };
    const dateFilter: any = dateMatch(rs);

    // 1. Get bank account balances (assets) — scope-aware
    const tenantObjId = rs.tenant.tenantId;
    const bankAccountDocs = tenantObjId ? await getBankAccounts(tenantObjId, rs) : [];

    const bankAccounts = (bankAccountDocs as any[]).map((acc: any) => ({
      accountName: acc.accountName,
      bankName: acc.bankName,
      balance: acc.balance,
      entity: acc.entity || acc.instituteId?.name,
    }));
    // The listing is capped (MAX_BANK_ACCOUNTS), the total is not: it is summed by the database.
    const totalBankBalance = round2(tenantObjId ? await getBankBalanceTotal(tenantObjId, rs) : 0);

    // 2. Get income summary
    const incomeResult = await LedgerItem.aggregate([
      {
        $match: { ...instituteFilter, ...dateFilter },
      },
      {
        $lookup: {
          from: 'ledgers',
          localField: 'ledgerId',
          foreignField: '_id',
          as: 'ledger',
        },
      },
      { $unwind: { path: '$ledger', preserveNullAndEmptyArrays: true } },
      { $match: { type: 'income' } },
      {
        $group: {
          _id: { ledgerId: '$ledgerId', ledgerName: { $ifNull: ['$ledger.name', 'Unknown ledger'] } },
          total: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          ledgerName: '$_id.ledgerName',
          total: 1,
        },
      },
      { $sort: { ledgerName: 1 } },
    ]);

    // 3. Get expense summary
    const expenseResult = await LedgerItem.aggregate([
      {
        $match: { ...instituteFilter, ...dateFilter },
      },
      {
        $lookup: {
          from: 'ledgers',
          localField: 'ledgerId',
          foreignField: '_id',
          as: 'ledger',
        },
      },
      { $unwind: { path: '$ledger', preserveNullAndEmptyArrays: true } },
      { $match: { type: 'expense' } },
      {
        $group: {
          _id: { ledgerId: '$ledgerId', ledgerName: { $ifNull: ['$ledger.name', 'Unknown ledger'] } },
          total: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          ledgerName: '$_id.ledgerName',
          total: 1,
        },
      },
      { $sort: { ledgerName: 1 } },
    ]);

    // Salary is already included in expenseResult via auto-posted LedgerItems (source='salary')
    // No separate SalaryPayment query needed — avoids double-counting

    const totalIncome = round2(incomeResult.reduce((sum: number, r: any) => sum + r.total, 0));
    const totalExpense = round2(expenseResult.reduce((sum: number, r: any) => sum + r.total, 0));

    res.json({
      success: true,
      data: {
        assets: {
          bankAccounts: bankAccounts.map((acc: any) => ({
            accountName: acc.accountName,
            bankName: acc.bankName,
            balance: acc.balance,
            entity: acc.entity,
          })),
          totalBankBalance,
        },
        income: {
          items: incomeResult,
          total: totalIncome,
        },
        expenses: {
          items: expenseResult,
          salaryExpense: 0,
          total: totalExpense,
        },
        summary: {
          totalAssets: totalBankBalance,
          totalIncome,
          totalExpenses: totalExpense,
          netBalance: round2(totalIncome - totalExpense),
        },
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the balance sheet right now. Please try again.');
  }
};
/**
 * Ledger Report: Detailed transactions for a specific ledger with opening/closing balance
 */
export const getLedgerReport = async (req: AuthRequest, res: Response) => {
  try {
    const rs = resolveReportScope(req, res);
    if (!rs) return;

    const { ledgerId } = req.query;

    if (!ledgerId) {
      return res.status(400).json({ success: false, message: 'Please select a ledger.' });
    }
    if (!isValidId(ledgerId)) {
      return res.status(400).json({ success: false, message: 'Please select a valid ledger.' });
    }

    // The ledger itself must be in the caller's Mahallu (and, for an institute account, their
    // institute) before anything about it - its name included - is read or reported.
    const ledger = await Ledger.findById(ledgerId);
    if (!ledger) {
      return res.status(404).json({ success: false, message: "We couldn't find that ledger. It may have been removed." });
    }
    if (!verifyRecordAccess(req, res, ledger, 'Ledger')) return;

    const baseMatch: any = {
      ...rs.tenant,
      ...buildScopeFilter(rs),
      ledgerId: oid(ledgerId),
    };

    const { page, limit, skip } = reportPage(req);
    const signed = { $cond: [{ $eq: ['$type', 'income'] }, '$amount', { $multiply: ['$amount', -1] }] };

    // Opening balance: net of all entries before startDate
    let openingBalance = 0;
    if (rs.dates?.$gte) {
      const openingResult = await LedgerItem.aggregate([
        { $match: { ...baseMatch, date: { $lt: rs.dates.$gte } } },
        { $group: { _id: null, total: { $sum: signed } } },
      ]);
      openingBalance = round2(openingResult[0]?.total || 0);
    }

    // Transactions in date range
    const rangeMatch: any = { ...baseMatch, ...dateMatch(rs) };

    // Totals over the WHOLE range (not this page), and the net of the rows that come before this page,
    // so each row's running balance and the closing balance are right on every page.
    const [items, totals, before] = await Promise.all([
      LedgerItem.find(rangeMatch)
        .populate('ledgerId', 'name type')
        .populate('categoryId', 'name')
        .populate('instituteId', 'name')
        .sort(REPORT_ORDER)
        .skip(skip)
        .limit(limit),
      LedgerItem.aggregate([
        { $match: rangeMatch },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      skip > 0
        ? LedgerItem.aggregate([
            { $match: rangeMatch },
            { $sort: REPORT_ORDER },
            { $limit: skip },
            { $group: { _id: null, total: { $sum: signed } } },
          ])
        : Promise.resolve([] as any[]),
    ]);

    const sumOf = (type: string) => round2((totals as any[]).find((t) => t._id === type)?.total || 0);
    const totalCredit = sumOf('income');
    const totalDebit = sumOf('expense');
    const totalEntries = (totals as any[]).reduce((n, t) => n + (t.count || 0), 0);

    // Build entries with running balance
    let runningBalance = round2(openingBalance + ((before as any[])[0]?.total || 0));
    const entries = items.map((item: any) => {
      const isIncome = item.type === 'income';
      runningBalance = round2(runningBalance + (isIncome ? item.amount : -item.amount));
      return {
        _id: item._id,
        date: item.date,
        description: item.description,
        category: item.categoryId?.name,
        institute: item.instituteId?.name,
        debit: isIncome ? 0 : item.amount,
        credit: isIncome ? item.amount : 0,
        amount: item.amount,
        balance: runningBalance,
        paymentMethod: item.paymentMethod,
        referenceNo: item.referenceNo,
        source: item.source,
      };
    });

    res.json({
      success: true,
      data: {
        ledger: { _id: ledger._id, name: ledger.name, type: ledger.type },
        openingBalance,
        closingBalance: round2(openingBalance + totalCredit - totalDebit),
        totalDebit,
        totalCredit,
        entries,
        pagination: pageInfo(page, limit, totalEntries),
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the ledger report right now. Please try again.');
  }
};

/**
 * Income & Expenditure Statement: Groups income and expenses by category with surplus/deficit
 */
export const getIncomeExpenditure = async (req: AuthRequest, res: Response) => {
  try {
    const rs = resolveReportScope(req, res);
    if (!rs) return;

    const matchQuery: any = { ...rs.tenant, ...buildScopeFilter(rs), ...dateMatch(rs) };

    // Income grouped by ledger then category
    const incomeItems = await LedgerItem.aggregate([
      { $match: matchQuery },
      { $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledger' } },
      { $unwind: { path: '$ledger', preserveNullAndEmptyArrays: true } },
      { $match: { type: 'income' } },
      { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            ledgerId: '$ledgerId',
            ledgerName: { $ifNull: ['$ledger.name', 'Unknown ledger'] },
            categoryId: '$categoryId',
            categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { ledgerId: '$_id.ledgerId', ledgerName: '$_id.ledgerName' },
          categories: {
            $push: {
              categoryId: '$_id.categoryId',
              categoryName: '$_id.categoryName',
              total: '$total',
              count: '$count',
            },
          },
          ledgerTotal: { $sum: '$total' },
        },
      },
      { $sort: { '_id.ledgerName': 1 } },
    ]);

    // Expense grouped similarly
    const expenseItems = await LedgerItem.aggregate([
      { $match: matchQuery },
      { $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledger' } },
      { $unwind: { path: '$ledger', preserveNullAndEmptyArrays: true } },
      { $match: { type: 'expense' } },
      { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            ledgerId: '$ledgerId',
            ledgerName: { $ifNull: ['$ledger.name', 'Unknown ledger'] },
            categoryId: '$categoryId',
            categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { ledgerId: '$_id.ledgerId', ledgerName: '$_id.ledgerName' },
          categories: {
            $push: {
              categoryId: '$_id.categoryId',
              categoryName: '$_id.categoryName',
              total: '$total',
              count: '$count',
            },
          },
          ledgerTotal: { $sum: '$total' },
        },
      },
      { $sort: { '_id.ledgerName': 1 } },
    ]);

    const totalIncome = round2(incomeItems.reduce((s: number, i: any) => s + i.ledgerTotal, 0));
    const totalExpense = round2(expenseItems.reduce((s: number, i: any) => s + i.ledgerTotal, 0));

    res.json({
      success: true,
      data: {
        income: incomeItems.map((i: any) => ({
          ledgerId: i._id.ledgerId,
          ledgerName: i._id.ledgerName,
          categories: i.categories,
          total: i.ledgerTotal,
        })),
        expenses: expenseItems.map((e: any) => ({
          ledgerId: e._id.ledgerId,
          ledgerName: e._id.ledgerName,
          categories: e.categories,
          total: e.ledgerTotal,
        })),
        totalIncome,
        totalExpense,
        surplus: round2(totalIncome - totalExpense),
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the income expenditure right now. Please try again.');
  }
};

/**
 * Consolidated Report: Aggregates income / expense by institute for franchise-level view
 */
export const getConsolidatedReport = async (req: AuthRequest, res: Response) => {
  try {
    const rs = resolveReportScope(req, res);
    if (!rs) return;

    // An institute account sees only its own institute's row (no Mahallu-level row, no siblings).
    // mahall / super_admin may narrow to one institute with ?instituteId=, otherwise they get every
    // institute plus the Mahallu's own row.
    const instituteOnly = rs.instituteId ? { instituteId: oid(rs.instituteId) } : {};
    const includeMahalluRow = !rs.instituteId;

    const matchQuery: any = { ...rs.tenant, ...instituteOnly, ...dateMatch(rs) };

    const result = await LedgerItem.aggregate([
      { $match: matchQuery },
      { $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledger' } },
      { $unwind: { path: '$ledger', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'institutes', localField: 'instituteId', foreignField: '_id', as: 'institute' } },
      { $unwind: { path: '$institute', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            instituteId: '$instituteId',
            instituteName: { $ifNull: ['$institute.name', 'Unassigned'] },
          },
          totalIncome: {
            $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
          },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          instituteId: '$_id.instituteId',
          instituteName: '$_id.instituteName',
          totalIncome: 1,
          totalExpense: 1,
          netBalance: { $subtract: ['$totalIncome', '$totalExpense'] },
          transactionCount: 1,
        },
      },
      { $sort: { instituteName: 1 } },
    ]);

    // Bank accounts per institute
    const accountQuery: any = { status: 'active', ...rs.tenant, ...instituteOnly };

    const bankAccounts = await InstituteAccount.aggregate([
      { $match: accountQuery },
      { $lookup: { from: 'institutes', localField: 'instituteId', foreignField: '_id', as: 'institute' } },
      { $unwind: { path: '$institute', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { instituteId: '$instituteId', instituteName: { $ifNull: ['$institute.name', 'Unassigned'] } },
          totalBankBalance: { $sum: '$balance' },
          accountCount: { $sum: 1 },
        },
      },
    ]);

    const bankMap: Record<string, number> = {};
    bankAccounts.forEach((b: any) => {
      bankMap[String(b._id.instituteId)] = b.totalBankBalance;
    });

    // Mahallu-level entries (no institute) are reported by the "Mahallu (Main)" row below. Left in here they
    // came back a second time as an "Unassigned" row and every grand total counted them twice.
    const institutes = result
      .filter((r: any) => r.instituteId !== null && r.instituteId !== undefined)
      .map((r: any) => ({
        ...r,
        bankBalance: bankMap[String(r.instituteId)] || 0,
      }));
    // An institute with an active bank account but no ledger entry yet still holds that money: list it, so
    // the grand bank balance matches the balance sheet instead of silently leaving it out.
    const listed = new Set(institutes.map((i: any) => String(i.instituteId)));
    for (const b of bankAccounts as any[]) {
      if (b._id?.instituteId && !listed.has(String(b._id.instituteId))) {
        institutes.push({
          instituteId: b._id.instituteId,
          instituteName: b._id.instituteName,
          totalIncome: 0,
          totalExpense: 0,
          netBalance: 0,
          transactionCount: 0,
          bankBalance: b.totalBankBalance || 0,
        });
      }
    }
    institutes.sort((a: any, b: any) => String(a.instituteName).localeCompare(String(b.instituteName)));

    // Add Mahallu's own financials as the first entry (instituteId=null rows)
    const mahalluMatch: any = { instituteId: null, ...rs.tenant };
    if (matchQuery.date) mahalluMatch.date = matchQuery.date;

    const mahalluLedgerResult = !includeMahalluRow ? [] : await LedgerItem.aggregate([
      { $match: mahalluMatch },
      { $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledger' } },
      { $unwind: { path: '$ledger', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          totalExpense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    const mahalluBankBalance = !includeMahalluRow ? [] : await MahalluAccount.aggregate([
      { $match: { ...rs.tenant, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$balance' } } },
    ]);

    const mahalluRow = mahalluLedgerResult[0] || { totalIncome: 0, totalExpense: 0, transactionCount: 0 };
    const mahalluBankBal = mahalluBankBalance[0]?.total || 0;

    const mahalluEntry = {
      instituteId: null,
      instituteName: 'Mahallu (Main)',
      totalIncome: mahalluRow.totalIncome,
      totalExpense: mahalluRow.totalExpense,
      netBalance: mahalluRow.totalIncome - mahalluRow.totalExpense,
      transactionCount: mahalluRow.transactionCount,
      bankBalance: mahalluBankBal,
    };

    const allEntries = includeMahalluRow ? [mahalluEntry, ...institutes] : institutes;

    const grandTotalIncome = round2(allEntries.reduce((s: number, i: any) => s + i.totalIncome, 0));
    const grandTotalExpense = round2(allEntries.reduce((s: number, i: any) => s + i.totalExpense, 0));
    const grandBankBalance = round2(allEntries.reduce((s: number, i: any) => s + i.bankBalance, 0));

    res.json({
      success: true,
      data: {
        institutes: allEntries,
        grandTotals: {
          totalIncome: grandTotalIncome,
          totalExpense: grandTotalExpense,
          netBalance: round2(grandTotalIncome - grandTotalExpense),
          bankBalance: grandBankBalance,
        },
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the consolidated report right now. Please try again.');
  }
};
