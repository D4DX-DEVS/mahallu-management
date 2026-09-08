/**
 * One icon per destination, for both the sidebar and the page title.
 *
 * The sidebar already carried an icon for every module; the page it opened
 * showed a bare heading, so "Families" in the menu and "Families" as an <h1>
 * did not read as the same place. Rather than repeat the icon choice on 241
 * pages — which is how two names for one module happen — the map is derived
 * from `menuItems`, the same tree the sidebar renders. Adding a module to the
 * menu gives its page an icon; there is no second list to keep in step.
 */
import type { IconType } from 'react-icons';
import { FiDollarSign, FiFileText, FiLayers, FiSettings, FiShield, FiUser } from 'react-icons/fi';
import { menuItems, MenuItem } from './menuItems';

type IconComponent = IconType | React.ComponentType<{ className?: string }>;

interface NavIconEntry {
  path: string;
  icon: IconComponent;
  /** Leaf icons beat the icon of the group they sit in. */
  depth: number;
}

function collect(items: MenuItem[], depth = 0, acc: NavIconEntry[] = []): NavIconEntry[] {
  for (const item of items) {
    if (item.path) acc.push({ path: item.path, icon: item.icon as IconComponent, depth });
    if (item.children) collect(item.children, depth + 1, acc);
  }
  return acc;
}

const entries = collect(menuItems);

/** Exact route → icon. Built once at module load, not per render. */
const byPath = new Map<string, IconComponent>();
for (const entry of entries) {
  const existing = byPath.get(entry.path);
  // First writer wins: the menu lists a destination once, and where a path is
  // repeated across roles the shallower entry is the canonical one.
  if (!existing) byPath.set(entry.path, entry.icon);
}

/**
 * Longest first, so `/member/noc/request` resolves to the request icon rather
 * than to the `/member/noc` list it is nested under.
 */
const prefixes = [...byPath.keys()].filter((path) => path !== '/').sort((a, b) => b.length - a.length);

/**
 * Destinations that exist as routes but not as menu entries — the account
 * menu reaches them directly. Without these their pages would be the only
 * ones with a bare heading.
 */
const extraPaths: Array<[string, IconComponent]> = [
  ['/settings/security', FiShield],
  ['/settings', FiSettings],
  ['/profile', FiUser],
  ['/member/profile', FiUser],
  /* Routed under a different prefix from the menu entry that opens them:
   * the petty cash list is /accounting/petty-cash but a voucher is
   * /petty-cash/:id, and the consolidated report answers on two paths. */
  ['/petty-cash', FiDollarSign],
  ['/accounting/consolidated', FiLayers],
  ['/registrations/noc', FiFileText],
];

/**
 * The icon the sidebar uses for `pathname`, or for the nearest ancestor route
 * it sits under — so `/families/new` and `/families/:id/edit` carry the
 * Families icon, and a detail page is visibly part of its module.
 *
 * Returns undefined for a route with no module, e.g. login. PageHeader then
 * renders the title alone rather than inventing a placeholder glyph.
 */
export function resolveNavIcon(pathname: string): IconComponent | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  const exact = byPath.get(path);
  if (exact) return exact;

  const extraExact = extraPaths.find(([candidate]) => candidate === path);
  if (extraExact) return extraExact[1];

  const prefix = prefixes.find((candidate) => path.startsWith(candidate + '/'));
  if (prefix) return byPath.get(prefix);

  const extraPrefix = extraPaths.find(([candidate]) => path.startsWith(candidate + '/'));
  if (extraPrefix) return extraPrefix[1];

  return undefined;
}

/** Used by the report pages, which are generated rather than routed one by one. */
export const FALLBACK_PAGE_ICON: IconComponent = FiFileText;
