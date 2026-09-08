import api, { asList } from './api';

export interface MosqueProfile {
  id: string;
  name: string;
  nameMl?: string;
  capacity?: number;
  facilities: string[];
  prayerFacilityNotes?: string;
  imamName?: string;
  imamMemberId?: string;
  muazzinName?: string;
  khateebName?: string;
  staffNotes?: string;
}

export const MOSQUE_FACILITY_OPTIONS = [
  { value: 'parking', label: 'Parking' },
  { value: 'wudu_area', label: 'Wudu Area' },
  { value: 'women_prayer_area', label: 'Women Prayer Area' },
  { value: 'ac', label: 'Air Conditioning' },
  { value: 'library', label: 'Library' },
  { value: 'madrasa_hall', label: 'Madrasa Hall' },
  { value: 'janazah_facility', label: 'Janazah Facility' },
  { value: 'other', label: 'Other' },
];

export const mosqueService = {
  getAll: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await api.get<{ success: boolean; data: MosqueProfile[]; pagination?: any }>(
      '/mosques',
      {
        params,
      }
    );
    return { data: asList(response.data.data), pagination: response.data.pagination || null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: MosqueProfile }>(`/mosques/${id}`);
    return response.data.data;
  },

  create: async (payload: Partial<MosqueProfile>) => {
    const response = await api.post<{ success: boolean; data: MosqueProfile }>('/mosques', payload);
    return response.data.data;
  },

  update: async (id: string, payload: Partial<MosqueProfile>) => {
    const response = await api.put<{ success: boolean; data: MosqueProfile }>(`/mosques/${id}`, payload);
    return response.data.data;
  },

  remove: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/mosques/${id}`);
    return response.data;
  },
};
