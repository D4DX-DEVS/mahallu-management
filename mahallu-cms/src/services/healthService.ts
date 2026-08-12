import api from './api';

export interface IHealthResource {
  _id: string;
  tenantId: string;
  type: 'doctor' | 'blood_donor' | 'palliative_case' | 'patient_support' | 'elderly_care';
  memberId?: string;
  name: string;
  specialty?: string;
  bloodGroup?: string;
  contactNo: string;
  availability?: string;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface IMedicalCamp {
  _id: string;
  tenantId: string;
  name: string;
  campDate: string;
  location: string;
  organizer?: string;
  attendeeCount?: number;
  notes?: string;
  status: 'planned' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    skip: number;
    total: number;
    totalPages: number;
  };
}

export interface HealthSummary {
  success: boolean;
  data: {
    doctorsCount: number;
    elderlyCareCount: number;
    bloodDonorsCount: number;
    bloodGroupDistribution: Array<{ _id: string; count: number }>;
    palliativeCaseCount?: number;
    patientSupportCount?: number;
  };
}

// Health Resources

export const getHealthResourcesSummary = async (): Promise<HealthSummary> => {
  const response = await api.get('/health-resources/summary');
  return response.data;
};

export const getHealthResources = async (
  page: number = 1,
  limit: number = 10,
  type?: string,
  status?: string,
  bloodGroup?: string,
  search?: string
): Promise<PaginatedResponse<IHealthResource>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (type) params.append('type', type);
  if (status) params.append('status', status);
  if (bloodGroup) params.append('bloodGroup', bloodGroup);
  if (search) params.append('search', search);

  const response = await api.get(`/health-resources?${params.toString()}`);
  return response.data;
};

export const getHealthResourceById = async (id: string): Promise<{ success: boolean; data: IHealthResource }> => {
  const response = await api.get(`/health-resources/${id}`);
  return response.data;
};

export const createHealthResource = async (data: Partial<IHealthResource>): Promise<{ success: boolean; data: IHealthResource }> => {
  const response = await api.post('/health-resources', data);
  return response.data;
};

export const updateHealthResource = async (id: string, data: Partial<IHealthResource>): Promise<{ success: boolean; data: IHealthResource }> => {
  const response = await api.put(`/health-resources/${id}`, data);
  return response.data;
};

export const deleteHealthResource = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/health-resources/${id}`);
  return response.data;
};

// Sensitive Health Resources

export const getSensitiveHealthResources = async (
  page: number = 1,
  limit: number = 10,
  type?: string,
  status?: string,
  search?: string
): Promise<PaginatedResponse<IHealthResource>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (type) params.append('type', type);
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  const response = await api.get(`/health-resources/sensitive?${params.toString()}`);
  return response.data;
};

export const createSensitiveHealthResource = async (data: Partial<IHealthResource>): Promise<{ success: boolean; data: IHealthResource }> => {
  const response = await api.post('/health-resources/sensitive', data);
  return response.data;
};

export const deleteSensitiveHealthResource = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/health-resources/${id}`);
  return response.data;
};

// Medical Camps

export const getMedicalCamps = async (
  page: number = 1,
  limit: number = 10,
  status?: string,
  search?: string
): Promise<PaginatedResponse<IMedicalCamp>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  const response = await api.get(`/medical-camps?${params.toString()}`);
  return response.data;
};

export const getMedicalCampById = async (id: string): Promise<{ success: boolean; data: IMedicalCamp }> => {
  const response = await api.get(`/medical-camps/${id}`);
  return response.data;
};

export const createMedicalCamp = async (data: Partial<IMedicalCamp>): Promise<{ success: boolean; data: IMedicalCamp }> => {
  const response = await api.post('/medical-camps', data);
  return response.data;
};

export const updateMedicalCamp = async (id: string, data: Partial<IMedicalCamp>): Promise<{ success: boolean; data: IMedicalCamp }> => {
  const response = await api.put(`/medical-camps/${id}`, data);
  return response.data;
};

export const deleteMedicalCamp = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/medical-camps/${id}`);
  return response.data;
};
