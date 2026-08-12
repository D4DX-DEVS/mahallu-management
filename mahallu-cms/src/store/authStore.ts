import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  currentTenantId: string | null;
  currentInstituteId: string | null;
  isSuperAdmin: boolean;
  /** tenant.settings.features — null until the tenant is loaded (treated as "all enabled") */
  tenantFeatures: Record<string, boolean> | null;
  setTenantFeatures: (features: Record<string, boolean> | null) => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setCurrentTenant: (tenantId: string | null) => void;
  setCurrentInstitute: (instituteId: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      currentTenantId: null,
      currentInstituteId: null,
      isSuperAdmin: false,
      tenantFeatures: null,
      setTenantFeatures: (tenantFeatures) => set({ tenantFeatures }),
      setUser: (user) =>
        set({
          user,
          isSuperAdmin: user?.isSuperAdmin || false,
          currentTenantId: user?.tenantId || null,
          currentInstituteId: user?.instituteId || null,
        }),
      setToken: (token) => {
        set({ token });
        if (token) {
          localStorage.setItem('token', token);
        } else {
          localStorage.removeItem('token');
        }
      },
      setCurrentTenant: (tenantId) => set({ currentTenantId: tenantId }),
      setCurrentInstitute: (instituteId) => set({ currentInstituteId: instituteId }),
      logout: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          currentTenantId: null,
          currentInstituteId: null,
          isSuperAdmin: false,
          tenantFeatures: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

