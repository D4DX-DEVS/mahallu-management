import { ReactNode, useEffect } from 'react';
import Sidebar from './Sidebar';
import { useTenant } from '@/hooks/useTenant';
import Header from './Header';
import TenantBanner from './TenantBanner';
import ImpersonationBanner from './ImpersonationBanner';
import MobileFooterNav from './MobileFooterNav';
import { useLayoutStore } from '@/store/layoutStore';
import { useAuthStore } from '@/store/authStore';
import { useLocation } from 'react-router-dom';
import { RouteErrorBoundary } from '@/components/ui/ErrorBoundary';
import { cn } from '@/utils/cn';
interface MainLayoutProps {
  children: ReactNode;
}
export default function MainLayout({ children }: MainLayoutProps) {
  // Keeps authStore.tenantFeatures fresh so module gating works on every page.
  useTenant();
  const isMobileSidebarOpen = useLayoutStore((s) => s.isMobileSidebarOpen);
  const isDesktopSidebarCollapsed = useLayoutStore((s) => s.isDesktopSidebarCollapsed);
  const isSubmenuOpen = useLayoutStore((s) => s.isSubmenuOpen);
  const setMobileSidebarOpen = useLayoutStore((s) => s.setMobileSidebarOpen);
  const { isSuperAdmin, currentTenantId, isImpersonating } = useAuthStore();
  // Single source of truth for the top-shell offset: the sidebar and the
  // content column both read this so their top rows stay aligned on every route.
  // The two banners are mutually exclusive — isSuperAdmin is false for the
  // whole duration of an impersonation session, so isViewingAsTenant can
  // never also be true then — but the offset itself still needs to apply.
  const isViewingAsTenant = Boolean(isSuperAdmin && currentTenantId);
  const showTopBanner = isViewingAsTenant || isImpersonating;
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
    <div
      className={cn(
        'workspace-canvas flex h-screen h-[100dvh] overflow-hidden text-foreground',
        showTopBanner && 'pt-9'
      )}
    >
      {isViewingAsTenant && <TenantBanner />}
      {isImpersonating && <ImpersonationBanner />}
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
        className={cn(
          'relative z-30 flex min-w-0 flex-1 flex-col overflow-hidden transition-[margin-left] duration-200 ease-out',
          // Parenthesised through cn(): `'base ' + collapsed ? a : b` binds as `('base ' + collapsed) ? a : b`
          // and threw the base classes (flex-1, flex-col, overflow-hidden) away, so the content column
          // shrank to its content and slid under the sidebar.
          isDesktopSidebarCollapsed
            ? isSubmenuOpen
              ? 'md:ml-rail-flyout-content'
              : 'md:ml-rail-content'
            : isSubmenuOpen
              ? 'md:ml-expanded-flyout-content'
              : 'md:ml-60'
        )}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Skip to content
        </a>

        <Header />

        {/* 12px gutters on a phone, 24px from `md`. The page used to keep its
            desktop 16px inset on a 360px screen and then nest a bordered card
            inside it, so a table had 320px to render nine columns in. */}
        <main id="main-content" className="flex-1 overflow-y-auto px-3 pb-24 pt-5 md:px-8 md:pb-10 md:pt-7">
          {/* A page that throws costs the user that page, not the whole app:
              the chrome stays up and the boundary clears on the next route. */}
          <div className="mx-auto w-full max-w-content">
            <RouteErrorBoundary>
              <div key={location.pathname} className="page-enter">
                {children}
              </div>
            </RouteErrorBoundary>
          </div>
        </main>
      </div>
      {/* Rendered as a root sibling, not nested inside #app-content-area: that
       * div is `relative z-30`, which opens its own stacking context, so a
       * z-index set on something nested inside it (this nav used to live
       * there) is only ever compared against other things in that same
       * context — it can never outrank a root-level sibling like the backdrop
       * above, whatever number it carries. The backdrop (root-level, z-40)
       * was silently painting over the entire nested context, footer nav
       * included, so Home/Families/Members/Search stopped receiving taps
       * whenever the mobile menu was open, even in the strip below the sheet
       * that the sheet never visually covers. At the root level the footer
       * nav's z-50 sits above the backdrop (40) but below the menu sheet
       * (60), so it now stays visible and tappable while the menu is open,
       * without the sheet itself losing the top slot. */}
      <MobileFooterNav />
    </div>
  );
}
