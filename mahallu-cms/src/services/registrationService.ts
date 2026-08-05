import api from './api';

export interface NikahRegistration {
  id: string;
  tenantId?: string;
  groomName: string;
  groomNameMl?: string;
  groomAge?: number;
  groomId?: string;
  brideName: string;
  brideNameMl?: string;
  brideAge?: number;
  brideId?: string;
  mahallMemberType?: 'groom' | 'bride';
  nikahDate: string;
  mahallId?: string;
  waliName?: string;
  witness1?: string;
  witness2?: string;
  mahrAmount?: number;
  mahrDescription?: string;
  status?: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  createdAt: string;
}

export interface DeathRegistration {
  id: string;
  tenantId?: string;
  deceasedName: string;
  deceasedNameMl?: string;
  deceasedId?: string;
  deathDate: string;
  placeOfDeath?: string;
  causeOfDeath?: string;
  mahallId?: string;
  familyId?: string;
  informantName?: string;
  informantRelation?: string;
  informantPhone?: string;
  status?: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  createdAt: string;
}

export interface NOC {
  id: string;
  tenantId?: string | { _id: string; name: string };
  mahalluName?: string;
  applicantName: string;
  applicantNameMl?: string;
  applicantId?: string;
  applicantPhone?: string;
  purposeTitle?: string;
  purposeTitleMl?: string;
  purposeDescription?: string;
  purpose?: string;
  type: 'common' | 'nikah';
  nikahRegistrationId?: string | {
    _id?: string;
    groomName?: string;
    groomAge?: number;
    brideName?: string;
    brideAge?: number;
    nikahDate?: string;
    waliName?: string;
    mahrAmount?: number;
    mahrDescription?: string;
    witness1?: string;
    witness2?: string;
  };
  status?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  issuedDate?: string;
  expiryDate?: string;
  remarks?: string;
  createdAt: string;
}

export const registrationService = {
  // Nikah Registrations
  getAllNikah: async (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: NikahRegistration[]; pagination?: any }>('/registrations/nikah', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  getNikahById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: NikahRegistration }>(`/registrations/nikah/${id}`);
    return response.data.data;
  },

  createNikah: async (data: Partial<NikahRegistration>) => {
    const response = await api.post<{ success: boolean; data: NikahRegistration }>('/registrations/nikah', data);
    return response.data.data;
  },

  updateNikah: async (id: string, data: Partial<NikahRegistration>) => {
    const response = await api.put<{ success: boolean; data: NikahRegistration }>(`/registrations/nikah/${id}`, data);
    return response.data.data;
  },

  // Death Registrations
  getAllDeath: async (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: DeathRegistration[]; pagination?: any }>('/registrations/death', {
      params,
    });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  getDeathById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: DeathRegistration }>(`/registrations/death/${id}`);
    return response.data.data;
  },

  createDeath: async (data: Partial<DeathRegistration>) => {
    const response = await api.post<{ success: boolean; data: DeathRegistration }>('/registrations/death', data);
    return response.data.data;
  },

  updateDeath: async (id: string, data: Partial<DeathRegistration>) => {
    const response = await api.put<{ success: boolean; data: DeathRegistration }>(`/registrations/death/${id}`, data);
    return response.data.data;
  },

  // NOC
  getAllNOC: async (params?: { type?: string; status?: string; search?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: NOC[]; pagination?: any }>('/registrations/noc', { params });
    // Handle both paginated and non-paginated responses
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  getNOCById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: NOC }>(`/registrations/noc/${id}`);
    return response.data.data;
  },

  createNOC: async (data: Partial<NOC>) => {
    const response = await api.post<{ success: boolean; data: NOC }>('/registrations/noc', data);
    return response.data.data;
  },

  updateNOC: async (id: string, data: Partial<NOC>) => {
    const response = await api.put<{ success: boolean; data: NOC }>(`/registrations/noc/${id}`, data);
    return response.data.data;
  },
};

