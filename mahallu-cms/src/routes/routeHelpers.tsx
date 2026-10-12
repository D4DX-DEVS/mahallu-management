import { ReactNode } from 'react';
import { Route } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import RefreshBoundary from '@/components/routing/RefreshBoundary';
import { registerRoute, ModalFlag } from './modalRegistry';
import { menuItems, type MenuItem } from '@/constants/menuItems';
import type { SensitiveModuleKey } from '@/constants/modules';
import { useAuthStore } from '@/store/authStore';
import Alert from '@/components/ui/Alert';

export type AppRole = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';

interface GuardOptions {
  superAdminOnly?: boolean;
  allowedRoles?: AppRole[];
  /**
   * Modal behaviour (see routes/modalRegistry.ts). Omit to infer from the path:
   * /create, /new, /edit => form modal; /:id detail of a resource that has a list page => detail modal.
   * Pass a size to force a modal, or false to force a full page.
   */
  modal?: ModalFlag;
}

/**
 * Roles a menu path is limited to: the intersection of every allowedRoles on the way down to
 * the leaf. Routes that name no guard of their own inherit this, so a page that the sidebar
 * hides from a role is also closed to it by URL (menu and route guards cannot drift apart).
 */
const MENU_ROLES: { path: string; roles: AppRole[] }[] = [];
(function collect(items: MenuItem[], inherited: AppRole[] | undefined) {
  for (const it of items) {
    const own = it.allowedRoles as AppRole[] | undefined;
    const roles = own && inherited ? own.filter((r) => inherited.includes(r)) : own ?? inherited;
    if (it.path && roles) MENU_ROLES.push({ path: it.path, roles });
    if (it.children) collect(it.children, roles);
  }
})(menuItems, undefined);

const MENU_SENSITIVE: { path: string; key: SensitiveModuleKey }[] = [];
(function collectSensitive(items: MenuItem[]) {
  for (const it of items) {
    if (it.path && it.sensitiveKey) MENU_SENSITIVE.push({ path: it.path, key: it.sensitiveKey });
    if (it.children) collectSensitive(it.children);
  }
})(menuItems);

function sensitiveKeyFor(path: string): SensitiveModuleKey | undefined {
  let best: { len: number; key: SensitiveModuleKey } | undefined;
  for (const m of MENU_SENSITIVE) {
    if ((path === m.path || path.startsWith(m.path + '/')) && (!best || m.path.length > best.len)) best = { len: m.path.length, key: m.key };
  }
  return best?.key;
}

/**
 * Restricted modules (counselling, maslahat, inheritance, health records) need a per-user grant.
 * Without it the page would only call an API that answers 403, so show the reason instead.
 */
function SensitiveGate({ moduleKey, children }: { moduleKey: SensitiveModuleKey; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  if (isSuperAdmin || user?.permissions?.sensitiveModules?.includes(moduleKey)) return <>{children}</>;
  return (
    <div className="mx-auto max-w-xl py-10">
      <Alert tone="warning" title="Restricted module">
        This area holds sensitive records and needs special permission. Ask your mahallu admin to grant it on your user.
      </Alert>
    </div>
  );
}

/** Longest menu path that is the route path or a parent of it (e.g. /committees/meetings/:id -> /committees/meetings). */
function menuRolesFor(path: string): AppRole[] | undefined {
  let best: { len: number; roles: AppRole[] } | undefined;
  for (const m of MENU_ROLES) {
    if ((path === m.path || path.startsWith(m.path + '/')) && (!best || m.path.length > best.len)) best = { len: m.path.length, roles: m.roles };
  }
  return best?.roles;
}

/**
 * Build a protected route wrapped in the main layout.
 * ponytail: one helper replaces the 8-line ProtectedRoute/MainLayout block
 * that was repeated ~140 times in App.tsx.
 */
export const route = (path: string, element: ReactNode, rawGuard: GuardOptions = {}) => {
  const guard: GuardOptions = rawGuard.allowedRoles || rawGuard.superAdminOnly || path === '/member' || path.startsWith('/member/')
    ? rawGuard
    : { ...rawGuard, allowedRoles: menuRolesFor(path) };
  const sensitiveKey = sensitiveKeyFor(path);
  if (sensitiveKey) element = <SensitiveGate moduleKey={sensitiveKey}>{element}</SensitiveGate>;
  registerRoute({ path, element, superAdminOnly: guard.superAdminOnly, allowedRoles: guard.allowedRoles, modal: guard.modal });
  return (
    <Route
      key={path}
      path={path}
      element={
        <ProtectedRoute superAdminOnly={guard.superAdminOnly} allowedRoles={guard.allowedRoles}>
          <MainLayout>
            <RefreshBoundary>{element}</RefreshBoundary>
          </MainLayout>
        </ProtectedRoute>
      }
    />
  );
};

/** Same as `route` but restricted to super admins. */
export const superAdminRoute = (path: string, element: ReactNode) =>
  route(path, element, { superAdminOnly: true });
