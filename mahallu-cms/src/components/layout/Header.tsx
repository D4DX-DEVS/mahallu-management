import Avatar from '@/components/ui/Avatar';
import { FiMenu, FiBell, FiSun, FiMoon, FiLogOut, FiSearch, FiMail, FiPhone, FiShield, FiCalendar, FiChevronDown, FiChevronRight, FiMapPin, FiAlertTriangle } from 'react-icons/fi';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useLayoutStore } from '@/store/layoutStore';
import { applyTheme } from '@/utils/theme';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { menuItems, MenuItem } from '@/constants/menuItems';
import TenantSwitcher from './TenantSwitcher';
import CommandPalette from '@/components/ui/CommandPalette';
import Modal from '@/components/ui/Modal';
import { tenantService } from '@/services/tenantService';
import { canReadNotifications, canReadTenantInfo } from '@/utils/apiAccess';
import { useNotificationStore } from '@/store/notificationStore';
import { Tenant } from '@/types/tenant';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/** Best-matching menu trail for the current URL (longest path prefix), e.g. Community > Families. */
function findTrail(items: MenuItem[], pathname: string, trail: MenuItem[] = []): MenuItem[] {
  let best: MenuItem[] = [];
  for (const item of items) {
    const next = [...trail, item];
    if (item.path && (pathname === item.path || pathname.startsWith(item.path + '/'))) {
      if (next.length > 0 && (best.length === 0 || item.path.length >= (best[best.length - 1].path?.length ?? 0))) best = next;
    }
    if (item.children) {
      const sub = findTrail(item.children, pathname, next);
      if (sub.length > 0 && (best.length === 0 || (sub[sub.length - 1].path?.length ?? 0) >= (best[best.length - 1].path?.length ?? 0))) best = sub;
    }
  }
  return best;
}

