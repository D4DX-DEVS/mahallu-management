import api from './api';

export interface InstituteAccount {
  id: string;
  tenantId?: string;
  instituteId: string;
  accountName: string;
  accountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  balance?: number;
  status?: 'active' | 'inactive';
  createdAt: string;
}

export interface MahalluAccount {
  id: string;
  tenantId?: string;
  accountName: string;
  accountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  balance?: number;
  status?: 'active' | 'inactive';
  createdAt: string;
}

export interface Category {
  id: string;
  tenantId?: string;
  name: string;
  nameMl?: string;
  type?: string;
  description?: string;
  descriptionMl?: string;
  createdAt: string;
}

export interface MasterWallet {
  id: string;
  tenantId?: string;
  name: string;
  type?: string;
  balance?: number;
  createdAt: string;
}

export interface Ledger {
  id: string;
  tenantId?: string;
  name: string;
  nameMl?: string;
  type?: string;
  description?: string;
  descriptionMl?: string;
  createdAt: string;
}

export interface LedgerItem {
  id: string;
  tenantId?: string;
  ledgerId: string;
  categoryId?: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  description?: string;
  paymentMethod?: string;
  referenceNo?: string;
  source?: 'manual' | 'salary' | 'varisangya' | 'zakat';
  sourceId?: string;
  createdAt: string;
}

export const masterAccountService = {
  // Institute Accounts
  getAllInstituteAccounts: async (params?: { instituteId?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: InstituteAccount[]; pagination?: any }>('/master-accounts/institute', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  createInstituteAccount: async (data: Partial<InstituteAccount>) => {
    const response = await api.post<{ success: boolean; data: InstituteAccount }>('/master-accounts/institute', data);
    return response.data.data;
  },

  updateInstituteAccount: async (id: string, data: Partial<InstituteAccount>) => {
    const response = await api.put<{ success: boolean; data: InstituteAccount }>(`/master-accounts/institute/${id}`, data);
    return response.data.data;
  },

  deleteInstituteAccount: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/master-accounts/institute/${id}`);
    return response.data;
  },

  // Categories
  getAllCategories: async (params?: { type?: string; instituteId?: string; scope?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Category[]; pagination?: any }>('/master-accounts/categories', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  createCategory: async (data: Partial<Category>) => {
    const response = await api.post<{ success: boolean; data: Category }>('/master-accounts/categories', data);
    return response.data.data;
  },

  updateCategory: async (id: string, data: Partial<Category>) => {
    const response = await api.put<{ success: boolean; data: Category }>(`/master-accounts/categories/${id}`, data);
    return response.data.data;
  },

  deleteCategory: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/master-accounts/categories/${id}`);
    return response.data;
  },

  // Wallets
  getAllWallets: async (params?: { type?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: MasterWallet[]; pagination?: any }>('/master-accounts/wallets', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  createWallet: async (data: Partial<MasterWallet>) => {
    const response = await api.post<{ success: boolean; data: MasterWallet }>('/master-accounts/wallets', data);
    return response.data.data;
  },

  updateWallet: async (id: string, data: Partial<MasterWallet>) => {
    const response = await api.put<{ success: boolean; data: MasterWallet }>(`/master-accounts/wallets/${id}`, data);
    return response.data.data;
  },

  deleteWallet: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/master-accounts/wallets/${id}`);
    return response.data;
  },

  // Ledgers
  getAllLedgers: async (params?: { type?: string; instituteId?: string; scope?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Ledger[]; pagination?: any }>('/master-accounts/ledgers', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  createLedger: async (data: Partial<Ledger>) => {
    const response = await api.post<{ success: boolean; data: Ledger }>('/master-accounts/ledgers', data);
    return response.data.data;
  },

  updateLedger: async (id: string, data: Partial<Ledger>) => {
    const response = await api.put<{ success: boolean; data: Ledger }>(`/master-accounts/ledgers/${id}`, data);
    return response.data.data;
  },

  deleteLedger: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/master-accounts/ledgers/${id}`);
    return response.data;
  },

  // Ledger Items
  getLedgerItems: async (params?: { ledgerId?: string; instituteId?: string; scope?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: LedgerItem[]; pagination?: any }>('/master-accounts/ledger-items', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  createLedgerItem: async (data: Partial<LedgerItem>) => {
    const response = await api.post<{ success: boolean; data: LedgerItem }>('/master-accounts/ledger-items', data);
    return response.data.data;
  },

  updateLedgerItem: async (id: string, data: Partial<LedgerItem>) => {
    const response = await api.put<{ success: boolean; data: LedgerItem }>(`/master-accounts/ledger-items/${id}`, data);
    return response.data.data;
  },

  deleteLedgerItem: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/master-accounts/ledger-items/${id}`);
    return response.data;
  },

  // Mahallu Accounts (tenant-level, no instituteId)
  getAllMahalluAccounts: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: MahalluAccount[]; pagination?: any }>('/master-accounts/mahallu-accounts', { params });
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  createMahalluAccount: async (data: Partial<MahalluAccount>) => {
    const response = await api.post<{ success: boolean; data: MahalluAccount }>('/master-accounts/mahallu-accounts', data);
    return response.data.data;
  },

  updateMahalluAccount: async (id: string, data: Partial<MahalluAccount>) => {
    const response = await api.put<{ success: boolean; data: MahalluAccount }>(`/master-accounts/mahallu-accounts/${id}`, data);
    return response.data.data;
  },

  deleteMahalluAccount: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/master-accounts/mahallu-accounts/${id}`);
    return response.data;
  },
};

