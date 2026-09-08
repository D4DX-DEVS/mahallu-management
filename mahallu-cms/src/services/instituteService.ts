import api, { asList } from './api';
import { Institute } from '@/types';

export const instituteService = {
  getAll: async (params?: {
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<{ success: boolean; data: Institute[]; pagination?: any }>('/institutes', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Institute }>(`/institutes/${id}`);
    return response.data.data;
  },

  create: async (instituteData: Partial<Institute>) => {
    const response = await api.post<{ success: boolean; data: Institute }>('/institutes', instituteData);
    return response.data.data;
  },

  update: async (id: string, instituteData: Partial<Institute>) => {
    const response = await api.put<{ success: boolean; data: Institute }>(`/institutes/${id}`, instituteData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/institutes/${id}`);
    return response.data;
  },
};
