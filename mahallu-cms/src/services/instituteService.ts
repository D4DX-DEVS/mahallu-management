import api, { asList } from './api';
import { Institute } from '@/types';

export interface InstituteListParams {
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const getAll = async (params?: InstituteListParams) => {
  const response = await api.get<{ success: boolean; data: Institute[]; pagination?: any }>('/institutes', {
    params,
  });
  // Handle both paginated and non-paginated responses
  if (response.data.pagination) {
    return { data: asList(response.data.data), pagination: response.data.pagination };
  }
  return { data: asList(response.data.data), pagination: null };
};

/** The largest page the list route will serve — see validations/common.ts `listQuery`. */
const MAX_PAGE_SIZE = 100;
/** A guard against an unbounded loop if the server ever reports a wrong page count. */
const MAX_EXPORT_PAGES = 100;

export const instituteService = {
  getAll,

  /**
   * Every institute matching `params`, gathered a page at a time.
   *
   * The export handlers used to ask for `limit: 10000` in one call. The API caps
   * `limit` at 100 and answers 400 above it, so every export failed with a
   * validation error instead of producing a file.
   */
  getAllForExport: async (params?: Omit<InstituteListParams, 'page' | 'limit'>) => {
    const all: Institute[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await getAll({ ...params, page, limit: MAX_PAGE_SIZE });
      all.push(...result.data);
      totalPages = result.pagination?.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages && page <= MAX_EXPORT_PAGES);

    return all;
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Institute }>(`/institutes/${id}`);
    return response.data.data;
  },

  create: async (instituteData: Partial<Institute>) => {
    const response = await api.post<{ success: boolean; data: Institute }>('/institutes', instituteData);
    return response.data.data;
  },

  update: async (id: string, instituteData: Partial<Institute>) => {
    const response = await api.put<{ success: boolean; data: Institute }>(`/institutes/${id}`, instituteData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/institutes/${id}`);
    return response.data;
  },
};
