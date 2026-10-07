import api, { asList } from './api';

export type WelfareStatus = 'pending' | 'verified' | 'approved' | 'rejected' | 'disbursed' | 'closed';

export interface WelfareScheme {
  id: string;
  name: string;
  nameMl?: string;
  category: string;
  description?: string;
  budgetAmount?: number;
  status: 'active' | 'closed';
}

export interface WelfareApplication {
  id: string;
  schemeId: { _id: string; name: string; category?: string } | string;
  familyId?: { _id: string; houseName: string; familyHead?: string; contactNo?: string } | string;
  memberId?: { _id: string; name: string } | string;
  requestedAmount: number;
  approvedAmount?: number;
  reason?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: WelfareStatus;
  verificationNotes?: string;
  disbursedDate?: string;
  disbursedVia?: 'cash' | 'bank' | 'ledger';
  history?: Array<{ status: WelfareStatus; changedAt: string; note?: string }>;
  createdAt: string;
}

export interface WelfareSummary {
  total: number;
  pending: number;
  approved: number;
  disbursed: number;
  disbursedAmount: number;
}

export const welfareService = {
  getSchemes: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const response = await api.get<{ success: boolean; data: WelfareScheme[]; pagination?: any }>(
      '/welfare/schemes',
      { params }
    );
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  createScheme: async (payload: Partial<WelfareScheme>) => {
    const response = await api.post<{ success: boolean; data: WelfareScheme }>('/welfare/schemes', payload);
    return response.data.data;
  },

  updateScheme: async (id: string, payload: Partial<WelfareScheme>) => {
    const response = await api.put<{ success: boolean; data: WelfareScheme }>(
      `/welfare/schemes/${id}`,
      payload
    );
    return response.data.data;
  },

  removeScheme: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/welfare/schemes/${id}`);
    return response.data;
  },

  getApplications: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: WelfareApplication[]; pagination?: any }>(
      '/welfare/applications',
      { params }
    );
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  getApplication: async (id: string) => {
    const response = await api.get<{ success: boolean; data: WelfareApplication }>(
      `/welfare/applications/${id}`
    );
    return response.data.data;
  },

  createApplication: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: WelfareApplication }>(
      '/welfare/applications',
      payload
    );
    return response.data.data;
  },

  updateApplication: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: WelfareApplication }>(
      `/welfare/applications/${id}`,
      payload
    );
    return response.data.data;
  },

  updateStatus: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: WelfareApplication }>(
      `/welfare/applications/${id}/status`,
      payload
    );
    return response.data.data;
  },

  removeApplication: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/welfare/applications/${id}`);
    return response.data;
  },

  getSummary: async () => {
    const response = await api.get<{ success: boolean; data: WelfareSummary }>('/welfare/summary');
    return response.data.data;
  },
};
