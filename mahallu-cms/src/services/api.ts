import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { noteMutation } from './mutationTracker';
import { handleWriteSuccess, handleApiError, SESSION_NOTICE_KEY } from './apiToasts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token and tenant ID
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add tenant ID header for tenant-based data filtering
    const { currentTenantId, isSuperAdmin, user, currentInstituteId } = useAuthStore.getState();
    
    // For super admin: use selected tenant or no tenant (to see all)
    if (isSuperAdmin) {
      if (currentTenantId) {
        config.headers['x-tenant-id'] = currentTenantId;
      }
    } else {
      // For regular users: always use their assigned tenant
      const tenantId = currentTenantId || user?.tenantId;
      if (tenantId) {
        config.headers['x-tenant-id'] = tenantId;
      }
    }

    // Add institute ID header for institute-scoped users
    if (currentInstituteId) {
      config.headers['x-institute-id'] = currentInstituteId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper function to transform MongoDB _id to id
const transformId = (data: any): any => {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(transformId);
  }
  
  if (typeof data === 'object') {
    const transformed: any = {};
    for (const key in data) {
      if (key === '_id') {
        transformed.id = data[key].toString();
      } else if (key === 'tenantId' && data[key] && typeof data[key] === 'object' && data[key]._id) {
        transformed[key] = {
          ...data[key],
          id: data[key]._id.toString(),
        };
        delete transformed[key]._id;
      } else if (key === 'familyId' && data[key] && typeof data[key] === 'object' && data[key]._id) {
        const ref = data[key];
        if (ref.houseName !== undefined) {
          transformed[key] = transformId(ref);
        } else {
          transformed[key] = ref._id.toString();
        }
      } else if (key === 'memberId' && data[key] && typeof data[key] === 'object' && data[key]._id) {
        const ref = data[key];
        if (ref.name !== undefined || ref.familyName !== undefined || ref.familyId) {
          transformed[key] = transformId(ref);
        } else {
          transformed[key] = ref._id.toString();
        }
      } else {
        transformed[key] = transformId(data[key]);
      }
    }
    return transformed;
  }
  
  return data;
};

// Response interceptor for error handling and data transformation
api.interceptors.response.use(
  (response) => {
    noteMutation(response.config?.method, response.config?.url);
    handleWriteSuccess(response);
    // Transform _id to id in response data
    if (response.data && response.data.data) {
      response.data.data = transformId(response.data.data);
    }
    return response;
  },
  (error) => {
    handleApiError(error, (cfg) => api.request(cfg));
    if (error.response?.status === 401) {
      if (!/\/auth\//.test(error.config?.url || '')) {
        try { sessionStorage.setItem(SESSION_NOTICE_KEY, '1'); } catch { /* ignore */ }
      }
      localStorage.removeItem('token');
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

