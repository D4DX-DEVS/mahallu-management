import api, { asList } from './api';
import { SalaryPayment } from '@/types';

export const salaryService = {
  getAll: async (params?: {
    instituteId?: string;
    employeeId?: string;
    month?: number;
    year?: number;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<{ success: boolean; data: SalaryPayment[]; pagination?: any }>(
      '/salary-payments',
      { params }
    );
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: SalaryPayment }>(`/salary-payments/${id}`);
    return response.data.data;
  },

  create: async (data: Partial<SalaryPayment>) => {
    const response = await api.post<{ success: boolean; data: SalaryPayment }>('/salary-payments', data);
    return response.data.data;
  },

  update: async (id: string, data: Partial<SalaryPayment>) => {
    const response = await api.put<{ success: boolean; data: SalaryPayment }>(`/salary-payments/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/salary-payments/${id}`);
    return response.data;
  },

  getSummary: async (params?: { instituteId?: string; month?: number; year?: number }) => {
    const response = await api.get<{ success: boolean; data: any[] }>('/salary-payments/summary', { params });
    return asList(response.data.data);
  },

  getEmployeeHistory: async (employeeId: string) => {
    const response = await api.get<{ success: boolean; data: any }>(
      `/salary-payments/employee/${employeeId}`
    );
    return response.data.data;
  },
};
