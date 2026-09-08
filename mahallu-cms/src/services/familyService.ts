import api, { asList } from './api';
import { Family } from '@/types';

export const familyService = {
  getAll: async (params?: {
    status?: string;
    search?: string;
    area?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<{ success: boolean; data: Family[]; pagination?: any }>('/families', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  getStats: async () => {
    const response = await api.get<{
      success: boolean;
      data: { totalMembers: number; maleCount: number; femaleCount: number };
    }>('/families/stats');
    return response.data.data;
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Family }>(`/families/${id}`);
    return response.data.data;
  },

  create: async (familyData: Partial<Family>) => {
    const response = await api.post<{ success: boolean; data: Family }>('/families', familyData);
    return response.data.data;
  },

  update: async (id: string, familyData: Partial<Family>) => {
    const response = await api.put<{ success: boolean; data: Family }>(`/families/${id}`, familyData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/families/${id}`);
    return response.data;
  },

  bulkImportFamilies: async (families: Array<Record<string, any>>) => {
    const response = await api.post<{ success: boolean; data: { imported: number } }>(
      '/families/bulk-import',
      { families }
    );
    return response.data.data;
  },
};
