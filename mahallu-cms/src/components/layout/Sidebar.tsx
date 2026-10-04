import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { menuItems, MenuItem } from '@/constants/menuItems';
import type { ModuleKey, SensitiveModuleKey } from '@/constants/modules';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { FiChevronDown, FiChevronRight, FiChevronUp, FiWifiOff, FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { BRAND_NAME, LOGO_PATH } from '@/constants/theme';
import { useLayoutStore } from '@/store/layoutStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { footerNavByRole, useIsMobile } from './MobileFooterNav';
type UserRole = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';
function isAccessible(
  item: MenuItem,
  userRole: UserRole | null,
  isSuperAdmin: boolean,
  sensitiveModules: SensitiveModuleKey[]
) {
  if (item.superAdminOnly && !isSuperAdmin) return false;
  if (item.sensitiveKey && !isSuperAdmin && !sensitiveModules.includes(item.sensitiveKey)) return false;
  if (item.allowedRoles && userRole) return item.allowedRoles.includes(userRole);
  return true;
}
function hasActiveDescendant(item: MenuItem, pathname: string): boolean {
  if (item.path && matchPath({ path: item.path, end: false }, pathname)) return true;
  return item.children?.some((child) => hasActiveDescendant(child, pathname)) ?? false;
}
function filterMenuTree(
  items: MenuItem[],
  searchQuery: string,
  userRole: UserRole | null,
  isSuperAdmin: boolean,
  isModuleEnabled: (moduleKey?: ModuleKey) => boolean,
  sensitiveModules: SensitiveModuleKey[]
): MenuItem[] {
  return items.reduce<MenuItem[]>((result, item) => {
    // Support is a profile action, not a navigation module. Keep it out of
    // both the expanded footer and compact rail while retaining the route for
    // the account menu.
    if (item.id === 'support') return result;
    if (!isAccessible(item, userRole, isSuperAdmin, sensitiveModules)) return result;
    if (!isModuleEnabled(item.moduleKey)) return result;
    const accessibleChildren = item.children
      ? filterMenuTree(item.children, '', userRole, isSuperAdmin, isModuleEnabled, sensitiveModules)
      : undefined;
    const matchesSearch = item.label.toLowerCase().includes(searchQuery.toLowerCase());
    const filteredChildren = item.children
      ? filterMenuTree(item.children, searchQuery, userRole, isSuperAdmin, isModuleEnabled, sensitiveModules)
      : undefined;
    if (item.children && (!accessibleChildren || accessibleChildren.length === 0)) return result;
    if (!searchQuery.trim()) {
      result.push({ ...item, children: accessibleChildren });
      return result;
    }
    if (matchesSearch) {
      result.push({ ...item, children: accessibleChildren });
      return result;
    }
    if (filteredChildren && filteredChildren.length > 0) {
      result.push({ ...item, children: filteredChildren });
    }
    return result;
  }, []);
}
function pruneFooterItems(items: MenuItem[], paths: Set<string>): MenuItem[] {
  return items.reduce<MenuItem[]>((acc, item) => {
    if (item.path && paths.has(item.path)) return acc;
    const children = item.children ? pruneFooterItems(item.children, paths) : undefined;
    if (item.children && (!children || children.length === 0)) return acc;
    acc.push({ ...item, children });
    return acc;
  }, []);
}
function collectAncestorIds(items: MenuItem[], pathname: string, trail: string[] = []): string[] {
  for (const item of items) {
    const nextTrail = [...trail, item.id];
    if (item.path && matchPath({ path: item.path, end: false }, pathname)) return nextTrail;
    if (item.children) {
      const childTrail = collectAncestorIds(item.children, pathname, nextTrail);
      if (childTrail.length > 0) return childTrail;
    }
  }
  return [];
}
/* --------------------------------------------------------------------------- * Collapsed flyout * * When the rail is collapsed, child items used to `return null` with no * alternative, so every nested destination became unreachable and clicking a * group merely re-expanded the rail. The flyout restores the whole tree. * ------------------------------------------------------------------------- */

/**
 * Keep the information architecture visible without changing the route tree.
 * Labels are attached to stable top-level ids so role/module filtering can
 * remove items freely while the remaining navigation still has clear groups.
 */
function sectionLabelForItem(item: MenuItem): string {
  return item.section === 'Overview' ? 'Main' : item.section ?? 'Navigation';
}

/* The flyout is a workspace, not a long unlabelled list. Keep grouping in the
 * shell so the menu data can remain route-focused and role filtering can still
 * remove individual destinations without breaking the visual hierarchy. */
const MENU_GROUPS: Record<string, Record<string, string>> = {
  'member-space': {
    'member-overview': 'Overview',
    'member-profile': 'Overview',
    'member-family': 'Overview',
    'member-varisangya-portal': 'Payments',
    'member-payments': 'Payments',
    'member-requests': 'Requests',
    'member-noc-list': 'Documents',
    'member-certificates': 'Documents',
  },
  'member-apply': { 'member-noc-request': 'Requests', 'member-nikah-request': 'Requests', 'member-death-request': 'Requests' },
  community: {
    families: 'People & registers',
    members: 'People & registers',
    registers: 'People & registers',
    survey: 'Survey',
    'locality-facilities': 'Survey',
    clusters: 'Survey',
    mosque: 'Community operations',
    committees: 'Community operations',
    meetings: 'Community operations',
    programs: 'Community operations',
    assets: 'Community operations',
    'development-projects': 'Community operations',
  },
  services: {
    'welfare-applications': 'Support & welfare',
    'welfare-schemes': 'Support & welfare',
    zakat: 'Support & welfare',
    'qard-hasan': 'Support & welfare',
    'emergency-relief': 'Support & welfare',
    employment: 'Community services',
    volunteers: 'Community services',
    health: 'Community services',
    religious: 'Community services',
    counselling: 'Community services',
    maslahat: 'Community services',
    inheritance: 'Community services',
    cemetery: 'Community services',
    library: 'Community services',
  },
  registrations: {
    nikah: 'Registration desk',
    death: 'Registration desk',
    'common-noc': 'Registration desk',
    'nikah-noc': 'Registration desk',
    'marriage-assistance': 'Registration desk',
    certificates: 'Documents & requests',
    'change-requests': 'Documents & requests',
  },
  collections: {
    'all-collections': 'Collections',
    'live-dues': 'Collections',
    varisangya: 'Collections',
    'family-varisangya': 'Collections',
    'member-varisangya': 'Collections',
    'zakat-collection': 'Collections',
  },
  finance: {
    'fin-accounts': 'Ledger setup',
    'fin-ledgers': 'Ledger setup',
    'fin-ledger-items': 'Ledger setup',
    'fin-categories': 'Ledger setup',
    'fin-i-accounts': 'Ledger setup',
    'fin-i-ledgers': 'Ledger setup',
    'fin-i-ledger-items': 'Ledger setup',
    'fin-i-categories': 'Ledger setup',
    'fin-day-book': 'Reports & statements',
    'fin-trial-balance': 'Reports & statements',
    'fin-balance-sheet': 'Reports & statements',
    'fin-ledger-report': 'Reports & statements',
    'fin-income-expenditure': 'Reports & statements',
    'fin-consolidated': 'Reports & statements',
    'fin-i-day-book': 'Reports & statements',
    'fin-i-trial-balance': 'Reports & statements',
    'fin-i-balance-sheet': 'Reports & statements',
    'fin-i-ledger-report': 'Reports & statements',
    'fin-i-income-expenditure': 'Reports & statements',
    'fin-petty-cash': 'Cash & wallets',
    'fin-wallets': 'Cash & wallets',
    'fin-i-petty-cash': 'Cash & wallets',
  },
  institute: {
    institutes: 'Institute operations',
    employees: 'Institute operations',
    salary: 'Institute operations',
    'education-classes': 'Education',
    'education-scholarships': 'Education',
    'education-support': 'Education',
  },
  reports: {
    'r-demographics': 'Community reports',
    'r-area': 'Community reports',
    'r-blood-bank': 'Community reports',
    'r-orphans': 'Community reports',
    'r-welfare': 'Community reports',
    'r-education': 'Community reports',
    'r-community': 'Community reports',
    'r-annual': 'Performance',
    'r-development-index': 'Performance',
    'r-data-quality': 'Performance',
  },
  communication: {
    announcements: 'Messages',
    'send-notification': 'Messages',
    'notifications-sent': 'Messages',
    'notifications-collection': 'Messages',
    banners: 'Media',
    feeds: 'Media',
    'super-feeds': 'Media',
  },
  administration: {
    'mahallu-settings': 'Settings & access',
    'security-settings': 'Settings & access',
    'mahallu-users': 'Settings & access',
    'survey-users': 'Settings & access',
    'institute-users': 'Settings & access',
    'activity-logs': 'Monitoring',
    support: 'Monitoring',
    assistant: 'Monitoring',
    tenants: 'Platform',
    'all-users': 'Platform',
    'categories-admin': 'Platform',
  },
};

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

function groupChildren(parentId: string, children: MenuItem[] = []): MenuGroup[] {
  const groups = new Map<string, MenuItem[]>();
  children.forEach((child) => {
    const label = MENU_GROUPS[parentId]?.[child.id] ?? 'More';
    const group = groups.get(label) ?? [];
    group.push(child);
    groups.set(label, group);
  });
  return Array.from(groups, ([label, items]) => ({ label, items }));
}

const SECTION_ORDER: Record<string, number> = {
  Overview: 0,
  Community: 1,
  Services: 2,
  'Finance & reports': 3,
  Administration: 4,
};

function orderBySection(items: MenuItem[]): MenuItem[] {
  return [...items].sort(
    (a, b) => (SECTION_ORDER[a.section ?? 'Navigation'] ?? 99) - (SECTION_ORDER[b.section ?? 'Navigation'] ?? 99)
  );
}

function GroupHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-2 pb-1.5 pt-3 first:pt-1">
      <span className="h-4 w-0.5 rounded-full bg-primary/60" aria-hidden="true" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function CollapsedFlyout({
  item,
  anchor,
  pathname,
  onNavigate,
  onClose,
  trigger,
  leftOffset,
}: {
  item: MenuItem;
  anchor: DOMRect;
  pathname: string;
  onNavigate: (fromFlyout?: boolean) => void;
  onClose: () => void;
  trigger: HTMLElement | null;
  leftOffset: number;
}) {
  const flyoutRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const groups = groupChildren(item.id, item.children);
  const headerOffset = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
  useEffect(() => {
    firstItemRef.current?.focus();
  }, []);
  useEffect(() => {
    const closeFlyout = () => {
      onClose();
      trigger?.focus({ preventScroll: true });
    };
    const closeOnOutsidePress = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!flyoutRef.current?.contains(target) && !trigger?.contains(target)) closeFlyout();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeFlyout();
      }
    };
    document.addEventListener('mousedown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, trigger]);
  return createPortal(
    <div
      ref={flyoutRef}
      role="menu"
      aria-label={item.label}
      style={{
        position: 'fixed',
        top: `${headerOffset}px`,
        left: anchor.right + leftOffset,
        height: `calc(100dvh - ${headerOffset}px)`,
      }}
      className="z-[70] w-56 min-h-0 overflow-y-auto border-r border-border bg-card p-3 text-card-foreground shadow-md"
    >
      <div role="presentation" className="flex items-center gap-3 border-b border-border px-2 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {(() => {
            const BranchIcon = item.icon as React.ComponentType<{ className?: string }>;
            return <BranchIcon className="h-4 w-4" />;
          })()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
        </div>
      </div>
      <div className="divide-y divide-border/70">
        {groups.map((group) => (
          <div key={group.label} role="group" aria-label={group.label}>
            <GroupHeading label={group.label} count={group.items.length} />
            {group.items.map((leaf, index) => {
              const LeafIcon = leaf.icon as React.ComponentType<{ className?: string }>;
              const flatIndex = groups.slice(0, groups.indexOf(group)).reduce((sum, current) => sum + current.items.length, 0) + index;
              const active = Boolean(leaf.path && matchPath({ path: leaf.path, end: false }, pathname));
              return (
                <Link
                  key={leaf.id}
                  ref={(node) => {
                    itemRefs.current[flatIndex] = node;
                    if (flatIndex === 0 && node) firstItemRef.current = node;
                  }}
                  to={leaf.path || '#'}
                  role="menuitem"
                  onClick={() => {
                    onNavigate(true);
                    onClose();
                  }}
                  aria-current={active ? 'page' : undefined}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      onClose();
                      trigger?.focus({ preventScroll: true });
                      return;
                    }
                    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                    event.preventDefault();
                    const total = groups.reduce((sum, current) => sum + current.items.length, 0);
                    const nextIndex = (flatIndex + (event.key === 'ArrowDown' ? 1 : -1) + total) % total;
                    itemRefs.current[nextIndex]?.focus();
                  }}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    active
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <span className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center text-muted-foreground', active && 'text-primary')} aria-hidden="true">
                    <LeafIcon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 truncate">{leaf.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
interface SideFlyoutState {
  id: string;
  anchor: DOMRect;
  trigger: HTMLElement | null;
}

interface MenuNodeProps {
  item: MenuItem;
  depth: number;
  pathname: string;
  openSections: Record<string, boolean>;
  onToggle: (id: string) => void;
  onNavigate: (fromFlyout?: boolean) => void;
  forceOpen: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
  flyout: SideFlyoutState | null;
  onFlyoutToggle: (id: string, anchor: DOMRect, trigger: HTMLElement | null) => void;
  onFlyoutClose: () => void;
}
function MenuNode({
  item,
  depth,
  pathname,
  openSections,
  onToggle,
  onNavigate,
  forceOpen,
  isCollapsed,
  isMobile,
  flyout,
  onFlyoutToggle,
  onFlyoutClose,
}: MenuNodeProps) {
  const Icon = item.icon as React.ComponentType<{ className?: string }>;
  const hasChildren = Boolean(item.children?.length);
  const isActive = Boolean(item.path && matchPath({ path: item.path, end: false }, pathname));
  const isBranchActive = hasActiveDescendant(item, pathname);
  const sideFlyoutRoot = !isCollapsed && !isMobile && depth === 0;
  const isOpen = hasChildren ? !isCollapsed && !sideFlyoutRoot && (forceOpen || openSections[item.id]) : false;
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  /*
   * Navigation text sits on the type scale: 14px top level, 13px children.
   * It used to render at 11.5px and 10.9px, below the readability floor.
   * Rows are min-h-11 (44px) so they clear the touch-target minimum. */
  const compactRoot = isCollapsed && depth === 0;
  const expandedRoot = !isCollapsed && depth === 0;
  const branchOpen = flyout?.id === item.id;
  const branchHighlighted = isBranchActive || ((isCollapsed || sideFlyoutRoot) && branchOpen);
  const rowBase =
    'group flex w-full min-h-11 items-center gap-2.5 rounded-md py-2 transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
  const indent = depth === 0 ? 'pl-3 pr-2' : depth === 1 ? 'pl-9 pr-2' : 'pl-12 pr-2';
  const textSize = depth === 0 ? 'text-sm' : 'text-label';
  if (isCollapsed && depth > 0) return null;
  if (hasChildren) {
    return (
      <div className={cn(isCollapsed ? 'space-y-0.5' : 'space-y-1')}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            if (isCollapsed || sideFlyoutRoot) {
              const box = buttonRef.current?.getBoundingClientRect();
              if (box) onFlyoutToggle(item.id, box, buttonRef.current);
              return;
            }
            onToggle(item.id);
          }}
          aria-expanded={isCollapsed || sideFlyoutRoot ? branchOpen : isOpen}
          aria-controls={isCollapsed || sideFlyoutRoot ? undefined : panelId}
          aria-haspopup={isCollapsed || sideFlyoutRoot ? 'menu' : undefined}
          className={cn(
            rowBase,
            expandedRoot
              ? 'min-h-10 gap-2 rounded-lg px-4 py-2'
              : compactRoot
                ? '!mx-auto !w-[70px] min-h-14 flex-col gap-0.5 rounded-lg px-1 py-1'
                : indent,
            branchHighlighted
              ? compactRoot
                ? 'bg-primary/10 text-primary ring-1 ring-primary/25'
                : 'text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          title={isCollapsed ? item.label : undefined}
          aria-label={isCollapsed ? item.label : undefined}
        >
          <span
            className={cn(
              'flex flex-shrink-0 items-center justify-center transition-colors',
              expandedRoot
                ? 'h-5 w-5 rounded-md'
                : compactRoot
                  ? 'h-8 w-8 rounded-lg'
                  : 'h-7 w-7 rounded-md',
              expandedRoot
                ? branchHighlighted
                  ? 'text-primary'
                  : 'text-muted-foreground'
                : branchHighlighted
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
            )}
            aria-hidden="true"
          >
            <Icon className={expandedRoot ? 'h-5 w-5' : 'h-4 w-4'} />
          </span>
          {!isCollapsed && (
            <>
              <span className={cn('min-w-0 flex-1 text-left font-medium leading-tight', textSize)}>
                {item.label}
              </span>
              {isOpen ? (
                <FiChevronDown className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              ) : (
                <FiChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              )}
            </>
          )}
          {compactRoot && (
            <span className="max-w-[4rem] truncate text-center text-[9px] font-semibold leading-[1.1]">
              {item.label}
            </span>
          )}
        </button>
        {(isCollapsed || sideFlyoutRoot) && branchOpen && flyout && (
          <CollapsedFlyout
            item={item}
            anchor={flyout.anchor}
            pathname={pathname}
            onNavigate={onNavigate}
            onClose={onFlyoutClose}
            trigger={flyout.trigger}
            leftOffset={compactRoot ? 10 : 12}
          />
        )}
        {!isCollapsed && (
          <div id={panelId} hidden={!isOpen} className="space-y-1 pb-1">
            {groupChildren(item.id, item.children).map((group) => (
              <div key={group.label} className="space-y-1">
                <GroupHeading label={group.label} count={group.items.length} />
                {group.items.map((child) => (
                  <MenuNode
                    key={child.id}
                    item={child}
                    depth={depth + 1}
                    pathname={pathname}
                    openSections={openSections}
                    onToggle={onToggle}
                    onNavigate={onNavigate}
                    forceOpen={forceOpen}
                    isCollapsed={isCollapsed}
                    isMobile={isMobile}
                    flyout={flyout}
                    onFlyoutToggle={onFlyoutToggle}
                    onFlyoutClose={onFlyoutClose}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <Link
      to={item.path || '#'}
      onClick={() => onNavigate()}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        rowBase,
        expandedRoot
          ? 'min-h-10 gap-2 rounded-lg px-4 py-2'
          : compactRoot
            ? '!mx-auto !w-[70px] min-h-14 flex-col gap-0.5 rounded-lg px-1 py-1'
            : indent,
        isActive
          ? compactRoot
            ? 'bg-primary/10 font-medium text-primary ring-1 ring-primary/25'
            : 'bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
      title={isCollapsed ? item.label : undefined}
    >
      <span
        className={cn(
          'flex flex-shrink-0 items-center justify-center transition-colors',
          expandedRoot
            ? 'h-5 w-5 rounded-md'
            : compactRoot
              ? 'h-8 w-8 rounded-lg'
              : 'h-7 w-7 rounded-md',
          expandedRoot
            ? (isActive ? 'text-primary' : 'text-muted-foreground')
            : isActive
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
        )}
        aria-hidden="true"
      >
        <Icon className={expandedRoot ? 'h-5 w-5' : 'h-4 w-4'} />
      </span>
      {!isCollapsed && <span className={cn('min-w-0 leading-tight', textSize)}>{item.label}</span>}
      {compactRoot && (
        <span className="max-w-[4rem] truncate text-center text-[9px] font-semibold leading-[1.1]">
          {item.label}
        </span>
      )}
    </Link>
  );
}
export default function Sidebar() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [activeFlyout, setActiveFlyout] = useState<SideFlyoutState | null>(null);
  const location = useLocation();
  const asideRef = useRef<HTMLElement>(null);
  const setSubmenuOpen = useLayoutStore((s) => s.setSubmenuOpen);
  const isMobileSidebarOpen = useLayoutStore((s) => s.isMobileSidebarOpen);
  const setMobileSidebarOpen = useLayoutStore((s) => s.setMobileSidebarOpen);
  const toggleDesktopSidebarCollapsed = useLayoutStore((s) => s.toggleDesktopSidebarCollapsed);
  const setDesktopSidebarCollapsed = useLayoutStore((s) => s.setDesktopSidebarCollapsed);
  const isDesktopSidebarCollapsedRaw = useLayoutStore((s) => s.isDesktopSidebarCollapsed);
  const isOnline = useOnlineStatus();
  const { isSuperAdmin, user } = useAuthStore();
  const userRole = (user?.role || (isSuperAdmin ? 'super_admin' : null)) as UserRole | null;
  const { isModuleEnabled } = useModuleAccess();
  const sensitiveModules = user?.permissions?.sensitiveModules ?? [];
  const isMobile = useIsMobile();
  /* The collapsed rail is a desktop affordance. Applied on a phone it turned the
   * drawer into a 72px strip and `MenuNode` dropped every nested destination,
   * so rotating a collapsed tablet into portrait lost the whole submenu tree. */
  const isDesktopSidebarCollapsed = isDesktopSidebarCollapsedRaw && !isMobile;
  /*
   * Memoised: the tree is a recursive filter over the whole menu and was
   * recomputed on every render, including every keystroke elsewhere. */
  const filteredMenuItems = useMemo(() => {
    const roleFiltered = filterMenuTree(
      menuItems,
      '',
      userRole,
      isSuperAdmin,
      isModuleEnabled,
      sensitiveModules
    );
    const ordered = orderBySection(roleFiltered);
    const footerPaths = new Set((userRole ? (footerNavByRole[userRole] ?? []) : []).map((i) => i.path));
    return isMobile ? pruneFooterItems(ordered, footerPaths) : ordered; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, isSuperAdmin, isMobile, JSON.stringify(sensitiveModules)]);
  useEffect(() => {
    setSubmenuOpen(false);
  }, [setSubmenuOpen]);
  useEffect(() => {
    const activeTrail = collectAncestorIds(filteredMenuItems, location.pathname);
    if (activeTrail.length === 0) return;
    setOpenSections((prev) => {
      const next = { ...prev };
      activeTrail.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
  }, [location.pathname, filteredMenuItems]);
  const sidebarFooterItems = useMemo(
    () =>
      filteredMenuItems
        .find((item) => item.id === 'administration')
        ?.children?.filter((item) => item.id === 'mahallu-settings') ?? [],
    [filteredMenuItems]
  );
  const visibleMenuItems = useMemo(() => {
    if (isDesktopSidebarCollapsed || sidebarFooterItems.length === 0) return filteredMenuItems;
    return filteredMenuItems
      .map((item) =>
        item.id === 'administration'
          ? { ...item, children: item.children?.filter((child) => child.id !== 'mahallu-settings') }
          : item
      )
      .filter((item) => !item.children || item.children.length > 0);
  }, [filteredMenuItems, isDesktopSidebarCollapsed, sidebarFooterItems.length]);
  /*
   * The mobile drawer is a dialog: Escape closes it and focus is trapped. */
  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobileSidebarOpen, setMobileSidebarOpen]);
  const handleToggleSection = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  const handleFlyoutToggle = (id: string, anchor: DOMRect, trigger: HTMLElement | null) => {
    setActiveFlyout((current) => (current?.id === id ? null : { id, anchor, trigger }));
  };
  const handleFlyoutClose = () => setActiveFlyout(null);
  const handleNavigate = (fromFlyout = false) => {
    setMobileSidebarOpen(false);
    setActiveFlyout(null);
    if (!isMobile && fromFlyout) {
      setDesktopSidebarCollapsed(true);
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>('[aria-label="Expand navigation"]')?.focus({ preventScroll: true });
      });
    }
  };
  useEffect(() => {
    setActiveFlyout(null);
  }, [location.pathname]);
  return (
    <aside
      ref={asideRef}
      aria-label="Main navigation"
      role={isMobile && isMobileSidebarOpen ? 'dialog' : undefined}
      aria-modal={isMobile && isMobileSidebarOpen ? true : undefined}
      className={cn(
        'fixed left-0 top-0 z-[60] h-screen h-[100dvh] border-r border-border/80 bg-card text-card-foreground',
        'transition-[width,transform] duration-200 ease-out md:translate-x-0',
        /* The drawer never exceeds the viewport: at 320px a fixed 16rem panel
         * left 64px of page, which is not enough to read what is behind it. */
        isDesktopSidebarCollapsed ? 'ml-[5px] w-rail' : 'w-60 max-w-[85vw]',
        isMobileSidebarOpen ? 'translate-x-0 shadow-md' : '-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'flex flex-shrink-0 items-center border-b border-border',
            isDesktopSidebarCollapsed ? 'h-16 justify-center px-2' : 'h-20 gap-2 px-5'
          )}
        >
          {isDesktopSidebarCollapsed ? (
            <button
              type="button"
              onClick={toggleDesktopSidebarCollapsed}
              aria-label="Expand navigation"
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img src={LOGO_PATH} alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
            </button>
          ) : (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-card">
              <img src={LOGO_PATH} alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
            </div>
          )}
          {!isDesktopSidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
                {BRAND_NAME}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {userRole === 'member' ? 'Member portal' : 'Mahallu Management'}
              </p>
            </div>
          )}
          {!isDesktopSidebarCollapsed && !isMobile && (
            <button
              type="button"
              onClick={toggleDesktopSidebarCollapsed}
              aria-label="Collapse navigation"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FiChevronUp className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {isMobileSidebarOpen && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close navigation"
              className="ml-auto rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
            >
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>
        <nav
          aria-label="Modules"
          className={cn(
            'no-scrollbar min-h-0 flex-1 overflow-y-auto',
            isDesktopSidebarCollapsed ? 'px-1 py-2' : 'px-3 py-3'
          )}
        >
          {visibleMenuItems.length === 0 ? (
            <p className="px-2 py-6 text-center text-label text-muted-foreground">No menu items available</p>
          ) : (
            <div className={cn(isDesktopSidebarCollapsed ? 'space-y-1' : 'space-y-3')}>
              {visibleMenuItems.map((item, index) => {
                const sectionLabel = sectionLabelForItem(item);
                const previousSectionLabel =
                  index > 0 ? sectionLabelForItem(visibleMenuItems[index - 1]) : undefined;
                const startsSection = index === 0 || sectionLabel !== previousSectionLabel;

                return (
                    <div
                      key={item.id}
                      className={cn(
                        startsSection && index > 0 && (isDesktopSidebarCollapsed ? 'pt-1' : 'pt-2'),
                        isDesktopSidebarCollapsed && startsSection && index > 0 && 'border-t border-border/70'
                      )}
                    >
                    {!isDesktopSidebarCollapsed && startsSection && (
                      <p className="nav-section-label mb-1 px-2 text-muted-foreground/70">
                        {sectionLabel}
                      </p>
                    )}
                    <MenuNode
                      item={item}
                      depth={0}
                      pathname={location.pathname}
                      openSections={openSections}
                      onToggle={handleToggleSection}
                      onNavigate={handleNavigate}
                      forceOpen={false}
                      isCollapsed={isDesktopSidebarCollapsed}
                      isMobile={isMobile}
                      flyout={activeFlyout}
                      onFlyoutToggle={handleFlyoutToggle}
                      onFlyoutClose={handleFlyoutClose}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </nav>
        {!isDesktopSidebarCollapsed && sidebarFooterItems.length > 0 && (
          <div className="flex-shrink-0 border-t border-border px-3 pb-2 pt-3">
            <p className="nav-section-label mb-1 px-2 text-muted-foreground/70">Others</p>
            <div className="space-y-1">
              {sidebarFooterItems.map((item) => {
                const Icon = item.icon as React.ComponentType<{ className?: string }>;
                const active = Boolean(item.path && matchPath({ path: item.path, end: false }, location.pathname));
                return (
                  <Link
                    key={item.id}
                    to={item.path || '#'}
                    onClick={() => handleNavigate()}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{item.id === 'mahallu-settings' ? 'Settings' : 'Support'}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {!isDesktopSidebarCollapsed && user && (
          <div className="flex-shrink-0 border-t border-border px-3 py-3">
            <Link
              to={userRole === 'member' ? '/member/profile' : '/mahall-main'}
              onClick={() => handleNavigate()}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {(user.name || 'U').charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {user.email || user.phone || 'Account settings'}
                </span>
              </span>
              <FiChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </div>
        )}
        {/* Connectivity is only worth screen space when it is lost. It used to
            occupy a permanent footer block reading "Status / Connected". */}
        {!isOnline && (
          <div
            role="status"
            className="flex flex-shrink-0 items-center gap-2 border-t border-border bg-warning/10 px-3 py-2.5 text-label text-warning"
          >
            <FiWifiOff className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {!isDesktopSidebarCollapsed && <span>Offline — changes will not save</span>}
          </div>
        )}
      </div>
    </aside>
  );
}
