import api, { asList } from './api';
import { User } from '@/types';

export const userService = {
  getAll: async (params?: {
    role?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<{ success: boolean; data: User[]; pagination?: any }>('/users', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: User }>(`/users/${id}`);
    return response.data.data;
  },

  create: async (userData: Partial<User> & { password?: string }) => {
    const response = await api.post<{ success: boolean; data: User }>('/users', userData);
    return response.data.data;
  },

  update: async (id: string, userData: Partial<User>) => {
    const response = await api.put<{ success: boolean; data: User }>(`/users/${id}`, userData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/users/${id}`);
    return response.data;
  },
};
