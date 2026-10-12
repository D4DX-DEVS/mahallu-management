import api from './api';
import { Member } from '@/types';

export const memberService = {
  getAll: async (params?: {
    familyId?: string;
    search?: string;
    gender?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<{ success: boolean; data: Member[]; pagination?: any }>('/members', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  getById: async (id: string, signal?: AbortSignal) => {
    const response = await api.get<{ success: boolean; data: Member }>(`/members/${id}`, { signal });
    return response.data.data;
  },

  getByFamily: async (familyId: string, signal?: AbortSignal) => {
    const response = await api.get<{ success: boolean; data: Member[] }>(
      `/members/family/${familyId}`,
      { signal }
    );
    return response.data.data;
  },

  /** Pass `{ confirmDuplicate: true }` to save even though the API found a possible duplicate. */
  create: async (memberData: Partial<Member>, opts?: { confirmDuplicate?: boolean }) => {
    const response = await api.post<{ success: boolean; data: Member }>('/members', memberData, {
      params: opts?.confirmDuplicate ? { confirmDuplicate: true } : undefined,
    });
    return response.data.data;
  },

  /** Move a member to another family of this mahallu. */
  transfer: async (id: string, toFamilyId: string, makeHead = false) => {
    const response = await api.post<{ success: boolean; message: string; data: { newMahallId?: string; sourceNeedsHead: boolean } }>(
      `/members/${id}/transfer`,
      { toFamilyId, makeHead }
    );
    return response.data;
  },

  update: async (id: string, memberData: Partial<Member>) => {
    const response = await api.put<{ success: boolean; data: Member }>(`/members/${id}`, memberData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/members/${id}`);
    return response.data;
  },

  /** The API answers 409 POSSIBLE_DUPLICATE when rows look like existing members; re-send with `confirmDuplicate`. */
  bulkImportMembers: async (familyId: string, members: Array<Record<string, any>>, opts?: { confirmDuplicate?: boolean }) => {
    const response = await api.post<{ success: boolean; data: { imported: number } }>(
      '/members/bulk-import',
      { familyId, members },
      { params: opts?.confirmDuplicate ? { confirmDuplicate: true } : undefined }
    );
    return response.data.data;
  },
};

