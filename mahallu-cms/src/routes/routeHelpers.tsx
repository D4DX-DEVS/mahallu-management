import { ReactNode } from 'react';
import { Route } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/ui/ProtectedRoute';

export type AppRole = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';

interface GuardOptions {
  superAdminOnly?: boolean;
  allowedRoles?: AppRole[];
}

/**
 * Build a protected route wrapped in the main layout.
 * ponytail: one helper replaces the 8-line ProtectedRoute/MainLayout block
 * that was repeated ~140 times in App.tsx.
 */
export const route = (path: string, element: ReactNode, guard: GuardOptions = {}) => (
  <Route
    key={path}
    path={path}
    element={
      <ProtectedRoute superAdminOnly={guard.superAdminOnly} allowedRoles={guard.allowedRoles}>
        <MainLayout>{element}</MainLayout>
      </ProtectedRoute>
    }
  />
);

/** Same as `route` but restricted to super admins. */
export const superAdminRoute = (path: string, element: ReactNode) =>
  route(path, element, { superAdminOnly: true });
