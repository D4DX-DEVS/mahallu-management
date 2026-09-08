import api, { asList } from './api';

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

export const announcementService = {
  getAll: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const response = await api.get<{ success: boolean; data: Announcement[]; pagination?: any }>(
      '/announcements',
      { params }
    );
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
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
    const response = await api.put<{ success: boolean; data: Announcement }>(`/announcements/${id}`, payload);
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
