import api from './api';

export type EmploymentOutcome = 'none' | 'employed' | 'self_employed';

export interface Employer {
  _id: string;
  name: string;
  businessType?: string;
  contactPerson?: string;
  contactNo?: string;
  location?: string;
  memberId?: { _id: string; name: string } | string;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface JobVacancy {
  _id: string;
  employerId?: { _id: string; name: string } | string;
  employerName?: string;
  title: string;
  location?: string;
  skillsRequired: string[];
  salaryRange?: string;
  status: 'open' | 'filled' | 'closed';
  postedDate: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingParticipant {
  memberId: { _id: string; name: string; phone?: string } | string;
  certificateIssued?: boolean;
  employmentOutcome?: EmploymentOutcome;
}

export interface SkillTraining {
  _id: string;
  name: string;
  trainerName?: string;
  startDate: string;
  endDate: string;
  participants: TrainingParticipant[];
  participantCount?: number;
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface EmploymentSummary {
  employersCount: number;
  openVacancies: number;
  trainingsCount: number;
  registeredJobSeekers: number;
  skilledWorkers: number;
}

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export const VACANCY_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'filled', label: 'Filled' },
  { value: 'closed', label: 'Closed' },
];

export const TRAINING_STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const EMPLOYMENT_OUTCOME_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self Employed' },
];

export const employmentService = {
  // Employer endpoints
  getEmployers: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: Employer[]; pagination?: any }>(
      '/employers',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getEmployer: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Employer }>(`/employers/${id}`);
    return response.data.data;
  },

  createEmployer: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: Employer }>('/employers', payload);
    return response.data.data;
  },

  updateEmployer: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: Employer }>(`/employers/${id}`, payload);
    return response.data.data;
  },

  deleteEmployer: async (id: string) => {
    await api.delete(`/employers/${id}`);
  },

  // Job Vacancy endpoints
  getVacancies: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: JobVacancy[]; pagination?: any }>(
      '/job-vacancies',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getVacancy: async (id: string) => {
    const response = await api.get<{ success: boolean; data: JobVacancy }>(`/job-vacancies/${id}`);
    return response.data.data;
  },

  createVacancy: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: JobVacancy }>('/job-vacancies', payload);
    return response.data.data;
  },

  updateVacancy: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: JobVacancy }>(
      `/job-vacancies/${id}`,
      payload
    );
    return response.data.data;
  },

  deleteVacancy: async (id: string) => {
    await api.delete(`/job-vacancies/${id}`);
  },

  // Skill Training endpoints
  getTrainings: async (params?: Record<string, any>) => {
    const response = await api.get<{ success: boolean; data: SkillTraining[]; pagination?: any }>(
      '/skill-trainings',
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getTraining: async (id: string) => {
    const response = await api.get<{ success: boolean; data: SkillTraining }>(`/skill-trainings/${id}`);
    return response.data.data;
  },

  createTraining: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: SkillTraining }>(
      '/skill-trainings',
      payload
    );
    return response.data.data;
  },

  updateTraining: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: SkillTraining }>(
      `/skill-trainings/${id}`,
      payload
    );
    return response.data.data;
  },

  deleteTraining: async (id: string) => {
    await api.delete(`/skill-trainings/${id}`);
  },

  // Participant endpoints
  addParticipant: async (trainingId: string, memberId: string) => {
    const response = await api.post<{ success: boolean; data: SkillTraining }>(
      `/skill-trainings/${trainingId}/participants`,
      { memberId }
    );
    return response.data.data;
  },

  updateParticipant: async (
    trainingId: string,
    memberId: string,
    payload: Record<string, any>
  ) => {
    const response = await api.put<{ success: boolean; data: SkillTraining }>(
      `/skill-trainings/${trainingId}/participants/${memberId}`,
      payload
    );
    return response.data.data;
  },

  removeParticipant: async (trainingId: string, memberId: string) => {
    const response = await api.delete<{ success: boolean; data: SkillTraining }>(
      `/skill-trainings/${trainingId}/participants/${memberId}`
    );
    return response.data.data;
  },

  // Summary endpoint
  getSummary: async () => {
    const response = await api.get<{ success: boolean; data: EmploymentSummary }>(
      '/employment/summary'
    );
    return response.data.data;
  },
};
