import { create } from 'zustand';

interface LayoutState {
  isSubmenuOpen: boolean;
  setSubmenuOpen: (open: boolean) => void;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isSubmenuOpen: false,
  setSubmenuOpen: (open) => set({ isSubmenuOpen: open }),
  isMobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
}));
