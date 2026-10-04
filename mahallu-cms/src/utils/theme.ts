export const applyTheme = () => {
  const root = window.document.documentElement;

  // The product uses a white-only surface system. Keep the legacy dark class
  // removed so dark utility text cannot become invisible on white surfaces.
  root.classList.remove('dark');
};

// Initialize theme on load
if (typeof window !== 'undefined') {
  applyTheme();
}
