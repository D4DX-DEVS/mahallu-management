import { isValidElement, ReactNode } from 'react';
import { Route } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import FormModalRoute from '@/components/ui/FormModalRoute';

export type AppRole = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';

interface GuardOptions {
  superAdminOnly?: boolean;
  allowedRoles?: AppRole[];
}

function isFormRoute(path: string, element: ReactNode) {
  if (/(^|\/)(create|edit)(?=\/|$)/i.test(path)) return true;

  // A few legacy edit screens use only `/:id` in their URL. Use the component
  // name as a fallback so those forms receive the same modal treatment too.
  if (!isValidElement(element) || typeof element.type !== 'function') return false;
  return /(?:Create|Edit|Form)$/.test(element.type.name);
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
        <MainLayout>
          {isFormRoute(path, element) ? (
            <FormModalRoute>{element}</FormModalRoute>
          ) : (
            element
          )}
        </MainLayout>
      </ProtectedRoute>
    }
  />
);

/** Same as `route` but restricted to super admins. */
export const superAdminRoute = (path: string, element: ReactNode) =>
  route(path, element, { superAdminOnly: true });
