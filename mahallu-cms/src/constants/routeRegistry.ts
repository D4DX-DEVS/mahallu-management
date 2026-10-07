import { isValidElement, ReactElement } from 'react';
import type { AppRole, RouteRegistration } from '@/routes/routeHelpers';
import { labelFromPath } from '@/utils/pageLabel';

export interface RegisteredPage {
  path: string;
  /** Display label, from the route's own registration (never a component name). */
  label: string;
  /** Opens as a form modal rather than a page. */
  modal: boolean;
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
 * Everything is read from the `handle` that `route()` attaches to each route
 * (see routeHelpers.tsx). Nothing is read from React element types or function
 * names: production builds minify those, and the route() helper wraps the page
 * element, so the layout child is no longer the page component anyway.
 *
 * Only static paths are kept - a Detail/Edit route needs a specific record id
 * to go anywhere, so it isn't a destination a name search can resolve to.
 */
export function extractRegisteredPages(appRoutes: ReactElement[]): RegisteredPage[] {
  const pages: RegisteredPage[] = [];

  for (const routeEl of appRoutes) {
    if (!isValidElement(routeEl)) continue;
    const routeProps = routeEl.props as { path?: string; handle?: Partial<RouteRegistration> };
    const path = routeProps.path;
    if (!path || isDynamicPath(path)) continue;

    const handle = routeProps.handle ?? {};
    pages.push({
      path,
      label: handle.label ?? labelFromPath(path),
      modal: handle.modal ?? false,
      allowedRoles: handle.allowedRoles,
      superAdminOnly: handle.superAdminOnly,
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
