import api from './api';

export interface MarriageAssistance {
  id: string;
  tenantId?: string;
  memberId?: string | { _id: string; name: string; phone?: string };
  familyId?: string | { _id: string; houseName?: string; familyHead?: string; contactNo?: string };
  type: 'proposal_support' | 'financial_assistance' | 'premarital_counselling';
  amount?: number;
  status: 'requested' | 'approved' | 'completed';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
  total: number;
  totalPages: number;
}

export const marriageAssistanceService = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    search?: string;
    memberId?: string;
    familyId?: string;
  }) => {
    const response = await api.get<{
      success: boolean;
      data: MarriageAssistance[];
      pagination?: Pagination;
    }>('/marriage-assistance', { params });
    return {
      data: response.data.data,
      pagination: response.data.pagination || null,
    };
  },

  getById: async (id: string) => {
    const response = await api.get<{
      success: boolean;
      data: MarriageAssistance;
    }>(`/marriage-assistance/${id}`);
    return response.data.data;
  },

  create: async (data: Partial<MarriageAssistance>) => {
    const response = await api.post<{
      success: boolean;
      data: MarriageAssistance;
    }>('/marriage-assistance', data);
    return response.data.data;
  },

  update: async (id: string, data: Partial<MarriageAssistance>) => {
    const response = await api.put<{
      success: boolean;
      data: MarriageAssistance;
    }>(`/marriage-assistance/${id}`, data);
    return response.data.data;
  },

  updateStatus: async (
    id: string,
    status: 'approved' | 'completed',
    notes?: string
  ) => {
    const response = await api.put<{
      success: boolean;
      data: MarriageAssistance;
    }>(`/marriage-assistance/${id}/status`, { status, notes });
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{
      success: boolean;
      message: string;
    }>(`/marriage-assistance/${id}`);
    return response.data;
  },
};
