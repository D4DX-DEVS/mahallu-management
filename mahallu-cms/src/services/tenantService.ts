import api, { asList } from './api';
import { Tenant, TenantStats } from '@/types/tenant';

export const tenantService = {
  getAll: async (params?: {
    status?: string;
    search?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<{ success: boolean; data: Tenant[]; pagination?: any }>('/tenants', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Tenant }>(`/tenants/${id}`);
    return response.data.data;
  },

  getStats: async (id: string) => {
    const response = await api.get<{ success: boolean; data: TenantStats }>(`/tenants/${id}/stats`);
    return response.data.data;
  },

  create: async (tenantData: Partial<Tenant>) => {
    const response = await api.post<{ success: boolean; data: Tenant }>('/tenants', tenantData);
    return response.data.data;
  },

  update: async (id: string, tenantData: Partial<Tenant>) => {
    const response = await api.put<{ success: boolean; data: Tenant }>(`/tenants/${id}`, tenantData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/tenants/${id}`);
    return response.data;
  },

  suspend: async (id: string) => {
    const response = await api.post<{ success: boolean; data: Tenant }>(`/tenants/${id}/suspend`);
    return response.data.data;
  },

  activate: async (id: string) => {
    const response = await api.post<{ success: boolean; data: Tenant }>(`/tenants/${id}/activate`);
    return response.data.data;
  },
};
