import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MenuItem } from '@/constants/menuItems';
import { collectLeaves, findActiveTrail, type Leaf } from './navModel';

const PINS_KEY = 'zaad.sidebar.pins';
const RECENT_KEY = 'zaad.recentPages';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export interface SidebarModel {
  sections: MenuItem[];
  selectedId: string | null;
  selectSection: (id: string) => void;
  activeSectionId: string | null;
  activeLeafId: string | null;
  openGroups: Record<string, string | null>;
  toggleGroup: (parentId: string, id: string) => void;
  pinnedPaths: string[];
  togglePin: (path: string) => void;
  recent: { path: string; label: string }[];
  leavesBySection: Record<string, Leaf[]>;
}

/** Navigation state for the rail + panel: selected section, accordions, pins, recents. */
export function useSidebarState(sections: MenuItem[], pathname: string, userKey: string): SidebarModel {
  const trail = useMemo(() => findActiveTrail(sections, pathname), [sections, pathname]);
  const activeSectionId = trail[0] ?? null;
  const activeLeafId = trail.length ? trail[trail.length - 1] : null;

  const [manualId, setManualId] = useState<string | null>(null);
  // Navigation wins over a manual choice: reset it whenever the route changes.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setManualId(null);
    }
  }, [pathname]);

  const firstExpandable = sections.find((s) => s.children?.length)?.id ?? sections[0]?.id ?? null;
  const manualValid = manualId && sections.some((s) => s.id === manualId) ? manualId : null;
  const selectedId = manualValid ?? activeSectionId ?? firstExpandable;

  // Accordions: one open per parent, the one holding the active route auto-opens on navigation.
  const [openGroups, setOpenGroups] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (trail.length < 2) return;
    setOpenGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      for (let i = 0; i < trail.length - 1; i++) {
        if (next[trail[i]] !== trail[i + 1]) {
          next[trail[i]] = trail[i + 1];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [trail]);
  const toggleGroup = useCallback((parentId: string, id: string) => {
    setOpenGroups((prev) => ({ ...prev, [parentId]: prev[parentId] === id ? null : id }));
  }, []);

  // Pins (per user)
  const pinsKey = `${PINS_KEY}.${userKey}`;
  const [pinnedPaths, setPinned] = useState<string[]>(() => readJson<string[]>(pinsKey, []));
  useEffect(() => {
    setPinned(readJson<string[]>(pinsKey, []));
  }, [pinsKey]);
  const togglePin = useCallback(
    (path: string) => {
      setPinned((prev) => {
        const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
        writeJson(pinsKey, next);
        return next;
      });
    },
    [pinsKey]
  );

  // Recent pages are written by the command palette; re-read after each navigation.
  const [recent, setRecent] = useState<{ path: string; label: string }[]>(() => readJson(RECENT_KEY, []));
  useEffect(() => {
    const read = () => {
      const raw = readJson<{ path: string; label: string }[]>(RECENT_KEY, []);
      setRecent(Array.isArray(raw) ? raw.filter((r) => r && typeof r.path === 'string') : []);
    };
    read();
    const t = window.setTimeout(read, 120);
    return () => window.clearTimeout(t);
  }, [pathname]);

  const leavesBySection = useMemo(() => {
    const map: Record<string, Leaf[]> = {};
    sections.forEach((s) => (map[s.id] = collectLeaves(s)));
    return map;
  }, [sections]);

  return {
    sections,
    selectedId,
    selectSection: setManualId,
    activeSectionId,
    activeLeafId,
    openGroups,
    toggleGroup,
    pinnedPaths,
    togglePin,
    recent,
    leavesBySection,
  };
}
