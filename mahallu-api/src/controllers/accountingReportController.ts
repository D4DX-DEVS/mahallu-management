import { Response } from 'express';
import { LedgerItem, Ledger, Category, InstituteAccount, MahalluAccount } from '../models/MasterAccount';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';

import { sendFailure } from '../utils/userMessages';

/**
 * Build a MongoDB filter for LedgerItems based on scope/instituteId/includeEntities.
 *
 * scope='mahallu'    → { instituteId: null }
 * scope='institute'  → { instituteId: <id> }  (requires instituteId param)
 * scope='combined'   → { $or: [{instituteId: null}, {instituteId: {$in: [...]}}] }
 *                       where includeEntities is comma-separated "mahallu,id1,id2,..."
 * (default / no scope) → existing behaviour: filter by instituteId if provided
 */
function buildScopeFilter(scope: string | undefined, instituteId: string | undefined, includeEntities: string | undefined): any {
  if (scope === 'mahallu') {
    return { instituteId: null };
  }
  if (scope === 'combined' && includeEntities) {
    const parts = includeEntities.split(',').map(s => s.trim()).filter(Boolean);
    const hasMahallu = parts.includes('mahallu');
    const ids = parts.filter(p => p !== 'mahallu').map(p => new mongoose.Types.ObjectId(p));
    if (hasMahallu && ids.length > 0) {
      return { $or: [{ instituteId: null }, { instituteId: { $in: ids } }] };
    }
    if (hasMahallu) return { instituteId: null };
    if (ids.length > 0) return { instituteId: { $in: ids } };
  }
  // Default: institute scope (existing behaviour)
  if (instituteId) return { instituteId: new mongoose.Types.ObjectId(instituteId) };
  return {};
}

/**
 * Build an account query for bank accounts based on scope.
 * Returns a query object to pass to InstituteAccount / MahalluAccount.
 */
async function getBankAccounts(
  tenantId: mongoose.Types.ObjectId,
  scope: string | undefined,
  instituteId: string | undefined,
  includeEntities: string | undefined
) {
  if (scope === 'mahallu') {
    return MahalluAccount.find({ tenantId, status: 'active' }).select('accountName bankName balance');
  }
  if (scope === 'combined' && includeEntities) {
    const parts = includeEntities.split(',').map(s => s.trim()).filter(Boolean);
    const hasMahallu = parts.includes('mahallu');
    const ids = parts.filter(p => p !== 'mahallu').map(p => new mongoose.Types.ObjectId(p));
    const results: any[] = [];
    if (hasMahallu) {
      const ma = await MahalluAccount.find({ tenantId, status: 'active' }).select('accountName bankName balance');
      results.push(...ma.map((a: any) => ({ accountName: a.accountName, bankName: a.bankName, balance: a.balance, entity: 'Mahallu' })));
    }
    if (ids.length > 0) {
      const ia = await InstituteAccount.find({ tenantId, instituteId: { $in: ids }, status: 'active' })
        .populate('instituteId', 'name')
        .select('accountName bankName balance instituteId');
      results.push(...ia.map((a: any) => ({ accountName: a.accountName, bankName: a.bankName, balance: a.balance, entity: (a.instituteId as any)?.name || 'Institute' })));
    }
    return results;
  }
  // Default: institute scope
  const query: any = { tenantId, status: 'active' };
  if (instituteId) query.instituteId = new mongoose.Types.ObjectId(instituteId);
  return InstituteAccount.find(query).populate('instituteId', 'name').select('accountName bankName balance instituteId');
}

/**
 * Day Book: Chronological list of all transactions for an institute within a date range
 */
