import api, { asList } from './api';
import {
  buildWalletListParams,
  normalizeWalletListResponse,
  type WalletListType,
  type WalletListResult,
} from '../utils/walletList';

export interface Varisangya {
  id: string;
  tenantId?: string;
  familyId?: string | { id: string; houseName?: string };
  memberId?: string | { id: string; name?: string };
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  receiptNo?: string;
  remarks?: string;
  status?: 'pending' | 'verified';
  source?: 'admin' | 'member';
  createdAt: string;
}

/**
 * Body for creating a varisangya payment. `clientRequestId` is generated once per
 * payment attempt: a repeat of the same id is treated by the server as the same
 * payment and answered with the one that already exists, so a retry after a
 * timeout or a partial bulk failure cannot create a duplicate.
 */
export type CreateVarisangyaPayload = Partial<Varisangya> & {
  remarksMl?: string;
  clientRequestId?: string;
};

/**
 * Totals over the WHOLE filtered set (every page), computed by the server with
 * the same filters as the list. `totalAmount` includes pending payments;
 * `verifiedAmount` is money actually received.
 */
export interface CollectionSummary {
  count: number;
  totalAmount: number;
  verifiedAmount: number;
  pendingAmount: number;
  verifiedCount: number;
  pendingCount: number;
}

export const EMPTY_COLLECTION_SUMMARY: CollectionSummary = {
  count: 0,
  totalAmount: 0,
  verifiedAmount: 0,
  pendingAmount: 0,
  verifiedCount: 0,
  pendingCount: 0,
};

/** Fills any missing field so a page never renders NaN from a partial summary. */
export const normalizeCollectionSummary = (raw: Partial<CollectionSummary> | null | undefined): CollectionSummary => ({
  count: Number(raw?.count) || 0,
  totalAmount: Number(raw?.totalAmount) || 0,
  verifiedAmount: Number(raw?.verifiedAmount) || 0,
  pendingAmount: Number(raw?.pendingAmount) || 0,
  verifiedCount: Number(raw?.verifiedCount) || 0,
  pendingCount: Number(raw?.pendingCount) || 0,
});

/**
 * Totals for rows already in memory. Only for a view that has fetched every
 * matching row (for example a client-side name filter); everything else uses
 * the server `summary`, which covers rows that are not on the page.
 */
export const summarizeCollectionRows = (rows: { amount?: number; status?: string }[]): CollectionSummary => {
  const summary = { ...EMPTY_COLLECTION_SUMMARY };
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    summary.count += 1;
    summary.totalAmount += amount;
    if (row.status === 'pending') {
      summary.pendingCount += 1;
      summary.pendingAmount += amount;
    } else {
      summary.verifiedCount += 1;
      summary.verifiedAmount += amount;
    }
  }
  return summary;
};

export interface CollectionsSummaryResult {
  varisangya: CollectionSummary;
  zakat: CollectionSummary;
  totals: CollectionSummary;
}

/** Body for creating a zakat payment; `clientRequestId` works as for varisangya. */
export type CreateZakatPayload = Partial<Zakat> & { clientRequestId?: string };

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
  paymentMethod?: string;
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
  getFamilyDues: async (params?: {
    search?: string;
    onlyPending?: boolean;
    page?: number;
    limit?: number;
  }) => {
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
  getAllVarisangyas: async (params?: {
    familyId?: string;
    memberId?: string;
    hasFamily?: boolean;
    hasMember?: boolean;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const response = await api.get<{
      success: boolean;
      data: Varisangya[];
      pagination?: any;
      summary?: CollectionSummary;
    }>('/collectibles/varisangya', { params });
    // `summary` covers the whole filtered set, not just this page.
    return {
      data: asList(response.data.data),
      pagination: response.data.pagination ?? null,
      summary: normalizeCollectionSummary(response.data.summary),
    };
  },

  /** Collections overview totals (varisangya, zakat and combined) over the whole tenant. */
  getCollectionsSummary: async (params?: { dateFrom?: string; dateTo?: string }) => {
    const response = await api.get<{ success: boolean; data: Partial<CollectionsSummaryResult> }>(
      '/collectibles/summary',
      { params }
    );
    const data = response.data.data;
    return {
      varisangya: normalizeCollectionSummary(data?.varisangya),
      zakat: normalizeCollectionSummary(data?.zakat),
      totals: normalizeCollectionSummary(data?.totals),
    } as CollectionsSummaryResult;
  },

  createVarisangya: async (data: CreateVarisangyaPayload) => {
    const response = await api.post<{ success: boolean; data: Varisangya }>('/collectibles/varisangya', data);
    return response.data.data;
  },

  updateVarisangya: async (
    id: string,
    data: Partial<Pick<Varisangya, 'amount' | 'paymentDate' | 'paymentMethod' | 'remarks'>>
  ) => {
    const response = await api.put<{ success: boolean; data: Varisangya }>(
      `/collectibles/varisangya/${id}`,
      data
    );
    return response.data.data;
  },

  deleteVarisangya: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/collectibles/varisangya/${id}`
    );
    return response.data;
  },

  verifyVarisangya: async (id: string) => {
    const response = await api.put<{ success: boolean; data: Varisangya }>(
      `/collectibles/varisangya/${id}/verify`,
      {}
    );
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
  getAllZakats: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const response = await api.get<{
      success: boolean;
      data: Zakat[];
      pagination?: any;
      summary?: CollectionSummary;
    }>('/collectibles/zakat', { params });
    // `summary` covers the whole filtered set, not just this page.
    return {
      data: asList(response.data.data),
      pagination: response.data.pagination ?? null,
      summary: normalizeCollectionSummary(response.data.summary),
    };
  },

  createZakat: async (data: CreateZakatPayload) => {
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
    const response = await api.get<{ success: boolean; data: Wallet & { _id?: string } }>(
      '/collectibles/wallet',
      { params }
    );
    const data = response.data.data;
    if (!data) return data;
    const id = (data as any).id ?? (data as any)._id;
    const normalizedId = id != null ? String(id) : undefined;
    return { ...data, id: normalizedId } as Wallet;
  },

  /**
   * One page of wallet balances for EVERY family (or member) of the Mahallu, with `summary` totals over
   * the whole filtered set. Families/members without a wallet come back with balance 0. Fits
   * fetchAllPages (data + pagination), so an export can page through the same filter.
   */
  listWallets: async (
    type: WalletListType,
    params: { page?: number; limit?: number; search?: string } = {}
  ): Promise<WalletListResult> => {
    const response = await api.get('/collectibles/wallets', { params: buildWalletListParams(type, params) });
    return normalizeWalletListResponse(response.data);
  },

  /** One page of a wallet's journal (the API defaults to 50 and caps at 100). */
  getWalletTransactions: async (walletId: string, params?: { page?: number; limit?: number }) => {
    if (!walletId || typeof walletId !== 'string') return { data: [] as Transaction[], pagination: null };
    const response = await api.get<{
      success: boolean;
      data: (Transaction & { _id?: string })[];
      pagination?: any;
    }>(`/collectibles/wallet/${encodeURIComponent(walletId)}/transactions`, { params });
    const list = asList(response.data?.data);
    return {
      data: list.map((t) => {
        const id = (t as any).id ?? (t as any)._id;
        return { ...t, id: id != null ? String(id) : (t as Transaction).id } as Transaction;
      }),
      pagination: response.data?.pagination ?? null,
    };
  },
};
