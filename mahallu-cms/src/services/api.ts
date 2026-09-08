import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

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

    // FormData must not inherit the JSON default — the browser sets multipart/form-data with boundary
    if (config.data instanceof FormData) {
      config.headers.delete?.('Content-Type');
      delete (config.headers as Record<string, unknown>)['Content-Type'];
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
        const rawId = data[key];
        if (rawId == null) {
          // A grouped aggregation can bucket under `_id: null` — calling
          // .toString() on it threw inside the interceptor and failed the whole
          // response, so a chart with one unlabelled bucket broke its page.
          transformed.id = rawId;
        } else if (typeof rawId === 'object') {
          /*
           * `$group` keys are often composite — `{ ledgerId, ledgerName }`,
           * `{ instituteId, month, year }`, `{ name, age }`. Stringifying those
           * produced the literal "[object Object]", so the salary summary, the
           * income & expenditure report and the duplicate finder all lost the
           * very field they were grouped by. A composite key is data, not an id.
           */
          transformed.id = transformId(rawId);
        } else {
          transformed.id = String(rawId);
        }
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

/*
 * Endpoints where a 401 means "those details are wrong", not "your session ended".
 *
 * The interceptor used to treat every 401 the same way: clear the token and
 * hard-navigate to /login. So a mistyped password reloaded the sign-in page
 * before its own error could be read, and — worse — typing the wrong *current*
 * password in Change password signed the user out of a working session. These
 * four answer 401 as a verdict on the credentials in the request body, and the
 * calling screen shows that verdict itself.
 */
const CREDENTIAL_CHECK_PATHS = [
  '/auth/login',
  '/auth/verify-otp',
  '/auth/select-account',
  '/auth/change-password',
];

const isCredentialCheck = (url?: string): boolean =>
  !!url && CREDENTIAL_CHECK_PATHS.some((p) => url.startsWith(p) || url.includes(p));

// Response interceptor for error handling and data transformation
api.interceptors.response.use(
  (response) => {
    // Transform _id to id in response data
    if (response.data && response.data.data) {
      response.data.data = transformId(response.data.data);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && !isCredentialCheck(error.config?.url)) {
      localStorage.removeItem('token');
      useAuthStore.getState().logout();
      // Already on the sign-in screen: let the page show its own message
      // instead of reloading it out from under the user.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

/**
 * A list endpoint that answers without its array — a 200 whose body omits
 * `data`, a proxy that rewrote the envelope, a controller that changed shape —
 * used to hand `undefined` to a page that immediately called `.map()` on it.
 * React unmounts on that throw, so one odd response blanked the whole screen.
 *
 * Services declare these methods as returning an array. This makes that true:
 * anything that isn't a list becomes an empty one, and the page shows its
 * empty state instead of disappearing.
 */
export const asList = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);