export const getDayBook = async (req: AuthRequest, res: Response) => {
  try {
    const { instituteId, startDate, endDate, scope, includeEntities } = req.query;
    const query: any = {};

    if (req.tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(req.tenantId);
    }

    const scopeFilter = buildScopeFilter(scope as string, instituteId as string, includeEntities as string);
    Object.assign(query, scopeFilter);

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }

    const items = await LedgerItem.find(query)
      .populate('ledgerId', 'name type')
      .populate('categoryId', 'name type')
      .populate('instituteId', 'name type')
      .sort({ date: 1, createdAt: 1 });

    // Calculate totals
    let totalIncome = 0;
    let totalExpense = 0;

    const entries = items.map((item: any) => {
      const ledgerType = item.ledgerId?.type;
      if (ledgerType === 'income') {
        totalIncome += item.amount;
      } else if (ledgerType === 'expense') {
        totalExpense += item.amount;
      }
      return {
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
        type: ledgerType,
      };
    });

    res.json({
      success: true,
      data: {
        entries,
        summary: {
          totalIncome,
          totalExpense,
          netBalance: totalIncome - totalExpense,
          totalEntries: entries.length,
        },
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
    const { instituteId, startDate, endDate, scope, includeEntities } = req.query;
    const matchQuery: any = {};

    if (req.tenantId) {
      matchQuery.tenantId = new mongoose.Types.ObjectId(req.tenantId);
    }

    const scopeFilter = buildScopeFilter(scope as string, instituteId as string, includeEntities as string);
    Object.assign(matchQuery, scopeFilter);

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate as string);
      if (endDate) matchQuery.date.$lte = new Date(endDate as string);
    }

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
      { $unwind: '$ledger' },
      {
        $group: {
          _id: {
            ledgerId: '$ledgerId',
            ledgerName: '$ledger.name',
            ledgerType: '$ledger.type',
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

    const totalDebit = result.reduce((sum: number, r: any) => sum + r.debit, 0);
    const totalCredit = result.reduce((sum: number, r: any) => sum + r.credit, 0);

    res.json({
      success: true,
      data: {
        ledgers: result,
        totals: {
          totalDebit,
          totalCredit,
          difference: totalCredit - totalDebit,
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
    const { instituteId, startDate, endDate, scope, includeEntities } = req.query;
    const tenantFilter: any = {};

    if (req.tenantId) {
      tenantFilter.tenantId = new mongoose.Types.ObjectId(req.tenantId);
    }

    const scopeFilter = buildScopeFilter(scope as string, instituteId as string, includeEntities as string);
    const instituteFilter: any = { ...tenantFilter, ...scopeFilter };

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate as string);
      if (endDate) dateFilter.date.$lte = new Date(endDate as string);
    }

    // 1. Get bank account balances (assets) — scope-aware
    const tenantObjId = req.tenantId ? new mongoose.Types.ObjectId(req.tenantId) : undefined;
    const bankAccountDocs = tenantObjId
      ? await getBankAccounts(tenantObjId, scope as string, instituteId as string, includeEntities as string)
      : [];

    const bankAccounts = (bankAccountDocs as any[]).map((acc: any) => ({
      accountName: acc.accountName,
      bankName: acc.bankName,
      balance: acc.balance,
      entity: acc.entity || acc.instituteId?.name,
    }));
    const totalBankBalance = bankAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0);

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
      { $unwind: '$ledger' },
      { $match: { 'ledger.type': 'income' } },
      {
        $group: {
          _id: { ledgerId: '$ledgerId', ledgerName: '$ledger.name' },
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
      { $unwind: '$ledger' },
      { $match: { 'ledger.type': 'expense' } },
      {
        $group: {
          _id: { ledgerId: '$ledgerId', ledgerName: '$ledger.name' },
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

    const totalIncome = incomeResult.reduce((sum: number, r: any) => sum + r.total, 0);
    const totalExpense = expenseResult.reduce((sum: number, r: any) => sum + r.total, 0);

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
          netBalance: totalIncome - totalExpense,
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
    const { ledgerId, instituteId, startDate, endDate, scope, includeEntities } = req.query;

    if (!ledgerId) {
      return res.status(400).json({ success: false, message: 'Please select a ledger.' });
    }

    const tenantMatch: any = {};
    if (req.tenantId) {
      tenantMatch.tenantId = new mongoose.Types.ObjectId(req.tenantId);
    }

    const scopeFilter = buildScopeFilter(scope as string, instituteId as string, includeEntities as string);

    const baseMatch: any = {
      ...tenantMatch,
      ...scopeFilter,
      ledgerId: new mongoose.Types.ObjectId(ledgerId as string),
    };

    // Opening balance: sum of all entries before startDate
    let openingBalance = 0;
    if (startDate) {
      const openingResult = await LedgerItem.aggregate([
        { $match: { ...baseMatch, date: { $lt: new Date(startDate as string) } } },
        {
          $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledger' },
        },
        { $unwind: '$ledger' },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [{ $eq: ['$ledger.type', 'income'] }, '$amount', { $multiply: ['$amount', -1] }],
              },
            },
          },
        },
      ]);
      openingBalance = openingResult[0]?.total || 0;
    }

    // Transactions in date range
    const dateMatch: any = { ...baseMatch };
    if (startDate || endDate) {
      dateMatch.date = {};
      if (startDate) dateMatch.date.$gte = new Date(startDate as string);
      if (endDate) dateMatch.date.$lte = new Date(endDate as string);
    }

    const items = await LedgerItem.find(dateMatch)
      .populate('ledgerId', 'name type')
      .populate('categoryId', 'name')
      .populate('instituteId', 'name')
      .sort({ date: 1, createdAt: 1 });

    // Build entries with running balance
    let runningBalance = openingBalance;
    const entries = items.map((item: any) => {
      const isIncome = item.ledgerId?.type === 'income';
      const signedAmount = isIncome ? item.amount : -item.amount;
      runningBalance += signedAmount;
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

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    const ledger = await Ledger.findById(ledgerId);

    res.json({
      success: true,
      data: {
        ledger: ledger ? { _id: ledger._id, name: ledger.name, type: ledger.type } : null,
        openingBalance,
        closingBalance: runningBalance,
        totalDebit,
        totalCredit,
        entries,
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
    const { instituteId, startDate, endDate, scope, includeEntities } = req.query;
    const matchQuery: any = {};

    if (req.tenantId) {
      matchQuery.tenantId = new mongoose.Types.ObjectId(req.tenantId);
    }

    const scopeFilter = buildScopeFilter(scope as string, instituteId as string, includeEntities as string);
    Object.assign(matchQuery, scopeFilter);

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate as string);
      if (endDate) matchQuery.date.$lte = new Date(endDate as string);
    }

    // Income grouped by ledger then category
    const incomeItems = await LedgerItem.aggregate([
      { $match: matchQuery },
      { $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledger' } },
      { $unwind: '$ledger' },
      { $match: { 'ledger.type': 'income' } },
      { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            ledgerId: '$ledgerId',
            ledgerName: '$ledger.name',
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
      { $unwind: '$ledger' },
      { $match: { 'ledger.type': 'expense' } },
      { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            ledgerId: '$ledgerId',
            ledgerName: '$ledger.name',
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

    const totalIncome = incomeItems.reduce((s: number, i: any) => s + i.ledgerTotal, 0);
    const totalExpense = expenseItems.reduce((s: number, i: any) => s + i.ledgerTotal, 0);

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
        surplus: totalIncome - totalExpense,
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
    const { startDate, endDate } = req.query;
    const matchQuery: any = {};

    if (req.tenantId) {
      matchQuery.tenantId = new mongoose.Types.ObjectId(req.tenantId);
    }
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate as string);
      if (endDate) matchQuery.date.$lte = new Date(endDate as string);
    }

    const result = await LedgerItem.aggregate([
      { $match: matchQuery },
      { $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledger' } },
      { $unwind: '$ledger' },
      { $lookup: { from: 'institutes', localField: 'instituteId', foreignField: '_id', as: 'institute' } },
      { $unwind: { path: '$institute', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            instituteId: '$instituteId',
            instituteName: { $ifNull: ['$institute.name', 'Unassigned'] },
          },
          totalIncome: {
            $sum: { $cond: [{ $eq: ['$ledger.type', 'income'] }, '$amount', 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ['$ledger.type', 'expense'] }, '$amount', 0] },
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
    const accountQuery: any = { status: 'active' };
    if (req.tenantId) accountQuery.tenantId = new mongoose.Types.ObjectId(req.tenantId);

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

    const institutes = result.map((r: any) => ({
      ...r,
      bankBalance: bankMap[String(r.instituteId)] || 0,
    }));

    // Add Mahallu's own financials as the first entry (instituteId=null rows)
    const mahalluMatch: any = { instituteId: null };
    if (req.tenantId) mahalluMatch.tenantId = new mongoose.Types.ObjectId(req.tenantId);
    if (matchQuery.date) mahalluMatch.date = matchQuery.date;

    const mahalluLedgerResult = await LedgerItem.aggregate([
      { $match: mahalluMatch },
      { $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledger' } },
      { $unwind: '$ledger' },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: { $cond: [{ $eq: ['$ledger.type', 'income'] }, '$amount', 0] } },
          totalExpense: { $sum: { $cond: [{ $eq: ['$ledger.type', 'expense'] }, '$amount', 0] } },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    const mahalluBankBalance = await MahalluAccount.aggregate([
      { $match: { tenantId: req.tenantId ? new mongoose.Types.ObjectId(req.tenantId) : undefined, status: 'active' } },
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

    const allEntries = [mahalluEntry, ...institutes];

    const grandTotalIncome = allEntries.reduce((s: number, i: any) => s + i.totalIncome, 0);
    const grandTotalExpense = allEntries.reduce((s: number, i: any) => s + i.totalExpense, 0);
    const grandBankBalance = allEntries.reduce((s: number, i: any) => s + i.bankBalance, 0);

    res.json({
      success: true,
      data: {
        institutes: allEntries,
        grandTotals: {
          totalIncome: grandTotalIncome,
          totalExpense: grandTotalExpense,
          netBalance: grandTotalIncome - grandTotalExpense,
          bankBalance: grandBankBalance,
        },
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the consolidated report right now. Please try again.');
  }
};