const iconBtn =
  'relative inline-flex h-[34px] w-[34px] max-sm:h-10 max-sm:w-10 items-center justify-center rounded-[10px] border border-line bg-white text-[#3A4741] transition-colors hover:bg-[#F4F7F5] ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:border-surface-border dark:bg-surface-raised dark:text-surface-text dark:hover:bg-surface-hover';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const { user, logout, isSuperAdmin, currentTenantId } = useAuthStore();
  const { isMobileSidebarOpen, setMobileSidebarOpen, toggleDesktopSidebarCollapsed } = useLayoutStore();
  const [mounted, setMounted] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);
  const { unreadCount, fetchUnreadCount } = useNotificationStore();
  const trail = findTrail(menuItems, location.pathname);
  const crumbs = trail.length > 1 ? trail : trail.length === 1 ? [{ id: 'overview', label: 'Overview', path: undefined } as MenuItem, ...trail] : [];
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isViewingAsTenant = isSuperAdmin && currentTenantId;

  useEffect(() => {
    setMounted(true);
    applyTheme();
  }, []);

  const showNotifications = canReadNotifications(user?.role, isSuperAdmin);
  const mayReadTenant = canReadTenantInfo(user?.role, isSuperAdmin);

  useEffect(() => {
    if (!showNotifications) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, showNotifications]);

  useEffect(() => {
    const loadTenantInfo = async () => {
      // Don't load tenant info for super admin without selected tenant
      if (!currentTenantId) {
        setTenantInfo(null);
        return;
      }
      // Member accounts cannot read the tenant: show what the sign-in session already carries.
      if (!mayReadTenant) {
        setTenantInfo(user?.tenant?.name ? ({ id: currentTenantId, name: user.tenant.name, code: '', location: '' } as Tenant) : null);
        return;
      }
      try {
        const data = await tenantService.getById(currentTenantId);
        setTenantInfo(data);
      } catch (err) {
        console.error('Error loading tenant info:', err);
        setTenantInfo(null);
      }
    };
    loadTenantInfo();
  }, [currentTenantId, mayReadTenant, user?.tenant?.name]);

  useEffect(() => {
    if (mounted) {
      applyTheme();
    }
  }, [theme, mounted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleNotificationsClick = () => {
    setShowUserMenu(false);
    navigate(ROUTES.NOTIFICATIONS.INDIVIDUAL);
  };

  const formatMemberSince = (date: string) => {
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  const getAccountTypeLabel = () => {
    if (isSuperAdmin) return 'Super Admin';
    if (user?.role === 'mahall') return 'Mahall Admin';
    if (user?.role === 'survey') return 'Survey Admin';
    if (user?.role === 'institute') return 'Institute Admin';
    if (user?.role === 'member') return 'Member';
    return 'User';
  };

  return (
    <>
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
      
      {/* Viewing as Tenant Banner */}
      {isViewingAsTenant && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 dark:bg-primary-700 text-white text-sm">
          <FiShield className="h-4 w-4" />
          <span className="font-medium">Viewing as Tenant</span>
          <span className="opacity-75">•</span>
          <span className="opacity-90">All data is filtered for the selected tenant</span>
        </div>
      )}
      
      <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center pt-[env(safe-area-inset-top)] justify-between gap-3 border-b border-line bg-white/90 px-3 backdrop-blur-md md:px-6 dark:border-surface-border dark:bg-surface-base/90">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileSidebarOpen(!isMobileSidebarOpen)}
            className={cn(iconBtn, 'lg:hidden')}
            aria-label="Open navigation menu"
          >
            <FiMenu className="h-4 w-4" />
          </button>
          <button
            onClick={toggleDesktopSidebarCollapsed}
            className={cn(iconBtn, 'hidden lg:inline-flex')}
            aria-label="Toggle menu panel"
          >
            <FiMenu className="h-4 w-4" />
          </button>
          {/* Breadcrumb derived from the menu tree */}
          {crumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-xs text-[#7B8983] sm:flex dark:text-surface-muted">
              {crumbs.map((c, i) => (
                <span key={c.id} className="flex min-w-0 items-center gap-2">
                  {i > 0 && <FiChevronRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
                  {i === crumbs.length - 1 ? (
                    <span className="truncate font-bold text-[#18231E] dark:text-surface-text" aria-current="page">{c.label}</span>
                  ) : c.path ? (
                    <Link to={c.path} className="truncate hover:text-[#18231E] dark:hover:text-surface-text">{c.label}</Link>
                  ) : (
                    <span className="truncate">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          {/* Search / Command Palette Trigger */}
          {user?.role !== 'member' && (
            <button
              onClick={() => setShowCommandPalette(true)}
              aria-label="Search menu"
              className="ml-1 flex h-[34px] items-center gap-2 rounded-[10px] border border-line bg-[#F4F7F5] px-3 text-xs text-[#7B8983] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] md:ml-4 md:w-[300px] dark:border-surface-border dark:bg-surface-raised dark:text-surface-muted dark:hover:bg-surface-hover"
            >
              <FiSearch className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden flex-1 text-left md:inline">Search menu</span>
              <kbd className="hidden items-center rounded-[5px] border border-[#D5DDD9] bg-white px-1.5 py-px font-sans text-[10px] md:inline-flex dark:border-surface-border-strong dark:bg-surface-card">
                ⌘K
              </kbd>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
        {/* Tenant Switcher (Super Admin Only) */}
        {isSuperAdmin && <TenantSwitcher />}

        <button
          type="button"
          onClick={handleThemeToggle}
          className={iconBtn}
          aria-label={mounted && theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {mounted && theme === 'dark' ? <FiSun className="h-[15px] w-[15px]" /> : <FiMoon className="h-[15px] w-[15px]" />}
        </button>
        {showNotifications && <button
          type="button"
          onClick={handleNotificationsClick}
          className={iconBtn}
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        >
          <FiBell className="h-[15px] w-[15px]" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-secondary-500 dark:border-surface-raised" />
          )}
        </button>}

        {/* User Menu */}
        <div className="relative ml-1 flex items-center gap-3 border-l border-line pl-3 dark:border-surface-border" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            aria-label="Account menu"
            className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-1 transition-colors hover:bg-[#F4F7F5] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:hover:bg-surface-hover"
          >
            <Avatar name={user?.name} src={user?.photoUrl} size={32} />
            <div className="hidden text-left leading-tight md:block">
              <p className="text-[12.5px] font-bold text-[#18231E] dark:text-surface-text">
                {user?.name || 'User'}
              </p>
              <p className="text-[11px] text-[#7B8983] dark:text-surface-muted">
                {getAccountTypeLabel()}
              </p>
            </div>
            <FiChevronDown className={`h-3.5 w-3.5 text-[#7B8983] transition-transform dark:text-surface-muted ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-5rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-card border border-line bg-white shadow-pop dark:border-surface-border dark:bg-surface-card">
              {/* Blue Banner */}
              <div className="border-b border-line-soft bg-mint px-5 py-4 dark:border-surface-border dark:bg-surface-raised">
                <div className="flex items-center gap-3">
                  <Avatar name={user?.name} src={user?.photoUrl} size={40} status="active" />
                  <div>
                    <p className="text-xs text-[#5B6963] dark:text-surface-muted">Welcome back,</p>
                    <p className="text-base font-extrabold text-primary-700 dark:text-surface-text">{user?.name || 'User'}</p>
                  </div>
                </div>
              </div>

              {/* User Info Cards */}
              <div className="p-4 space-y-3">
                {/* Phone Number */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
                      <FiPhone className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Phone Number</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user?.phone || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Email Address (only if available) */}
                {user?.email && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
                      <FiMail className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Email Address</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>
                )}

                {/* Account Type */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
                      <FiShield className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Account Type</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {getAccountTypeLabel()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Member Since */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
                      <FiCalendar className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Member Since</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user?.joiningDate ? formatMemberSince(user.joiningDate) : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mahallu Info */}
                {tenantInfo && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
                        <FiMapPin className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                          Mahallu
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {tenantInfo.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {tenantInfo.code}
                          {tenantInfo.location ? ` • ${tenantInfo.location}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">
                {/* Notifications */}
                {showNotifications && <button
                  onClick={handleNotificationsClick}
                  aria-label="View notifications"
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group relative"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <FiBell className="h-4 w-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800"></span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                      Notifications
                    </span>
                  </div>
                  <FiChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </button>}

                {/* Theme Toggle */}
                <button
                  onClick={() => {
                    handleThemeToggle();
                    // Keep menu open after toggle
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {mounted && theme === 'dark' ? (
                      <FiSun className="h-4 w-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                    ) : (
                      <FiMoon className="h-4 w-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                      {mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                  </div>
                  <FiChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </button>

                {/* Sign Out */}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <FiLogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      Sign out
                    </span>
                  </div>
                  <FiChevronRight className="h-4 w-4 text-red-400 dark:text-red-500" />
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Confirm Sign Out"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowLogoutConfirm(false);
                handleLogout();
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30">
            <FiAlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to sign out? You will need to log in again to access your account.
          </p>
        </div>
      </Modal>
    </>
  );
}

