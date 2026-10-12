import type { MenuItem } from '@/constants/menuItems';
import { FiGrid, FiHome, FiMoreHorizontal } from 'react-icons/fi';
import type { ModuleKey, SensitiveModuleKey } from '@/constants/modules';

export type UserRole = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';

export interface GatingContext {
  userRole: UserRole | null;
  isSuperAdmin: boolean;
  isModuleEnabled: (moduleKey?: ModuleKey) => boolean;
  sensitiveModules: SensitiveModuleKey[];
}

/** Same role / sensitive-module / tenant-module gating the grouped sidebar used. Presentation changes only. */
function isAccessible(item: MenuItem, ctx: GatingContext) {
  if (item.superAdminOnly && !ctx.isSuperAdmin) return false;
  if (item.sensitiveKey && !ctx.isSuperAdmin && !ctx.sensitiveModules.includes(item.sensitiveKey)) return false;
  if (item.allowedRoles && ctx.userRole) return item.allowedRoles.includes(ctx.userRole);
  return true;
}

/** Keep only what the user may open; groups whose children are all hidden are dropped. */
export function filterAccessible(items: MenuItem[], ctx: GatingContext): MenuItem[] {
  return items.reduce<MenuItem[]>((out, item) => {
    if (!isAccessible(item, ctx)) return out;
    if (!ctx.isModuleEnabled(item.moduleKey)) return out;
    if (item.children) {
      const children = filterAccessible(item.children, ctx);
      if (children.length === 0) return out;
      out.push({ ...item, children });
    } else {
      out.push(item);
    }
    return out;
  }, []);
}

export interface Leaf {
  item: MenuItem;
  sectionId: string;
  /** Labels of the groups between the section and the leaf (for search context). */
  trail: string[];
}

export function collectLeaves(section: MenuItem): Leaf[] {
  const out: Leaf[] = [];
  const walk = (items: MenuItem[], trail: string[]) => {
    for (const item of items) {
      if (item.children?.length) walk(item.children, [...trail, item.label]);
      else if (item.path) out.push({ item, sectionId: section.id, trail });
    }
  };
  if (section.children?.length) walk(section.children, []);
  else if (section.path) out.push({ item: section, sectionId: section.id, trail: [] });
  return out;
}

function pathMatches(path: string, pathname: string) {
  return pathname === path || pathname.startsWith(path.endsWith('/') ? path : path + '/');
}

/**
 * Ids from the section down to the leaf that best matches the pathname
 * (exact match wins, otherwise the longest path prefix so detail pages keep their parent highlighted).
 */
export function findActiveTrail(sections: MenuItem[], pathname: string): string[] {
  let best: { len: number; trail: string[] } | null = null;
  const walk = (items: MenuItem[], trail: string[]) => {
    for (const item of items) {
      const next = [...trail, item.id];
      if (item.children?.length) walk(item.children, next);
      else if (item.path && pathMatches(item.path, pathname)) {
        const len = item.path === pathname ? Infinity : item.path.length;
        if (!best || len > best.len) best = { len, trail: next };
      }
    }
  };
  walk(sections, []);
  return best ? (best as { trail: string[] }).trail : [];
}

/** Short rail label (10px under the icon). Full label stays in the tooltip / aria-label. */
const RAIL_LABELS: Record<string, string> = {
  dashboard: 'Home',
  'ai-assistant': 'Assistant',
  'member-space': 'My Space',
  'institute-operations': 'Institute',
  'mahallu-finance': 'Finance',
  administration: 'Admin',
};
export function railLabel(item: MenuItem) {
  return RAIL_LABELS[item.id] ?? item.label;
}

/* ------------------------------------------------------------------ */
/* Panel grouping: group TITLE -> level-1 rows -> nested sub-menu.     */
/* Menu data stays untouched; this map only decides presentation.      */
/* An id may name any node of the section; naming a deep leaf promotes */
/* it to a level-1 row (its former parents are dissolved).             */
/* ------------------------------------------------------------------ */
/** A synthetic accordion parent: not in the menu data, groups existing items under one level-1 row. */
export interface SyntheticParent {
  label: string;
  icon: MenuItem['icon'];
  ids: string[];
}
export interface NavGroupConfig {
  title: string;
  itemIds: (string | SyntheticParent)[];
}
export interface NavGroup {
  title: string;
  items: MenuItem[];
}

const more = (label: string, ids: string[], icon: MenuItem['icon'] = FiMoreHorizontal as MenuItem['icon']): SyntheticParent => ({ label, icon, ids });

