import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types';

/**
 * Display-only context for the persistent impersonation banner. Never used
 * for authorization anywhere — the backend re-derives everything it actually
 * enforces from the session's own JWT on every request, not from this.
 */
export interface ImpersonationContext {
  role: string;
  tenantName: string;
  instituteName?: string | null;
  memberName?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  currentTenantId: string | null;
  currentInstituteId: string | null;
  isSuperAdmin: boolean;
  /** tenant.settings.features — null until the tenant is loaded (treated as "all enabled") */
  tenantFeatures: Record<string, boolean> | null;
  isImpersonating: boolean;
  impersonationContext: ImpersonationContext | null;
  setTenantFeatures: (features: Record<string, boolean> | null) => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setCurrentTenant: (tenantId: string | null) => void;
  setCurrentInstitute: (instituteId: string | null) => void;
  setImpersonation: (context: ImpersonationContext | null) => void;
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
      isImpersonating: false,
      impersonationContext: null,
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
      setImpersonation: (context) => set({ isImpersonating: !!context, impersonationContext: context }),
      logout: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          currentTenantId: null,
          currentInstituteId: null,
          isSuperAdmin: false,
          tenantFeatures: null,
          isImpersonating: false,
          impersonationContext: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
