import api, { asList } from './api';

export interface Cluster {
  id: string;
  name: string;
  nameMl?: string;
  code?: string;
  coordinatorMemberId?: { _id: string; name: string; phone?: string } | string;
  teamMemberIds?: Array<{ _id: string; name: string } | string>;
  notes?: string;
  status: 'active' | 'inactive';
  familyCount?: number;
}

export interface ClusterVisit {
  id: string;
  clusterId: { _id: string; name: string } | string;
  familyId?: { _id: string; houseName: string; familyHead?: string } | string;
  visitDate: string;
  visitedBy?: string;
  notes?: string;
  issuesFound?: string;
  followUpNeeded: boolean;
}

export const clusterService = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const response = await api.get<{ success: boolean; data: Cluster[]; pagination?: any }>('/clusters', {
      params,
    });
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Cluster }>(`/clusters/${id}`);
    return response.data.data;
  },

  getFamilies: async (id: string, params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get<{ success: boolean; data: any[]; pagination?: any }>(
      `/clusters/${id}/families`,
      { params }
    );
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  create: async (payload: Partial<Cluster>) => {
    const response = await api.post<{ success: boolean; data: Cluster }>('/clusters', payload);
    return response.data.data;
  },

  update: async (id: string, payload: Partial<Cluster>) => {
    const response = await api.put<{ success: boolean; data: Cluster }>(`/clusters/${id}`, payload);
    return response.data.data;
  },

  remove: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/clusters/${id}`);
    return response.data;
  },

  assignFamilies: async (id: string, familyIds: string[]) => {
    const response = await api.post<{ success: boolean; data: { assigned: number } }>(
      `/clusters/${id}/assign-families`,
      { familyIds }
    );
    return response.data.data;
  },

  unassignFamily: async (id: string, familyId: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/clusters/${id}/families/${familyId}`
    );
    return response.data;
  },
};

export const clusterVisitService = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    clusterId?: string;
    followUpNeeded?: boolean;
  }) => {
    const response = await api.get<{ success: boolean; data: ClusterVisit[]; pagination?: any }>(
      '/cluster-visits',
      { params }
    );
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  create: async (payload: Partial<ClusterVisit> & { clusterId: string }) => {
    const response = await api.post<{ success: boolean; data: ClusterVisit }>('/cluster-visits', payload);
    return response.data.data;
  },

  remove: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/cluster-visits/${id}`);
    return response.data;
  },
};
