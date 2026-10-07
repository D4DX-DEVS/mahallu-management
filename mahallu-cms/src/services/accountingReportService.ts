import api from './api';

// Backend does `date.$lte = new Date(endDate)`, which resolves to midnight UTC and
// silently excludes same-day transactions recorded later that day. Push plain
// YYYY-MM-DD end dates to the last instant of the day so the range is inclusive.
const toInclusiveEndDate = (endDate?: string) =>
  endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? `${endDate}T23:59:59.999` : endDate;

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

/** Totals over the WHOLE date range, identical on every page of the day book. */
export interface DayBookSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  totalEntries: number;
}

/** Describes the page of rows returned (the API serves at most 100 per page). */
export interface ReportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DayBookResult {
  entries: DayBookEntry[];
  summary: DayBookSummary;
  pagination: ReportPagination;
}

/** Page and size for a paged report. */
export interface ReportPageParams {
  page?: number;
  limit?: number;
}

export interface DayBookParams extends ReportPageParams {
  instituteId?: string;
  startDate: string;
  endDate: string;
  scope?: string;
  includeEntities?: string;
}

export interface LedgerReportEntry {
  id?: string;
  date: string;
  description: string;
  category?: string;
  institute?: string;
  debit: number;
  credit: number;
  /** Running balance, correct for this page's position in the whole range. */
  balance: number;
  paymentMethod?: string;
  referenceNo?: string;
  source?: string;
}

export interface LedgerReportResult {
  ledger?: { id?: string; name?: string; type?: string };
  openingBalance: number;
  closingBalance: number;
  /** Whole-range totals, not this page's. */
  totalDebit: number;
  totalCredit: number;
  entries: LedgerReportEntry[];
  pagination: ReportPagination;
}

const toPagination = (raw: any, rowCount: number, requested: ReportPageParams): ReportPagination => {
  const limit = Number(raw?.limit) || requested.limit || rowCount || 1;
  const total = Number.isFinite(Number(raw?.total)) ? Number(raw.total) : rowCount;
  return {
    page: Number(raw?.page) || requested.page || 1,
    limit,
    total,
    totalPages: Number(raw?.totalPages) || Math.max(1, Math.ceil(total / limit)),
  };
};

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
  getDayBook: async (params: DayBookParams): Promise<DayBookResult> => {
    const response = await api.get<{ success: boolean; data: any }>('/accounting-reports/day-book', {
      params: { ...params, endDate: toInclusiveEndDate(params.endDate) },
    });
    const raw = response.data.data;
    // API returns { entries, summary, pagination } — `summary` covers the whole
    // range and `pagination` describes this page of `entries`.
    const rows: any[] = Array.isArray(raw?.entries) ? raw.entries : Array.isArray(raw) ? raw : [];
    const entries: DayBookEntry[] = rows.map((e: any) => ({
      date: e.date,
      description: e.description,
      type: e.type || e.ledgerType,
      amount: e.amount,
      ledgerName: e.ledgerName || e.ledger,
      categoryName: e.categoryName || e.category,
      employeeName: e.employeeName,
      referenceNo: e.referenceNo,
    }));
    const totalIncome = Number(raw?.summary?.totalIncome) || 0;
    const totalExpense = Number(raw?.summary?.totalExpense) || 0;
    const pagination = toPagination(raw?.pagination, entries.length, params);
    return {
      entries,
      summary: {
        totalIncome,
        totalExpense,
        netBalance: Number(raw?.summary?.netBalance ?? totalIncome - totalExpense) || 0,
        totalEntries: Number(raw?.summary?.totalEntries ?? pagination.total) || 0,
      },
      pagination,
    };
  },

  getTrialBalance: async (params: {
    instituteId?: string;
    startDate?: string;
    endDate?: string;
    scope?: string;
    includeEntities?: string;
  }) => {
    const response = await api.get<{ success: boolean; data: any }>('/accounting-reports/trial-balance', {
      params: { ...params, endDate: toInclusiveEndDate(params.endDate) },
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
      params: { ...params, endDate: toInclusiveEndDate(params.endDate) },
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
    page?: number;
    limit?: number;
  }): Promise<LedgerReportResult> => {
    const response = await api.get<{ success: boolean; data: any }>('/accounting-reports/ledger-report', {
      params: { ...params, endDate: toInclusiveEndDate(params.endDate) },
    });
    const raw = response.data.data;
    const entries: LedgerReportEntry[] = Array.isArray(raw?.entries) ? raw.entries : [];
    return {
      ...raw,
      ledger: raw?.ledger,
      openingBalance: Number(raw?.openingBalance) || 0,
      closingBalance: Number(raw?.closingBalance) || 0,
      totalDebit: Number(raw?.totalDebit) || 0,
      totalCredit: Number(raw?.totalCredit) || 0,
      entries,
      pagination: toPagination(raw?.pagination, entries.length, params),
    };
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
      { params: { ...params, endDate: toInclusiveEndDate(params.endDate) } }
    );
    return response.data.data;
  },

  getConsolidatedReport: async (params: { startDate?: string; endDate?: string }) => {
    const response = await api.get<{ success: boolean; data: any }>('/accounting-reports/consolidated', {
      params: { ...params, endDate: toInclusiveEndDate(params.endDate) },
    });
    return response.data.data;
  },
};
