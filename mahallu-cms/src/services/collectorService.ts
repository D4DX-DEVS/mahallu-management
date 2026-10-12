import api from './api';

export interface Collector {
  id: string;
  name: string;
  phone?: string;
  wards: string[];
  active: boolean;
  userId?: string;
  memberId?: string;
}

export interface ExpectedCash {
  date: string;
  scopeKey: string;
  expectedCash: number;
  breakdown: { varisangya: number; zakat: number; campaigns: number; receiptCount: number };
  attribution: 'mahallu' | 'collector' | 'user';
  note?: string;
  existing?: CashClosing | null;
}

export type ClosingStatus = 'submitted' | 'verified' | 'reopened';

export interface CashClosing {
  id: string;
  dateKey: string;
  scopeKey: string;
  collectorId?: { id: string; name: string } | string;
  expectedCash: number;
  countedCash: number;
  difference: number;
  breakdown?: ExpectedCash['breakdown'];
  denominations?: Record<string, number>;
  note?: string;
  status: ClosingStatus;
  submittedBy?: { id: string; name: string } | string;
  submittedAt?: string;
  verifiedBy?: { id: string; name: string } | string;
  verifiedAt?: string;
  reopenReason?: string;
}

export const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export const collectorService = {
  list: async (params?: Record<string, any>) => (await api.get<{ data: Collector[] }>('/collectors', { params })).data.data,
  create: async (payload: Partial<Collector>) => (await api.post<{ data: Collector }>('/collectors', payload)).data.data,
  update: async (id: string, payload: Partial<Collector>) => (await api.put<{ data: Collector }>(`/collectors/${id}`, payload)).data.data,
  remove: (id: string) => api.delete(`/collectors/${id}`),
  day: async (id: string, date?: string) => (await api.get<{ data: ExpectedCash & { collector: Collector } }>(`/collectors/${id}/day`, { params: { date } })).data.data,
};

export const cashClosingService = {
  preview: async (params: { date?: string; collectorId?: string }) =>
    (await api.get<{ data: ExpectedCash }>('/cash-closings/preview', { params })).data.data,
  list: async (params?: Record<string, any>) => {
    const r = await api.get<{ data: CashClosing[]; pagination: any; summary: { totalShort: number; totalExcess: number; closingsWithVariance: number } }>('/cash-closings', { params });
    return { data: r.data.data, pagination: r.data.pagination, summary: r.data.summary };
  },
  submit: async (payload: { date: string; collectorId?: string; countedCash?: number; denominations?: Record<string, number>; note?: string }) =>
    (await api.post<{ data: CashClosing }>('/cash-closings', payload)).data.data,
  verify: async (id: string) => (await api.post<{ data: CashClosing }>(`/cash-closings/${id}/verify`)).data.data,
  reopen: async (id: string, reason: string) => (await api.post<{ data: CashClosing }>(`/cash-closings/${id}/reopen`, { reason })).data.data,
};
