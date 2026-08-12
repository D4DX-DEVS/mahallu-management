import api from './api';

export type ScholarshipStatus = 'active' | 'closed';
export type AwardStatus = 'applied' | 'approved' | 'paid';
export type SupportCaseType =
  | 'career_guidance'
  | 'competitive_exam'
  | 'dropout_risk'
  | 'tuition'
  | 'remedial'
  | 'academic_award';
export type SupportCaseStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Scholarship {
  _id: string;
  name: string;
  nameMl?: string;
  amount: number;
  academicYear: string;
  criteria?: string;
  status: ScholarshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ScholarshipAward {
  _id: string;
  scholarshipId: { _id: string; name: string; amount: number; academicYear: string } | string;
  memberId: { _id: string; name: string; nameMl?: string; contactNo?: string } | string;
  awardedDate: string;
  amount: number;
  status: AwardStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicSupportCase {
  _id: string;
  memberId: { _id: string; name: string; nameMl?: string; contactNo?: string } | string;
  type: SupportCaseType;
  description: string;
  mentorName?: string;
  startDate: string;
  status: SupportCaseStatus;
  outcome?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const SCHOLARSHIP_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
];

export const AWARD_STATUS_OPTIONS = [
  { value: 'applied', label: 'Applied' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
];

export const SUPPORT_CASE_TYPE_OPTIONS = [
  { value: 'career_guidance', label: 'Career Guidance' },
  { value: 'competitive_exam', label: 'Competitive Exam Support' },
  { value: 'dropout_risk', label: 'Dropout Risk' },
  { value: 'tuition', label: 'Tuition Support' },
  { value: 'remedial', label: 'Remedial Classes' },
  { value: 'academic_award', label: 'Academic Award' },
];

export const SUPPORT_CASE_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const scholarshipStatusLabel = (value: string): string =>
  SCHOLARSHIP_STATUS_OPTIONS.find((option) => option.value === value)?.label || value;

export const awardStatusLabel = (value: string): string =>
  AWARD_STATUS_OPTIONS.find((option) => option.value === value)?.label || value;

export const supportCaseTypeLabel = (value: string): string =>
  SUPPORT_CASE_TYPE_OPTIONS.find((option) => option.value === value)?.label || value;

export const supportCaseStatusLabel = (value: string): string =>
  SUPPORT_CASE_STATUS_OPTIONS.find((option) => option.value === value)?.label || value;

export const memberName = (member: any): string => {
  if (!member) return '-';
  if (typeof member === 'object') {
    return member.name || '-';
  }
  return '-';
};

export const scholarshipService = {
  // Scholarships
  getScholarships: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: Scholarship[]; pagination?: any }>(
      '/scholarships',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getScholarship: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Scholarship }>(
      `/scholarships/${id}`
    );
    return response.data.data;
  },

  createScholarship: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: Scholarship }>(
      '/scholarships',
      payload
    );
    return response.data.data;
  },

  updateScholarship: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: Scholarship }>(
      `/scholarships/${id}`,
      payload
    );
    return response.data.data;
  },

  deleteScholarship: async (id: string) => {
    const response = await api.delete<{ success: boolean }>(
      `/scholarships/${id}`
    );
    return response.data.success;
  },

  // Scholarship Awards
  getAwards: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: ScholarshipAward[]; pagination?: any }>(
      '/scholarship-awards',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getAwardsByScholarship: async (scholarshipId: string, params?: Record<string, any>) => {
    const response = await api.get<{
      success: boolean;
      data: ScholarshipAward[];
      pagination?: any;
    }>(`/scholarships/${scholarshipId}/awards`, { params });
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  createAward: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: ScholarshipAward }>(
      '/scholarship-awards',
      payload
    );
    return response.data.data;
  },

  updateAward: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: ScholarshipAward }>(
      `/scholarship-awards/${id}`,
      payload
    );
    return response.data.data;
  },

  deleteAward: async (id: string) => {
    const response = await api.delete<{ success: boolean }>(
      `/scholarship-awards/${id}`
    );
    return response.data.success;
  },

  // Academic Support Cases
  getSupportCases: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: AcademicSupportCase[]; pagination?: any }>(
      '/academic-support',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getSupportCase: async (id: string) => {
    const response = await api.get<{ success: boolean; data: AcademicSupportCase }>(
      `/academic-support/${id}`
    );
    return response.data.data;
  },

  createSupportCase: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: AcademicSupportCase }>(
      '/academic-support',
      payload
    );
    return response.data.data;
  },

  updateSupportCase: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: AcademicSupportCase }>(
      `/academic-support/${id}`,
      payload
    );
    return response.data.data;
  },

  deleteSupportCase: async (id: string) => {
    const response = await api.delete<{ success: boolean }>(
      `/academic-support/${id}`
    );
    return response.data.success;
  },
};
