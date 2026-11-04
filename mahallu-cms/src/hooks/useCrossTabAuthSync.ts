import { useEffect } from 'react';
import { ROUTES } from '@/constants/routes';

const TOKEN_KEY = 'token';
const AUTH_STORE_KEY = 'auth-storage';
const RELOAD_GUARD_KEY = 'auth-sync-reloaded-at';
/** Two tabs reacting to each other must not be able to reload in a loop. */
const RELOAD_GUARD_MS = 3000;

/** Pages that work without a session and must not be yanked around. */
const isPublicPath = (pathname: string) => pathname === ROUTES.LANDING || pathname.startsWith('/verify/');

const recentlyReloaded = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY));
    return Number.isFinite(last) && Date.now() - last < RELOAD_GUARD_MS;
  } catch {
    return false;
  }
};

const markReloaded = () => {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage can be unavailable (private mode); the guard is best effort.
  }
};

/**
 * The part of the persisted auth state that decides what this tab should show.
 * The whole store is persisted, including data that is refreshed constantly
 * (tenant features, the user's profile fields); reacting to those would have two
 * tabs reloading each other for no reason.
 */
const authIdentity = (raw: string | null): string | null => {
  if (raw === null) return null;
  try {
    type PersistedUser = { id?: string; _id?: string; role?: string; tenantId?: unknown; instituteId?: unknown };
    type PersistedState = {
      token?: unknown;
      user?: PersistedUser;
      currentTenantId?: unknown;
      currentInstituteId?: unknown;
      isSuperAdmin?: unknown;
      isImpersonating?: unknown;
      impersonationContext?: { role?: unknown };
    };
    const state = (JSON.parse(raw) as { state?: PersistedState }).state ?? {};
    return JSON.stringify([
      state.token ?? null,
      state.user?.id ?? state.user?._id ?? null,
      state.user?.role ?? null,
      state.user?.tenantId ?? null,
      state.user?.instituteId ?? null,
      state.currentTenantId ?? null,
      state.currentInstituteId ?? null,
      Boolean(state.isSuperAdmin),
      Boolean(state.isImpersonating),
      state.impersonationContext?.role ?? null,
    ]);
  } catch {
    return raw;
  }
};

/**
 * The API client reads the token from localStorage on every request, but the
 * role, user and tenant live in this tab's memory. After a login, role switch,
 * tenant switch or logout in ANOTHER tab, this tab would keep drawing the old
 * role's screens while sending the new token. `storage` events only fire in the
 * other tabs, so listening for them is exactly "someone else changed it".
 *
 * - token or persisted auth state changed: reload, so memory is rebuilt from storage.
 * - token removed (logout elsewhere, or storage cleared): go to the login page.
 */
export function useCrossTabAuthSync() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      // `key` is null when another tab called localStorage.clear().
      const cleared = event.key === null;
      if (!cleared && event.key !== TOKEN_KEY && event.key !== AUTH_STORE_KEY) return;
      if (event.key === TOKEN_KEY && event.oldValue === event.newValue) return;
      if (event.key === AUTH_STORE_KEY && authIdentity(event.oldValue) === authIdentity(event.newValue)) return;
      if (isPublicPath(window.location.pathname)) return;
      if (recentlyReloaded()) return;

      const tokenRemoved = cleared || (event.key === TOKEN_KEY && event.newValue === null);
      markReloaded();

      if (tokenRemoved) {
        if (window.location.pathname === ROUTES.LOGIN) window.location.reload();
        else window.location.replace(ROUTES.LOGIN);
        return;
      }
      window.location.reload();
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}
