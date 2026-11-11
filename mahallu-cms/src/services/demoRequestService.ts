import api, { asList } from './api';
import { Pagination } from '@/types';

export type DemoRequestStatus = 'pending' | 'accepted' | 'rejected';

/** What the landing page's "Request ZAAD" form sends. */
export interface DemoRequestInput {
  mahalluName: string;
  affiliationNumber?: string;
  /** Place (സ്ഥലം). */
  location: string;
  /** Jamaat-e-Islami local unit. */
  localUnit: string;
  area: string;
  district: string;
  /** President or secretary; `contactNumber` and `whatsappNumber` are theirs. */
  officeBearerName: string;
  contactNumber: string;
  whatsappNumber: string;
  /** Optional person to contact for follow-up. */
  contactPersonName?: string;
  contactPersonPhone?: string;
  contactPersonWhatsapp?: string;
}

/** The form's Malayalam labels, shared by the landing form and the admin detail view. */
export const ZAAD_REQUEST_LABELS: Record<keyof DemoRequestInput, string> = {
  mahalluName: 'മസ്ജിദ്/മഹല്ലിന്റെ പേര്',
  affiliationNumber: 'മസ്ജിദ് കൌൺസിൽ അഫിലിയേഷൻ നമ്പർ',
  location: 'സ്ഥലം',
  localUnit: 'ജമാഅത്തെ ഇസ്ലാമി പ്രാദേശിക ഘടകം',
  area: 'ഏരിയ',
  district: 'ജില്ല',
  officeBearerName: 'മസ്ജിദ്/മഹല്ലിന്റെ പ്രസിഡന്റ് /സെക്രട്ടറിയുടെ പേര്',
  contactNumber: 'ഫോൺ',
  whatsappNumber: 'വാട്സാപ്പ് നമ്പർ',
  contactPersonName: 'തുടർ നടപടിക്കായി ബന്ധപ്പെടേണ്ട വ്യക്തിയുടെ പേര്',
  contactPersonPhone: 'ഫോൺ നമ്പർ',
  contactPersonWhatsapp: 'വാട്സാപ്പ് നമ്പർ',
};

/**
 * A "Request ZAAD" submission from the public landing page. Requests saved before the current
 * form may lack the newer fields.
 */
export interface DemoRequest extends Partial<DemoRequestInput> {
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
