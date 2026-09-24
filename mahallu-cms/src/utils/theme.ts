import { useThemeStore } from '@/store/themeStore';

export const applyTheme = () => {
  const { theme } = useThemeStore.getState();
  const root = window.document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

// Initialize theme on load
if (typeof window !== 'undefined') {
  applyTheme();
}
