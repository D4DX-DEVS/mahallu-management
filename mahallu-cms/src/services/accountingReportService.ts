import api from './api';

export interface DayBookEntry {
  date: string;
  description: string;
  type: 'income' | 'expense' | 'salary';
  amount: number;
  ledgerName?: string;
  categoryName?: string;
  employeeName?: string;
  referenceNo?: string;
}

export interface TrialBalanceEntry {
  ledgerId: string;
  ledgerName: string;
  type: string;
  debit: number;
  credit: number;
}

export interface BalanceSheetData {
  bankBalances: { ledgerName: string; balance: number }[];
  totalBankBalance: number;
  incomeByCategory: { category: string; amount: number }[];
  totalIncome: number;
  expenseByCategory: { category: string; amount: number }[];
  totalExpense: number;
  salaryExpense: number;
  totalExpenseWithSalary: number;
  netBalance: number;
}

export const accountingReportService = {
  getDayBook: async (params: {
    instituteId?: string;
    startDate: string;
    endDate: string;
    scope?: string;
    includeEntities?: string;
  }) => {
    const response = await api.get<{ success: boolean; data: any }>('/accounting-reports/day-book', {
      params,
    });
    const raw = response.data.data;
    // API returns { entries, summary } — extract and normalize entries
    const entries: DayBookEntry[] = (raw?.entries || raw || []).map((e: any) => ({
      date: e.date,
      description: e.description,
      type: e.type || e.ledgerType,
      amount: e.amount,
      ledgerName: e.ledgerName || e.ledger,
      categoryName: e.categoryName || e.category,
      employeeName: e.employeeName,
      referenceNo: e.referenceNo,
    }));
    return entries;
  },

  getTrialBalance: async (params: {
    instituteId?: string;
    startDate?: string;
    endDate?: string;
    scope?: string;
    includeEntities?: string;
  }) => {
    const response = await api.get<{ success: boolean; data: any }>('/accounting-reports/trial-balance', {
      params,
    });
    const raw = response.data.data;
    // API returns { ledgers: [...], totals: {...} } — extract ledgers array and normalize
    const ledgers = raw?.ledgers || raw || [];
    const entries: TrialBalanceEntry[] = Array.isArray(ledgers)
      ? ledgers.map((l: any) => ({
          ledgerId: l.ledgerId,
          ledgerName: l.ledgerName,
          type: l.ledgerType || l.type,
          debit: l.debit || 0,
          credit: l.credit || 0,
        }))
      : [];
    return entries;
  },

  getBalanceSheet: async (params: {
    instituteId?: string;
    startDate?: string;
    endDate?: string;
    scope?: string;
    includeEntities?: string;
  }) => {
    const response = await api.get<{ success: boolean; data: any }>('/accounting-reports/balance-sheet', {
      params,
    });
    const raw = response.data.data;
    // API returns nested structure — normalize to flat BalanceSheetData
    const bankBalances = (raw?.assets?.bankAccounts || raw?.bankBalances || []).map((b: any) => ({
      ledgerName: b.accountName || b.ledgerName || b.bankName || 'Unknown',
      balance: b.balance || 0,
    }));
    const totalBankBalance =
      raw?.assets?.totalBankBalance ??
      raw?.totalBankBalance ??
      bankBalances.reduce((s: number, b: any) => s + b.balance, 0);
    const incomeByCategory = (raw?.income?.items || raw?.incomeByCategory || []).map((i: any) => ({
      category: i.ledgerName || i.category || 'Unknown',
      amount: i.total || i.amount || 0,
    }));
    const totalIncome = raw?.income?.total ?? raw?.totalIncome ?? raw?.summary?.totalIncome ?? 0;
    const expenseByCategory = (raw?.expenses?.items || raw?.expenseByCategory || []).map((e: any) => ({
      category: e.ledgerName || e.category || 'Unknown',
      amount: e.total || e.amount || 0,
    }));
    const totalExpense = raw?.summary?.totalExpenses ?? raw?.expenses?.total ?? raw?.totalExpense ?? 0;
    const salaryExpense = raw?.expenses?.salaryExpense ?? raw?.salaryExpense ?? 0;
    const totalExpenseWithSalary = totalExpense;
    const netBalance = raw?.summary?.netBalance ?? raw?.netBalance ?? totalIncome - totalExpenseWithSalary;

    return {
      bankBalances,
      totalBankBalance,
      incomeByCategory,
      totalIncome,
      expenseByCategory,
      totalExpense,
      salaryExpense,
      totalExpenseWithSalary,
      netBalance,
    } as BalanceSheetData;
  },

  getLedgerReport: async (params: {
    ledgerId: string;
    instituteId?: string;
    startDate?: string;
    endDate?: string;
    scope?: string;
    includeEntities?: string;
  }) => {
    const response = await api.get<{ success: boolean; data: any }>('/accounting-reports/ledger-report', {
      params,
    });
    return response.data.data;
  },

  getIncomeExpenditure: async (params: {
    instituteId?: string;
    startDate?: string;
    endDate?: string;
    scope?: string;
    includeEntities?: string;
  }) => {
    const response = await api.get<{ success: boolean; data: any }>(
      '/accounting-reports/income-expenditure',
      { params }
    );
    return response.data.data;
  },

  getConsolidatedReport: async (params: { startDate?: string; endDate?: string }) => {
    const response = await api.get<{ success: boolean; data: any }>('/accounting-reports/consolidated', {
      params,
    });
    return response.data.data;
  },
};
