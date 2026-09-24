import api, { asList } from './api';

export interface RegisterSummaryRow {
  key: string;
  label: string;
  source: 'member' | 'family';
  count: number;
}

export interface RegisterQuery {
  page?: number;
  limit?: number;
  search?: string;
  gender?: string;
  minAge?: number;
  welfareStatus?: string;
  economicStatus?: string;
}

export const registerService = {
  getRegister: async (key: string, params?: RegisterQuery) => {
    const response = await api.get<{ success: boolean; data: any[]; pagination?: any }>(`/registers/${key}`, {
      params,
    });
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  getSummary: async () => {
    const response = await api.get<{ success: boolean; data: RegisterSummaryRow[] }>('/registers/summary');
    return asList(response.data.data);
  },
};
