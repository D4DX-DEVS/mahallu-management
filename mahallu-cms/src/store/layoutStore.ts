import { create } from 'zustand';

const PANEL_KEY = 'zaad.sidebar.panelCollapsed';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(PANEL_KEY) === '1';
  } catch {
    return false;
  }
}
function saveCollapsed(v: boolean) {
  try {
    localStorage.setItem(PANEL_KEY, v ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

interface LayoutState {
  /** Hover/focus flyout of the collapsed sidebar panel (name kept for backwards compatibility). */
  isSubmenuOpen: boolean;
  setSubmenuOpen: (open: boolean) => void;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  /** True when the sidebar panel is collapsed to the 64px rail. Persisted. */
  isDesktopSidebarCollapsed: boolean;
  setDesktopSidebarCollapsed: (collapsed: boolean) => void;
  toggleDesktopSidebarCollapsed: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isSubmenuOpen: false,
  setSubmenuOpen: (open) => set({ isSubmenuOpen: open }),
  isMobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
  isDesktopSidebarCollapsed: loadCollapsed(),
  setDesktopSidebarCollapsed: (collapsed) => {
    saveCollapsed(collapsed);
    set({ isDesktopSidebarCollapsed: collapsed, isSubmenuOpen: false });
  },
  toggleDesktopSidebarCollapsed: () =>
    set((state) => {
      saveCollapsed(!state.isDesktopSidebarCollapsed);
      return { isDesktopSidebarCollapsed: !state.isDesktopSidebarCollapsed, isSubmenuOpen: false };
    }),
}));
