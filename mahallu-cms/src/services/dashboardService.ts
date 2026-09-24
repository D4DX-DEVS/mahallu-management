import api, { asList } from './api';

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  families: {
    total: number;
    approved: number;
    pending: number;
    unapproved: number;
  };
  members: {
    total: number;
    male: number;
    female: number;
  };
}

export interface RecentFamily {
  id: string;
  familyName: string;
  mahallId: string;
  createdAt: string;
  status: string;
}

export interface ActivityTimelineData {
  name: string;
  date: string;
  value: number;
}

export interface FinancialSummary {
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  incomeGrowthPercent: number | null;
  transactionCount: number;
  totalBankBalance: number;
  bankAccountCount: number;
}

export const dashboardService = {
  getStats: async () => {
    const response = await api.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats');
    return response.data.data;
  },

  getRecentFamilies: async (limit: number = 5) => {
    const response = await api.get<{ success: boolean; data: RecentFamily[] }>('/dashboard/recent-families', {
      params: { limit },
    });
    return asList(response.data.data);
  },

  getActivityTimeline: async (days: number = 7) => {
    const response = await api.get<{ success: boolean; data: ActivityTimelineData[] }>(
      '/dashboard/activity-timeline',
      {
        params: { days },
      }
    );
    return asList(response.data.data);
  },

  getFinancialSummary: async () => {
    const response = await api.get<{ success: boolean; data: FinancialSummary }>(
      '/dashboard/financial-summary'
    );
    return response.data.data;
  },
};
