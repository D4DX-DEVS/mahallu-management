import api, { asList } from './api';

export interface ICounsellingCase {
  id: string;
  tenantId: string;
  caseNo: string;
  category: 'marriage' | 'family' | 'adolescent' | 'education' | 'parenting' | 'behaviour' | 'career';
  clientMemberId?: string;
  clientName?: string;
  counsellorName: string;
  appointmentDate: string;
  status: 'open' | 'in_progress' | 'follow_up' | 'closed';
  sessionNotes: Array<{
    date: string;
    note: string;
    addedBy: string;
  }>;
  closureNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDisputeCase {
  id: string;
  tenantId: string;
  caseNo: string;
  type: 'family' | 'marriage' | 'divorce' | 'community' | 'inheritance' | 'other';
  parties: string[];
  description: string;
  mediators: string[];
  status: 'registered' | 'mediation' | 'resolved' | 'referred' | 'closed';
  resolutionNotes?: string;
  referredTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IInheritanceCase {
  id: string;
  tenantId: string;
  caseNo: string;
  deceasedMemberId?: string;
  deceasedName?: string;
  deathRegistrationId?: string;
  heirs: Array<{
    name: string;
    relation: string;
    contactNo?: string;
  }>;
  status: 'reported' | 'documentation' | 'referred' | 'distributed' | 'closed';
  referredScholar?: string;
  notes?: string;
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

// ====== COUNSELLING CASES ======

export const getCounsellingCases = async (
  page: number = 1,
  limit: number = 10,
  category?: string,
  status?: string,
  search?: string
): Promise<PaginatedResponse<ICounsellingCase>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (category) params.append('category', category);
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  const response = await api.get(`/counselling-cases?${params.toString()}`);
  return { ...response.data, data: asList(response.data?.data) };
};

export const getCounsellingCaseById = async (
  id: string
): Promise<{ success: boolean; data: ICounsellingCase }> => {
  const response = await api.get(`/counselling-cases/${id}`);
  return response.data;
};

export const createCounsellingCase = async (
  data: Partial<ICounsellingCase>
): Promise<{ success: boolean; data: ICounsellingCase }> => {
  const response = await api.post('/counselling-cases', data);
  return response.data;
};

export const updateCounsellingCase = async (
  id: string,
  data: Partial<ICounsellingCase>
): Promise<{ success: boolean; data: ICounsellingCase }> => {
  const response = await api.put(`/counselling-cases/${id}`, data);
  return response.data;
};

export const deleteCounsellingCase = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/counselling-cases/${id}`);
  return response.data;
};

export const addCounsellingNote = async (
  id: string,
  note: string
): Promise<{ success: boolean; data: ICounsellingCase }> => {
  const response = await api.post(`/counselling-cases/${id}/notes`, { note });
  return response.data;
};

// ====== DISPUTE CASES (MASLAHAT) ======

export const getDisputeCases = async (
  page: number = 1,
  limit: number = 10,
  type?: string,
  status?: string,
  search?: string
): Promise<PaginatedResponse<IDisputeCase>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (type) params.append('type', type);
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  const response = await api.get(`/dispute-cases?${params.toString()}`);
  return { ...response.data, data: asList(response.data?.data) };
};

export const getDisputeCaseById = async (id: string): Promise<{ success: boolean; data: IDisputeCase }> => {
  const response = await api.get(`/dispute-cases/${id}`);
  return response.data;
};

export const createDisputeCase = async (
  data: Partial<IDisputeCase>
): Promise<{ success: boolean; data: IDisputeCase }> => {
  const response = await api.post('/dispute-cases', data);
  return response.data;
};

export const updateDisputeCase = async (
  id: string,
  data: Partial<IDisputeCase>
): Promise<{ success: boolean; data: IDisputeCase }> => {
  const response = await api.put(`/dispute-cases/${id}`, data);
  return response.data;
};

export const deleteDisputeCase = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/dispute-cases/${id}`);
  return response.data;
};

// ====== INHERITANCE CASES ======

export const getInheritanceCases = async (
  page: number = 1,
  limit: number = 10,
  status?: string,
  search?: string
): Promise<PaginatedResponse<IInheritanceCase>> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  const response = await api.get(`/inheritance-cases?${params.toString()}`);
  return { ...response.data, data: asList(response.data?.data) };
};

export const getInheritanceCaseById = async (
  id: string
): Promise<{ success: boolean; data: IInheritanceCase }> => {
  const response = await api.get(`/inheritance-cases/${id}`);
  return response.data;
};

export const createInheritanceCase = async (
  data: Partial<IInheritanceCase>
): Promise<{ success: boolean; data: IInheritanceCase }> => {
  const response = await api.post('/inheritance-cases', data);
  return response.data;
};

export const updateInheritanceCase = async (
  id: string,
  data: Partial<IInheritanceCase>
): Promise<{ success: boolean; data: IInheritanceCase }> => {
  const response = await api.put(`/inheritance-cases/${id}`, data);
  return response.data;
};

export const deleteInheritanceCase = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/inheritance-cases/${id}`);
  return response.data;
};
