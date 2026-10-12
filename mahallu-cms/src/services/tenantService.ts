import api from './api';
import { Tenant, TenantStats } from '@/types/tenant';

const FRESH_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; data: Tenant }>();
const inflight = new Map<string, Promise<Tenant>>();

/** Forget a cached tenant (or all of them) so the next getById reads from the API. */
export const invalidateTenantCache = (id?: string) => {
  if (id) {
    cache.delete(id);
    inflight.delete(id);
  } else {
    cache.clear();
    inflight.clear();
  }
};

export const tenantService = {
  getAll: async (params?: { status?: string; search?: string; type?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Tenant[]; pagination?: any }>('/tenants', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  /**
   * One shared read of GET /tenants/:id for the whole app: concurrent callers share a single
   * request and the result stays fresh for 5 minutes. Pass `{ force: true }` where stale data
   * would mislead (admin edit pages). Updates through this service invalidate the cache.
   */
  getById: async (id: string, opts?: { force?: boolean }): Promise<Tenant> => {
    if (!opts?.force) {
      const hit = cache.get(id);
      if (hit && Date.now() - hit.at < FRESH_MS) return hit.data;
      const pending = inflight.get(id);
      if (pending) return pending;
    }
    const request = api
      .get<{ success: boolean; data: Tenant }>(`/tenants/${id}`)
      .then((response) => {
        cache.set(id, { at: Date.now(), data: response.data.data });
        return response.data.data;
      })
      .finally(() => {
        if (inflight.get(id) === request) inflight.delete(id);
      });
    inflight.set(id, request);
    return request;
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
    invalidateTenantCache(id);
    const response = await api.put<{ success: boolean; data: Tenant }>(`/tenants/${id}`, tenantData);
    invalidateTenantCache(id);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/tenants/${id}`);
    return response.data;
  },

  suspend: async (id: string) => {
    const response = await api.post<{ success: boolean; data: Tenant }>(`/tenants/${id}/suspend`);
    invalidateTenantCache(id);
    return response.data.data;
  },

  activate: async (id: string) => {
    const response = await api.post<{ success: boolean; data: Tenant }>(`/tenants/${id}/activate`);
    invalidateTenantCache(id);
    return response.data.data;
  },
};

