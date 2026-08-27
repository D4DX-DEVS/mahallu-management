import api from './api';
import { Asset, AssetMaintenance } from '@/types';

export const assetService = {
  getAll: async (params?: { status?: string; category?: string; search?: string; mosqueId?: string; page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: Asset[]; pagination?: any }>('/assets', { params });
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Asset }>(`/assets/${id}`);
    return response.data.data;
  },

  create: async (assetData: Partial<Asset>) => {
    const response = await api.post<{ success: boolean; data: Asset }>('/assets', assetData);
    return response.data.data;
  },

  update: async (id: string, assetData: Partial<Asset>) => {
    const response = await api.put<{ success: boolean; data: Asset }>(`/assets/${id}`, assetData);
    return response.data.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/assets/${id}`);
    return response.data;
  },

  // Maintenance
  getMaintenanceRecords: async (assetId: string, params?: { page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: AssetMaintenance[]; pagination?: any }>(
      `/assets/${assetId}/maintenance`,
      { params }
    );
    if (response.data.pagination) {
      return { data: response.data.data, pagination: response.data.pagination };
    }
    return { data: response.data.data, pagination: null };
  },

  createMaintenance: async (assetId: string, data: Partial<AssetMaintenance>) => {
    const response = await api.post<{ success: boolean; data: AssetMaintenance }>(
      `/assets/${assetId}/maintenance`,
      data
    );
    return response.data.data;
  },

  updateMaintenance: async (assetId: string, maintenanceId: string, data: Partial<AssetMaintenance>) => {
    const response = await api.put<{ success: boolean; data: AssetMaintenance }>(
      `/assets/${assetId}/maintenance/${maintenanceId}`,
      data
    );
    return response.data.data;
  },

  deleteMaintenance: async (assetId: string, maintenanceId: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/assets/${assetId}/maintenance/${maintenanceId}`
    );
    return response.data;
  },
};
