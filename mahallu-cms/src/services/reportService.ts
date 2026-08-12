import api from './api';

export interface AreaReport {
  totalFamilies: number;
  totalMembers: number;
  maleCount: number;
  femaleCount: number;
  families: Array<{
    id: string;
    houseName: string;
    area: string;
    memberCount: number;
  }>;
}

export interface BloodBankReport {
  total: number;
  bloodGroupStats: Record<string, number>;
  members: Array<{
    id: string;
    name: string;
    bloodGroup: string;
    phone?: string;
    age?: number;
    gender?: string;
  }>;
}

export interface OrphansReport {
  total: number;
  orphans: Array<{
    id: string;
    name: string;
    age?: number;
    gender?: string;
    family?: string;
  }>;
}

export const reportService = {
  getAreaReport: async (params?: { area?: string }) => {
    const response = await api.get<{ success: boolean; data: AreaReport }>('/reports/area', { params });
    return response.data.data;
  },

  getBloodBankReport: async (params?: { bloodGroup?: string }) => {
    const response = await api.get<{ success: boolean; data: BloodBankReport }>('/reports/blood-bank', { params });
    return response.data.data;
  },

  getOrphansReport: async () => {
    const response = await api.get<{ success: boolean; data: OrphansReport }>('/reports/orphans');
    return response.data.data;
  },

  getEducationReport: async () => {
    const response = await api.get<{ success: boolean; data: any }>('/reports/education');
    return response.data.data;
  },
};

export interface DemographicsBucket {
  label: string;
  count: number;
}

export interface DemographicsReport {
  ageGroups: DemographicsBucket[];
  gender: { male: number; female: number };
  education: DemographicsBucket[];
  employment: DemographicsBucket[];
  welfare: DemographicsBucket[];
}

export const demographicsReportService = {
  get: async () => {
    const response = await api.get<{ success: boolean; data: DemographicsReport }>(
      '/reports/demographics'
    );
    return response.data.data;
  },
};
