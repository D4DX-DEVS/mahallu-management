import api, { asList } from './api';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface ZakatBeneficiary {
  id: string;
  memberId?: { id: string; name: string; phone?: string; familyName?: string } | string;
  familyId?: { _id: string; houseName: string } | string;
  name?: string;
  category: string;
  verificationStatus: VerificationStatus;
  verifiedDate?: string;
  priorityArea?: string;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface ZakatDistribution {
  id: string;
  beneficiaryId: { _id: string; name?: string; category?: string; memberId?: { name: string } } | string;
  amount: number;
  distributionDate: string;
  type: 'regular' | 'monthly' | 'fitr' | 'qurbani';
  paymentMethod?: string;
  receiptNo?: string;
  remarks?: string;
}

export interface ZakatSummary {
  year: number;
  collected: number;
  distributed: number;
  balance: number;
  collectionCount: number;
  distributionCount: number;
  verifiedBeneficiaries: number;
  pendingBeneficiaries: number;
  byType: Array<{ type: string; total: number; count: number }>;
}

export const ZAKAT_CATEGORY_OPTIONS = [
  { value: 'fakir', label: 'Fakir (destitute)' },
  { value: 'miskin', label: 'Miskin (needy)' },
  { value: 'amil', label: 'Amil (collector)' },
  { value: 'muallaf', label: 'Muallaf (new Muslim)' },
  { value: 'riqab', label: 'Riqab (freeing from bondage)' },
  { value: 'gharim', label: 'Gharim (in debt)' },
  { value: 'fisabilillah', label: 'Fisabilillah (in the cause of Allah)' },
  { value: 'ibnussabil', label: 'Ibnussabil (wayfarer)' },
  { value: 'other', label: 'Other' },
];

export const PRIORITY_AREA_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'medical', label: 'Medical' },
  { value: 'housing', label: 'Housing' },
  { value: 'education', label: 'Education' },
  { value: 'livelihood', label: 'Livelihood' },
  { value: 'living_expenses', label: 'Living expenses' },
];

export const DISTRIBUTION_TYPE_OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'fitr', label: 'Zakat al-Fitr' },
  { value: 'qurbani', label: 'Qurbani' },
];

export const zakatDistributionService = {
  getBeneficiaries: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: ZakatBeneficiary[]; pagination?: any }>(
      '/zakat/beneficiaries',
      { params }
    );
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  getBeneficiary: async (id: string) => {
    const response = await api.get<{
      success: boolean;
      data: { beneficiary: ZakatBeneficiary; distributions: ZakatDistribution[] };
    }>(`/zakat/beneficiaries/${id}`);
    return response.data.data;
  },

  createBeneficiary: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: ZakatBeneficiary }>(
      '/zakat/beneficiaries',
      payload
    );
    return response.data.data;
  },

  updateBeneficiary: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: ZakatBeneficiary }>(
      `/zakat/beneficiaries/${id}`,
      payload
    );
    return response.data.data;
  },

  removeBeneficiary: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/zakat/beneficiaries/${id}`);
    return response.data;
  },

  verifyBeneficiary: async (
    id: string,
    payload: { verificationStatus: VerificationStatus; notes?: string }
  ) => {
    const response = await api.put<{ success: boolean; data: ZakatBeneficiary }>(
      `/zakat/beneficiaries/${id}/verify`,
      payload
    );
    return response.data.data;
  },

  getDistributions: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: ZakatDistribution[]; pagination?: any }>(
      '/zakat/distributions',
      { params }
    );
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  createDistribution: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: ZakatDistribution }>(
      '/zakat/distributions',
      payload
    );
    return response.data.data;
  },

  updateDistribution: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: ZakatDistribution }>(
      `/zakat/distributions/${id}`,
      payload
    );
    return response.data.data;
  },

  removeDistribution: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/zakat/distributions/${id}`);
    return response.data;
  },

  getSummary: async (year?: number) => {
    const response = await api.get<{ success: boolean; data: ZakatSummary }>('/zakat/summary', {
      params: year ? { year } : undefined,
    });
    return response.data.data;
  },
};
