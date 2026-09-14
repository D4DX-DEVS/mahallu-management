import {
  FiMenu,
  FiBell,
  FiSun,
  FiMoon,
  FiUser,
  FiLogOut,
  FiSearch,
  FiSettings,
  FiShield,
} from 'react-icons/fi';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useLayoutStore } from '@/store/layoutStore';
import { applyTheme } from '@/utils/theme';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TenantSwitcher from './TenantSwitcher';
import CommandPalette from '@/components/ui/CommandPalette';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useNotificationStore } from '@/store/notificationStore';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';
export default function Header() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const { user, logout, isSuperAdmin, currentTenantId } = useAuthStore();
  const { toggleDesktopSidebarCollapsed, setMobileSidebarOpen } = useLayoutStore();
  const isCommandPaletteOpen = useLayoutStore((s) => s.isCommandPaletteOpen);
  const openCommandPalette = useLayoutStore((s) => s.openCommandPalette);
  const closeCommandPalette = useLayoutStore((s) => s.closeCommandPalette);
  const [mounted, setMounted] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
    if (mounted) applyTheme();
  }, [theme, mounted]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCommandPalette]);
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setShowUserMenu(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showUserMenu]);
  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };
  const accountTypeLabel = () => {
    if (isSuperAdmin) return 'Super admin';
    if (user?.role === 'mahall') return 'Mahall admin';
    if (user?.role === 'survey') return 'Survey admin';
    if (user?.role === 'institute') return 'Institute admin';
    if (user?.role === 'member') return 'Member';
    return 'User';
  };
  const iconButton =
    'inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors ' +
    'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
  const isMember = user?.role === 'member';
  return (
    <>
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />
      {/* The banner sits above the header in the stacking order as well as on screen — it used to be z-40 against a z-30 sticky header, so it overlapped the header instead of stacking with it. */}
      {isViewingAsTenant && (
        <div className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-primary px-4 py-1.5 text-label text-primary-foreground">
          <FiShield className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span className="font-medium">Viewing as tenant</span> <span aria-hidden="true">·</span>
          <span className="hidden sm:inline">All data is filtered to the selected tenant</span>
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
        <button
          onClick={toggleDesktopSidebarCollapsed}
          className={cn(iconButton, 'hidden md:inline-flex')}
          aria-label="Toggle sidebar"
        >
          <FiMenu className="h-5 w-5" />
        </button>
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className={cn(iconButton, 'md:hidden')}
          aria-label="Open navigation"
        >
          <FiMenu className="h-5 w-5" />
        </button>
        {!isMember && (
          <button
            onClick={openCommandPalette}
            className="hidden h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
          >
            <FiSearch className="h-4 w-4" aria-hidden="true" /> <span>Search</span>
            <kbd className="ml-2 rounded-sm border border-border px-1.5 py-0.5 text-xs">Ctrl K</kbd>
          </button>
        )}
        {/* Tenant switcher shares the flex row instead of being absolutely centred, which collided with the search and action clusters at narrow desktop widths. Below lg it was hidden outright, leaving a super admin on a phone with no way to switch tenants — the switcher itself already collapses to an icon-only button there, so it fits. */}
        {isSuperAdmin && (
          <div className="ml-2 min-w-0 flex-shrink-0 sm:max-w-xs lg:flex-1">
            <TenantSwitcher />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => navigate(ROUTES.NOTIFICATIONS.INDIVIDUAL)}
            aria-label={unreadCount > 0 ? 'Notifications, ' + unreadCount + ' unread' : 'Notifications'}
            className={cn(iconButton, 'relative')}
          >
            <FiBell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-xs font-semibold leading-5 text-destructive-foreground tabular-nums"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className={iconButton}
          >
            {mounted && theme === 'dark' ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
          </button>
          <div className="relative ml-1" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu((open) => !open)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </button>
            {showUserMenu && (
              <div
                role="menu"
                aria-label="Account"
                className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
              >
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-foreground">{user?.name || 'User'}</p>
                  <p className="truncate text-label text-muted-foreground">{accountTypeLabel()}</p>
                  {user?.phone && (
                    <p className="truncate text-label text-muted-foreground">{user.phone}</p>
                  )}
                </div>
                <div className="my-1 h-px bg-border" />
                {/* Profile and settings reach the account menu. They used to be four levels deep in the sidebar, while this menu held only Sign out beneath a block of read-only detail. */}
                <Link
                  to={isMember ? ROUTES.MEMBER.PROFILE : ROUTES.MAHALL_MAIN}
                  role="menuitem"
                  onClick={() => setShowUserMenu(false)}
                  className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <FiUser className="h-4 w-4" aria-hidden="true" />
                  {isMember ? 'My profile' : 'Mahall settings'}
                </Link>
                {!isMember && (
                  <Link
                    to="/settings/security"
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <FiSettings className="h-4 w-4" aria-hidden="true" /> Security and access
                  </Link>
                )}
                <div className="my-1 h-px bg-border" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <FiLogOut className="h-4 w-4" aria-hidden="true" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Sign-out is reversible, so it gets the neutral confirm rather than the red destructive treatment with a warning triangle it used to carry. */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Sign out?"
        message="You'll need your phone number and a verification code to sign back in."
        confirmLabel="Sign out"
        variant="primary"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}
