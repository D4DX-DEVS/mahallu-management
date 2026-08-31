import api from './api';

export interface Cemetery {
  id?: string;
  tenantId: string;
  name: string;
  location?: string;
  capacity: number;
  usedCount?: number;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface GraveRecord {
  id?: string;
  tenantId: string;
  cemeteryId: string;
  graveNo: string;
  deceasedMemberId?: string;
  deceasedName: string;
  dateOfDeath?: string;
  burialDate?: string;
  familyId?: string;
  rowLabel?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  skip: number;
}

// ==================== CEMETERY ENDPOINTS ====================

export const cemeteryService = {
  // Get all cemeteries
  getAllCemeteries: async (
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: string
  ) => {
    const params = { page, limit };
    if (search) (params as any).search = search;
    if (status) (params as any).status = status;
    const response = await api.get('/cemeteries', { params });
    return response.data;
  },

  // Get cemetery by ID
  getCemeteryById: async (id: string) => {
    const response = await api.get(`/cemeteries/${id}`);
    return response.data.data;
  },

  // Create cemetery
  createCemetery: async (data: Cemetery) => {
    const response = await api.post('/cemeteries', data);
    return response.data.data;
  },

  // Update cemetery
  updateCemetery: async (id: string, data: Partial<Cemetery>) => {
    const response = await api.put(`/cemeteries/${id}`, data);
    return response.data.data;
  },

  // Delete cemetery
  deleteCemetery: async (id: string) => {
    const response = await api.delete(`/cemeteries/${id}`);
    return response.data;
  },

  // Get graves in a cemetery
  getCemeteryGraves: async (
    cemeteryId: string,
    page: number = 1,
    limit: number = 10,
    search?: string
  ) => {
    const params = { page, limit };
    if (search) (params as any).search = search;
    const response = await api.get(`/cemeteries/${cemeteryId}/graves`, { params });
    return response.data;
  },

  // ==================== GRAVE RECORDS ENDPOINTS ====================

  // Get all grave records
  getAllGraveRecords: async (
    page: number = 1,
    limit: number = 10,
    cemeteryId?: string,
    search?: string
  ) => {
    const params = { page, limit };
    if (cemeteryId) (params as any).cemeteryId = cemeteryId;
    if (search) (params as any).search = search;
    const response = await api.get('/grave-records', { params });
    return response.data;
  },

  // Get grave record by ID
  getGraveRecordById: async (id: string) => {
    const response = await api.get(`/grave-records/${id}`);
    return response.data.data;
  },

  // Create grave record
  createGraveRecord: async (data: GraveRecord) => {
    const response = await api.post('/grave-records', data);
    return response.data.data;
  },

  // Update grave record
  updateGraveRecord: async (id: string, data: Partial<GraveRecord>) => {
    const response = await api.put(`/grave-records/${id}`, data);
    return response.data.data;
  },

  // Delete grave record
  deleteGraveRecord: async (id: string) => {
    const response = await api.delete(`/grave-records/${id}`);
    return response.data;
  },
};

export default cemeteryService;
