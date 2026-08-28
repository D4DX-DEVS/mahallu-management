import api from './api';

export type VolunteerWing = 'youth' | 'women' | 'general';
export type ServiceType =
  | 'janazah'
  | 'grave_digging'
  | 'patient_transport'
  | 'palliative'
  | 'emergency'
  | 'first_aid'
  | 'disaster'
  | 'environment'
  | 'govt_scheme_support'
  | 'medical'
  | 'other';
export type VolunteerAvailability = 'anytime' | 'weekends' | 'emergency_only';

export interface VolunteerProfile {
  id: string;
  memberId: { id: string; name: string; contactNo?: string } | string;
  wings: VolunteerWing[];
  serviceTypes: ServiceType[];
  availability: VolunteerAvailability;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface VolunteerAssignment {
  id: string;
  volunteerIds: Array<{ id: string; name: string; contactNo?: string } | string>;
  serviceType: ServiceType;
  date: string;
  description: string;
  status: 'assigned' | 'completed' | 'cancelled';
  completionNotes?: string;
  createdAt: string;
}

export interface VolunteerSummary {
  totalActiveVolunteers: number;
  byWing: Record<string, number>;
  byServiceType: Record<string, number>;
  assignmentsByStatus: Record<string, number>;
}

export const VOLUNTEER_WINGS: Array<{ value: VolunteerWing; label: string }> = [
  { value: 'youth', label: 'Youth' },
  { value: 'women', label: 'Women' },
  { value: 'general', label: 'General' },
];

export const SERVICE_TYPE_OPTIONS: Array<{ value: ServiceType; label: string }> = [
  { value: 'janazah', label: 'Janazah' },
  { value: 'grave_digging', label: 'Grave Digging' },
  { value: 'patient_transport', label: 'Patient Transport' },
  { value: 'palliative', label: 'Palliative Care' },
  { value: 'emergency', label: 'Emergency Response' },
  { value: 'first_aid', label: 'First Aid' },
  { value: 'disaster', label: 'Disaster Relief' },
  { value: 'environment', label: 'Environmental Care' },
  { value: 'govt_scheme_support', label: 'Government Scheme Support' },
  { value: 'medical', label: 'Medical Support' },
  { value: 'other', label: 'Other' },
];

export const AVAILABILITY_OPTIONS: Array<{ value: VolunteerAvailability; label: string }> = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'emergency_only', label: 'Emergency Only' },
];

export const ASSIGNMENT_STATUS_OPTIONS = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const wingLabel = (value: string): string =>
  VOLUNTEER_WINGS.find((option) => option.value === value)?.label || value;

export const serviceTypeLabel = (value: string): string =>
  SERVICE_TYPE_OPTIONS.find((option) => option.value === value)?.label || value;

export const availabilityLabel = (value: string): string =>
  AVAILABILITY_OPTIONS.find((option) => option.value === value)?.label || value;

export const volunteerName = (volunteer: VolunteerProfile): string => {
  if (volunteer.memberId && typeof volunteer.memberId === 'object') {
    return volunteer.memberId.name;
  }
  return '-';
};

export const volunteerService = {
  getVolunteers: async (params?: Record<string, any>) => {
    const response = await api.get<{
      success: boolean;
      data: VolunteerProfile[];
      pagination?: any;
    }>('/volunteers', { params });
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getVolunteer: async (id: string) => {
    const response = await api.get<{ success: boolean; data: VolunteerProfile }>(
      `/volunteers/${id}`
    );
    return response.data.data;
  },

  createVolunteer: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: VolunteerProfile }>(
      '/volunteers',
      payload
    );
    return response.data.data;
  },

  updateVolunteer: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: VolunteerProfile }>(
      `/volunteers/${id}`,
      payload
    );
    return response.data.data;
  },

  deleteVolunteer: async (id: string) => {
    await api.delete(`/volunteers/${id}`);
  },

  getVolunteerAssignments: async (id: string, params?: Record<string, any>) => {
    const response = await api.get<{
      success: boolean;
      data: VolunteerAssignment[];
      pagination?: any;
    }>(`/volunteers/${id}/assignments`, { params });
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getAssignments: async (params?: Record<string, any>) => {
    const response = await api.get<{
      success: boolean;
      data: VolunteerAssignment[];
      pagination?: any;
    }>('/volunteer-assignments', { params });
    return { data: response.data.data, pagination: response.data.pagination || null };
  },

  getAssignment: async (id: string) => {
    const response = await api.get<{ success: boolean; data: VolunteerAssignment }>(
      `/volunteer-assignments/${id}`
    );
    return response.data.data;
  },

  createAssignment: async (payload: Record<string, any>) => {
    const response = await api.post<{ success: boolean; data: VolunteerAssignment }>(
      '/volunteer-assignments',
      payload
    );
    return response.data.data;
  },

  updateAssignment: async (id: string, payload: Record<string, any>) => {
    const response = await api.put<{ success: boolean; data: VolunteerAssignment }>(
      `/volunteer-assignments/${id}`,
      payload
    );
    return response.data.data;
  },

  deleteAssignment: async (id: string) => {
    await api.delete(`/volunteer-assignments/${id}`);
  },

  getSummary: async () => {
    const response = await api.get<{ success: boolean; data: VolunteerSummary }>(
      '/volunteers/summary'
    );
    return response.data.data;
  },
};
