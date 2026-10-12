import api from './api';

export interface Announcement {
  id: string;
  title: string;
  titleMl?: string;
  body: string;
  category: string;
  audience: 'all' | 'families' | 'committee' | 'cluster' | 'custom';
  audienceRefIds?: string[];
  channels: string[];
  deliveryResults?: Record<string, string>;
  deliverySummary?: Record<string, { total: number; sent: number; failed: number; skipped: number; queued: number; note?: string }>;
  deliveryMessage?: string;
  sentAt?: string;
  status: 'draft' | 'sent';
  createdAt: string;
}

export const ANNOUNCEMENT_CATEGORY_OPTIONS = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'program', label: 'Program' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'welfare', label: 'Welfare' },
  { value: 'education', label: 'Education' },
  { value: 'news', label: 'News' },
];

export const ANNOUNCEMENT_AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Everyone' },
  { value: 'families', label: 'All Families' },
  { value: 'committee', label: 'Committee' },
  { value: 'cluster', label: 'Cluster' },
  { value: 'custom', label: 'Custom' },
];

export const ANNOUNCEMENT_CHANNELS = [
  { value: 'push', label: 'Push', supported: true },
  { value: 'whatsapp', label: 'WhatsApp', supported: true },
  { value: 'sms', label: 'SMS', supported: false },
  { value: 'email', label: 'Email', supported: false },
];

export interface ChannelAvailability {
  channel: 'push' | 'whatsapp' | 'sms' | 'email';
  label: string;
  available: boolean;
  reason?: string;
  reach: string;
}

export interface DeliveryRow {
  id: string;
  channel: string;
  recipient: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  error?: string;
}

export const announcementService = {
  getChannels: async () => {
    const response = await api.get<{ success: boolean; data: ChannelAvailability[]; testMode: boolean }>('/announcements/channels');
    return { channels: response.data.data, testMode: response.data.testMode };
  },

  getDeliveries: async (id: string, params?: { channel?: string; status?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: DeliveryRow[]; pagination: any; summary: Announcement['deliverySummary']; message: string }>(
      `/announcements/${id}/deliveries`,
      { params }
    );
    return { rows: response.data.data, pagination: response.data.pagination, summary: response.data.summary || {}, message: response.data.message };
  },

  getAll: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const response = await api.get<{ success: boolean; data: Announcement[]; pagination?: any }>(
      '/announcements',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Announcement }>(`/announcements/${id}`);
    return response.data.data;
  },

  create: async (payload: Partial<Announcement>) => {
    const response = await api.post<{ success: boolean; data: Announcement }>('/announcements', payload);
    return response.data.data;
  },

  update: async (id: string, payload: Partial<Announcement>) => {
    const response = await api.put<{ success: boolean; data: Announcement }>(
      `/announcements/${id}`,
      payload
    );
    return response.data.data;
  },

  send: async (id: string) => {
    const response = await api.post<{ success: boolean; data: Announcement }>(`/announcements/${id}/send`);
    return response.data.data;
  },

  remove: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/announcements/${id}`);
    return response.data;
  },
};
