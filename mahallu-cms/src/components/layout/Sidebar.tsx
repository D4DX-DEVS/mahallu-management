import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { menuItems, MenuItem } from '@/constants/menuItems';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { BRAND_NAME, LOGO_PATH } from '@/constants/theme';
import { useLayoutStore } from '@/store/layoutStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { filterAccessible, type UserRole } from './sidebar/navModel';
import { useMediaQuery, useSidebarState } from './sidebar/useSidebarState';
import SidebarRail from './sidebar/SidebarRail';
import SidebarPanel from './sidebar/SidebarPanel';

const focusRing = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]';
const FLYOUT_DELAY = 200;

/** Opens the existing Ctrl+K command palette (the Header owns it and listens for the shortcut). */
function openCommandPalette() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
}

/** Two-level navigation: a 64px section rail plus a 232px panel for the selected section. */
export default function Sidebar() {
  const location = useLocation();
  const setSubmenuOpen = useLayoutStore((s) => s.setSubmenuOpen);
  const isMobileSidebarOpen = useLayoutStore((s) => s.isMobileSidebarOpen);
  const setMobileSidebarOpen = useLayoutStore((s) => s.setMobileSidebarOpen);
  const panelCollapsed = useLayoutStore((s) => s.isDesktopSidebarCollapsed);
  const setPanelCollapsed = useLayoutStore((s) => s.setDesktopSidebarCollapsed);
  const flyoutOpen = useLayoutStore((s) => s.isSubmenuOpen);
  const setFlyoutOpen = useLayoutStore((s) => s.setSubmenuOpen);
  const { theme, toggleTheme } = useThemeStore();
  const isOnline = useOnlineStatus();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { isSuperAdmin, user } = useAuthStore();
  const userRole = (user?.role || (isSuperAdmin ? 'super_admin' : null)) as UserRole | null;
  const { isModuleEnabled } = useModuleAccess();
  const sensitiveModules = user?.permissions?.sensitiveModules ?? [];
  const sensitiveKey = sensitiveModules.join(',');

  const sections = useMemo(
    () => filterAccessible(menuItems, { userRole, isSuperAdmin, isModuleEnabled, sensitiveModules }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userRole, isSuperAdmin, isModuleEnabled, sensitiveKey]
  );
  const userKey = String((user as { id?: string; _id?: string; email?: string } | null)?.id ?? (user as { _id?: string } | null)?._id ?? user?.email ?? 'anon');
  const model = useSidebarState(sections, location.pathname, userKey);

  const asideRef = useRef<HTMLElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const leaveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setSubmenuOpen(false);
  }, [setSubmenuOpen]);

  const closeFlyout = useCallback(() => {
    window.clearTimeout(hoverTimer.current);
    setFlyoutOpen(false);
  }, [setFlyoutOpen]);

  // Navigating always closes the flyout
  useEffect(() => {
    closeFlyout();
  }, [location.pathname, closeFlyout]);

  // Flyout: Escape / click outside
  useEffect(() => {
    if (!flyoutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFlyout();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) closeFlyout();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [flyoutOpen, closeFlyout]);

  useEffect(() => () => {
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(leaveTimer.current);
  }, []);

  const handleNavigate = () => {
    setMobileSidebarOpen(false);
    closeFlyout();
  };

  const onSectionClick = (item: MenuItem) => {
    model.selectSection(item.id);
    if (panelCollapsed && isDesktop) {
      // Clicking a rail icon while collapsed pins the panel open
      closeFlyout();
      setPanelCollapsed(false);
    }
  };

  const onSectionHover = (item: MenuItem | null) => {
    if (!panelCollapsed || !isDesktop) return;
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(leaveTimer.current);
    if (!item) return;
    hoverTimer.current = window.setTimeout(() => {
      model.selectSection(item.id);
      setFlyoutOpen(true);
    }, FLYOUT_DELAY);
  };

  const onAsideLeave = () => {
    window.clearTimeout(hoverTimer.current);
    if (!panelCollapsed) return;
    leaveTimer.current = window.setTimeout(() => setFlyoutOpen(false), 160);
  };

  const initials = (user?.name || 'U').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const roleLabel = isSuperAdmin
    ? 'Super Admin'
    : user?.role === 'mahall' ? 'Mahall Admin'
    : user?.role === 'survey' ? 'Survey Admin'
    : user?.role === 'institute' ? 'Institute Admin'
    : user?.role === 'member' ? 'Member' : 'User';
  const userLabel = `${user?.name || 'User'} · ${roleLabel}`;

  const railProps = {
    model,
    onNavigate: handleNavigate,
    onSearch: () => { setMobileSidebarOpen(false); openCommandPalette(); },
    theme,
    onToggleTheme: toggleTheme,
    initials,
    userLabel,
    isOnline,
  };

  // ---- Mobile / tablet drawer: chips on top, items below ----
  if (!isDesktop) {
    return (
      <aside
        aria-label="Main navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(88vw,340px)] flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] border-r border-line bg-white text-[#18231E] transition-transform duration-200 ease-out motion-reduce:transition-none dark:border-surface-border dark:bg-surface-card dark:text-surface-text',
          isMobileSidebarOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full invisible'
        )}
      >
        <div className="flex h-14 flex-shrink-0 items-center justify-between gap-2 px-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-mint ring-1 ring-mint-deep dark:bg-surface-raised dark:ring-surface-border-strong">
              <img src={LOGO_PATH} alt="" className="h-5 w-5 object-contain" />
            </div>
            <span className="truncate text-[15px] font-extrabold tracking-[0.03em] text-primary-700 dark:text-surface-text">{BRAND_NAME}</span>
          </div>
          <button type="button" onClick={() => setMobileSidebarOpen(false)} aria-label="Close navigation menu" className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-[#7B8983] hover:bg-[#F4F7F5] dark:hover:bg-surface-hover', focusRing)}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <nav aria-label="Sections" className="no-scrollbar flex flex-shrink-0 gap-1.5 overflow-x-auto px-3 pb-2.5">
          {model.sections.map((s) => {
            const Icon = s.icon as React.ComponentType<{ className?: string }>;
            const isLeaf = !s.children?.length;
            const selected = model.selectedId === s.id && !isLeaf;
            const active = model.activeSectionId === s.id;
            const chip = cn(
              'flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              focusRing,
              selected || active ? 'border-mint-deep bg-mint text-primary-700 dark:border-brand-lime/30 dark:bg-brand-lime/[.12] dark:text-brand-lime' : 'border-line text-[#3A4741] dark:border-surface-border dark:text-surface-muted'
            );
            return isLeaf ? (
              <Link key={s.id} to={s.path || '#'} onClick={handleNavigate} aria-current={active ? 'page' : undefined} className={chip}>
                <Icon className="h-3.5 w-3.5" />{s.label}
              </Link>
            ) : (
              <button key={s.id} type="button" onClick={() => model.selectSection(s.id)} aria-pressed={selected} aria-current={active ? 'page' : undefined} className={chip}>
                <Icon className="h-3.5 w-3.5" />{s.label}
              </button>
            );
          })}
        </nav>
        <SidebarPanel model={model} pathname={location.pathname} onNavigate={handleNavigate} variant="drawer" />
        <div className="flex flex-shrink-0 items-center gap-2.5 border-t border-line px-4 py-3 text-[12.5px] dark:border-surface-border">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-mint text-xs font-extrabold text-primary-700 dark:bg-surface-raised dark:text-brand-lime">
            {initials}
            <span aria-hidden="true" className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-surface-card', isOnline ? 'bg-[#1E9B63]' : 'bg-rose-400')} />
          </span>
          <span className="flex min-w-0 flex-col leading-tight"><span className="truncate font-bold">{user?.name || 'User'}</span><span className="truncate text-[12px] text-[#7B8983] dark:text-surface-muted">{isOnline ? roleLabel : 'Offline mode'}</span></span>
        </div>
      </aside>
    );
  }

  // ---- Desktop: rail + docked panel (or flyout when collapsed) ----
  const hasPanelSection = model.sections.some((s) => s.children?.length);
  const showDock = !panelCollapsed && hasPanelSection;
  const showFlyout = panelCollapsed && flyoutOpen && hasPanelSection;
  return (
    <aside
      ref={asideRef}
      aria-label="Main navigation"
      onMouseEnter={() => window.clearTimeout(leaveTimer.current)}
      onMouseLeave={onAsideLeave}
      className={cn(
        'fixed left-0 top-0 z-50 flex h-app text-[#18231E] dark:text-surface-text',
        showDock ? 'w-[296px]' : 'w-16'
      )}
    >
      <SidebarRail
        {...railProps}
        panelOpen={showDock || showFlyout}
        onSectionClick={onSectionClick}
        onSectionHover={onSectionHover}
      />
      {(showDock || showFlyout) && (
        <div
          className={cn(
            'flex h-full w-[232px] flex-shrink-0 flex-col border-r border-line bg-white dark:border-surface-border dark:bg-surface-card',
            showFlyout && 'absolute left-16 top-0 shadow-pop'
          )}
        >
          <SidebarPanel
            model={model}
            pathname={location.pathname}
            onNavigate={handleNavigate}
            variant={showFlyout ? 'flyout' : 'dock'}
            onToggleDock={() => {
              closeFlyout();
              setPanelCollapsed(!panelCollapsed);
            }}
            onClose={closeFlyout}
          />
        </div>
      )}
    </aside>
  );
}
