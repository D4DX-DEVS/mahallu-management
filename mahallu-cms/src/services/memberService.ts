import api from './api';
import { Member } from '@/types';

export const memberService = {
  getAll: async (params?: {
    familyId?: string;
    search?: string;
    gender?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<{ success: boolean; data: Member[]; pagination?: any }>('/members', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Member }>(`/members/${id}`);
    return response.data.data;
  },

  getByFamily: async (familyId: string) => {
    const response = await api.get<{ success: boolean; data: Member[] }>(
      `/members/family/${familyId}`
    );
    return response.data.data;
  },

  create: async (memberData: Partial<Member>) => {
    const response = await api.post<{ success: boolean; data: Member }>('/members', memberData);
    return response.data.data;
  },

  update: async (id: string, memberData: Partial<Member>) => {
    const response = await api.put<{ success: boolean; data: Member }>(`/members/${id}`, memberData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/members/${id}`);
    return response.data;
  },

  bulkImportMembers: async (familyId: string, members: Array<Record<string, any>>) => {
    const response = await api.post<{ success: boolean; data: { imported: number } }>(
      '/members/bulk-import',
      { familyId, members }
    );
    return response.data.data;
  },
};

