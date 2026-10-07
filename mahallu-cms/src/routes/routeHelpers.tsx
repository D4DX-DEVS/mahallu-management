import { ReactNode } from 'react';
import { Route } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import FormModalRoute from '@/components/ui/FormModalRoute';

export type AppRole = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';

interface GuardOptions {
  superAdminOnly?: boolean;
  allowedRoles?: AppRole[];
}

export interface RouteOptions {
  /**
   * Open this route as a form modal even though its path has no `/create` or
   * `/edit` segment. Only a few legacy edit screens use a bare `/:id` URL.
   * This is an explicit flag on purpose: the old fallback matched the element's
   * function name (`/(Create|Edit|Form)$/`), which minification rewrites, so those
   * routes were modals in dev and plain pages in a production build.
   */
  modal?: boolean;
  /**
   * Human label for this page in the command palette. Components cannot supply
   * it (their names are minified in production), so it lives with the route.
   */
  label?: string;
}

/** Registration data attached to every route as React Router's `handle`. */
export interface RouteRegistration extends RouteOptions, GuardOptions {
  modal: boolean;
}

const FORM_PATH = /(^|\/)(create|edit)(?=\/|$)/i;

/** Pure: a route is a form modal by path convention, or when explicitly flagged. */
export function isFormRoute(path: string, options: RouteOptions = {}): boolean {
  return options.modal ?? FORM_PATH.test(path);
}

/**
 * Build a protected route wrapped in the main layout.
 * ponytail: one helper replaces the 8-line ProtectedRoute/MainLayout block
 * that was repeated ~140 times in App.tsx.
 */
export const route = (
  path: string,
  element: ReactNode,
  guard: GuardOptions = {},
  options: RouteOptions = {}
) => {
  const modal = isFormRoute(path, options);
  const registration: RouteRegistration = {
    modal,
    label: options.label,
    allowedRoles: guard.allowedRoles,
    superAdminOnly: guard.superAdminOnly,
  };
  return (
    <Route
      key={path}
      path={path}
      handle={registration}
      element={
        <ProtectedRoute superAdminOnly={guard.superAdminOnly} allowedRoles={guard.allowedRoles}>
          <MainLayout>
            {modal ? (
              <FormModalRoute>{element}</FormModalRoute>
            ) : (
              <div className="page-route-shell">{element}</div>
            )}
          </MainLayout>
        </ProtectedRoute>
      }
    />
  );
};

/** Same as `route` but restricted to super admins. */
export const superAdminRoute = (path: string, element: ReactNode, options?: RouteOptions) =>
  route(path, element, { superAdminOnly: true }, options);
