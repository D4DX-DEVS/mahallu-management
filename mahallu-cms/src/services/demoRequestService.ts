import api, { asList } from './api';
import { Pagination } from '@/types';

/** A "Request a demo" submission from the public landing page. */
export interface DemoRequest {
  _id: string;
  mahalluName: string;
  contactNumber: string;
  whatsappNumber: string;
  createdAt: string;
}

export interface DemoRequestInput {
  mahalluName: string;
  contactNumber: string;
  whatsappNumber: string;
}

export const demoRequestService = {
  /** Public: sent from the landing page, no session needed. */
  submit: async (data: DemoRequestInput) => {
    const response = await api.post<{ success: boolean; message: string }>('/demo-requests', data);
    return response.data;
  },

  /** Super admin inbox, newest first. */
  getAll: async (params?: { search?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: DemoRequest[]; pagination: Pagination }>(
      '/demo-requests',
      { params }
    );
    return { data: asList(response.data.data), pagination: response.data.pagination ?? null };
  },
};
