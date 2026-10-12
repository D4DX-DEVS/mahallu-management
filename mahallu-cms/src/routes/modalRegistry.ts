import { ReactNode } from 'react';
import { matchRoutes, Location } from 'react-router-dom';
import type { AppRole } from './routeHelpers';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
/** false = never a modal, a size = always a modal at that size, undefined = infer from the path. */
export type ModalFlag = ModalSize | false | undefined;

export interface RegisteredRoute {
  path: string;
  element: ReactNode;
  superAdminOnly?: boolean;
  allowedRoles?: AppRole[];
  modal?: ModalFlag;
}

const registry: RegisteredRoute[] = [];

/** Called by route() while the route modules evaluate (before the first render). */
export const registerRoute = (r: RegisteredRoute) => {
  registry.push(r);
};

/** Paths that are never modals: auth, member portal, dashboard, assistant, reports, settings, 404. */
const EXCLUDED_PREFIXES = ['/login', '/member/', '/dashboard', '/assistant', '/reports', '/settings'];
/** Overview-style or dedicated full pages that look like a detail route but are not. */
const FULL_PAGE_EXACT = new Set(['/families/:id', '/members/:id', '/registers/:key']);
/** Multi-step wizards need the wide modal. */
const WIZARD_PREFIXES = ['/families/', '/members/', '/employees/', '/campaigns/'];

const FORM_LAST = new Set(['create', 'new', 'edit']);
const isParam = (seg: string) => seg.startsWith(':');

export function inferModalSize(path: string, allPaths: Set<string>): ModalSize | false {
  if (path === '*' || path === '/') return false;
  if (EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : p + '/') || path.startsWith(p))) return false;
  if (FULL_PAGE_EXACT.has(path)) return false;
  const segs = path.split('/').filter(Boolean);
  const last = segs[segs.length - 1];
  if (!last) return false;
  if (FORM_LAST.has(last)) {
    return WIZARD_PREFIXES.some((p) => path.startsWith(p)) ? 'xl' : 'lg';
  }
  if (isParam(last) && segs.length > 1) {
    const parent = '/' + segs.slice(0, -1).join('/');
    if (allPaths.has(parent)) return 'xl';
  }
  return false;
}

let resolved: { routes: { path: string; size: ModalSize | false; entry: RegisteredRoute }[] } | null = null;

function resolve() {
  if (resolved && resolved.routes.length === registry.length) return resolved;
  const all = new Set(registry.map((r) => r.path));
  resolved = {
    routes: registry.map((entry) => ({
      path: entry.path,
      entry,
      size: entry.modal === undefined ? inferModalSize(entry.path, all) : entry.modal,
    })),
  };
  return resolved;
}

/** Every registered route with its resolved modal size (for building the modal route tree and for docs/tests). */
export const getResolvedRoutes = () => resolve().routes;

/** Modal size for a location, or null when it renders as a full page. */
export function getModalSize(loc: Pick<Location, 'pathname'>): ModalSize | null {
  const routes = resolve().routes;
  const matches = matchRoutes(routes.map((r) => ({ path: r.path })), loc.pathname);
  if (!matches) return null;
  const hit = routes.find((r) => r.path === matches[matches.length - 1].route.path);
  return hit && hit.size ? hit.size : null;
}
