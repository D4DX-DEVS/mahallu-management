import api, { asList } from './api';
import { Meeting } from '@/types';

export const meetingService = {
  getAll: async (params?: { committeeId?: string; status?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Meeting[]; pagination?: any }>('/meetings', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Meeting }>(`/meetings/${id}`);
    return response.data.data;
  },

  create: async (meetingData: Partial<Meeting>) => {
    const response = await api.post<{ success: boolean; data: Meeting }>('/meetings', meetingData);
    return response.data.data;
  },

  update: async (id: string, meetingData: Partial<Meeting>) => {
    const response = await api.put<{ success: boolean; data: Meeting }>(`/meetings/${id}`, meetingData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/meetings/${id}`);
    return response.data;
  },
};
