import api from './api';

export interface MosqueProfile {
  _id?: string;
  name?: string;
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
  get: async () => {
    const response = await api.get<{ success: boolean; data: MosqueProfile | null }>('/mosque-profile');
    return response.data.data;
  },

  save: async (payload: Partial<MosqueProfile>) => {
    const response = await api.put<{ success: boolean; data: MosqueProfile }>('/mosque-profile', payload);
    return response.data.data;
  },
};
