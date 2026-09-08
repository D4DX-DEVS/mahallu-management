import api, { asList } from './api';
import { Employee } from '@/types';

export const employeeService = {
  getAll: async (params?: {
    instituteId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<{ success: boolean; data: Employee[]; pagination?: any }>('/employees', {
      params,
    });
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Employee }>(`/employees/${id}`);
    return response.data.data;
  },

  create: async (data: Partial<Employee>) => {
    const response = await api.post<{ success: boolean; data: Employee }>('/employees', data);
    return response.data.data;
  },

  update: async (id: string, data: Partial<Employee>) => {
    const response = await api.put<{ success: boolean; data: Employee }>(`/employees/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/employees/${id}`);
    return response.data;
  },
};
