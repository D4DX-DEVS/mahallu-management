import api from './api';

export interface PeriodAccountSnapshot {
  accountId: string;
  accountType: 'mahallu' | 'institute';
  name: string;
  balance: number;
}

export interface PeriodLedgerTotal {
  ledgerId: string;
  name: string;
  type: 'income' | 'expense';
  total: number;
  count: number;
}

export interface FinancialPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  closedAt?: string;
  closedBy?: { id: string; name: string } | string;
  closingNote?: string;
  totals?: { income: number; expense: number; net: number };
  ledgerTotals?: PeriodLedgerTotal[];
  openingBalances?: PeriodAccountSnapshot[];
  balancesAsOf?: string;
  history?: Array<{ action: 'created' | 'closed' | 'reopened'; byName?: string; at: string; note?: string }>;
}

export interface ClosePreview {
  period: FinancialPeriod;
  checklist: Array<{ key: string; label: string; ok: boolean; blocking: boolean; detail: string }>;
  canClose: boolean;
  confirmationText: string;
  totals: { income: number; expense: number; net: number };
  ledgerTotals: PeriodLedgerTotal[];
  openingBalances: PeriodAccountSnapshot[];
  balancesAsOf: string;
  balancesNote?: string;
}

export interface BudgetLine {
  id?: string;
  ledgerId?: string;
  categoryId?: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
}

export interface Budget {
  id: string;
  periodId: string | { id: string; name: string; startDate: string; endDate: string; status: string };
  name?: string;
  lines: BudgetLine[];
  status: 'draft' | 'approved';
}

export interface BudgetVsActualLine {
  id?: string;
  ledgerId?: string;
  name: string;
  type: 'income' | 'expense';
  budget: number;
  actual: number;
  benchmark: number;
  variance: number;
  variancePct: number | null;
  percentUsed: number | null;
  status: 'on-track' | 'over' | 'under';
  favourable: boolean;
}

export interface BudgetVsActual {
  budget: { id: string; name?: string; status: string };
  period: { id: string; name: string; startDate: string; endDate: string; status: string };
  elapsedPercent: number;
  lines: BudgetVsActualLine[];
  unbudgeted: Array<{ ledgerId: string; name: string; type: 'income' | 'expense'; actual: number }>;
  summary: {
    incomeBudget: number;
    incomeActual: number;
    expenseBudget: number;
    expenseActual: number;
    unbudgetedIncome: number;
    unbudgetedExpense: number;
  };
}

export const periodService = {
  list: async () => (await api.get<{ data: FinancialPeriod[] }>('/periods')).data.data,
  create: async (payload: { name: string; startDate: string; endDate: string }) =>
    (await api.post<{ data: FinancialPeriod }>('/periods', payload)).data.data,
  closePreview: async (id: string) => (await api.get<{ data: ClosePreview }>(`/periods/${id}/close-preview`)).data.data,
  close: async (id: string, payload: { confirmation: string; note?: string }) =>
    (await api.post<{ data: FinancialPeriod; message: string }>(`/periods/${id}/close`, payload)).data,
  reopen: async (id: string, reason: string) =>
    (await api.post<{ data: FinancialPeriod; message: string }>(`/periods/${id}/reopen`, { reason })).data,
  remove: async (id: string) => (await api.delete(`/periods/${id}`)).data,
};

export const budgetService = {
  list: async (periodId?: string) =>
    (await api.get<{ data: Budget[] }>('/budgets', { params: periodId ? { periodId } : undefined })).data.data,
  create: async (payload: { periodId: string; name?: string; lines: BudgetLine[] }) =>
    (await api.post<{ data: Budget }>('/budgets', payload)).data.data,
  update: async (id: string, payload: Partial<Pick<Budget, 'name' | 'lines' | 'status'>>) =>
    (await api.put<{ data: Budget }>(`/budgets/${id}`, payload)).data.data,
  remove: async (id: string) => (await api.delete(`/budgets/${id}`)).data,
  priorActuals: async (periodId: string) =>
    (
      await api.get<{
        data: { fromPeriod: { id: string; name: string }; lines: BudgetLine[]; totals: { income: number; expense: number; net: number } };
      }>('/budgets/prior-actuals', { params: { periodId } })
    ).data.data,
  vsActual: async (id: string) => (await api.get<{ data: BudgetVsActual }>(`/budgets/${id}/vs-actual`)).data.data,
};
