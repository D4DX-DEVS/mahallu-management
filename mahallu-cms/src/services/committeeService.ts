import api, { asList } from './api';
import { Committee } from '@/types';

export const committeeService = {
  getAll: async (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    expiring?: string;
  }) => {
    const response = await api.get<{ success: boolean; data: Committee[]; pagination?: any }>('/committees', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Committee }>(`/committees/${id}`);
    return response.data.data;
  },

  getMeetings: async (id: string) => {
    const response = await api.get<{ success: boolean; data: any[] }>(`/committees/${id}/meetings`);
    return asList(response.data.data);
  },

  create: async (committeeData: Partial<Committee>) => {
    const response = await api.post<{ success: boolean; data: Committee }>('/committees', committeeData);
    return response.data.data;
  },

  update: async (id: string, committeeData: Partial<Committee>) => {
    const response = await api.put<{ success: boolean; data: Committee }>(`/committees/${id}`, committeeData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/committees/${id}`);
    return response.data;
  },
};
