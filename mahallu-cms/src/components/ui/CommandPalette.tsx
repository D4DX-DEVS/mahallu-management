import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOverlay, useKeyboardInset } from './modalLayer';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiSearch,
  FiX,
  FiMoon,
  FiSun,
  FiLogOut,
  FiRepeat,
  FiClock,
  FiCornerDownLeft,
  FiArrowLeft,
  FiLayers,
} from 'react-icons/fi';
import { menuItems, MenuItem } from '@/constants/menuItems';
import type { SensitiveModuleKey } from '@/constants/modules';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { QUICK_ACTIONS, useRole } from '@/features/dashboard/quickActions';
import { tenantService } from '@/services/tenantService';
import type { Tenant } from '@/types/tenant';
import { getFriendlyError } from '@/utils/apiMessages';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type IconType = React.ComponentType<{ className?: string }>;

interface Entry {
  id: string;
  group: 'Recent' | 'Actions' | 'Pages' | 'Tenants';
  label: string;
  hint?: string;
  icon: IconType;
  keywords: string;
  run: () => void;
}

const RECENT_KEY = 'zaad.recentPages';
const RECENT_MAX = 5;

interface RecentPage {
  path: string;
  label: string;
}

function loadRecent(): RecentPage[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((r) => r && typeof r.path === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecent(list: RecentPage[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    /* storage unavailable */
  }
}

/** Walk the menu keeping only what the user may open (same rules as the sidebar). */
function flatten(
  items: MenuItem[],
  ctx: {
    role: string | null;
    isSuperAdmin: boolean;
    sensitive: SensitiveModuleKey[];
    isModuleEnabled: (k?: any) => boolean;
  },
  trail: string[] = []
) {
  const out: { id: string; label: string; path: string; icon: IconType; trail: string[] }[] = [];
  for (const item of items) {
    if (item.superAdminOnly && !ctx.isSuperAdmin) continue;
    if (item.sensitiveKey && !ctx.isSuperAdmin && !ctx.sensitive.includes(item.sensitiveKey)) continue;
    if (item.allowedRoles && ctx.role && !item.allowedRoles.includes(ctx.role as any)) continue;
    if (!ctx.isModuleEnabled(item.moduleKey)) continue;
    const next = [...trail, item.label];
    if (item.path) out.push({ id: item.id, label: item.label, path: item.path, icon: item.icon as IconType, trail: next });
    if (item.children) out.push(...flatten(item.children, ctx, next));
  }
  return out;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '');

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[20px] items-center justify-center rounded-md border border-line bg-white px-1.5 py-0.5 font-sans text-[12px] font-semibold text-[#6A7771] dark:border-surface-border dark:bg-surface-raised dark:text-surface-muted">
      {children}
    </kbd>
  );
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'root' | 'tenants'>('root');
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentPage[]>(loadRecent);
  const { setEl: setOverlayEl } = useOverlay(isOpen);
  const kbStyle = useKeyboardInset(isOpen);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { user, isSuperAdmin, logout, currentTenantId, setCurrentTenant } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { isModuleEnabled } = useModuleAccess();
  const role = useRole();
  const sensitive = user?.permissions?.sensitiveModules ?? [];

  const pages = useMemo(
    () => flatten(menuItems, { role, isSuperAdmin, sensitive, isModuleEnabled }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, isSuperAdmin, sensitive.join(','), isModuleEnabled]
  );

  // Track visited pages that exist in the menu (kept per browser).
  useEffect(() => {
    const page = pages.find((p) => p.path === location.pathname);
    if (!page || page.path === '/dashboard') return;
    setRecent((prev) => {
      const next = [{ path: page.path, label: page.label }, ...prev.filter((r) => r.path !== page.path)].slice(0, RECENT_MAX);
      saveRecent(next);
      return next;
    });
  }, [location.pathname, pages]);

  const go = useCallback(
    (path: string) => {
      navigate(path);
      onClose();
    },
    [navigate, onClose]
  );

  const entries: Entry[] = useMemo(() => {
    if (mode === 'tenants') {
      return (tenants ?? []).map((t) => ({
        id: `tenant-${t.id}`,
        group: 'Tenants' as const,
        label: t.name,
        hint: [t.code, t.location].filter(Boolean).join(' • '),
        icon: FiLayers,
        keywords: `${t.name} ${t.code} ${t.location}`.toLowerCase(),
        run: () => {
          setCurrentTenant(t.id);
          window.location.reload();
        },
      }));
    }

    const list: Entry[] = [];

    const actionRole = role;
    QUICK_ACTIONS.filter((a) => actionRole && a.roles.includes(actionRole) && isModuleEnabled(a.moduleKey)).forEach((a) =>
      list.push({
        id: `act-${a.id}`,
        group: 'Actions',
        label: a.label,
        hint: 'Create',
        icon: a.icon,
        keywords: `${a.label} ${(a.keywords || []).join(' ')}`.toLowerCase(),
        run: () => go(a.path),
      })
    );

    list.push({
      id: 'act-theme',
      group: 'Actions',
      label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      hint: 'Toggle dark mode',
      icon: theme === 'dark' ? FiSun : FiMoon,
      keywords: 'toggle dark mode light theme appearance',
      run: () => {
        toggleTheme();
        onClose();
      },
    });

    if (isSuperAdmin) {
      list.push({
        id: 'act-tenant',
        group: 'Actions',
        label: 'Switch tenant…',
        hint: 'Super admin',
        icon: FiRepeat,
        keywords: 'switch tenant mahall change view as',
        run: () => {
          setMode('tenants');
          setSearch('');
        },
      });
      if (currentTenantId) {
        list.push({
          id: 'act-tenant-clear',
          group: 'Actions',
          label: 'Back to super admin view',
          hint: 'Leave tenant',
          icon: FiArrowLeft,
          keywords: 'tenant super admin exit leave',
          run: () => {
            setCurrentTenant(null);
            window.location.reload();
          },
        });
      }
    }

    list.push({
      id: 'act-logout',
      group: 'Actions',
      label: 'Log out',
      icon: FiLogOut,
      keywords: 'sign out logout exit',
      run: () => {
        logout();
        window.location.href = '/login';
      },
    });

    pages.forEach((p) =>
      list.push({
        id: `page-${p.id}`,
        group: 'Pages',
        label: p.label,
        hint: p.trail.slice(0, -1).join(' › '),
        icon: p.icon,
        keywords: p.trail.join(' ').toLowerCase(),
        run: () => go(p.path),
      })
    );

    return list;
  }, [mode, tenants, role, isModuleEnabled, theme, isSuperAdmin, currentTenantId, pages, go, logout, onClose, setCurrentTenant, toggleTheme]);

  const q = search.trim().toLowerCase();

  const results: Entry[] = useMemo(() => {
    if (mode === 'tenants') return q ? entries.filter((e) => e.keywords.includes(q)) : entries;
    if (q) {
      const terms = q.split(/\s+/);
      return entries.filter((e) => terms.every((t) => e.keywords.includes(t) || e.label.toLowerCase().includes(t)));
    }
    // Empty query: Recent, Actions, then a short slice of pages
    const recentEntries: Entry[] = recent
      .filter((r) => pages.some((p) => p.path === r.path))
      .map((r) => {
        const page = pages.find((p) => p.path === r.path)!;
        return {
          id: `recent-${r.path}`,
          group: 'Recent' as const,
          label: page.label,
          hint: page.trail.slice(0, -1).join(' › '),
          icon: FiClock,
          keywords: '',
          run: () => go(r.path),
        };
      });
    return [...recentEntries, ...entries.filter((e) => e.group === 'Actions'), ...entries.filter((e) => e.group === 'Pages').slice(0, 8)];
  }, [entries, q, mode, recent, pages, go]);

  // Load tenant list lazily for the super-admin sub-menu.
  useEffect(() => {
    if (mode !== 'tenants' || tenants) return;
    tenantService
      .getAll({ limit: 500 })
      .then((res) => setTenants(res.data || []))
      .catch((err) => {
        setTenants([]);
        setTenantError(getFriendlyError(err, "Couldn't load mahallus. Refresh the page or try again."));
      });
  }, [mode, tenants]);

  useEffect(() => setSelectedIndex(0), [search, mode]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setMode('root');
    }
  }, [isOpen]);

  // Keep the highlighted row in view
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const choose = (entry: Entry) => entry.run();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Header opens the palette on the same shortcut; a second press while open closes it.
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((p) => (results.length ? (p + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((p) => (results.length ? (p - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        choose(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (mode === 'tenants') {
          setMode('root');
          setSearch('');
        } else {
          onClose();
        }
      } else if (e.key === 'Backspace' && mode === 'tenants' && !search) {
        setMode('root');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results, selectedIndex, mode, search]);

  if (!isOpen) return null;

  // Group headings render when the group changes between consecutive rows.
  let lastGroup = '';

  return createPortal(
    <div ref={setOverlayEl} style={kbStyle} className="fixed inset-0 z-[60] flex items-start justify-center overflow-hidden overscroll-none px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:pt-[12dvh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-[#0B2A20]/45 backdrop-blur-sm" onMouseDown={onClose} />

      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-card border border-line bg-white shadow-[0_30px_80px_-30px_rgba(5,40,28,.55)] dark:border-surface-border dark:bg-surface-card">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 dark:border-surface-border">
          {mode === 'tenants' ? (
            <button
              onClick={() => setMode('root')}
              className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[12px] font-bold text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime"
            >
              <FiArrowLeft className="h-3 w-3" /> Switch tenant
            </button>
          ) : (
            <FiSearch className="h-5 w-5 text-[#7B8983]" />
          )}
          <input
            type="text"
            placeholder={mode === 'tenants' ? 'Search tenants…' : 'Search pages or type an action…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border-none bg-transparent text-[14px] shadow-none ring-0 focus:shadow-none focus:outline-none focus:ring-0 text-[#18231E] outline-none placeholder:text-[#9AA7A1] dark:text-surface-text"
            autoFocus
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[#7B8983] transition-colors hover:bg-[#F1F5F3] dark:hover:bg-surface-hover"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="min-h-0 max-h-[56dvh] flex-1 overflow-y-auto overscroll-contain py-1.5">
          {mode === 'tenants' && tenants === null ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#7B8983]">Loading tenants…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#7B8983] dark:text-surface-muted">
              {tenantError || `No results for “${search}”`}
            </div>
          ) : (
            results.map((item, index) => {
              const showHeading = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              const active = index === selectedIndex;
              return (
                <div key={item.id}>
                  {showHeading && (
                    <div className="px-4 pb-1 pt-2.5 text-[12px] font-extrabold uppercase tracking-wider text-[#8A9992] dark:text-surface-muted">
                      {item.group}
                    </div>
                  )}
                  <button
                    data-idx={index}
                    onClick={() => choose(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'mx-1.5 flex w-[calc(100%-12px)] items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors',
                      active ? 'bg-mint dark:bg-brand-lime/10' : 'hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px]',
                        active
                          ? 'bg-white text-primary-700 dark:bg-surface-raised dark:text-brand-lime'
                          : 'bg-[#F1F5F3] text-[#4A5A52] dark:bg-surface-raised dark:text-surface-muted'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-[#18231E] dark:text-surface-text">{item.label}</span>
                      {item.hint && <span className="block truncate text-[12px] text-[#7B8983] dark:text-surface-muted">{item.hint}</span>}
                    </span>
                    {active && (
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-[#6A7771] dark:text-surface-muted">
                        {item.group === 'Actions' ? 'Run' : 'Open'} <Kbd><FiCornerDownLeft className="h-3 w-3" /></Kbd>
                      </span>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-[#F8FBF9] px-4 py-2 text-[12px] text-[#6A7771] dark:border-surface-border dark:bg-surface-raised/40 dark:text-surface-muted">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> Navigate</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> Select</span>
          <span className="flex items-center gap-1.5"><Kbd>esc</Kbd> {mode === 'tenants' ? 'Back' : 'Close'}</span>
          <span className="ml-auto flex items-center gap-1.5"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd> Open anywhere</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
