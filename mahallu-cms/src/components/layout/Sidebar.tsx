import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { menuItems, MenuItem } from '@/constants/menuItems';
import type { ModuleKey, SensitiveModuleKey } from '@/constants/modules';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { isMenuItemAccessible, UserRole } from '@/utils/menuAccess';
import { FiChevronDown, FiChevronRight, FiWifiOff, FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { BRAND_NAME, LOGO_PATH } from '@/constants/theme';
import { useLayoutStore } from '@/store/layoutStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { footerNavByRole, useIsMobile } from './MobileFooterNav';
function hasActiveDescendant(item: MenuItem, pathname: string): boolean {
  if (item.path === pathname) return true;
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
    // CEO decision: hidden features stay in code but never appear in navigation. Do not delete underlying pages/routes.
    if ((item as MenuItem & { hidden?: boolean }).hidden) return result;
    if (!isMenuItemAccessible(item, userRole, isSuperAdmin, sensitiveModules)) return result;
    if (!isModuleEnabled(item.moduleKey)) return result;
    const filteredChildren = item.children
      ? filterMenuTree(item.children, userRole, isSuperAdmin, isModuleEnabled, sensitiveModules)
      : undefined;
    if (item.children && (!filteredChildren || filteredChildren.length === 0)) return result;
    result.push({ ...item, children: filteredChildren });
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
/* --------------------------------------------------------------------------- * Submenu flyout (desktop) * * Sections with children never expand the rail vertically on desktop — that * pushed lower sections below the viewport. Clicking a section instead opens * this panel beside the sidebar, positioned from the trigger's own rect so it * works the same whether the rail is collapsed (icon only) or expanded (icon * + label). It is rendered once at the Sidebar level so only one can ever be * open, and it only closes on an explicit signal (outside click, Escape, or a * route change) — never on pointer-leave — so moving from the sidebar into * the panel never flickers. * ------------------------------------------------------------------------- */
function SubmenuFlyout({
  item,
  anchor,
  pathname,
  onNavigate,
}: {
  item: MenuItem;
  anchor: DOMRect;
  pathname: string;
  onNavigate: () => void;
}) {
  const leaves: MenuItem[] = [];
  const walk = (nodes: MenuItem[]) =>
    nodes.forEach((node) => {
      if (node.path) leaves.push(node);
      if (node.children) walk(node.children);
    });
  walk(item.children ?? []);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  /*
   * The flyout portals to document.body, so it sits outside the sidebar's tab
   * order — Tab from the trigger button would otherwise skip straight past it
   * into the page. Moving focus in on open (mirroring the native <select> /
   * menu-button pattern) is what makes it reachable at all from the keyboard. */
  useEffect(() => {
    firstLinkRef.current?.focus();
  }, []);
  return createPortal(
    <div
      role="menu"
      aria-label={item.label}
      data-sidebar-flyout
      style={{
        position: 'fixed',
        top: Math.min(anchor.top, window.innerHeight - 320),
        left: anchor.right + 8,
      }}
      className="z-[70] max-h-80 w-60 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
    >
      <p className="px-3 py-2 text-label font-semibold text-muted-foreground">{item.label}</p>
      {leaves.map((leaf, index) => (
        <Link
          key={leaf.id}
          ref={index === 0 ? firstLinkRef : undefined}
          to={leaf.path!}
          role="menuitem"
          onClick={onNavigate}
          aria-current={leaf.path === pathname ? 'page' : undefined}
          className={cn(
            'block rounded-sm px-3 py-2 text-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
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
  /** True when a section's children belong in a flyout rather than an inline panel. */
  flyoutMode: boolean;
  isFlyoutOpen: boolean;
  onOpenFlyout: (id: string, anchor: DOMRect, trigger: HTMLElement | null) => void;
  onCloseFlyout: () => void;
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
  flyoutMode,
  isFlyoutOpen,
  onOpenFlyout,
  onCloseFlyout,
}: MenuNodeProps) {
  const Icon = item.icon as React.ComponentType<{ className?: string }>;
  const hasChildren = Boolean(item.children?.length);
  const isActive = item.path === pathname;
  const isBranchActive = hasActiveDescendant(item, pathname);
  const isOpen = hasChildren ? !flyoutMode && (forceOpen || openSections[item.id]) : false;
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  /*
   * Desktop fit: 11 top-level items must fit in 768px without scroll.
   * min-h-9 (36px) keeps 36px touch floor with py-1.5, saving ~8px per row vs 44px. */
  const rowBase =
    'group flex w-full min-h-9 items-center gap-2 rounded-md py-1.5 transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
  const indent = depth === 0 ? 'pl-2.5 pr-2' : depth === 1 ? 'pl-8 pr-2' : 'pl-10 pr-2';
  const textSize = depth === 0 ? 'text-sm' : 'text-label';
  if (isCollapsed && depth > 0) return null;
  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          ref={buttonRef}
          type="button"
          data-sidebar-flyout
          onClick={() => {
            if (flyoutMode) {
              if (isFlyoutOpen) {
                onCloseFlyout();
                return;
              }
              const box = buttonRef.current?.getBoundingClientRect();
              if (box) onOpenFlyout(item.id, box, buttonRef.current);
              return;
            }
            onToggle(item.id);
          }}
          aria-expanded={flyoutMode ? isFlyoutOpen : isOpen}
          aria-controls={flyoutMode ? undefined : panelId}
          aria-haspopup={flyoutMode ? 'menu' : undefined}
          className={cn(
            rowBase,
            isCollapsed && depth === 0 ? 'justify-center px-2' : indent,
            isFlyoutOpen && 'bg-accent',
            isBranchActive
              ? 'text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          title={isCollapsed ? item.label : undefined}
          aria-label={isCollapsed ? item.label : undefined}
        >
          <span
            className={cn(
              'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-colors',
              isBranchActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}
            aria-hidden="true"
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          {!isCollapsed && (
            <>
              <span className={cn('min-w-0 flex-1 text-left font-medium leading-tight', textSize)}>
                {item.label}
              </span>
              {flyoutMode ? (
                <FiChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              ) : isOpen ? (
                <FiChevronDown className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              ) : (
                <FiChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              )}
            </>
          )}
        </button>
        {!flyoutMode && (
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
                flyoutMode={flyoutMode}
                isFlyoutOpen={false}
                onOpenFlyout={onOpenFlyout}
                onCloseFlyout={onCloseFlyout}
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
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-colors',
          isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      {!isCollapsed && <span className={cn('min-w-0 leading-tight', textSize)}>{item.label}</span>}
    </Link>
  );
}
export default function Sidebar() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openFlyout, setOpenFlyout] = useState<{
    id: string;
    anchor: DOMRect;
    trigger: HTMLElement | null;
  } | null>(null);
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
  /*
   * Memoised: the tree is a recursive filter over the whole menu and was
   * recomputed on every render, including every keystroke elsewhere. */
  const filteredMenuItems = useMemo(() => {
    const roleFiltered = filterMenuTree(menuItems, userRole, isSuperAdmin, isModuleEnabled, sensitiveModules);
    const footerPaths = new Set((userRole ? (footerNavByRole[userRole] ?? []) : []).map((i) => i.path));
    return isMobile ? pruneFooterItems(roleFiltered, footerPaths) : roleFiltered; // eslint-disable-next-line react-hooks/exhaustive-deps
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
  /*
   * The flyout closes only on an explicit signal — outside click, Escape, or
   * a route change — never on pointer-leave, so crossing the gap between the
   * sidebar and the panel never flickers it shut. */
  useEffect(() => {
    if (!openFlyout) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-sidebar-flyout]')) return;
      setOpenFlyout(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const trigger = openFlyout.trigger;
      setOpenFlyout(null);
      trigger?.focus();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openFlyout]);
  useEffect(() => {
    setOpenFlyout(null);
  }, [location.pathname]);
  const handleToggleSection = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  const handleNavigate = () => setMobileSidebarOpen(false);
  const flyoutMode = !isMobile;
  const openFlyoutItem = openFlyout ? filteredMenuItems.find((item) => item.id === openFlyout.id) : undefined;
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
            'flex h-14 flex-shrink-0 items-center border-b border-border',
            isDesktopSidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
          )}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted">
            <img src={LOGO_PATH} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
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
        <nav
          aria-label="Modules"
          className={cn(
            'no-scrollbar flex-1 overflow-y-auto py-2',
            isDesktopSidebarCollapsed ? 'px-2' : 'px-3'
          )}
        >
          {filteredMenuItems.length === 0 ? (
            <p className="px-2 py-6 text-center text-label text-muted-foreground">No menu items available</p>
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
                  forceOpen={false}
                  isCollapsed={isDesktopSidebarCollapsed}
                  flyoutMode={flyoutMode}
                  isFlyoutOpen={openFlyout?.id === item.id}
                  onOpenFlyout={(id, anchor, trigger) => setOpenFlyout({ id, anchor, trigger })}
                  onCloseFlyout={() => setOpenFlyout(null)}
                />
              ))}
            </div>
          )}
        </nav>
        {openFlyoutItem && (
          <SubmenuFlyout
            item={openFlyoutItem}
            anchor={openFlyout!.anchor}
            pathname={location.pathname}
            onNavigate={() => {
              handleNavigate();
              setOpenFlyout(null);
            }}
          />
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
