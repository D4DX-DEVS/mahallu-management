import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { menuItems, MenuItem } from '@/constants/menuItems';
import type { ModuleKey, SensitiveModuleKey } from '@/constants/modules';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { FiChevronDown, FiChevronRight, FiSearch } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { BRAND_NAME, LOGO_PATH } from '@/constants/theme';
import { useLayoutStore } from '@/store/layoutStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type UserRole = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';

function isAccessible(
  item: MenuItem,
  userRole: UserRole | null,
  isSuperAdmin: boolean,
  sensitiveModules: SensitiveModuleKey[]
) {
  if (item.superAdminOnly && !isSuperAdmin) return false;
  // Restricted modules need an explicit per-user grant — the API returns 403 without it
  if (item.sensitiveKey && !isSuperAdmin && !sensitiveModules.includes(item.sensitiveKey)) return false;
  if (item.allowedRoles && userRole) {
    return item.allowedRoles.includes(userRole);
  }
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
    // Module gating from the Mahallu classification / tenant feature toggles
    if (!isModuleEnabled(item.moduleKey)) return result;

    const accessibleChildren = item.children
      ? filterMenuTree(item.children, '', userRole, isSuperAdmin, isModuleEnabled, sensitiveModules)
      : undefined;
    const matchesSearch = item.label.toLowerCase().includes(searchQuery.toLowerCase());
    const filteredChildren = item.children
      ? filterMenuTree(item.children, searchQuery, userRole, isSuperAdmin, isModuleEnabled, sensitiveModules)
      : undefined;

    // A group whose children are all filtered out for this role/tenant is noise — drop it entirely
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

function collectAncestorIds(items: MenuItem[], pathname: string, trail: string[] = []): string[] {
  for (const item of items) {
    const nextTrail = [...trail, item.id];
    if (item.path === pathname) {
      return nextTrail;
    }
    if (item.children) {
      const childTrail = collectAncestorIds(item.children, pathname, nextTrail);
      if (childTrail.length > 0) {
        return childTrail;
      }
    }
  }

  return [];
}

function collectExpandableIds(items: MenuItem[]): string[] {
  return items.flatMap((item) => {
    if (!item.children?.length) return [];
    return [item.id, ...collectExpandableIds(item.children)];
  });
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

function MenuNode({ item, depth, pathname, openSections, onToggle, onNavigate, forceOpen, isCollapsed }: MenuNodeProps) {
  const Icon = item.icon as React.ComponentType<{ className?: string }>;
  const hasChildren = Boolean(item.children?.length);
  const isActive = item.path === pathname;
  const isBranchActive = hasActiveDescendant(item, pathname);
  const isOpen = hasChildren ? (!isCollapsed && (forceOpen || openSections[item.id])) : false;
  const depthClass = depth === 0 ? 'pl-3 pr-2.5' : depth === 1 ? 'pl-8 pr-2.5' : 'pl-11 pr-2.5';

  if (isCollapsed && depth > 0) {
    return null;
  }

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className={cn(
            'group flex w-full items-center gap-2 rounded-xl py-1.5 text-left transition-all duration-200',
            isCollapsed && depth === 0 ? 'justify-center px-1.5' : depthClass,
            isBranchActive
              ? 'text-primary-800 hover:bg-slate-100'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
          )}
          title={isCollapsed && depth === 0 ? item.label : undefined}
        >
          <span
            className={cn(
              'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-colors',
              isBranchActive
                ? 'bg-primary-100 text-primary-700'
                : depth === 0
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-slate-100 text-slate-500'
            )}
          >
            <Icon className="h-3 w-3" />
          </span>
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className={cn('break-words font-semibold leading-tight', depth === 0 ? 'text-[0.72rem]' : 'text-[0.68rem]')}>  
                  {item.label}
                </p>
                {depth === 0 && <p className="mt-0.5 text-[0.60rem] text-slate-400">Grouped access</p>}
              </div>
              {isOpen ? <FiChevronDown className="h-3.5 w-3.5 flex-shrink-0" /> : <FiChevronRight className="h-3.5 w-3.5 flex-shrink-0" />}
            </>
          )}
        </button>

        <div className={cn('overflow-hidden transition-[max-height,opacity] duration-200', isOpen ? 'max-h-[120rem] opacity-100' : 'max-h-0 opacity-0 pointer-events-none')}>
          <div className={cn('space-y-1 pb-1', depth === 0 ? 'pt-1' : 'pt-0')}>
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
        </div>
      </div>
    );
  }

  return (
    <Link
      to={item.path || '#'}
      onClick={onNavigate}
      className={cn(
        'group flex items-center gap-2 rounded-xl py-1.5 transition-all duration-200',
        isCollapsed && depth === 0 ? 'justify-center px-1.5' : depthClass,
        depth === 1
          ? isActive
            ? 'bg-primary-50 text-primary-900 shadow-sm ring-1 ring-primary-100'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
          : isActive
            ? 'bg-primary-50 text-primary-900 shadow-sm ring-1 ring-primary-100'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
      )}
      title={isCollapsed && depth === 0 ? item.label : undefined}
    >
      <span
        className={cn(
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-colors',
          isActive
            ? 'bg-primary-600 text-white'
            : 'bg-slate-100 text-slate-500'
        )}
      >
        <Icon className="h-3 w-3" />
      </span>
      {!isCollapsed && (
        <span className={cn('break-words leading-tight', depth === 1 ? 'font-medium text-[0.68rem]' : 'text-[0.72rem]')}>
          {item.label}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const setSubmenuOpen = useLayoutStore((s) => s.setSubmenuOpen);
  const isMobileSidebarOpen = useLayoutStore((s) => s.isMobileSidebarOpen);
  const setMobileSidebarOpen = useLayoutStore((s) => s.setMobileSidebarOpen);
  const isDesktopSidebarCollapsed = useLayoutStore((s) => s.isDesktopSidebarCollapsed);
  const toggleDesktopSidebarCollapsed = useLayoutStore((s) => s.toggleDesktopSidebarCollapsed);
  const isOnline = useOnlineStatus();
  const { isSuperAdmin, user } = useAuthStore();
  const userRole = (user?.role || (isSuperAdmin ? 'super_admin' : null)) as UserRole | null;
  const { isModuleEnabled } = useModuleAccess();
  const sensitiveModules = user?.permissions?.sensitiveModules ?? [];
  const filteredMenuItems = filterMenuTree(
    menuItems,
    searchQuery,
    userRole,
    isSuperAdmin,
    isModuleEnabled,
    sensitiveModules
  );

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
  }, [location.pathname]);

  useEffect(() => {
    if (!searchQuery.trim()) return;

    const nextOpenState = collectExpandableIds(filteredMenuItems).reduce<Record<string, boolean>>((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});
    setOpenSections(nextOpenState);
  }, [searchQuery]);

  const handleToggleSection = (id: string) => {
    if (isDesktopSidebarCollapsed) {
      toggleDesktopSidebarCollapsed();
      return;
    }

    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleNavigate = () => {
    setMobileSidebarOpen(false);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 h-screen border-r border-slate-200 bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.12)] transition-[width,transform] duration-200 ease-out',
        isDesktopSidebarCollapsed ? 'w-[4.75rem]' : 'w-[16rem]',
        'md:translate-x-0',
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="relative flex h-full flex-col">
        <div className={cn('flex flex-shrink-0 border-b border-slate-200 py-4', isDesktopSidebarCollapsed ? 'justify-center px-2.5' : 'items-center gap-2.5 px-3')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200">
            <img src={LOGO_PATH} alt={BRAND_NAME} className="h-7 w-7 object-contain" />
          </div>
          {!isDesktopSidebarCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-slate-400">Admin Panel</p>
              <h1 className="truncate text-[0.95rem] font-semibold text-slate-900">{BRAND_NAME}</h1>
            </div>
          )}
        </div>

        {!isDesktopSidebarCollapsed && (
          <div className="px-2.5 pt-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-1">
              <label className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[0.78rem] text-slate-600">
                <FiSearch className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search modules"
                  className="w-full bg-transparent text-[0.78rem] text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </label>
            </div>
          </div>
        )}

        <nav className={cn('no-scrollbar flex-1 overflow-y-auto py-3', isDesktopSidebarCollapsed ? 'px-1.5' : 'px-2.5')}>
          <div className="space-y-1.5">
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
        </nav>

        <div className={cn('flex flex-shrink-0 border-t border-slate-200 py-3', isDesktopSidebarCollapsed ? 'justify-center px-2.5' : 'items-center justify-between px-3')}>
          {!isDesktopSidebarCollapsed && (
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">Status</p>
              <p className="mt-1 text-[0.78rem] font-medium text-slate-700">{isOnline ? 'Connected' : 'Offline mode'}</p>
            </div>
          )}
          <span
            title={isOnline ? 'Connected' : 'Disconnected'}
            className={cn('h-2.5 w-2.5 rounded-full shadow-[0_0_20px_currentColor]', isOnline ? 'bg-emerald-400 text-emerald-400' : 'animate-pulse bg-rose-400 text-rose-400')}
          />
        </div>
      </div>
    </aside>
  );
}