export const GROUP_MAP: Record<string, NavGroupConfig[]> = {
  'member-space': [
    { title: 'MY SPACE', itemIds: ['member-overview', 'member-payments', 'member-varisangya-portal'] },
    { title: 'REQUESTS', itemIds: ['member-noc-request', 'member-noc-list'] },
  ],
  community: [
    { title: 'PEOPLE', itemIds: ['families', 'members', 'duplicate-families'] },
    { title: 'COMMITTEES AND EVENTS', itemIds: ['committees', 'programs'] },
    {
      title: 'RECORDS',
      itemIds: ['registers', 'survey', 'locality-facilities', more('More records', ['clusters', 'mosque', 'assets', 'development-projects'])],
    },
    { title: 'REPORTS', itemIds: ['reports'] },
  ],
  services: [
    {
      title: 'COLLECTIONS',
      itemIds: [
        'all-collections',
        'quick-collection',
        'payment-approvals',
        more('Varisangya', ['varisangya', 'family-varisangya', 'member-varisangya', 'live-dues'], FiHome as MenuItem['icon']),
        'zakat',
      ],
    },
    { title: 'CAMPAIGNS AND CASH', itemIds: ['campaigns', 'collectors', 'day-closing'] },
    { title: 'WELFARE AND AID', itemIds: ['welfare', 'zakat-module', 'qard-hasan', 'emergency-relief'] },
    { title: 'LEARNING AND HEALTH', itemIds: ['education', 'health', more('More programmes', ['library', 'employment', 'volunteers'], FiGrid as MenuItem['icon'])] },
    {
      title: 'COMMUNITY LIFE',
      itemIds: [
        'announcements',
        'registrations',
        more('More community services', ['religious', 'counselling', 'maslahat', 'inheritance', 'cemetery', 'notifications', 'social']),
      ],
    },
  ],
  'institute-operations': [
    { title: 'INSTITUTES AND STAFF', itemIds: ['institutes', 'employees', 'salary'] },
    { title: 'ACCOUNTS SETUP', itemIds: ['institute-accounts', 'categories', 'ledgers', 'ledger-items'] },
    {
      title: 'FINANCIAL REPORTS',
      itemIds: ['day-book', 'trial-balance', 'balance-sheet', more('More reports', ['ledger-report', 'income-expenditure', 'consolidated-report', 'petty-cash'])],
    },
    { title: 'WALLETS', itemIds: ['wallets'] },
  ],
  'mahallu-finance': [
    { title: 'ACCOUNTS SETUP', itemIds: ['mahallu-bank-accounts', 'mahallu-ledgers', 'mahallu-ledger-items', 'mahallu-categories'] },
    { title: 'YEAR AND BUDGET', itemIds: ['mahallu-financial-years', 'mahallu-budgets'] },
    {
      title: 'FINANCIAL REPORTS',
      itemIds: ['mahallu-day-book', 'mahallu-trial-balance', 'mahallu-balance-sheet', more('More reports', ['mahallu-ledger-report', 'mahallu-income-expenditure', 'mahallu-combined'])],
    },
  ],
  administration: [
    { title: 'SETTINGS', itemIds: ['mahall-main', 'security-settings', 'users'] },
    { title: 'SUPER ADMIN', itemIds: ['tenants', 'all-users'] },
  ],
};

/** Arrange an (already access-filtered) section into titled groups. Unmapped items land in OTHER. */
export function buildGroups(section: MenuItem, config: Record<string, NavGroupConfig[]> = GROUP_MAP): NavGroup[] {
  const children = section.children;
  if (!children?.length) return [];
  const index = new Map<string, MenuItem>();
  const walk = (items: MenuItem[]) =>
    items.forEach((i) => {
      if (!index.has(i.id)) index.set(i.id, i);
      if (i.children) walk(i.children);
    });
  walk(children);

  const used = new Set<string>();
  const groups: NavGroup[] = [];
  for (const g of config[section.id] ?? []) {
    const items: MenuItem[] = [];
    for (const entry of g.itemIds) {
      if (typeof entry !== 'string') {
        const kids: MenuItem[] = [];
        for (const cid of entry.ids) {
          const c = index.get(cid);
          if (!c || used.has(cid)) continue;
          used.add(cid);
          kids.push(c);
        }
        if (kids.length) items.push({ id: `syn:${section.id}:${entry.label}`, label: entry.label, icon: entry.icon, children: kids });
        continue;
      }
      const id = entry;
      const node = index.get(id);
      if (!node || used.has(id)) continue;
      used.add(id);
      items.push(node);
    }
    if (items.length) groups.push({ title: g.title, items });
  }

  // Anything not placed (new menu entries, items with partially-mapped parents) keeps showing, under OTHER.
  const covered = (node: MenuItem): boolean => used.has(node.id) || (node.children?.some(covered) ?? false);
  const leftovers: MenuItem[] = [];
  const sweep = (node: MenuItem) => {
    if (used.has(node.id)) return;
    if (node.children?.length && node.children.some(covered)) node.children.forEach(sweep);
    else leftovers.push(node);
  };
  children.forEach(sweep);
  if (leftovers.length) groups.push({ title: groups.length ? 'OTHER' : section.label.toUpperCase(), items: leftovers });
  return groups;
}
