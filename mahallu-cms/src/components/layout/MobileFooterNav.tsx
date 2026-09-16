import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiGrid,
  FiHome,
  FiUsers,
  FiCreditCard,
  FiDollarSign,
  FiClipboard,
  FiTarget,
  FiUser,
  FiSearch,
  FiMenu,
} from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import { useLayoutStore } from '@/store/layoutStore';
import { cn } from '@/utils/cn';
interface FooterItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
} // Primary destinations per role. Anything not here lives in the side menu ("Menu").
export const footerNavByRole: Record<string, FooterItem[]> = {
  member: [
    { id: 'f-member-home', label: 'Home', icon: FiGrid, path: '/member/overview' },
    { id: 'f-member-varisangya', label: 'Varisangya', icon: FiCreditCard, path: '/member/varisangya' },
    { id: 'f-member-payments', label: 'Payments', icon: FiDollarSign, path: '/member/payments' },
  ],
  mahall: [
    { id: 'f-mahall-home', label: 'Home', icon: FiGrid, path: '/dashboard' },
    { id: 'f-mahall-families', label: 'Families', icon: FiHome, path: '/families' },
    { id: 'f-mahall-members', label: 'Members', icon: FiUsers, path: '/members' },
  ],
  super_admin: [
    { id: 'f-sa-home', label: 'Home', icon: FiGrid, path: '/dashboard' },
    { id: 'f-sa-families', label: 'Families', icon: FiHome, path: '/families' },
    { id: 'f-sa-members', label: 'Members', icon: FiUsers, path: '/members' },
  ],
  survey: [
    { id: 'f-survey-home', label: 'Home', icon: FiGrid, path: '/dashboard' },
    { id: 'f-survey-survey', label: 'Survey', icon: FiClipboard, path: '/survey' },
    { id: 'f-survey-families', label: 'Families', icon: FiHome, path: '/families' },
  ],
  institute: [
    { id: 'f-inst-home', label: 'Home', icon: FiGrid, path: '/dashboard' },
    { id: 'f-inst-institutes', label: 'Institutes', icon: FiTarget, path: '/institutes' },
    { id: 'f-inst-staff', label: 'Staff', icon: FiUser, path: '/employees' },
  ],
}; /** Institute day book keeps a home in the side menu; see menuItems. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}
export default function MobileFooterNav() {
  const location = useLocation();
  const { user, isSuperAdmin } = useAuthStore();
  const { isMobileSidebarOpen, setMobileSidebarOpen } = useLayoutStore();
  const openCommandPalette = useLayoutStore((s) => s.openCommandPalette);
  const role = user?.role || (isSuperAdmin ? 'super_admin' : null);
  const items = role ? footerNavByRole[role] : undefined;
  if (!items) return null;
  const isActive = (path: string) =>
    location.pathname === path ||
    location.pathname.startsWith(
      path + '/'
    ); /* Rows are min-h-16 with 11px labels — the previous 9.9px label was below the * readability floor on the product's primary device. */
  const itemClass = (active: boolean) =>
    cn(
      'flex flex-1 flex-col items-center justify-center gap-1 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      active ? 'text-primary' : 'text-muted-foreground'
    );
  const iconWrap = (active: boolean) =>
    cn(
      'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
      active ? 'bg-primary/10' : 'bg-transparent'
    );
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-card pb-safe md:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <Link
            key={item.id}
            to={item.path}
            onClick={() => setMobileSidebarOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={itemClass(active)}
          >
            <span className={iconWrap(active)} aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
      {/* Search reaches the phone. It used to be `hidden md:flex` in the header
          with no mobile equivalent, so the primary device had no way to find a
          record except by browsing the menu. */}
      <button type="button" onClick={openCommandPalette} className={itemClass(false)}>
        <span className={iconWrap(false)} aria-hidden="true">
          <FiSearch className="h-5 w-5" />
        </span>
        Search
      </button>
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(!isMobileSidebarOpen)}
        aria-expanded={isMobileSidebarOpen}
        className={itemClass(isMobileSidebarOpen)}
      >
        <span className={iconWrap(isMobileSidebarOpen)} aria-hidden="true">
          <FiMenu className="h-5 w-5" />
        </span>
        Menu
      </button>
    </nav>
  );
}
