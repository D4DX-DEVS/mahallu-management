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
  FiBookOpen,
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
}

// Primary destinations per role. Anything not here lives in the side menu ("Menu").
// Notifications stay in the header user menu — never repeated here.
export const footerNavByRole: Record<string, FooterItem[]> = {
  member: [
    { id: 'f-member-home', label: 'Home', icon: FiGrid, path: '/member/overview' },
    { id: 'f-member-varisangya', label: 'Varisangya', icon: FiCreditCard, path: '/member/varisangya' },
    { id: 'f-member-payments', label: 'Payments', icon: FiDollarSign, path: '/member/payments' },
    { id: 'f-member-requests', label: 'Requests', icon: FiClipboard, path: '/member/requests' },
  ],
  mahall: [
    { id: 'f-mahall-home', label: 'Home', icon: FiGrid, path: '/dashboard' },
    { id: 'f-mahall-families', label: 'Families', icon: FiHome, path: '/families' },
    { id: 'f-mahall-members', label: 'Members', icon: FiUsers, path: '/members' },
    { id: 'f-mahall-dues', label: 'Dues', icon: FiDollarSign, path: '/collectibles/dues' },
  ],
  super_admin: [
    { id: 'f-sa-home', label: 'Home', icon: FiGrid, path: '/dashboard' },
    { id: 'f-sa-families', label: 'Families', icon: FiHome, path: '/families' },
    { id: 'f-sa-members', label: 'Members', icon: FiUsers, path: '/members' },
    { id: 'f-sa-dues', label: 'Dues', icon: FiDollarSign, path: '/collectibles/dues' },
  ],
  survey: [
    { id: 'f-survey-home', label: 'Home', icon: FiGrid, path: '/dashboard' },
    { id: 'f-survey-survey', label: 'Survey', icon: FiClipboard, path: '/survey' },
    { id: 'f-survey-families', label: 'Families', icon: FiHome, path: '/families' },
    { id: 'f-survey-members', label: 'Members', icon: FiUsers, path: '/members' },
  ],
  institute: [
    { id: 'f-inst-home', label: 'Home', icon: FiGrid, path: '/dashboard' },
    { id: 'f-inst-institutes', label: 'Institutes', icon: FiTarget, path: '/institutes' },
    { id: 'f-inst-staff', label: 'Staff', icon: FiUser, path: '/employees' },
    { id: 'f-inst-daybook', label: 'Day Book', icon: FiBookOpen, path: '/accounting/day-book' },
  ],
};

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

  const role = user?.role || (isSuperAdmin ? 'super_admin' : null);
  const items = role ? footerNavByRole[role] : undefined;
  if (!items) return null;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-slate-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden dark:border-gray-800 dark:bg-gray-900/95">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <Link
            key={item.id}
            to={item.path}
            onClick={() => setMobileSidebarOpen(false)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-[0.62rem] font-medium transition-colors',
              active
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            <span
              className={cn(
                'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                active ? 'bg-primary-100 dark:bg-primary-500/15' : 'bg-transparent'
              )}
            >
              <Icon className="h-[1.1rem] w-[1.1rem]" />
            </span>
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(!isMobileSidebarOpen)}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-1 text-[0.62rem] font-medium transition-colors',
          isMobileSidebarOpen
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200'
        )}
      >
        <span
          className={cn(
            'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
            isMobileSidebarOpen ? 'bg-primary-100 dark:bg-primary-500/15' : 'bg-transparent'
          )}
        >
          <FiMenu className="h-[1.1rem] w-[1.1rem]" />
        </span>
        Menu
      </button>
    </nav>
  );
}
