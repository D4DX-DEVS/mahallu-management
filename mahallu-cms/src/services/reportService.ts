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

  getWelfareReport: async () => {
    const response = await api.get<{ success: boolean; data: any }>('/reports/welfare');
    return response.data.data;
  },

  getCommunityReport: async () => {
    const response = await api.get<{ success: boolean; data: any }>('/reports/community');
    return response.data.data;
  },

  getAnnualReport: async (year?: number) => {
    const response = await api.get<{ success: boolean; data: AnnualReport }>('/reports/annual', {
      params: year ? { year } : undefined,
    });
    return response.data.data;
  },

  getDevelopmentIndex: async () => {
    const response = await api.get<{ success: boolean; data: DevelopmentIndex }>('/development-index');
    return response.data.data;
  },
};

export interface IndexDimension {
  key: string;
  label: string;
  score: number;
  indicators: Record<string, number>;
}

export interface DevelopmentIndex {
  dimensions: IndexDimension[];
  totalScore: number;
  weakest: string[];
  generatedAt: string;
}

export interface AnnualReport {
  year: number;
  demographics: {
    totalFamilies: number;
    totalMembers: number;
    latestSurvey: { surveyDate: string; type: string; stats: Record<string, number> } | null;
  };
  finance: { income: number; expense: number; balance: number };
  welfare: { applications: number; disbursedAmount: number };
  zakat: { collected: number; distributed: number; balance: number };
  education: { activeClasses: number; activeStudents: number; exams: number };
  employment: {
    vacanciesPosted: number;
    trainings: number;
    trainedParticipants: number;
    employedOutcomes: number;
  };
  programs: { total: number };
  projects: { total: number; completed: number; inProgress: number; totalEstimatedCost: number };
}

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
