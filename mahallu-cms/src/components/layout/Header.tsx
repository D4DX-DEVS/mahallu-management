import { FiMenu, FiBell, FiSun, FiMoon, FiUser, FiLogOut, FiSearch, FiMail, FiPhone, FiShield, FiCalendar, FiMapPin, FiAlertTriangle } from 'react-icons/fi';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useLayoutStore } from '@/store/layoutStore';
import { applyTheme } from '@/utils/theme';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TenantSwitcher from './TenantSwitcher';
import CommandPalette from '@/components/ui/CommandPalette';
import Modal from '@/components/ui/Modal';
import { tenantService } from '@/services/tenantService';
import { useNotificationStore } from '@/store/notificationStore';
import { Tenant } from '@/types/tenant';
import { ROUTES } from '@/constants/routes';

export default function Header() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const { user, logout, isSuperAdmin, currentTenantId } = useAuthStore();
  const { toggleDesktopSidebarCollapsed } = useLayoutStore();
  const [mounted, setMounted] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);
  const { unreadCount, fetchUnreadCount } = useNotificationStore();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isViewingAsTenant = isSuperAdmin && currentTenantId;

  useEffect(() => {
    setMounted(true);
    applyTheme();
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const loadTenantInfo = async () => {
      // Don't load tenant info for super admin without selected tenant
      if (!currentTenantId) {
        setTenantInfo(null);
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
  }, [currentTenantId]);

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
      
      <header className="sticky top-0 z-30 relative flex h-16 items-center justify-between border-b border-gray-200/50 bg-white/80 backdrop-blur-md px-4 md:px-6 shadow-[0_4px_16px_rgba(15,23,42,0.06)] dark:border-gray-800/50 dark:bg-gray-900/80 dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
        {/* Tenant Switcher (Super Admin Only) — centered in header */}
        {isSuperAdmin && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <TenantSwitcher />
          </div>
        )}

        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile: no header buttons — footer nav "Menu" opens the sidebar */}
          <button
            onClick={toggleDesktopSidebarCollapsed}
            className="hidden md:inline-flex p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Toggle sidebar"
          >
            <FiMenu className="h-5 w-5" />
          </button>
          {/* Search / Command Palette Trigger */}
          {user?.role !== 'member' && (
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-gray-500 bg-gray-100/80 rounded-lg hover:bg-gray-200/80 dark:bg-gray-800/80 dark:hover:bg-gray-700/80 dark:text-gray-400 transition-colors"
            >
              <FiSearch className="h-4 w-4" />
              <span className="hidden md:inline">Search menu...</span>
              <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded">
                ⌘K
              </kbd>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
        {/* Notifications */}
        <button
          onClick={handleNotificationsClick}
          aria-label="View notifications"
          className="relative inline-flex p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <FiBell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[1rem] h-4 rounded-full bg-red-500 px-1 text-center text-[0.6rem] font-semibold leading-4 text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={handleThemeToggle}
          aria-label="Toggle theme"
          className="inline-flex p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {mounted && theme === 'dark' ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
        </button>

        {/* User Menu */}
        <div className="flex items-center gap-3 ml-2 pl-4 border-l border-gray-200/50 dark:border-gray-700/50 relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="Open user menu"
            className="flex items-center p-1 rounded-full hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-colors"
          >
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center ring-2 ring-white dark:ring-gray-800 relative">
              <FiUser className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></span>
            </div>
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 origin-top-right rounded-2xl border border-gray-200/70 bg-white/95 backdrop-blur-xl shadow-2xl shadow-gray-900/10 ring-1 ring-black/5 overflow-hidden z-50 dark:border-gray-700/60 dark:bg-gray-900/95 dark:shadow-black/40">
              {/* Identity */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <div className="relative h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-900" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {user?.name || 'User'}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {getAccountTypeLabel()}
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[0.68rem] font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                  <FiShield className="h-3 w-3" />
                  {getAccountTypeLabel()}
                </span>
                {user?.joiningDate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[0.68rem] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    <FiCalendar className="h-3 w-3" />
                    Since {formatMemberSince(user.joiningDate)}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="border-t border-gray-100 px-4 py-2.5 text-xs dark:border-gray-800">
                {user?.phone && (
                  <div className="flex items-center gap-2 py-1 text-gray-600 dark:text-gray-400">
                    <FiPhone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{user.phone}</span>
                  </div>
                )}
                {user?.email && (
                  <div className="flex items-center gap-2 py-1 text-gray-600 dark:text-gray-400">
                    <FiMail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                )}
                {tenantInfo && (
                  <div className="flex items-start gap-2 py-1 text-gray-600 dark:text-gray-400">
                    <FiMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {tenantInfo.name}
                      <span className="text-gray-400 dark:text-gray-500">
                        {' · '}
                        {tenantInfo.code}
                        {tenantInfo.location ? ` · ${tenantInfo.location}` : ''}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-gray-100 p-1.5 dark:border-gray-800">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <FiLogOut className="h-4 w-4" />
                  Sign out
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

