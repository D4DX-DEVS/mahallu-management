import api from './api';

export interface PettyCashFund {
  id: string;
  _id?: string;
  tenantId?: string;
  instituteId?: string | { _id: string; name?: string };
  custodianName: string;
  floatAmount: number;
  currentBalance: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface PettyCashTransaction {
  id: string;
  _id?: string;
  pettyCashId: string;
  type: 'float' | 'expense' | 'replenishment';
  amount: number;
  description: string;
  categoryId?: string | { _id: string; name?: string };
  receiptNo?: string;
  date: string;
  createdBy?: string | { _id: string; name?: string };
  createdAt: string;
}

const normalize = (item: any) => ({ ...item, id: item.id || item._id });

export const pettyCashService = {
  getAll: async (params?: { instituteId?: string }) => {
    const response = await api.get<{ success: boolean; data: any[] }>('/petty-cash', { params });
    return (response.data.data || []).map(normalize) as PettyCashFund[];
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: any }>(`/petty-cash/${id}`);
    return normalize(response.data.data) as PettyCashFund;
  },

  create: async (data: { instituteId: string; custodianName: string; floatAmount: number }) => {
    const response = await api.post<{ success: boolean; data: any }>('/petty-cash', data);
    return normalize(response.data.data) as PettyCashFund;
  },

  update: async (id: string, data: Partial<Pick<PettyCashFund, 'custodianName' | 'status'>>) => {
    const response = await api.put<{ success: boolean; data: any }>(`/petty-cash/${id}`, data);
    return normalize(response.data.data) as PettyCashFund;
  },

  getTransactions: async (id: string) => {
    const response = await api.get<{ success: boolean; data: any[] }>(`/petty-cash/${id}/transactions`);
    return (response.data.data || []).map(normalize) as PettyCashTransaction[];
  },

  recordExpense: async (
    id: string,
    data: { amount: number; description: string; categoryId?: string; receiptNo?: string; date?: string }
  ) => {
    const response = await api.post<{ success: boolean; data: any }>(`/petty-cash/${id}/expense`, data);
    return normalize(response.data.data) as PettyCashTransaction;
  },

  replenish: async (id: string) => {
    const response = await api.post<{ success: boolean; data: any; message: string }>(
      `/petty-cash/${id}/replenish`
    );
    return response.data;
  },
};
