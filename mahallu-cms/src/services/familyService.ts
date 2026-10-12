import api from './api';
import { Family } from '@/types';

/** A possible existing record returned with a 409 POSSIBLE_DUPLICATE response. */
export interface DuplicateMatchItem {
  id: string;
  houseName?: string;
  familyHead?: string;
  mahallId?: string;
  name?: string;
  row?: number;
  reason: string;
}

/** Returns the matches when an API error is a POSSIBLE_DUPLICATE warning, otherwise null. */
export const parseDuplicateError = (err: any): DuplicateMatchItem[] | null => {
  const d = err?.response?.data;
  return err?.response?.status === 409 && d?.code === 'POSSIBLE_DUPLICATE' && Array.isArray(d.matches) ? d.matches : null;
};

/** Lifecycle flags the API adds to a family (all optional on older records). */
export interface FamilyLifecycleFlags {
  isArchived?: boolean;
  archivedAt?: string;
  archivedReason?: string;
  needsHeadReassignment?: boolean;
  needsHeadReason?: string;
  mergedIntoFamilyId?: string;
  lifecycleLog?: Array<{ action: string; at: string; byName?: string; details?: Record<string, any> }>;
}

export interface FamilyLifecycleInfo {
  isArchived: boolean;
  activeMembers: number;
  members: Array<{ id: string; name: string }>;
  dueAmount: number;
  needsHeadReassignment: boolean;
  needsHeadReason?: string;
  lifecycleLog: NonNullable<FamilyLifecycleFlags['lifecycleLog']>;
}

export interface MergePreview {
  source: { id: string; houseName: string; mahallId?: string; familyHead?: string };
  target: { id: string; houseName: string; mahallId?: string; familyHead?: string };
  members: Array<{ id: string; name: string; isFamilyHead: boolean; isDead: boolean; status: string }>;
  references: Record<string, number>;
  headOutcome: { keep: string | null; demoted: string[]; note?: string };
  willBeArchived: boolean;
}

export const familyService = {
  getAll: async (params?: { status?: string; search?: string; area?: string; sortBy?: string; page?: number; limit?: number; archived?: boolean; needsHead?: boolean }) => {
    const response = await api.get<{ success: boolean; data: Family[]; pagination?: any }>('/families', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  getStats: async () => {
    const response = await api.get<{ success: boolean; data: { totalMembers: number; maleCount: number; femaleCount: number } }>('/families/stats');
    return response.data.data;
  },

  getById: async (id: string, signal?: AbortSignal) => {
    const response = await api.get<{ success: boolean; data: Family }>(`/families/${id}`, { signal });
    return response.data.data;
  },

  /** Pass `{ confirmDuplicate: true }` to save even though the API found a possible duplicate. */
  create: async (familyData: Partial<Family>, opts?: { confirmDuplicate?: boolean }) => {
    const response = await api.post<{ success: boolean; data: Family }>('/families', familyData, {
      params: opts?.confirmDuplicate ? { confirmDuplicate: true } : undefined,
    });
    return response.data.data;
  },

  update: async (id: string, familyData: Partial<Family>) => {
    const response = await api.put<{ success: boolean; data: Family }>(`/families/${id}`, familyData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/families/${id}`);
    return response.data;
  },

  // ----- Lifecycle (archive / restore / merge / split / head) -----
  getLifecycle: async (id: string) => {
    const response = await api.get<{ success: boolean; data: FamilyLifecycleInfo }>(`/families/${id}/lifecycle`);
    return response.data.data;
  },

  /** Archives the family (soft delete). The API answers 409 with a reason code when members or dues need a decision. */
  archive: async (id: string, opts: { cascade?: boolean; force?: boolean; reason?: string } = {}) => {
    const response = await api.delete<{ success: boolean; message: string; data: { archivedMembers: number; dueAmount: number } }>(
      `/families/${id}`,
      { params: { cascade: opts.cascade || undefined, force: opts.force || undefined, reason: opts.reason || undefined } }
    );
    return response.data;
  },

  restore: async (id: string) => {
    const response = await api.post<{ success: boolean; data: { restoredMembers: number } }>(`/families/${id}/restore`);
    return response.data.data;
  },

  mergePreview: async (id: string, intoFamilyId: string) => {
    const response = await api.get<{ success: boolean; data: MergePreview }>(`/families/${id}/merge-preview`, { params: { intoFamilyId } });
    return response.data.data;
  },

  merge: async (id: string, intoFamilyId: string) => {
    const response = await api.post<{ success: boolean; data: { movedMembers: number; repointed: Record<string, number> } }>(
      `/families/${id}/merge`,
      { intoFamilyId }
    );
    return response.data.data;
  },

  split: async (id: string, body: { memberIds: string[]; newHouseName: string; newFamilyHeadId?: string; contactNo?: string }) => {
    const response = await api.post<{ success: boolean; data: { newFamily: Family; movedMembers: number } }>(`/families/${id}/split`, body);
    return response.data.data;
  },

  setHead: async (id: string, memberId: string) => {
    const response = await api.put<{ success: boolean; data: Family }>(`/families/${id}/head`, { memberId });
    return response.data.data;
  },

  getDuplicates: async () => {
    const response = await api.get<{ success: boolean; data: { count: number; pairs: Array<{ a: DuplicateMatchItem & { contactNo?: string }; b: DuplicateMatchItem & { contactNo?: string }; reasons: Array<{ reason: string; reasonText: string }> }> } }>('/families/duplicates');
    return response.data.data;
  },

  getNeedsAttention: async () => {
    const response = await api.get<{ success: boolean; data: { needsNewHead: Array<{ id: string; houseName: string; mahallId?: string; formerHead?: string; reason?: string; since?: string }>; counts: { needsNewHead: number } } }>('/families/needs-attention');
    return response.data.data;
  },

  /** The API answers 409 POSSIBLE_DUPLICATE when rows look like existing families; re-send with `confirmDuplicate`. */
  bulkImportFamilies: async (families: Array<Record<string, any>>, opts?: { confirmDuplicate?: boolean }) => {
    const response = await api.post<{ success: boolean; data: { imported: number } }>(
      '/families/bulk-import',
      { families },
      { params: opts?.confirmDuplicate ? { confirmDuplicate: true } : undefined }
    );
    return response.data.data;
  },
};

