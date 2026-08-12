import api from './api';

export interface SurveyStats {
  totalHouseholds: number;
  totalPopulation: number;
  men: number;
  women: number;
  children: number;
  youth: number;
  seniorCitizens: number;
  students: number;
  married: number;
  unmarried: number;
  employed: number;
  unemployed: number;
  widows: number;
  orphans: number;
  disabled: number;
  familiesNeedingAssistance: number;
}

export interface SurveySnapshot {
  _id: string;
  surveyDate: string;
  type: 'comprehensive' | 'annual';
  nextReviewDate: string;
  stats: SurveyStats;
  notes?: string;
  createdAt: string;
}

export interface LocalityFacility {
  _id: string;
  name: string;
  nameMl?: string;
  type: string;
  address?: string;
  contactNo?: string;
  notes?: string;
  status: 'active' | 'inactive';
}

export const surveyService = {
  getAll: async (params?: { page?: number; limit?: number; type?: string }) => {
    const response = await api.get<{ success: boolean; data: SurveySnapshot[]; pagination?: any }>(
      '/surveys',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getById: async (id: string) => {
    const response = await api.get<{
      success: boolean;
      data: { snapshot: SurveySnapshot; previous: SurveySnapshot | null };
    }>(`/surveys/${id}`);
    return response.data.data;
  },

  getStatus: async () => {
    const response = await api.get<{
      success: boolean;
      data: { latest: SurveySnapshot | null; isOverdue: boolean; liveStats?: SurveyStats };
    }>('/surveys/status');
    return response.data.data;
  },

  generate: async (payload: { type: 'comprehensive' | 'annual'; notes?: string }) => {
    const response = await api.post<{ success: boolean; data: SurveySnapshot }>('/surveys/generate', payload);
    return response.data.data;
  },

  remove: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/surveys/${id}`);
    return response.data;
  },
};

export const facilityService = {
  getAll: async (params?: { page?: number; limit?: number; search?: string; type?: string }) => {
    const response = await api.get<{ success: boolean; data: LocalityFacility[]; pagination?: any }>(
      '/locality-facilities',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  create: async (payload: Partial<LocalityFacility>) => {
    const response = await api.post<{ success: boolean; data: LocalityFacility }>(
      '/locality-facilities',
      payload
    );
    return response.data.data;
  },

  update: async (id: string, payload: Partial<LocalityFacility>) => {
    const response = await api.put<{ success: boolean; data: LocalityFacility }>(
      `/locality-facilities/${id}`,
      payload
    );
    return response.data.data;
  },

  remove: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/locality-facilities/${id}`);
    return response.data;
  },
};
