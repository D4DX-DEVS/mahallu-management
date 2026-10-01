import { useState, useEffect, useRef } from 'react';
import { FiChevronDown, FiCheck } from 'react-icons/fi';
import { AccountOption } from '@/services/authService';
import { useAccountSwitcher } from '@/hooks/useAccountSwitcher';
import { toTitleCase } from '@/utils/format';
import { cn } from '@/utils/cn';
import { roleLabel, roleIcon } from '@/utils/roleLabels';

/** Exported — the header's unified "Switch Role" control (RoleSwitcher)
 * renders this identical row shape for a user's own sibling accounts. */
export function AccountList({
  accounts,
  isSwitching,
  onSwitch,
}: {
  accounts: AccountOption[];
  isSwitching: boolean;
  onSwitch: (account: AccountOption) => void;
}) {
  return (
    <div className="space-y-1">
      {accounts.map((account) => (
        <button
          key={account.userId}
          type="button"
          disabled={isSwitching}
          onClick={() => onSwitch(account)}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60',
            account.isCurrent && 'bg-primary/5'
          )}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {roleIcon(account.role)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-foreground">{roleLabel(account.role)}</span>
            {(account.instituteName || account.tenantName) && (
              <span className="block truncate text-xs text-muted-foreground">
                {toTitleCase(account.instituteName || account.tenantName || '')}
              </span>
            )}
          </span>
          {account.isCurrent && <FiCheck className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

/**
 * Standalone header control — an icon-and-label trigger that opens its own
 * dropdown, the same shape as TenantSwitcher. For desktop/tablet, where the
 * header row has room for it.
 *
 * Deliberately separate from TenantSwitcher: that control changes which
 * Mahallu a Super Admin is VIEWING under their own existing role (an
 * `x-tenant-id` header, no new session). This control changes which
 * AUTHENTICATED ACCOUNT — role, tenant, institute, permissions, everything —
 * the session actually is. Different weight, different control, never merged.
 */
export default function AccountSwitcher() {
  const { user, accounts, canSwitch, isSwitching, error, handleSwitch } = useAccountSwitcher();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!canSwitch || !user) {
    return null;
  }

  const currentLabel = roleLabel(user.role);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        title={`Switch account (currently ${currentLabel})`}
        aria-label={`Switch account (currently ${currentLabel})`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        disabled={isSwitching}
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-2 text-sm font-medium transition-colors sm:gap-2 sm:px-3',
          isOpen
            ? 'border-border bg-accent text-accent-foreground'
            : 'border-border/60 text-foreground hover:border-border hover:bg-accent hover:text-accent-foreground',
          isSwitching && 'cursor-wait opacity-60'
        )}
      >
        {roleIcon(user.role)}
        <span className="min-w-0 max-w-[76px] truncate sm:max-w-[150px] md:max-w-[190px]">{currentLabel}</span>
        <FiChevronDown className={cn('h-4 w-4 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        // Same viewport-anchored-on-mobile / trigger-anchored-from-sm pattern
        // as TenantSwitcher, so it can never overflow a narrow phone screen.
        <div className="fixed inset-x-4 top-16 z-50 flex max-h-[70vh] flex-col rounded-lg border border-border bg-popover py-2 shadow-md sm:absolute sm:inset-x-auto sm:left-0 sm:top-auto sm:mt-2 sm:max-h-[420px] sm:w-80 sm:max-w-[calc(100vw-2rem)]">
          <p className="border-b border-border px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Switch account
          </p>
          {error && <div className="px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="max-h-[360px] overflow-y-auto p-1">
            <AccountList accounts={accounts} isSwitching={isSwitching} onSwitch={handleSwitch} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The same switcher, without its own trigger/popover — for embedding inside
 * an already-open container, e.g. the header's mobile user-menu popover.
 * Keeps the mobile header from gaining a second crowded control; the
 * behaviour and authorization are identical to the standalone version above.
 */
export function AccountSwitcherInline() {
  const { accounts, canSwitch, isSwitching, error, handleSwitch } = useAccountSwitcher();

  if (!canSwitch) {
    return null;
  }

  return (
    <div className="border-t border-border pt-1">
      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Switch account
      </p>
      {error && <div className="px-3 py-2 text-sm text-destructive">{error}</div>}
      <AccountList accounts={accounts} isSwitching={isSwitching} onSwitch={handleSwitch} />
    </div>
  );
}
