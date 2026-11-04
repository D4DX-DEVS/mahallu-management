import api, { asList } from './api';
import { Pagination } from '@/types';
import type { TenantType } from '@/constants/tenantTypes';

export type DemoRequestStatus = 'pending' | 'accepted' | 'rejected';

/** The tenant details a request carries, as the tenant form asks for them. */
export interface DemoRequestDetails {
  type?: TenantType;
  location?: string;
  address?: {
    state?: string;
    district?: string;
    pinCode?: string;
    postOffice?: string;
    village?: string;
  };
}

/** A "Request a demo" submission from the public landing page. */
export interface DemoRequest extends DemoRequestDetails {
  /** The API layer renames Mongo `_id` to `id` on every response. */
  id: string;
  mahalluName: string;
  contactNumber: string;
  whatsappNumber: string;
  /** Requests saved before review existed have no status; they are pending. */
  status?: DemoRequestStatus;
  reviewedAt?: string;
  rejectionReason?: string;
  rejectionNotification?: { channel: 'whatsapp'; status: 'sent' | 'failed'; attemptedAt: string };
  /** The Mahall created from this request, once there is one. */
  tenantId?: string;
  createdAt: string;
}

export interface DemoRequestInput extends DemoRequestDetails {
  mahalluName: string;
  contactNumber: string;
  whatsappNumber: string;
}

export const requestStatus = (request: Pick<DemoRequest, 'status'>): DemoRequestStatus => request.status ?? 'pending';

export const demoRequestService = {
  /** Public: sent from the landing page, no session needed. */
  submit: async (data: DemoRequestInput) => {
    const response = await api.post<{ success: boolean; message: string }>('/demo-requests', data);
    return response.data;
  },

  /** Super admin inbox, newest first. */
  getAll: async (params?: { search?: string; status?: DemoRequestStatus; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: DemoRequest[]; pagination: Pagination }>(
      '/demo-requests',
      { params }
    );
    return { data: asList(response.data.data), pagination: response.data.pagination ?? null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: DemoRequest }>(`/demo-requests/${id}`);
    return response.data.data;
  },

  /** Records the decision only; the Mahall is created later, from the tenant form. */
  accept: async (id: string) => {
    const response = await api.post<{ success: boolean; message: string; data: DemoRequest }>(
      `/demo-requests/${id}/accept`
    );
    return response.data;
  },

  /** `notification` says whether the requester was actually messaged. */
  reject: async (id: string, reason: string) => {
    const response = await api.post<{
      success: boolean;
      message: string;
      notification: 'sent' | 'failed';
      data: DemoRequest;
    }>(`/demo-requests/${id}/reject`, { reason });
    return response.data;
  },
};
