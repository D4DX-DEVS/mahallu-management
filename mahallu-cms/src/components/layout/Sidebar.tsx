import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiExpandLeftLine,
  RiWifiOffLine,
} from 'react-icons/ri';
import { menuItems, MenuItem } from '@/constants/menuItems';
import type { ModuleKey, SensitiveModuleKey } from '@/constants/modules';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { isMenuItemAccessible, UserRole } from '@/utils/menuAccess';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { BRAND_NAME, LOGO_PATH } from '@/constants/theme';
import { useLayoutStore } from '@/store/layoutStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { footerNavByRole, useIsMobile } from './MobileFooterNav';

type IconComponent = React.ComponentType<{ className?: string }>;

function isPathActive(path: string | undefined, pathname: string): boolean {
  return Boolean(path && matchPath({ path, end: false }, pathname));
}

function hasActiveDescendant(item: MenuItem, pathname: string): boolean {
  if (isPathActive(item.path, pathname)) return true;
  return item.children?.some((child) => hasActiveDescendant(child, pathname)) ?? false;
}

function filterMenuTree(
  items: MenuItem[],
  userRole: UserRole | null,
  isSuperAdmin: boolean,
  isModuleEnabled: (moduleKey?: ModuleKey) => boolean,
  sensitiveModules: SensitiveModuleKey[]
): MenuItem[] {
  return items.reduce<MenuItem[]>((result, item) => {
    // Support is a profile action, not a navigation module.
    if (item.id === 'support') return result;
    // CEO decision: hidden features stay in code but never appear in navigation. Do not delete underlying pages/routes.
    if ((item as MenuItem & { hidden?: boolean }).hidden) return result;
    if (!isMenuItemAccessible(item, userRole, isSuperAdmin, sensitiveModules)) return result;
    if (!isModuleEnabled(item.moduleKey)) return result;
    const children = item.children
      ? filterMenuTree(item.children, userRole, isSuperAdmin, isModuleEnabled, sensitiveModules)
      : undefined;
    if (item.children && (!children || children.length === 0)) return result;
    result.push({ ...item, children });
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

/* The heading over a run of modules. Three of the five section names used to
 * repeat the module directly beneath them ("Community" over "Community",
 * "Services" over "Services"), so the heading read as a duplicate row. The
 * headings now name the area, the rows name the module. */
const SECTION_LABELS: Record<string, string> = {
  Overview: 'Main',
  Community: 'Workspace',
  Services: 'Services & records',
  Administration: 'Management',
};

function sectionLabelForItem(item: MenuItem): string {
  return SECTION_LABELS[item.section ?? ''] ?? item.section ?? 'Navigation';
}

/* Sub-groups inside a long submenu. Kept in the shell so the menu data stays
 * route-focused and role filtering can drop entries without breaking groups. */
const MENU_GROUPS: Record<string, Record<string, string>> = {
  'member-space': {
    'member-overview': 'Overview',
    'member-profile': 'Overview',
    'member-family': 'Overview',
    'member-varisangya-portal': 'Payments',
    'member-payments': 'Payments',
    // Not "Requests": a group named "Requests" holding one row named "Requests" read as one label printed twice.
    'member-requests': 'Submissions',
    'member-noc-list': 'Documents',
    'member-certificates': 'Documents',
  },
  'member-apply': { 'member-noc-request': 'Requests', 'member-nikah-request': 'Requests', 'member-death-request': 'Requests' },
  community: {
    families: 'People & registers',
    members: 'People & registers',
    registers: 'People & registers',
    // Not "Survey": a group named "Survey" holding a row named "Survey" read as one label printed twice.
    survey: 'Field survey',
    'locality-facilities': 'Field survey',
    clusters: 'Field survey',
    mosque: 'Operations',
    'mahallu-committee': 'Operations',
    committees: 'Operations',
    meetings: 'Operations',
    programs: 'Operations',
    assets: 'Operations',
    'development-projects': 'Operations',
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
    groups.set(label, [...(groups.get(label) ?? []), child]);
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

/* --------------------------------------------------------------------------
 * Shared row styles
 *
 * Four tiers, each told apart by more than colour:
 *
 *   1. Section heading — 11px bold capitals with a trailing hairline. The only
 *      thing in the panel set in capitals.
 *   2. Module row — 40px, 14px semibold, with its icon in a tile. The heaviest
 *      thing in the panel, so it reads as the thing you pick.
 *   3. Group label — 12px semibold sentence case, inside the submenu. A heading
 *      for the rows below it, never a row itself.
 *   4. Leaf — 13px regular, indented under its group. The active leaf is the
 *      one tinted pill in the tree.
 *
 * The active module carries a solid brand tile and the short indicator pinned
 * to the panel's left edge; a branch that only contains the current page keeps
 * a tinted tile, so "you are inside this group" and "you are on this row" differ.
 * ------------------------------------------------------------------------ */
const ROW =
  'group relative flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-sm font-semibold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
const ROW_IDLE = 'text-foreground/80 hover:bg-subtle hover:text-foreground';
const ROW_ACTIVE = 'bg-primary/10 text-foreground';

type TileTone = 'idle' | 'branch' | 'active';

function IconTile({ icon: Icon, tone }: { icon: IconComponent; tone: TileTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors',
        tone === 'active' && 'bg-primary text-primary-foreground shadow-sm',
        tone === 'branch' && 'bg-primary/10 text-primary',
        tone === 'idle' && 'bg-subtle text-muted-foreground group-hover:bg-card group-hover:text-foreground group-hover:shadow-sm'
      )}
    >
      <Icon className="h-[17px] w-[17px]" />
    </span>
  );
}

function EdgeIndicator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('absolute -left-4 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary', className)}
    />
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2.5 px-2.5">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 pr-1">
      <p className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">{label}</p>
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Submenu list — the tree under an open branch, or inside the rail popover.
 * ------------------------------------------------------------------------ */
function SubmenuLinks({
  parent,
  pathname,
  onNavigate,
  variant,
  linkRef,
  onLinkKeyDown,
}: {
  parent: MenuItem;
  pathname: string;
  onNavigate: () => void;
  variant: 'tree' | 'popover';
  linkRef?: (index: number, node: HTMLAnchorElement | null) => void;
  onLinkKeyDown?: (index: number, event: React.KeyboardEvent<HTMLAnchorElement>) => void;
}) {
  const groups = groupChildren(parent.id, parent.children);
  const showLabels = groups.length > 1;
  /* Only the most specific match is active: /committees/meetings must not
   * also light up /committees. */
  const activeLeafId = (parent.children ?? [])
    .filter((child) => isPathActive(child.path, pathname))
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0]?.id;
  let flatIndex = -1;
  return (
    <>
      {groups.map((group, groupIndex) => (
        <div
          key={group.label}
          role="group"
          aria-label={showLabels ? group.label : undefined}
          className={cn(groupIndex > 0 && 'mt-3')}
        >
          {showLabels && <GroupLabel label={group.label} />}
          <ul className={cn('space-y-0.5', showLabels && variant === 'tree' && 'pl-2')}>
            {group.items.map((leaf) => {
              flatIndex += 1;
              const index = flatIndex;
              const active = leaf.id === activeLeafId;
              const LeafIcon = leaf.icon as IconComponent;
              return (
                <li key={leaf.id} className="relative">
                  {variant === 'tree' && active && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary',
                        // Sits on the tree line: its padding, 1px border and the group indent.
                        showLabels ? '-left-[25px]' : '-left-[17px]'
                      )}
                    />
                  )}
                  <Link
                    ref={(node) => linkRef?.(index, node)}
                    to={leaf.path || '#'}
                    role={variant === 'popover' ? 'menuitem' : undefined}
                    onClick={onNavigate}
                    onKeyDown={(event) => onLinkKeyDown?.(index, event)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                      variant === 'tree' ? 'h-8' : 'h-9',
                      active
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-foreground/75 hover:bg-subtle hover:text-foreground'
                    )}
                  >
                    {variant === 'popover' && (
                      <LeafIcon
                        className={cn('h-4 w-4 flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
                      />
                    )}
                    {/* The size sits on the span: tailwind-merge reads an unknown `text-label` beside
                        a `text-primary` colour as a clash and would drop one. */}
                    <span className="min-w-0 truncate text-label">{leaf.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

/* --------------------------------------------------------------------------
 * Rail popover — the submenu for a branch while the panel is collapsed.
 * Floats over the page beside the rail; the content never shifts for it.
 * ------------------------------------------------------------------------ */
function RailPopover({
  item,
  anchor,
  pathname,
  onNavigate,
  onClose,
  trigger,
}: {
  item: MenuItem;
  anchor: DOMRect;
  pathname: string;
  onNavigate: () => void;
  onClose: () => void;
  trigger: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const links = useRef<Array<HTMLAnchorElement | null>>([]);
  const [top, setTop] = useState(anchor.top);

  // Clamp into the viewport once the real height is known.
  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 0;
    setTop(Math.max(8, Math.min(anchor.top - 8, window.innerHeight - height - 8)));
  }, [anchor.top]);

  useEffect(() => {
    links.current[0]?.focus();
  }, []);

  const close = useCallback(() => {
    onClose();
    trigger?.focus({ preventScroll: true });
  }, [onClose, trigger]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !trigger?.contains(target)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [close, onClose, trigger]);

  const Icon = item.icon as IconComponent;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={item.label}
      style={{ position: 'fixed', top, left: anchor.right + 12, maxHeight: 'calc(100dvh - 16px)' }}
      className="z-[70] w-60 overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-md animate-fade-in"
    >
      <div className="mb-1 flex items-center gap-2.5 border-b border-border px-2.5 pb-2.5 pt-1">
        <Icon className="h-[18px] w-[18px] text-primary" />
        <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
      </div>
      <SubmenuLinks
        parent={item}
        pathname={pathname}
        onNavigate={onNavigate}
        variant="popover"
        linkRef={(index, node) => {
          links.current[index] = node;
        }}
        onLinkKeyDown={(index, event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const total = links.current.filter(Boolean).length;
          const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + total) % total;
          links.current[next]?.focus();
        }}
      />
    </div>,
    document.body
  );
}

/* --------------------------------------------------------------------------
 * One top-level entry: a link, or a branch that opens its submenu inline.
 * ------------------------------------------------------------------------ */
interface NavEntryProps {
  item: MenuItem;
  pathname: string;
  isCollapsed: boolean;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onNavigate: () => void;
  popoverOpen: boolean;
  onPopoverToggle: (id: string, anchor: DOMRect, trigger: HTMLElement | null) => void;
  onPopoverClose: () => void;
  popoverAnchor: DOMRect | null;
  popoverTrigger: HTMLElement | null;
}

function NavEntry({
  item,
  pathname,
  isCollapsed,
  isOpen,
  onToggle,
  onNavigate,
  popoverOpen,
  onPopoverToggle,
  onPopoverClose,
  popoverAnchor,
  popoverTrigger,
}: NavEntryProps) {
  const Icon = item.icon as IconComponent;
  const hasChildren = Boolean(item.children?.length);
  const branchActive = hasActiveDescendant(item, pathname);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (isCollapsed) {
    const highlighted = branchActive || popoverOpen;
    const railClass = cn(
      'relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      highlighted ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-subtle hover:text-foreground'
    );
    const indicator = branchActive && <EdgeIndicator className="-left-4" />;
    if (!hasChildren) {
      return (
        <Link
          to={item.path || '#'}
          onClick={onNavigate}
          aria-current={branchActive ? 'page' : undefined}
          aria-label={item.label}
          title={item.label}
          className={railClass}
        >
          {indicator}
          <Icon className="h-[18px] w-[18px] flex-shrink-0" />
        </Link>
      );
    }
    return (
      <>
        <button
          ref={buttonRef}
          type="button"
          aria-label={item.label}
          title={item.label}
          aria-haspopup="menu"
          aria-expanded={popoverOpen}
          onClick={() => {
            const box = buttonRef.current?.getBoundingClientRect();
            if (box) onPopoverToggle(item.id, box, buttonRef.current);
          }}
          className={railClass}
        >
          {indicator}
          <Icon className="h-[18px] w-[18px] flex-shrink-0" />
        </button>
        {popoverOpen && popoverAnchor && (
          <RailPopover
            item={item}
            anchor={popoverAnchor}
            pathname={pathname}
            onNavigate={onNavigate}
            onClose={onPopoverClose}
            trigger={popoverTrigger}
          />
        )}
      </>
    );
  }

  if (!hasChildren) {
    return (
      <Link
        to={item.path || '#'}
        onClick={onNavigate}
        aria-current={branchActive ? 'page' : undefined}
        className={cn(ROW, branchActive ? ROW_ACTIVE : ROW_IDLE)}
      >
        {branchActive && <EdgeIndicator />}
        <IconTile icon={Icon} tone={branchActive ? 'active' : 'idle'} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={cn(ROW, branchActive && !isOpen ? ROW_ACTIVE : ROW_IDLE, isOpen && 'text-foreground')}
      >
        {branchActive && <EdgeIndicator />}
        <IconTile icon={Icon} tone={branchActive || isOpen ? 'branch' : 'idle'} />
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        <RiArrowDownSLine
          className={cn(
            'h-[18px] w-[18px] flex-shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen ? 'rotate-0' : '-rotate-90'
          )}
          aria-hidden="true"
        />
      </button>
      {/* grid-rows 0fr -> 1fr animates to the panel's natural height. */}
      <div
        id={panelId}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
        aria-hidden={!isOpen}
        // Closed panels stay mounted for the animation; inert keeps their links out of the tab order.
        ref={(node) => {
          if (node) node.toggleAttribute('inert', !isOpen);
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="relative ml-6 mt-0.5 border-l border-border py-1 pl-4">
            <SubmenuLinks parent={item} pathname={pathname} onNavigate={onNavigate} variant="tree" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface PopoverState {
  id: string;
  anchor: DOMRect;
  trigger: HTMLElement | null;
}

export default function Sidebar() {
  const location = useLocation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const isMobileSidebarOpen = useLayoutStore((s) => s.isMobileSidebarOpen);
  const setMobileSidebarOpen = useLayoutStore((s) => s.setMobileSidebarOpen);
  const toggleDesktopSidebarCollapsed = useLayoutStore((s) => s.toggleDesktopSidebarCollapsed);
  const isDesktopSidebarCollapsedRaw = useLayoutStore((s) => s.isDesktopSidebarCollapsed);
  const isOnline = useOnlineStatus();
  const { isSuperAdmin, user, currentTenantId, isImpersonating } = useAuthStore();
  // MainLayout reserves 36px at the top for the tenant / impersonation banner.
  const hasTopBanner = Boolean((isSuperAdmin && currentTenantId) || isImpersonating);
  const userRole = (user?.role || (isSuperAdmin ? 'super_admin' : null)) as UserRole | null;
  const { isModuleEnabled } = useModuleAccess();
  const sensitiveModules = user?.permissions?.sensitiveModules ?? [];
  const isMobile = useIsMobile();
  // The collapsed rail is a desktop affordance only.
  const isCollapsed = isDesktopSidebarCollapsedRaw && !isMobile;

  const filteredMenuItems = useMemo(() => {
    const ordered = orderBySection(
      filterMenuTree(menuItems, userRole, isSuperAdmin, isModuleEnabled, sensitiveModules)
    );
    const footerPaths = new Set((userRole ? (footerNavByRole[userRole] ?? []) : []).map((i) => i.path));
    return isMobile ? pruneFooterItems(ordered, footerPaths) : ordered; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, isSuperAdmin, isMobile, JSON.stringify(sensitiveModules)]);

  /* Settings lives in the panel footer, as in the reference layout, and is
   * lifted out of Administration so it is not listed twice. */
  const settingsItem = useMemo(
    () =>
      filteredMenuItems
        .find((item) => item.id === 'administration')
        ?.children?.find((item) => item.id === 'mahallu-settings'),
    [filteredMenuItems]
  );
  const visibleMenuItems = useMemo(() => {
    if (!settingsItem) return filteredMenuItems;
    return filteredMenuItems
      .map((item) =>
        item.id === 'administration'
          ? { ...item, children: item.children?.filter((child) => child.id !== 'mahallu-settings') }
          : item
      )
      .filter((item) => !item.children || item.children.length > 0);
  }, [filteredMenuItems, settingsItem]);

  // One branch open at a time: the one holding the current page.
  useEffect(() => {
    const activeBranch = visibleMenuItems.find(
      (item) => item.children?.length && hasActiveDescendant(item, location.pathname)
    );
    if (activeBranch) setOpenId(activeBranch.id);
    setPopover(null);
  }, [location.pathname, visibleMenuItems]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobileSidebarOpen, setMobileSidebarOpen]);

  const handleNavigate = () => {
    setMobileSidebarOpen(false);
    setPopover(null);
  };
  const handleToggle = (id: string) => setOpenId((current) => (current === id ? null : id));
  const handlePopoverToggle = (id: string, anchor: DOMRect, trigger: HTMLElement | null) =>
    setPopover((current) => (current?.id === id ? null : { id, anchor, trigger }));
  const handlePopoverClose = useCallback(() => setPopover(null), []);

  const settingsActive = isPathActive(settingsItem?.path, location.pathname);
  const SettingsIcon = settingsItem?.icon as IconComponent | undefined;
  const initials = (user?.name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <aside
      aria-label="Main navigation"
      role={isMobile && isMobileSidebarOpen ? 'dialog' : undefined}
      aria-modal={isMobile && isMobileSidebarOpen ? true : undefined}
      className={cn(
        'fixed left-0 z-[60] border-r border-border bg-card text-card-foreground',
        hasTopBanner ? 'top-9 h-[calc(100dvh-2.25rem)]' : 'top-0 h-screen h-[100dvh]',
        'transition-[width,transform] duration-200 ease-out md:translate-x-0',
        isCollapsed ? 'w-rail' : 'w-sidebar max-w-[85vw]',
        isMobileSidebarOpen ? 'translate-x-0 shadow-md' : '-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">
        {/* ---- Brand ---------------------------------------------------- */}
        <div className={cn('flex-shrink-0', isCollapsed ? 'px-3' : 'px-5')}>
          <div
            className={cn(
              'flex items-center border-b border-border',
              // Level with the app header, which is 64px beside the rail and 80px beside the panel.
              isCollapsed ? 'h-16 justify-center' : 'h-16 gap-3 md:h-20'
            )}
          >
            {isCollapsed ? (
              <button
                type="button"
                onClick={toggleDesktopSidebarCollapsed}
                aria-label="Expand navigation"
                title="Expand navigation"
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img src={LOGO_PATH} alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
              </button>
            ) : (
              <>
                <img src={LOGO_PATH} alt="" aria-hidden="true" className="h-10 w-10 flex-shrink-0 rounded-full object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-5 text-foreground">{BRAND_NAME}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {userRole === 'member' ? 'Member portal' : 'Mahallu Management'}
                  </p>
                </div>
                {isMobile ? (
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    aria-label="Close navigation"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground shadow-sm transition-colors hover:bg-subtle hover:text-foreground"
                  >
                    <RiCloseLine className="h-[18px] w-[18px]" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={toggleDesktopSidebarCollapsed}
                    aria-label="Collapse navigation"
                    title="Collapse navigation"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground shadow-sm transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RiExpandLeftLine className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ---- Modules -------------------------------------------------- */}
        <nav
          aria-label="Modules"
          className={cn('no-scrollbar min-h-0 flex-1 overflow-y-auto', isCollapsed ? 'px-3 py-4' : 'px-4 py-5')}
        >
          {visibleMenuItems.length === 0 ? (
            <p className="px-2 py-6 text-center text-label text-muted-foreground">No menu items available</p>
          ) : (
            visibleMenuItems.map((item, index) => {
              const label = sectionLabelForItem(item);
              const startsSection = index === 0 || label !== sectionLabelForItem(visibleMenuItems[index - 1]);
              return (
                <div key={item.id} className={cn('mt-1', startsSection && index > 0 && (isCollapsed ? 'mt-3 border-t border-border pt-3' : 'mt-7'))}>
                  {!isCollapsed && startsSection && <SectionHeading label={label} />}
                  <NavEntry
                    item={item}
                    pathname={location.pathname}
                    isCollapsed={isCollapsed}
                    isOpen={openId === item.id}
                    onToggle={handleToggle}
                    onNavigate={handleNavigate}
                    popoverOpen={popover?.id === item.id}
                    onPopoverToggle={handlePopoverToggle}
                    onPopoverClose={handlePopoverClose}
                    popoverAnchor={popover?.id === item.id ? popover.anchor : null}
                    popoverTrigger={popover?.id === item.id ? popover.trigger : null}
                  />
                </div>
              );
            })
          )}
        </nav>

        {/* ---- Footer: settings + account ------------------------------ */}
        {settingsItem && SettingsIcon && (
          <div className={cn('flex-shrink-0 pb-3', isCollapsed ? 'px-3' : 'px-4')}>
            <Link
              to={settingsItem.path || '#'}
              onClick={handleNavigate}
              aria-current={settingsActive ? 'page' : undefined}
              aria-label={isCollapsed ? 'Settings' : undefined}
              title={isCollapsed ? 'Settings' : undefined}
              className={cn(
                isCollapsed
                  ? 'relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors'
                  : ROW,
                settingsActive
                  ? cn(ROW_ACTIVE, isCollapsed && 'text-primary')
                  : isCollapsed
                    ? 'text-muted-foreground hover:bg-subtle hover:text-foreground'
                    : ROW_IDLE
              )}
            >
              {settingsActive && <EdgeIndicator />}
              {isCollapsed ? (
                <SettingsIcon className="h-[18px] w-[18px] flex-shrink-0" />
              ) : (
                <IconTile icon={SettingsIcon} tone={settingsActive ? 'active' : 'idle'} />
              )}
              {!isCollapsed && <span className="min-w-0 flex-1 truncate">Settings</span>}
            </Link>
          </div>
        )}

        {user && (
          <div className={cn('flex-shrink-0', isCollapsed ? 'px-3' : 'px-5')}>
            <Link
              to={userRole === 'member' ? '/member/profile' : '/mahall-main'}
              onClick={handleNavigate}
              title={isCollapsed ? user.name : undefined}
              className={cn(
                'flex items-center border-t border-border py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isCollapsed ? 'justify-center' : 'gap-3'
              )}
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initials}
              </span>
              {!isCollapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email || user.phone || 'Account settings'}
                    </span>
                  </span>
                  <RiArrowRightSLine className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                </>
              )}
            </Link>
          </div>
        )}

        {/* Connectivity is only worth screen space when it is lost. */}
        {!isOnline && (
          <div
            role="status"
            className="flex flex-shrink-0 items-center gap-2 border-t border-border bg-warning/10 px-4 py-2.5 text-label text-warning"
          >
            <RiWifiOffLine className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {!isCollapsed && <span>Offline — changes will not save</span>}
          </div>
        )}
      </div>
    </aside>
  );
}
