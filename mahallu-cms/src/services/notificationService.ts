import api, { asList } from './api';

export interface Notification {
  id: string;
  tenantId?: string;
  title: string;
  message: string;
  recipientType?: 'user' | 'member' | 'all';
  recipientId?: string;
  isRead?: boolean;
  imageUrl?: string;
  createdAt: string;
}

export const notificationService = {
  getAll: async (params?: { recipientType?: string; isRead?: boolean; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Notification[]; pagination?: any }>(
      '/notifications',
      { params }
    );
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  create: async (data: Partial<Notification>) => {
    const response = await api.post<{ success: boolean; data: Notification }>('/notifications', data);
    return response.data.data;
  },

  markAsRead: async (id: string) => {
    const response = await api.put<{ success: boolean; data: Notification }>(`/notifications/${id}/read`);
    return response.data.data;
  },

  markAllAsRead: async () => {
    const response = await api.put<{ success: boolean; message: string }>('/notifications/read-all');
    return response.data;
  },

  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post<{ success: boolean; url: string }>(
      '/upload/notification-image',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data.url;
  },
};
