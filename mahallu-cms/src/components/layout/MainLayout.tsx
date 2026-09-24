import { ReactNode, useEffect } from 'react';
import Sidebar from './Sidebar';
import { useTenant } from '@/hooks/useTenant';
import Header from './Header';
import MobileFooterNav from './MobileFooterNav';
import { useLayoutStore } from '@/store/layoutStore';
import { useLocation } from 'react-router-dom';
import { RouteErrorBoundary } from '@/components/ui/ErrorBoundary';
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
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, setMobileSidebarOpen]);
  /*
   *
   * The page chrome is deliberately flat.
   *
   * It previously painted a fixed radial-gradient backdrop and floated the
   * content in a backdrop-blur-xl frosted panel with a 60px shadow. The blur
   * sat behind a full-page scroll container, so it repainted on every scroll
   * frame — expensive on the mid-range Android hardware a community office
   * actually uses — and it was the single most decorative element in a dense
   * operational tool. It also mixed the `slate` ramp into a product built on
   * `gray`, which is now the one neutral ramp. */
  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-background text-foreground">
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/25 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar />
      <div
        id="app-content-area"
        className={
          'relative z-30 flex min-w-0 flex-1 flex-col overflow-hidden transition-[margin-left] duration-200 ease-out ' +
          (isDesktopSidebarCollapsed ? 'md:ml-rail' : 'md:ml-64')
        }
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Skip to content
        </a>

        <Header />

        {/* 12px gutters phone / 24px md. Compact but readable; cards breathe without stealing content width. */}
        <main id="main-content" className="flex-1 overflow-y-auto px-3 pb-24 pt-3 sm:pt-4 md:px-6 md:pb-8">
          {/* A page that throws costs the user that page, not the whole app:
              the chrome stays up and the boundary clears on the next route. */}
          <div className="mx-auto w-full max-w-content">
            <RouteErrorBoundary>{children}</RouteErrorBoundary>
          </div>
        </main>

        <MobileFooterNav />
      </div>
    </div>
  );
}
