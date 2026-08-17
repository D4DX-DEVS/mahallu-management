import api from './api';

export interface Varisangya {
  id: string;
  tenantId?: string;
  familyId?: string | { _id: string; houseName?: string };
  memberId?: string | { _id: string; name?: string };
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  receiptNo?: string;
  remarks?: string;
  status?: 'pending' | 'verified';
  source?: 'admin' | 'member';
  createdAt: string;
}

export interface Zakat {
  id: string;
  tenantId?: string;
  payerName: string;
  payerId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  receiptNo?: string;
  category?: string;
  remarks?: string;
  status?: 'pending' | 'verified';
  source?: 'admin' | 'member';
  createdAt: string;
}

export interface Wallet {
  id: string;
  tenantId?: string;
  familyId?: string;
  memberId?: string;
  balance: number;
  lastTransactionDate?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  tenantId?: string;
  walletId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  referenceId?: string;
  referenceType?: 'varisangya' | 'zakat';
  createdAt: string;
}

export interface FamilyDue {
  familyId: string;
  houseName: string;
  familyHead?: string;
  contactNo?: string;
  varisangyaGrade?: string;
  monthlyAmount: number;
  expectedAmount: number;
  paidAmount: number;
  dueAmount: number;
}

export interface DuesSummary {
  totalFamilies: number;
  familiesWithDues: number;
  totalExpected: number;
  totalPaid: number;
  totalDue: number;
}

export const collectibleService = {
  getFamilyDues: async (params?: { search?: string; onlyPending?: boolean; page?: number; limit?: number }) => {
    const response = await api.get<{
      success: boolean;
      data: { dues: FamilyDue[]; summary: DuesSummary };
      pagination?: { page: number; limit: number; total: number; totalPages: number };
    }>('/collectibles/dues', {
      params: { ...params, onlyPending: params?.onlyPending ? 'true' : undefined },
    });
    return { ...response.data.data, pagination: response.data.pagination ?? null };
  },

  // Varisangya
  getAllVarisangyas: async (params?: { familyId?: string; memberId?: string; hasFamily?: boolean; hasMember?: boolean; page?: number; limit?: number; dateFrom?: string; dateTo?: string }) => {
    const response = await api.get<{ success: boolean; data: Varisangya[]; pagination?: any }>('/collectibles/varisangya', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  createVarisangya: async (data: Partial<Varisangya>) => {
    const response = await api.post<{ success: boolean; data: Varisangya }>('/collectibles/varisangya', data);
    return response.data.data;
  },

  updateVarisangya: async (id: string, data: Partial<Pick<Varisangya, 'amount' | 'paymentDate' | 'paymentMethod' | 'remarks'>>) => {
    const response = await api.put<{ success: boolean; data: Varisangya }>(`/collectibles/varisangya/${id}`, data);
    return response.data.data;
  },

  deleteVarisangya: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/collectibles/varisangya/${id}`);
    return response.data;
  },

  verifyVarisangya: async (id: string) => {
    const response = await api.put<{ success: boolean; data: Varisangya }>(`/collectibles/varisangya/${id}/verify`, {});
    return response.data.data;
  },

  getNextReceiptNo: async (type: 'varisangya' | 'zakat') => {
    const response = await api.get<{ success: boolean; data: { receiptNo: string } }>(
      '/collectibles/receipt-next',
      { params: { type } }
    );
    return response.data.data.receiptNo;
  },

  // Zakat
  getAllZakats: async (params?: { search?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Zakat[]; pagination?: any }>('/collectibles/zakat', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  createZakat: async (data: Partial<Zakat>) => {
    const response = await api.post<{ success: boolean; data: Zakat }>('/collectibles/zakat', data);
    return response.data.data;
  },

  updateZakat: async (id: string, data: Partial<Zakat>) => {
    const response = await api.put<{ success: boolean; data: Zakat }>(`/collectibles/zakat/${id}`, data);
    return response.data.data;
  },

  deleteZakat: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/collectibles/zakat/${id}`);
    return response.data;
  },

  verifyZakat: async (id: string) => {
    const response = await api.put<{ success: boolean; data: Zakat }>(`/collectibles/zakat/${id}/verify`, {});
    return response.data.data;
  },

  // Wallet – API returns MongoDB docs with _id; normalize to id for frontend
  getWallet: async (params?: { familyId?: string; memberId?: string }) => {
    const response = await api.get<{ success: boolean; data: Wallet & { _id?: string } }>('/collectibles/wallet', { params });
    const data = response.data.data;
    if (!data) return data;
    const id = (data as any).id ?? (data as any)._id;
    const normalizedId = id != null ? String(id) : undefined;
    return { ...data, id: normalizedId } as Wallet;
  },

  getWalletTransactions: async (walletId: string) => {
    if (!walletId || typeof walletId !== 'string') return [];
    const response = await api.get<{ success: boolean; data: (Transaction & { _id?: string })[] }>(
      `/collectibles/wallet/${encodeURIComponent(walletId)}/transactions`
    );
    const list = response.data?.data;
    if (!Array.isArray(list)) return [];
    return list.map((t) => {
      const id = (t as any).id ?? (t as any)._id;
      return { ...t, id: id != null ? String(id) : (t as Transaction).id } as Transaction;
    });
  },
};

