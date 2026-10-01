import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authService, AccountOption } from '@/services/authService';
import { ROUTES } from '@/constants/routes';

/**
 * All of the "switch to another of my own accounts" behaviour — fetching
 * what's authorized, switching, error state. Every option comes straight
 * from `GET /auth/available-accounts`; nothing is computed or guessed
 * client-side, and switching only ever sends `targetUserId` to the backend,
 * which alone decides whether it's allowed.
 *
 * Shared by AccountSwitcher's own render surfaces and by the header's
 * unified "Switch Role" control (RoleSwitcher), so there is exactly one
 * place this data source and flow lives — not a second, duplicate
 * available-accounts query.
 */
export function useAccountSwitcher() {
  const { user, setUser, setToken } = useAuthStore();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    authService
      .getAvailableAccounts()
      .then((data) => setAccounts(data))
      .catch(() => setAccounts([]))
      .finally(() => setHasLoaded(true));
  }, [user?.id]);

  const handleSwitch = async (account: AccountOption) => {
    if (account.isCurrent || isSwitching) return;
    try {
      setIsSwitching(true);
      setError(null);
      const response = await authService.switchAccount(account.userId);
      setUser(response.user);
      setToken(response.token);
      // A full reload, not a client-side navigate — every store (tenant
      // features, notifications, layout) needs to recompute for the new
      // account, not just the route. TenantSwitcher uses the same approach
      // when its own context changes, for the same reason.
      window.location.href = response.user.role === 'member' ? ROUTES.MEMBER.OVERVIEW : ROUTES.DASHBOARD;
    } catch {
      setError("Couldn't switch accounts. Please try again.");
      setIsSwitching(false);
    }
  };

  const otherAccounts = accounts.filter((a) => !a.isCurrent);
  const canSwitch = !!user && hasLoaded && otherAccounts.length > 0;

  return { user, accounts, canSwitch, isSwitching, error, handleSwitch };
}
