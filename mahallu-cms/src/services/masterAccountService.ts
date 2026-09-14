import api, { asList } from './api';

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

/**
 * The API caps `limit` at 100 and answers 400 — not a truncated list — to
 * anything larger.
 *
 * Every dropdown and every export on these screens asked for `limit: 1000` or
 * `limit: 10000` to mean "give me all of them". Each of those calls was
 * refused, so the ledger pickers on Add Entry and the Ledger Report came up
 * empty (leaving Generate/Save permanently disabled) and every CSV/PDF export
 * failed. Asking for more than the API allows now walks the pages instead.
 */
const API_MAX_LIMIT = 100;

/** A hard stop, so an unexpected `pagination` shape can never spin forever. */
const MAX_PAGES = 200;

interface ListResponse<T> {
  success: boolean;
  data: T[];
  pagination?: any;
}

async function getList<T>(
  url: string,
  params?: Record<string, any>
): Promise<{ data: T[]; pagination: any }> {
  const requested = Number(params?.limit);
  const wantsEverything =
    Number.isFinite(requested) && requested > API_MAX_LIMIT && params?.page === undefined;

  if (!wantsEverything) {
    const response = await api.get<ListResponse<T>>(url, { params });
    return { data: asList(response.data.data), pagination: response.data.pagination ?? null };
  }

  const rows: T[] = [];
  let pagination: any = null;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await api.get<ListResponse<T>>(url, {
      params: { ...params, page, limit: API_MAX_LIMIT },
    });
    const batch = asList(response.data.data);
    rows.push(...batch);
    pagination = response.data.pagination ?? pagination;

    if (batch.length < API_MAX_LIMIT) break;
    if (rows.length >= requested) break;
    if (pagination?.totalPages && page >= pagination.totalPages) break;
  }

  return { data: rows, pagination };
}

export const masterAccountService = {
  // Institute Accounts
  getAllInstituteAccounts: async (params?: { instituteId?: string; page?: number; limit?: number }) =>
    getList<InstituteAccount>('/master-accounts/institute', params),

  createInstituteAccount: async (data: Partial<InstituteAccount>) => {
    const response = await api.post<{ success: boolean; data: InstituteAccount }>(
      '/master-accounts/institute',
      data
    );
    return response.data.data;
  },

  updateInstituteAccount: async (id: string, data: Partial<InstituteAccount>) => {
    const response = await api.put<{ success: boolean; data: InstituteAccount }>(
      `/master-accounts/institute/${id}`,
      data
    );
    return response.data.data;
  },

  deleteInstituteAccount: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/master-accounts/institute/${id}`
    );
    return response.data;
  },

  // Categories
  getAllCategories: async (params?: {
    type?: string;
    instituteId?: string;
    scope?: string;
    page?: number;
    limit?: number;
  }) => getList<Category>('/master-accounts/categories', params),

  createCategory: async (data: Partial<Category>) => {
    const response = await api.post<{ success: boolean; data: Category }>(
      '/master-accounts/categories',
      data
    );
    return response.data.data;
  },

  updateCategory: async (id: string, data: Partial<Category>) => {
    const response = await api.put<{ success: boolean; data: Category }>(
      `/master-accounts/categories/${id}`,
      data
    );
    return response.data.data;
  },

  deleteCategory: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/master-accounts/categories/${id}`
    );
    return response.data;
  },

  // Wallets
  getAllWallets: async (params?: { type?: string; page?: number; limit?: number }) =>
    getList<MasterWallet>('/master-accounts/wallets', params),

  createWallet: async (data: Partial<MasterWallet>) => {
    const response = await api.post<{ success: boolean; data: MasterWallet }>(
      '/master-accounts/wallets',
      data
    );
    return response.data.data;
  },

  updateWallet: async (id: string, data: Partial<MasterWallet>) => {
    const response = await api.put<{ success: boolean; data: MasterWallet }>(
      `/master-accounts/wallets/${id}`,
      data
    );
    return response.data.data;
  },

  deleteWallet: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/master-accounts/wallets/${id}`
    );
    return response.data;
  },

  // Ledgers
  getAllLedgers: async (params?: {
    type?: string;
    instituteId?: string;
    scope?: string;
    page?: number;
    limit?: number;
  }) => getList<Ledger>('/master-accounts/ledgers', params),

  createLedger: async (data: Partial<Ledger>) => {
    const response = await api.post<{ success: boolean; data: Ledger }>('/master-accounts/ledgers', data);
    return response.data.data;
  },

  updateLedger: async (id: string, data: Partial<Ledger>) => {
    const response = await api.put<{ success: boolean; data: Ledger }>(
      `/master-accounts/ledgers/${id}`,
      data
    );
    return response.data.data;
  },

  deleteLedger: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/master-accounts/ledgers/${id}`
    );
    return response.data;
  },

  // Ledger Items
  getLedgerItems: async (params?: {
    ledgerId?: string;
    instituteId?: string;
    scope?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => getList<LedgerItem>('/master-accounts/ledger-items', params),

  createLedgerItem: async (data: Partial<LedgerItem>) => {
    const response = await api.post<{ success: boolean; data: LedgerItem }>(
      '/master-accounts/ledger-items',
      data
    );
    return response.data.data;
  },

  updateLedgerItem: async (id: string, data: Partial<LedgerItem>) => {
    const response = await api.put<{ success: boolean; data: LedgerItem }>(
      `/master-accounts/ledger-items/${id}`,
      data
    );
    return response.data.data;
  },

  deleteLedgerItem: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/master-accounts/ledger-items/${id}`
    );
    return response.data;
  },

  // Mahallu Accounts (tenant-level, no instituteId)
  getAllMahalluAccounts: async (params?: { page?: number; limit?: number }) =>
    getList<MahalluAccount>('/master-accounts/mahallu-accounts', params),

  createMahalluAccount: async (data: Partial<MahalluAccount>) => {
    const response = await api.post<{ success: boolean; data: MahalluAccount }>(
      '/master-accounts/mahallu-accounts',
      data
    );
    return response.data.data;
  },

  updateMahalluAccount: async (id: string, data: Partial<MahalluAccount>) => {
    const response = await api.put<{ success: boolean; data: MahalluAccount }>(
      `/master-accounts/mahallu-accounts/${id}`,
      data
    );
    return response.data.data;
  },

  deleteMahalluAccount: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/master-accounts/mahallu-accounts/${id}`
    );
    return response.data;
  },
};
