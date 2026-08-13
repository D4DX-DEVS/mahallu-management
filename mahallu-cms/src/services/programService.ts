import api from './api';
import { Institute } from '@/types';

export const programService = {
  getAll: async (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Institute[]; pagination?: any }>('/programs', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Institute }>(`/programs/${id}`);
    return response.data.data;
  },

  create: async (programData: Partial<Institute>) => {
    const response = await api.post<{ success: boolean; data: Institute }>('/programs', programData);
    return response.data.data;
  },

  update: async (id: string, programData: Partial<Institute>) => {
    const response = await api.put<{ success: boolean; data: Institute }>(`/programs/${id}`, programData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/programs/${id}`);
    return response.data;
  },

  // Event registrations (Task C3)
  getRegistrations: async (id: string, params?: { page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: ProgramRegistration[]; pagination?: any }>(
      `/programs/${id}/registrations`,
      { params }
    );
    return { data: response.data.data, pagination: response.data.pagination ?? null };
  },

  register: async (id: string, memberId: string) => {
    const response = await api.post<{ success: boolean; data: ProgramRegistration[] }>(
      `/programs/${id}/registrations`,
      { memberId }
    );
    return response.data.data;
  },

  setAttendance: async (id: string, memberId: string, attended: boolean) => {
    const response = await api.put<{ success: boolean; data: ProgramRegistration }>(
      `/programs/${id}/registrations/${memberId}`,
      { attended }
    );
    return response.data.data;
  },

  removeRegistration: async (id: string, memberId: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/programs/${id}/registrations/${memberId}`
    );
    return response.data;
  },
};

export interface RegisteredMember {
  _id: string;
  name?: string;
  nameMl?: string;
  phone?: string;
  age?: number;
  gender?: string;
}

export interface ProgramRegistration {
  memberId: RegisteredMember | string;
  attended: boolean;
}

