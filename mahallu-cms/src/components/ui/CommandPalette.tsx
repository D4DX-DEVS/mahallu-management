import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiFile, FiSearch, FiX } from 'react-icons/fi';
import { menuItems } from '@/constants/menuItems';
import { getRegisteredPages, RegisteredPage } from '@/constants/routeRegistry';
import { flattenMenuItems, isMenuItemAccessible, FlatMenuItem, UserRole } from '@/utils/menuAccess';
import { humanizePageName } from '@/utils/pageLabel';
import { useAuthStore } from '@/store/authStore';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { cn } from '@/utils/cn';
import { getModalPortalTarget } from '@/utils/modalPortal';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Longest registered menu path that is a proper ancestor of `path`, if any. */
function findOwningMenuItem(path: string, menuLeaves: FlatMenuItem[]): FlatMenuItem | undefined {
  let best: FlatMenuItem | undefined;
  for (const item of menuLeaves) {
    if (path === item.path) continue;
    if (path === item.path || path.startsWith(`${item.path}/`)) {
      if (!best || item.path.length > best.path.length) best = item;
    }
  }
  return best;
}

/**
 * Every page the user can actually reach: the curated sidebar menu, plus any
 * registered route that isn't already represented there (e.g. a create/sub
 * page the two-level nav intentionally leaves out). Sourced from `appRoutes`
 * itself (see routeRegistry.ts) so a route can't silently go missing here
 * just because nobody added it to the menu.
 */
function useSearchableItems(): FlatMenuItem[] {
  const { isSuperAdmin, user } = useAuthStore();
  const userRole = (user?.role || (isSuperAdmin ? 'super_admin' : null)) as UserRole | null;
  const { isModuleEnabled } = useModuleAccess();
  const sensitiveModules = user?.permissions?.sensitiveModules ?? [];

  // Loaded via a dynamic import (see routeRegistry.ts) so it resolves after
  // mount instead of participating in the module graph's initial load.
  const [registeredPages, setRegisteredPages] = useState<RegisteredPage[]>([]);
  useEffect(() => {
    let cancelled = false;
    getRegisteredPages().then((pages) => {
      if (!cancelled) setRegisteredPages(pages);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // CEO decision: hidden menu items + their routes are excluded from Ctrl+K results. Keep underlying routes registered.
  const HIDDEN_SEARCH_PATH_PREFIXES = [
    '/religious', // Khutbah Management
    '/loans', // Qard Hasan (keep /relief visible)
    '/employment', // Employment Database
    '/volunteers', // Youth Volunteer Wing + Women's Forum (volunteer wings)
    '/volunteer-assignments',
    '/library', // Library Management
    '/counselling', // Counselling Services
    '/maslahat', // Maslahat / Reconciliation
    // Education — only the madrasa classes (Weekend Madrasa / Adult Qur'an) are hidden; scholarships/support/reports stay searchable
    '/education', // will be selectively filtered below
  ];

  function isHiddenByPath(path: string): boolean {
    // /education is special: only the classes list itself is hidden; scholarships/support/report must remain searchable
    if (path === '/education' || path.startsWith('/education/classes')) return true;
    if (path.startsWith('/education/scholarships') || path.startsWith('/education/support') || path === '/education/report') return false;
    if (path.startsWith('/education/') && path.includes('/attendance')) return true; // class attendance is part of hidden madrasa classes
    return HIDDEN_SEARCH_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}-`));
  }

  return useMemo(() => {
    const menuLeaves = flattenMenuItems(menuItems);
    const menuPaths = new Set(menuLeaves.map((item) => item.path));

    const accessibleMenuItems = menuLeaves.filter(
      (item) =>
        !item.hidden &&
        !isHiddenByPath(item.path) &&
        isMenuItemAccessible(item, userRole, isSuperAdmin, sensitiveModules) && isModuleEnabled(item.moduleKey)
    );

    const extraItems: FlatMenuItem[] = registeredPages
      .filter((page) => !menuPaths.has(page.path) && page.componentName)
      .filter((page) => !isHiddenByPath(page.path))
      .map((page) => {
        const owner = findOwningMenuItem(page.path, menuLeaves);
        // If the owning menu item is hidden, the route is hidden too — don't surface it via search.
        if (owner?.hidden) return null;
        if (owner && isHiddenByPath(owner.path)) return null;
        const label = humanizePageName(page.componentName!);
        return {
          id: `route:${page.path}`,
          label,
          path: page.path,
          icon: owner?.icon ?? FiFile,
          breadcrumb: owner ? [...owner.breadcrumb, label] : ['More pages', label],
          moduleKey: owner?.moduleKey,
          sensitiveKey: owner?.sensitiveKey,
          // The route's own guard is the actual enforcement; fall back to the
          // owning menu group's only when the route itself declares no guard.
          allowedRoles: page.allowedRoles ?? owner?.allowedRoles,
          superAdminOnly: page.superAdminOnly ?? owner?.superAdminOnly,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => isMenuItemAccessible(item, userRole, isSuperAdmin, sensitiveModules) && isModuleEnabled(item.moduleKey));

    return [...accessibleMenuItems, ...extraItems];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredPages, userRole, isSuperAdmin, isModuleEnabled, JSON.stringify(sensitiveModules)]);
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const allItems = useSearchableItems();

  const filteredItems = search
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(search.toLowerCase()) ||
          item.breadcrumb.some((b) => b.toLowerCase().includes(search.toLowerCase()))
      )
    : allItems;

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredItems[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  const handleSelect = (item: FlatMenuItem) => {
    navigate(item.path);
    onClose();
  };

  if (!isOpen) return null;

  const { node: portalTarget, scoped } = getModalPortalTarget();

  return createPortal(
    <div
      className={cn(
        scoped ? 'absolute inset-0' : 'fixed inset-0',
        'z-50 flex items-start justify-center px-3 pt-[8vh] sm:px-4 sm:pt-[15vh]'
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md dark:bg-black/40" onClick={onClose} />

      {/* Command Palette */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-card shadow-md">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <FiSearch className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            aria-label="Search pages"
            placeholder="Search pages"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Close"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto overscroll-contain sm:max-h-[60vh]">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">No results found</div>
          ) : (
            <div className="py-2">
              {filteredItems.map((item, index) => {
                const Icon = item.icon as React.ComponentType<{ className?: string }>;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                      index === selectedIndex ? 'bg-primary/10' : 'hover:bg-accent'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
                        index === selectedIndex ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{item.label}</div>
                      <div className="truncate text-xs text-muted-foreground">{item.breadcrumb.join(' > ')}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="hidden items-center justify-between border-t border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:flex">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded-sm border border-border bg-card px-1.5 py-0.5 text-xs">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded-sm border border-border bg-card px-1.5 py-0.5 text-xs">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded-sm border border-border bg-card px-1.5 py-0.5 text-xs">esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>,
    portalTarget
  );
}
