import {
  FiMenu,
  FiBell,
  FiUser,
  FiLogOut,
  FiSearch,
  FiShield,
  FiActivity,
  FiHelpCircle,
  FiSun,
  FiMoon,
} from 'react-icons/fi';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useLayoutStore } from '@/store/layoutStore';
import { applyTheme } from '@/utils/theme';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import TenantSwitcher from './TenantSwitcher';
import RoleSwitcher from './RoleSwitcher';
import CommandPalette from '@/components/ui/CommandPalette';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useNotificationStore } from '@/store/notificationStore';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';
export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeStore();
  const { user, logout, isSuperAdmin } = useAuthStore();
  const { setMobileSidebarOpen } = useLayoutStore();
  const isCommandPaletteOpen = useLayoutStore((s) => s.isCommandPaletteOpen);
  const openCommandPalette = useLayoutStore((s) => s.openCommandPalette);
  const closeCommandPalette = useLayoutStore((s) => s.closeCommandPalette);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { unreadCount, fetchUnreadCount } = useNotificationStore();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    applyTheme();
  }, []);
  const isDashboard = location.pathname === ROUTES.DASHBOARD;
  const firstName = user?.name?.split(' ')[0];
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);
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
    'inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors ' +
    'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
  const isMember = user?.role === 'member';
  return (
    <>
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />
      <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-3 border-b border-border/80 bg-card/95 px-4 shadow-[0_1px_0_hsl(var(--border)/0.55)] backdrop-blur md:px-8">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className={cn(iconButton, 'flex-shrink-0 md:hidden')}
          aria-label="Open navigation"
        >
          <FiMenu className="h-5 w-5" />
        </button>
        {isDashboard && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight text-foreground">
              Welcome back{firstName ? `, ${firstName}` : ''}
            </p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              What needs your attention across the mahallu today.
            </p>
          </div>
        )}
        {/* Tenant switcher shares the flex row instead of being absolutely centred, which collided with the search and action clusters at narrow desktop widths. Below lg it was hidden outright, leaving a super admin on a phone with no way to switch tenants — the switcher itself already collapses to an icon-only button there, so it fits. */}
        {isSuperAdmin && (
          <div className="ml-2 min-w-0 flex-shrink sm:max-w-xs sm:flex-shrink-0 lg:flex-1">
            <TenantSwitcher />
          </div>
        )}
        <div className="ml-auto flex flex-shrink-0 items-center gap-1.5 border-l border-border/60 pl-2.5 sm:gap-2 sm:pl-4">
          {/* Desktop/tablet only — the mobile equivalent lives inside the user
           * menu popover below rather than adding a second control to an
           * already-tight mobile header row. RoleSwitcher renders nothing of
           * its own when the signed-in person has no second role to switch
           * to, so this never leaves an empty placeholder in the row. */}
          <div className="hidden md:block">
            <RoleSwitcher />
          </div>
          {!isMember && (
            <button
              onClick={openCommandPalette}
              className="hidden h-10 min-w-44 items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
            >
              <FiSearch className="h-4 w-4" aria-hidden="true" /> <span>Search</span>
              <kbd className="ml-2 rounded-sm border border-border px-1.5 py-0.5 text-xs">Ctrl K</kbd>
            </button>
          )}
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
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </button>
            {showUserMenu && (
              <div
                role="menu"
                aria-label="Account"
                className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-md"
              >
                <div role="presentation" className="px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-foreground">{user?.name || 'User'}</p>
                  <p className="truncate text-label text-muted-foreground">{accountTypeLabel()}</p>
                  {user?.phone && (
                    <p className="truncate text-label text-muted-foreground">{user.phone}</p>
                  )}
                </div>
                <div role="separator" className="my-1 h-px bg-border" />
                <div role="group" aria-labelledby="account-menu-account">
                  <p id="account-menu-account" className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Account
                  </p>
                  <Link
                    to={isMember ? ROUTES.MEMBER.PROFILE : ROUTES.MAHALL_MAIN}
                    role="menuitem"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <FiUser className="h-4 w-4" aria-hidden="true" />
                    {isMember ? 'My profile' : 'Mahall settings'}
                  </Link>
                </div>
                {!isMember && (
                  <div role="group" aria-labelledby="account-menu-workspace">
                    <p id="account-menu-workspace" className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Workspace
                    </p>
                    <Link
                      to="/settings/security"
                      role="menuitem"
                      onClick={() => setShowUserMenu(false)}
                      className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <FiShield className="h-4 w-4" aria-hidden="true" /> Security and access
                    </Link>
                    <Link
                      to="/social/activity-logs"
                      role="menuitem"
                      onClick={() => setShowUserMenu(false)}
                      className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <FiActivity className="h-4 w-4" aria-hidden="true" /> Activity history
                    </Link>
                    <Link
                      to={ROUTES.SOCIAL.SUPPORT}
                      role="menuitem"
                      onClick={() => setShowUserMenu(false)}
                      className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <FiHelpCircle className="h-4 w-4" aria-hidden="true" /> Support
                    </Link>
                  </div>
                )}
                {/* Mobile only — desktop/tablet gets the standalone RoleSwitcher
                 * in the header row instead. The same component is reused as-is:
                 * its own dropdown is fixed/viewport-anchored, so it isn't
                 * clipped by this popover's bounds. The divider lives on
                 * RoleSwitcher's own root (via `className`) rather than an
                 * always-present wrapper here, so a single-role person who
                 * gets no control also gets no empty bordered gap. */}
                <RoleSwitcher className="border-t border-border pt-1 md:hidden" />
                <div role="separator" className="my-1 h-px bg-border" />
                <div role="group" aria-labelledby="account-menu-session">
                  <p id="account-menu-session" className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Session
                  </p>
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
