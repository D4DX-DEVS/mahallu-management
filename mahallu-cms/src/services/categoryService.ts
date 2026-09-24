import api, { asList } from './api';

export interface CategoryValue {
  id: string;
  categoryId: string;
  categoryKey: string;
  code: string;
  label: string;
  labelMl?: string;
  description?: string;
  /** Only 'varisangya_grade' values carry this - the amount billed for the grade. */
  amount?: number;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  key: string;
  name: string;
  description?: string;
  isSystem: boolean;
  status: 'active' | 'inactive';
  valueCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const categoryService = {
  getAll: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: Category[]; pagination?: any }>('/categories', {
      params,
    });
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Category }>(`/categories/${id}`);
    return response.data.data;
  },

  create: async (payload: { key: string; name: string; description?: string }) => {
    const response = await api.post<{ success: boolean; data: Category }>('/categories', payload);
    return response.data.data;
  },

  update: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: Category }>(`/categories/${id}`, payload);
    return response.data.data;
  },

  delete: async (id: string) => {
    await api.delete(`/categories/${id}`);
  },

  getValues: async (id: string) => {
    const response = await api.get<{ success: boolean; data: CategoryValue[] }>(`/categories/${id}/values`);
    return asList(response.data.data);
  },

  createValue: async (
    id: string,
    payload: { code: string; label: string; labelMl?: string; description?: string; sortOrder?: number }
  ) => {
    const response = await api.post<{ success: boolean; data: CategoryValue }>(
      `/categories/${id}/values`,
      payload
    );
    return response.data.data;
  },

  updateValue: async (id: string, valueId: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: CategoryValue }>(
      `/categories/${id}/values/${valueId}`,
      payload
    );
    return response.data.data;
  },

  deleteValue: async (id: string, valueId: string) => {
    await api.delete(`/categories/${id}/values/${valueId}`);
  },

  // Dropdown-consumption endpoints — available to any authenticated role.
  getActiveValuesByKey: async (key: string) => {
    const response = await api.get<{ success: boolean; data: CategoryValue[] }>(
      `/categories/by-key/${key}/values`
    );
    return asList(response.data.data);
  },

  createValueByKey: async (key: string, payload: { code: string; label: string; labelMl?: string }) => {
    const response = await api.post<{ success: boolean; data: CategoryValue }>(
      `/categories/by-key/${key}/values`,
      payload
    );
    return response.data.data;
  },
};
