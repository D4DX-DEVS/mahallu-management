import api from './api';

export type ReceiptStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ReceiptType = 'varisangya' | 'zakat';

type UserRef = string | { id?: string; name?: string } | null;

export interface ReceiptAuditFields {
  /** Missing on legacy receipts: treat as approved. */
  status?: ReceiptStatus;
  cancelledAt?: string;
  cancelledBy?: UserRef;
  cancelReason?: string;
  printLog?: Array<{ at: string; by?: UserRef; kind: 'original' | 'duplicate' }>;
  editHistory?: Array<{
    at: string;
    by?: UserRef;
    changes: Record<string, { from: unknown; to: unknown }>;
  }>;
}

export interface Varisangya extends ReceiptAuditFields {
  id: string;
  tenantId?: string;
  familyId?: string | { id: string; houseName?: string };
  memberId?: string | { id: string; name?: string };
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  receiptNo?: string;
  remarks?: string;
  createdAt: string;
}

export interface Zakat extends ReceiptAuditFields {
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
  createdAt: string;
}

export type PaymentRequestStatus = 'pending' | 'approved' | 'rejected';
export type PaymentRequestType = 'varisangya' | 'zakat';

export interface PaymentRequest {
  id: string;
  type: PaymentRequestType;
  payerName: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  receiptNo?: string;
  category?: string;
  remarks?: string;
  status: PaymentRequestStatus;
  rejectReason?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface PaymentRequestSummary {
  pending: { count: number; amount: number };
  approved: { count: number; amount: number };
  rejected: { count: number; amount: number };
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
  // Dues engine fields (additive)
  wardNumber?: string;
  monthsBilled?: number;
  totalBilled?: number;
  totalPaid?: number;
  arrears?: number;
  overdueAmount?: number;
  aheadMonths?: number;
  oldestUnpaidMonth?: string | null;
  oldestMonthBalance?: number;
  paidUpTo?: string | null;
  status?: DuesStatus;
}

export type DuesStatus = 'clear' | 'due' | 'overdue' | 'ahead';

export interface ReminderPreview {
  dryRun: boolean;
  totalWithDues: number;
  willSend: number;
  skippedNoPhone: number;
  sent: number;
  failed: number;
  runId?: string;
  delivery: 'whatsapp' | 'dev-stub';
  sample: Array<{ familyId: string; houseName: string; phone: string; amount: number; message: string }>;
}

export interface ReminderRun {
  id: string;
  month: string;
  mode: 'auto' | 'manual';
  state: 'sending' | 'sent';
  count: number;
  failed: number;
  skipped: number;
  sentAt?: string;
  createdAt: string;
}

export interface DuesSummary {
  totalFamilies: number;
  familiesWithDues: number;
  totalExpected: number;
  totalPaid: number;
  totalDue: number;
  totalOverdue?: number;
  familiesPaidAhead?: number;
  collectionRate?: number;
  statusCounts?: { all: number; overdue: number; due: number; clear: number; ahead: number };
  wardArrears?: Array<{ ward: string; amount: number }>;
}

export const collectibleService = {
  getFamilyDues: async (params?: { search?: string; onlyPending?: boolean; status?: DuesStatus }) => {
    const response = await api.get<{ success: boolean; data: { dues: FamilyDue[]; summary: DuesSummary } }>(
      '/collectibles/dues',
      { params: { ...params, onlyPending: params?.onlyPending ? 'true' : undefined } }
    );
    return response.data.data;
  },

  /** Preview (dryRun, default) or send varisangya reminders. familyIds limits the audience. */
  sendDueReminders: async (body: { dryRun: boolean; familyIds?: string[] }) => {
    const response = await api.post<{ success: boolean; data: ReminderPreview }>('/collectibles/dues/reminders/send', body);
    return response.data.data;
  },

  getReminderHistory: async () => {
    const response = await api.get<{ success: boolean; data: ReminderRun[] }>('/collectibles/dues/reminders/history');
    return response.data.data;
  },

  // Member payment requests (approval workflow)
  getPaymentRequests: async (params?: { status?: PaymentRequestStatus; type?: PaymentRequestType }) => {
    const response = await api.get<{ success: boolean; data: PaymentRequest[]; summary: PaymentRequestSummary }>(
      '/collectibles/payment-requests',
      { params }
    );
    return { data: response.data.data, summary: response.data.summary };
  },

  approvePaymentRequest: async (type: PaymentRequestType, id: string) => {
    const response = await api.post(`/collectibles/payment-requests/${type}/${encodeURIComponent(id)}/approve`);
    return response.data;
  },

  rejectPaymentRequest: async (type: PaymentRequestType, id: string, reason: string) => {
    const response = await api.post(`/collectibles/payment-requests/${type}/${encodeURIComponent(id)}/reject`, { reason });
    return response.data;
  },

  getCollectionsSummary: async () => {
    const response = await api.get<{ success: boolean; data: { varisangya: { count: number; amount: number }; zakat: { count: number; amount: number } } }>('/collectibles/summary');
    return response.data.data;
  },

  // Varisangya
  /** includeCancelled keeps voided receipts in the list (they are never part of any total). */
  getAllVarisangyas: async (params?: { familyId?: string; memberId?: string; page?: number; limit?: number; dateFrom?: string; dateTo?: string; includeCancelled?: boolean }) => {
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

  /** Void a receipt: keeps the number, reverses the amounts. Needs a reason of at least 5 characters. */
  cancelReceipt: async (type: ReceiptType, id: string, reason: string) => {
    const response = await api.post<{ success: boolean; data: Varisangya & Zakat; message: string }>(
      `/collectibles/${type}/${encodeURIComponent(id)}/cancel`,
      { reason }
    );
    return response.data;
  },

  /** Record a print. The server decides whether it is the original or a duplicate. */
  recordReceiptPrint: async (type: ReceiptType, id: string) => {
    const response = await api.post<{ success: boolean; data: { kind: 'original' | 'duplicate'; isDuplicate: boolean } }>(
      `/collectibles/${type}/${encodeURIComponent(id)}/print-log`
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
  getAllZakats: async (params?: { search?: string; page?: number; limit?: number; includeCancelled?: boolean }) => {
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

  // Wallet – API returns MongoDB docs with _id; normalize to id for frontend
  getWallet: async (params?: { familyId?: string; memberId?: string }) => {
    const response = await api.get<{ success: boolean; data: Wallet & { id?: string } }>('/collectibles/wallet', { params });
    const data = response.data.data;
    if (!data) return data;
    const id = (data as any).id ?? (data as any)._id;
    const normalizedId = id != null ? String(id) : undefined;
    return { ...data, id: normalizedId } as Wallet;
  },

  getWalletTransactions: async (walletId: string) => {
    if (!walletId || typeof walletId !== 'string') return [];
    const response = await api.get<{ success: boolean; data: (Transaction & { id?: string })[] }>(
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

