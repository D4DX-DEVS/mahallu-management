import { ReactNode, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { useTenant } from '@/hooks/useTenant';
import Header from './Header';
import { useLayoutStore } from '@/store/layoutStore';
import { useLocation } from 'react-router-dom';

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

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, setMobileSidebarOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.14),transparent_28%),radial-gradient(circle_at_right,rgba(245,158,11,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95))] dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_26%),radial-gradient(circle_at_right,rgba(245,158,11,0.08),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.98))]" />
      </div>

      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      
      <Sidebar />
      <div
        className={
          'relative z-30 ml-0 flex flex-1 flex-col overflow-hidden transition-[margin-left] duration-200 ease-out ' +
          (isDesktopSidebarCollapsed ? 'md:ml-[4.75rem]' : 'md:ml-[16rem]')
        }
      >
        <Header />
        <main
          className={
            'flex-1 overflow-y-auto scroll-smooth px-2.5 pb-3 pt-2.5 transition-opacity duration-150 ease-out sm:px-3 sm:pb-4 md:px-4 md:pb-5 md:pt-3 lg:px-5 ' +
            (contentVisible ? 'opacity-100' : 'opacity-0')
          }
        >
          <div className="mx-auto min-h-full w-full max-w-[1680px] rounded-[24px] border border-white/60 bg-white/72 p-2.5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-white/8 dark:bg-slate-900/62 sm:p-3 md:p-4 lg:p-4.5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

