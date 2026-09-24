import { create } from 'zustand';

interface LayoutState {
  isSubmenuOpen: boolean;
  setSubmenuOpen: (open: boolean) => void;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  isDesktopSidebarCollapsed: boolean;
  toggleDesktopSidebarCollapsed: () => void;
  /**
   * Command palette lives in the store so the mobile tab bar can open it.
   * It used to be Header-local state behind `hidden md:flex`, which left the
   * phone with no search at all.
   */
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isSubmenuOpen: false,
  setSubmenuOpen: (open) => set({ isSubmenuOpen: open }),
  isMobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
  isDesktopSidebarCollapsed: false,
  toggleDesktopSidebarCollapsed: () =>
    set((state) => ({ isDesktopSidebarCollapsed: !state.isDesktopSidebarCollapsed })),
  isCommandPaletteOpen: false,
  openCommandPalette: () => set({ isCommandPaletteOpen: true, isMobileSidebarOpen: false }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
}));
