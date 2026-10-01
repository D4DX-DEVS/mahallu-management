import api, { asList } from './api';
import { Member } from '@/types';

export const memberService = {
  getAll: async (params?: {
    familyId?: string;
    search?: string;
    gender?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
    /** Super admin only — scopes the list to a tenant other than the currently
     * selected one (see backend getAllMembers' explicit query-param fallback). */
    tenantId?: string;
  }) => {
    const response = await api.get<{ success: boolean; data: Member[]; pagination?: any }>('/members', {
      params,
      // An explicit tenantId (e.g. RoleSwitcher's picker) must scope this
      // request even when the ambient TenantSwitcher selection differs — see
      // api.ts's request interceptor, which never overwrites a header already
      // set here.
      ...(params?.tenantId ? { headers: { 'x-tenant-id': params.tenantId } } : {}),
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Member }>(`/members/${id}`);
    return response.data.data;
  },

  getByFamily: async (familyId: string) => {
    const response = await api.get<{ success: boolean; data: Member[] }>(`/members/family/${familyId}`);
    return asList(response.data.data);
  },

  create: async (memberData: Partial<Member>) => {
    const response = await api.post<{ success: boolean; data: Member }>('/members', memberData);
    return response.data.data;
  },

  update: async (id: string, memberData: Partial<Member>) => {
    const response = await api.put<{ success: boolean; data: Member }>(`/members/${id}`, memberData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/members/${id}`);
    return response.data;
  },

  bulkImportMembers: async (familyId: string, members: Array<Record<string, any>>) => {
    const response = await api.post<{ success: boolean; data: { imported: number } }>(
      '/members/bulk-import',
      { familyId, members }
    );
    return response.data.data;
  },
};
