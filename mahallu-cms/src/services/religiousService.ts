import api, { asList } from './api';

export interface Khateeb {
  id: string;
  name: string;
  nameMl?: string;
  memberId?: { id: string; name: string; contactNo?: string } | string;
  qualifications?: string;
  contactNo?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Khutbah {
  id: string;
  khateebId: { id: string; name: string; qualifications?: string } | string;
  date: string;
  topic: string;
  topicMl?: string;
  notes?: string;
  resourceUrl?: string;
  status: 'scheduled' | 'delivered' | 'cancelled';
  createdAt: string;
}

export const KHATEEB_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export const KHUTBAH_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const PROGRAM_AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'youth', label: 'Youth' },
  { value: 'children', label: 'Children' },
  { value: 'families', label: 'Families' },
];

export const PROGRAM_TYPE_OPTIONS = [
  { value: 'quran_class', label: 'Quran Class' },
  { value: 'hadith', label: 'Hadith' },
  { value: 'fiqh', label: 'Fiqh' },
  { value: 'lecture', label: 'Lecture' },
  { value: 'family', label: 'Family Program' },
  { value: 'other', label: 'Other' },
];

export const religiousService = {
  // Khateebs
  getAllKhateebs: async (params?: any) => {
    const response = await api.get('/khateebs', { params });
    return { ...response.data, data: asList(response.data?.data) };
  },

  getKhateebById: async (id: string) => {
    const response = await api.get(`/khateebs/${id}`);
    return response.data.data;
  },

  createKhateeb: async (data: any) => {
    const response = await api.post('/khateebs', data);
    return response.data.data;
  },

  updateKhateeb: async (id: string, data: any) => {
    const response = await api.put(`/khateebs/${id}`, data);
    return response.data.data;
  },

  deleteKhateeb: async (id: string) => {
    const response = await api.delete(`/khateebs/${id}`);
    return response.data;
  },

  // Khutbahs
  getAllKhutbahs: async (params?: any) => {
    const response = await api.get('/khutbahs', { params });
    return { ...response.data, data: asList(response.data?.data) };
  },

  getKhutbahById: async (id: string) => {
    const response = await api.get(`/khutbahs/${id}`);
    return response.data.data;
  },

  createKhutbah: async (data: any) => {
    const response = await api.post('/khutbahs', data);
    return response.data.data;
  },

  updateKhutbah: async (id: string, data: any) => {
    const response = await api.put(`/khutbahs/${id}`, data);
    return response.data.data;
  },

  deleteKhutbah: async (id: string) => {
    const response = await api.delete(`/khutbahs/${id}`);
    return response.data;
  },

  // Mosque Institute
  getMosqueInstitute: async () => {
    const response = await api.get('/religious/mosque-institute');
    return response.data.data;
  },
};
