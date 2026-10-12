import { ReactNode, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { useTenant } from '@/hooks/useTenant';
import Header from './Header';
import { useLayoutStore } from '@/store/layoutStore';
import { useLocation } from 'react-router-dom';
import { useScrollLock } from '@/components/ui/modalLayer';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  // Keeps authStore.tenantFeatures fresh so module gating works on every page.
  useTenant();
  const isMobileSidebarOpen = useLayoutStore((s) => s.isMobileSidebarOpen);
  const isDesktopSidebarCollapsed = useLayoutStore((s) => s.isDesktopSidebarCollapsed);
  const setMobileSidebarOpen = useLayoutStore((s) => s.setMobileSidebarOpen);
  const location = useLocation();
  const [contentVisible, setContentVisible] = useState(true);

  // Fade content on route changes
  useEffect(() => {
    setContentVisible(false);
    const raf = window.requestAnimationFrame(() => setContentVisible(true));
    return () => window.cancelAnimationFrame(raf);
  }, [location.pathname]);

  // Mobile drawer: lock the page behind it, close on Escape
  useScrollLock(isMobileSidebarOpen);
  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileSidebarOpen, setMobileSidebarOpen]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, setMobileSidebarOpen]);

  return (
    <div className="flex h-app overflow-hidden bg-canvas text-[#18231E] dark:bg-surface-base dark:text-surface-text">
      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      
      <Sidebar />
      <div
        className={
          'relative z-30 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden transition-[margin-left] duration-200 ease-out ' +
          (isDesktopSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-[296px]')
        }
      >
        <Header />
        <main
          id="main-content"
          className={
            'min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 transition-opacity duration-150 ease-out sm:px-4 md:px-6 md:pb-7 md:pt-5 ' +
            (contentVisible ? 'opacity-100' : 'opacity-0')
          }
        >
          <div className="mx-auto min-h-full w-full max-w-[1680px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
