import api, { asList, fetchAllPages } from './api';

export interface Banner {
  id: string;
  tenantId?: string;
  title: string;
  image: string;
  link?: string;
  status?: 'active' | 'inactive';
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface Feed {
  id: string;
  tenantId?: string;
  title: string;
  content: string;
  image?: string;
  authorId?: string;
  authorName?: string;
  isSuperFeed?: boolean;
  status?: 'draft' | 'published' | 'archived';
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  tenantId?: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  httpMethod?: string;
  endpoint?: string;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
  requestBody?: Record<string, any>;
  responseData?: Record<string, any>;
  errorMessage?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface Support {
  id: string;
  tenantId?: string;
  userId?: string | { id: string; name?: string };
  userName?: string;
  subject: string;
  message: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high';
  response?: string;
  createdAt: string;
}

export const socialService = {
  // Banners
  getAllBanners: async (params?: { status?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Banner[]; pagination?: any }>(
      '/social/banners',
      { params }
    );
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  createBanner: async (data: Partial<Banner>) => {
    const response = await api.post<{ success: boolean; data: Banner }>('/social/banners', data);
    return response.data.data;
  },

  getBannerById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Banner }>(`/social/banners/${id}`);
    return response.data.data;
  },

  updateBanner: async (id: string, data: Partial<Banner>) => {
    const response = await api.put<{ success: boolean; data: Banner }>(`/social/banners/${id}`, data);
    return response.data.data;
  },

  deleteBanner: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/social/banners/${id}`);
    return response.data;
  },

  uploadBannerImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await api.post<{ success: boolean; url: string }>('/upload/banner-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.url;
    } catch (error: any) {
      // Backward compatibility for API instances that only expose notification image upload.
      if (error?.response?.status === 404) {
        const fallbackResponse = await api.post<{ success: boolean; url: string }>(
          '/upload/notification-image',
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );
        return fallbackResponse.data.url;
      }
      throw error;
    }
  },

  // Feeds
  getAllFeeds: async (params?: { status?: string; isSuperFeed?: boolean; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Feed[]; pagination?: any }>('/social/feeds', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  createFeed: async (data: Partial<Feed>) => {
    const response = await api.post<{ success: boolean; data: Feed }>('/social/feeds', data);
    return response.data.data;
  },

  // Activity Logs
  getActivityLogs: async (params?: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<{ success: boolean; data: ActivityLog[]; pagination?: any }>(
      '/social/activity-logs',
      { params }
    );
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  // Support
  getAllSupport: async (params?: { status?: string; priority?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Support[]; pagination?: any }>(
      '/social/support',
      { params }
    );
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: asList(response.data.data), pagination: response.data.pagination };
    }
    return { data: asList(response.data.data), pagination: null };
  },

  createSupport: async (data: Partial<Support>) => {
    const response = await api.post<{ success: boolean; data: Support }>('/social/support', data);
    return response.data.data;
  },

  // No dedicated GET /social/support/:id endpoint exists on the backend,
  // so fetch every page and find the matching ticket. `limit` is capped at
  // 100 server-side — a bare `limit: 1000` used to 400 on every open.
  getSupportById: async (id: string) => {
    const all = await fetchAllPages<Support>(({ page, limit }) =>
      api
        .get<{ success: boolean; data: Support[]; pagination?: any }>('/social/support', {
          params: { page, limit },
        })
        .then((res) => ({ data: asList(res.data.data), pagination: res.data.pagination }))
    );
    const ticket = all.find((s) => s.id === id);
    if (!ticket) {
      throw new Error('Support ticket not found');
    }
    return ticket;
  },

  updateSupport: async (id: string, data: Partial<Support>) => {
    const response = await api.put<{ success: boolean; data: Support }>(`/social/support/${id}`, data);
    return response.data.data;
  },
};
