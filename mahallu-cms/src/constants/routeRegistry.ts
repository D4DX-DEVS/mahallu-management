import { isValidElement, ReactElement } from 'react';
import type { AppRole } from '@/routes/routeHelpers';

export interface RegisteredPage {
  path: string;
  componentName?: string;
  allowedRoles?: AppRole[];
  superAdminOnly?: boolean;
}

function isDynamicPath(path: string) {
  return path.includes(':');
}

/**
 * Reads the app's actual route table (`appRoutes`, the single source of truth
 * the router itself renders) rather than a hand-maintained list, so a route
 * added without updating any menu can never silently disappear from here.
 *
 * Only static paths are kept — a Detail/Edit route needs a specific record id
 * to go anywhere, so it isn't a destination a name search can resolve to.
 */
function extractRegisteredPages(appRoutes: ReactElement[]): RegisteredPage[] {
  const pages: RegisteredPage[] = [];

  for (const routeEl of appRoutes) {
    if (!isValidElement(routeEl)) continue;
    const routeProps = routeEl.props as { path?: string; element?: ReactElement };
    const path = routeProps.path;
    if (!path || isDynamicPath(path)) continue;

    // element is <ProtectedRoute allowedRoles superAdminOnly><MainLayout>{page}</MainLayout></ProtectedRoute>
    const protectedEl = routeProps.element;
    const guardProps = isValidElement(protectedEl)
      ? (protectedEl.props as { allowedRoles?: AppRole[]; superAdminOnly?: boolean; children?: ReactElement })
      : undefined;

    const mainLayoutEl = guardProps?.children;
    const pageEl = isValidElement(mainLayoutEl)
      ? ((mainLayoutEl.props as { children?: ReactElement }).children)
      : undefined;
    const componentName =
      isValidElement(pageEl) && typeof pageEl.type === 'function'
        ? (pageEl.type as { displayName?: string; name?: string }).displayName ||
          (pageEl.type as { name?: string }).name
        : undefined;

    pages.push({
      path,
      componentName,
      allowedRoles: guardProps?.allowedRoles,
      superAdminOnly: guardProps?.superAdminOnly,
    });
  }

  return pages;
}

let cached: RegisteredPage[] | null = null;
let pending: Promise<RegisteredPage[]> | null = null;

/**
 * `@/routes` pulls in every route file, which pulls in routeHelpers.tsx's
 * `route()`, which wraps every page in MainLayout -> Header -> CommandPalette.
 * A static `import { appRoutes } from '@/routes'` here therefore closed a
 * cycle back onto this module (routes/index.tsx -> ...Routes.tsx ->
 * routeHelpers.tsx -> MainLayout -> Header -> CommandPalette -> this module),
 * and `appRoutes` was still undefined when this module's own top-level code
 * ran mid-cycle — `buildRegisteredPages()` then threw while iterating
 * `undefined`, which blanked the entire app before React could render
 * anything (confirmed with `madge --circular` and by reproducing the crash
 * with the old code). A dynamic import defers the read until after the
 * initial module graph has settled — by then `@/routes` has already loaded
 * via the app's own normal (non-cyclic) entry path, so this just resolves
 * the already-loaded module.
 */
export function getRegisteredPages(): Promise<RegisteredPage[]> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = import('@/routes').then(({ appRoutes }) => {
      cached = extractRegisteredPages(appRoutes as ReactElement[]);
      return cached;
    });
  }
  return pending;
}
