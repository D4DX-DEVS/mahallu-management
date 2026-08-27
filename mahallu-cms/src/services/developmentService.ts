import api from './api';

export interface DevelopmentProject {
  id: string;
  name: string;
  nameMl?: string;
  area: string;
  proposal?: string;
  estimatedCost: number;
  fundingSource?: string;
  responsibleTeam?: string;
  committeeId?: { _id: string; name: string } | string;
  startDate?: string;
  targetDate?: string;
  progressPercent: number;
  status: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'dropped';
  completionReport?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectExpenditure {
  total: number;
  items: any[];
  pagination: {
    page: number;
    limit: number;
    skip: number;
    total: number;
    totalPages: number;
  };
}

export const developmentService = {
  getProjects: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: DevelopmentProject[]; pagination?: any }>(
      '/development-projects',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getProject: async (id: string) => {
    const response = await api.get<{ success: boolean; data: DevelopmentProject }>(
      `/development-projects/${id}`
    );
    return response.data.data;
  },

  createProject: async (payload: Partial<DevelopmentProject>) => {
    const response = await api.post<{ success: boolean; data: DevelopmentProject }>(
      '/development-projects',
      payload
    );
    return response.data.data;
  },

  updateProject: async (id: string, payload: Partial<DevelopmentProject>) => {
    const response = await api.put<{ success: boolean; data: DevelopmentProject }>(
      `/development-projects/${id}`,
      payload
    );
    return response.data.data;
  },

  deleteProject: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/development-projects/${id}`
    );
    return response.data;
  },

  getExpenditure: async (projectId: string, params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: ProjectExpenditure }>(
      `/development-projects/${projectId}/expenditure`,
      { params }
    );
    return response.data.data;
  },
};
