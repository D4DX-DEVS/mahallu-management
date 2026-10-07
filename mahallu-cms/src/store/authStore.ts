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
  /**
   * Called whenever a DIFFERENT account signs in on this browser (OTP sign-in, role selection, account
   * switch). Without it, the previous session's "Viewing as ..." banner and its tenant's module flags
   * survived into the new account until something refetched them.
   */
  resetSessionContext: () => void;
  logout: () => void;
}

/**
 * Browser storage that belongs to whoever is signed in, not to the browser.
 *
 * The Assistant keeps its chat history in localStorage, keyed by tenant. Without
 * this, logging out and signing in as someone else on the same Mahallu — or
 * switching from an admin account to the member account of the same phone
 * number — showed the previous account's questions and answers. Cleared on
 * logout and whenever the session token changes to a different one.
 */
const USER_SCOPED_STORAGE_PREFIXES = ['assistant-chats:'];
export const clearUserScopedStorage = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => USER_SCOPED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage can be unavailable (private mode); nothing to clear then.
  }
};

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
        const previous = localStorage.getItem('token');
        if (token && previous !== token) clearUserScopedStorage();
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
      resetSessionContext: () => set({ isImpersonating: false, impersonationContext: null, tenantFeatures: null }),
      logout: () => {
        localStorage.removeItem('token');
        clearUserScopedStorage();
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
