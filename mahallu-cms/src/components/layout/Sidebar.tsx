import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { menuItems, MenuItem } from '@/constants/menuItems';
import type { ModuleKey, SensitiveModuleKey } from '@/constants/modules';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { FiChevronDown, FiChevronRight, FiSearch, FiWifiOff, FiX } from 'react-icons/fi';
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
  if (item.path === pathname) return true;
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
    if (item.path === pathname) return nextTrail;
    if (item.children) {
      const childTrail = collectAncestorIds(item.children, pathname, nextTrail);
      if (childTrail.length > 0) return childTrail;
    }
  }
  return [];
}
function collectExpandableIds(items: MenuItem[]): string[] {
  return items.flatMap((item) =>
    item.children?.length ? [item.id, ...collectExpandableIds(item.children)] : []
  );
} /* --------------------------------------------------------------------------- * Collapsed flyout * * When the rail is collapsed, child items used to `return null` with no * alternative, so every nested destination became unreachable and clicking a * group merely re-expanded the rail. The flyout restores the whole tree. * ------------------------------------------------------------------------- */
function CollapsedFlyout({
  item,
  anchor,
  pathname,
  onNavigate,
  onClose,
}: {
  item: MenuItem;
  anchor: DOMRect;
  pathname: string;
  onNavigate: () => void;
  onClose: () => void;
}) {
  const leaves: MenuItem[] = [];
  const walk = (nodes: MenuItem[]) =>
    nodes.forEach((node) => {
      if (node.path) leaves.push(node);
      if (node.children) walk(node.children);
    });
  walk(item.children ?? []);
  return createPortal(
    <div
      role="menu"
      aria-label={item.label}
      style={{
        position: 'fixed',
        top: Math.min(anchor.top, window.innerHeight - 320),
        left: anchor.right + 8,
      }}
      onMouseLeave={onClose}
      className="z-[70] max-h-80 w-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
    >
      <p className="px-3 py-2 text-label font-semibold text-muted-foreground">{item.label}</p>
      {leaves.map((leaf) => (
        <Link
          key={leaf.id}
          to={leaf.path!}
          role="menuitem"
          onClick={() => {
            onNavigate();
            onClose();
          }}
          aria-current={leaf.path === pathname ? 'page' : undefined}
          className={cn(
            'block rounded-sm px-3 py-2 text-sm transition-colors',
            leaf.path === pathname
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          {leaf.label}
        </Link>
      ))}
    </div>,
    document.body
  );
}
interface MenuNodeProps {
  item: MenuItem;
  depth: number;
  pathname: string;
  openSections: Record<string, boolean>;
  onToggle: (id: string) => void;
  onNavigate: () => void;
  forceOpen: boolean;
  isCollapsed: boolean;
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
}: MenuNodeProps) {
  const Icon = item.icon as React.ComponentType<{ className?: string }>;
  const hasChildren = Boolean(item.children?.length);
  const isActive = item.path === pathname;
  const isBranchActive = hasActiveDescendant(item, pathname);
  const isOpen = hasChildren ? !isCollapsed && (forceOpen || openSections[item.id]) : false;
  const panelId = useId();
  const [flyout, setFlyout] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /*
   * Navigation text sits on the type scale: 14px top level, 13px children.
   * It used to render at 11.5px and 10.9px, below the readability floor.
   * Rows are min-h-11 (44px) so they clear the touch-target minimum. */
  const rowBase =
    'group flex w-full min-h-11 items-center gap-2.5 rounded-md py-2 transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
  const indent = depth === 0 ? 'pl-3 pr-2' : depth === 1 ? 'pl-9 pr-2' : 'pl-12 pr-2';
  const textSize = depth === 0 ? 'text-sm' : 'text-label';
  if (isCollapsed && depth > 0) return null;
  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            if (isCollapsed) {
              const box = buttonRef.current?.getBoundingClientRect();
              setFlyout((current) => (current ? null : (box ?? null)));
              return;
            }
            onToggle(item.id);
          }}
          onMouseEnter={() => {
            if (isCollapsed) setFlyout(buttonRef.current?.getBoundingClientRect() ?? null);
          }}
          aria-expanded={isCollapsed ? Boolean(flyout) : isOpen}
          aria-controls={isCollapsed ? undefined : panelId}
          aria-haspopup={isCollapsed ? 'menu' : undefined}
          className={cn(
            rowBase,
            isCollapsed && depth === 0 ? 'justify-center px-2' : indent,
            isBranchActive
              ? 'text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          title={isCollapsed ? item.label : undefined}
          aria-label={isCollapsed ? item.label : undefined}
        >
          <span
            className={cn(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors',
              isBranchActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
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
        </button>
        {isCollapsed && flyout && (
          <CollapsedFlyout
            item={item}
            anchor={flyout}
            pathname={pathname}
            onNavigate={onNavigate}
            onClose={() => setFlyout(null)}
          />
        )}
        {!isCollapsed && (
          <div id={panelId} hidden={!isOpen} className="space-y-1 pb-1">
            {item.children?.map((child) => (
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
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <Link
      to={item.path || '#'}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        rowBase,
        isCollapsed && depth === 0 ? 'justify-center px-2' : indent,
        isActive
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
      title={isCollapsed ? item.label : undefined}
    >
      <span
        className={cn(
          'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors',
          isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      {!isCollapsed && <span className={cn('min-w-0 leading-tight', textSize)}>{item.label}</span>}
    </Link>
  );
}
export default function Sidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const asideRef = useRef<HTMLElement>(null);
  const setSubmenuOpen = useLayoutStore((s) => s.setSubmenuOpen);
  const isMobileSidebarOpen = useLayoutStore((s) => s.isMobileSidebarOpen);
  const setMobileSidebarOpen = useLayoutStore((s) => s.setMobileSidebarOpen);
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
  const searchId = useId();
  /*
   * Memoised: the tree is a recursive filter over the whole menu and was
   * recomputed on every render, including every keystroke elsewhere. */
  const filteredMenuItems = useMemo(() => {
    const roleFiltered = filterMenuTree(
      menuItems,
      searchQuery,
      userRole,
      isSuperAdmin,
      isModuleEnabled,
      sensitiveModules
    );
    const footerPaths = new Set((userRole ? (footerNavByRole[userRole] ?? []) : []).map((i) => i.path));
    return isMobile ? pruneFooterItems(roleFiltered, footerPaths) : roleFiltered; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, userRole, isSuperAdmin, isMobile, JSON.stringify(sensitiveModules)]);
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
  useEffect(() => {
    if (!searchQuery.trim()) return;
    setOpenSections(
      collectExpandableIds(filteredMenuItems).reduce<Record<string, boolean>>((acc, id) => {
        acc[id] = true;
        return acc;
      }, {})
    );
  }, [searchQuery, filteredMenuItems]);
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
  const handleNavigate = () => setMobileSidebarOpen(false);
  return (
    <aside
      ref={asideRef}
      aria-label="Main navigation"
      role={isMobile && isMobileSidebarOpen ? 'dialog' : undefined}
      aria-modal={isMobile && isMobileSidebarOpen ? true : undefined}
      className={cn(
        'fixed left-0 top-0 z-[60] h-screen h-[100dvh] border-r border-border bg-card text-card-foreground',
        'transition-[width,transform] duration-200 ease-out md:translate-x-0',
        /* The drawer never exceeds the viewport: at 320px a fixed 16rem panel
         * left 64px of page, which is not enough to read what is behind it. */
        isDesktopSidebarCollapsed ? 'w-rail' : 'w-64 max-w-[85vw]',
        isMobileSidebarOpen ? 'translate-x-0 shadow-md' : '-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">
        <div
          className={cn(
            /* h-16, the same height as the app header beside it, so the
             * product name and the page chrome sit on one line across the top
             * of the window instead of two that nearly agree. */
            'flex h-16 flex-shrink-0 items-center border-b border-border',
            isDesktopSidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
          )}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-muted">
            <img src={LOGO_PATH} alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
          </div>
          {!isDesktopSidebarCollapsed && (
            <div className="min-w-0 flex-1">
              {/* 18px. The product name was 16px under 24px page titles, so
                  the application read as a caption on its own screen. */}
              <p className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground">
                {BRAND_NAME}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {userRole === 'member' ? 'Member portal' : 'Admin'}
              </p>
            </div>
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
        {!isDesktopSidebarCollapsed && (
          <div className="px-3 pt-3">
            <label htmlFor={searchId} className="sr-only">
              Search menu
            </label>
            <div className="relative">
              <FiSearch
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                aria-label="Search menu"
                id={searchId}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search menu"
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        )}
        <nav
          aria-label="Modules"
          className={cn(
            'no-scrollbar flex-1 overflow-y-auto py-3',
            isDesktopSidebarCollapsed ? 'px-2' : 'px-3'
          )}
        >
          {filteredMenuItems.length === 0 ? (
            <p className="px-2 py-6 text-center text-label text-muted-foreground">
              No menu items match your search
            </p>
          ) : (
            <div className="space-y-1">
              {filteredMenuItems.map((item) => (
                <MenuNode
                  key={item.id}
                  item={item}
                  depth={0}
                  pathname={location.pathname}
                  openSections={openSections}
                  onToggle={handleToggleSection}
                  onNavigate={handleNavigate}
                  forceOpen={Boolean(searchQuery.trim())}
                  isCollapsed={isDesktopSidebarCollapsed}
                />
              ))}
            </div>
          )}
        </nav>
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
