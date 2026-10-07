import { useState, useEffect, useRef } from 'react';
import { FiChevronDown, FiChevronLeft } from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import { authService, ImpersonatableRole } from '@/services/authService';
import { tenantService } from '@/services/tenantService';
import { instituteService } from '@/services/instituteService';
import { memberService } from '@/services/memberService';
import { Tenant } from '@/types/tenant';
import { Institute, Member } from '@/types';
import { ROUTES } from '@/constants/routes';
import { toTitleCase } from '@/utils/format';
import { cn } from '@/utils/cn';
import { roleLabel, roleIcon } from '@/utils/roleLabels';
import Button from '@/components/ui/Button';
import { useAccountSwitcher } from '@/hooks/useAccountSwitcher';
import { AccountList } from './AccountSwitcher';

const TARGET_ROLES: ImpersonatableRole[] = ['mahall', 'institute', 'member', 'survey'];

/** One line of context under each role name — mirrors AccountSwitcher's
 * icon + name + subtitle row so both option lists share the same rhythm. */
const ROLE_DESCRIPTIONS: Record<ImpersonatableRole, string> = {
  mahall: "Manage a Mahallu's records and settings",
  institute: 'View and manage a specific institute',
  member: "View a member's own portal",
  survey: 'Fill and manage household surveys',
};

/** Reads a server-provided message off an Axios-style error, falling back to
 * a generic one only when the backend didn't send one (network failure,
 * unexpected shape) — so a specific 400/403/429 reason reaches the user
 * instead of being collapsed into the same string every time. */
const impersonationErrorMessage = (error: unknown): string => {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === 'string' && message.trim().length > 0
    ? message
    : "Couldn't switch to that role. Please check your selection and try again.";
};

/**
 * The one header control for moving between roles. It covers two genuinely
 * separate capabilities behind a single "Switch Role" trigger — kept as one
 * control (not two competing ones) because the UI architecture already made
 * this the one header slot for role movement, but the two are never conflated
 * into a single "multi-role" concept:
 *
 *  A. REAL MULTI-ROLE SWITCHING — `hasMultipleRealRoles` below. Other active
 *     User documents that already exist for this person's own phone number
 *     (see authController.switchAccount / getAvailableAccounts, reused here
 *     via useAccountSwitcher — the exact same data source AccountSwitcher
 *     used, not a second query). This, and only this, is "multi-role": it
 *     counts actual active accounts, nothing else. Switching is authorized
 *     purely by phone ownership, validated server-side. Rendered as "Your
 *     roles" below, and listing only the roles this specific person actually
 *     has — never the fixed 4-role set.
 *
 *  B. SUPER ADMIN "VIEW AS" — `isSuperAdmin` below, read independently. A
 *     genuinely privileged, unrelated capability to temporarily exercise a
 *     role/tenant/institute/member combination that may not correspond to
 *     any account this person owns. Authorized purely by the caller
 *     genuinely being Super Admin right now, revalidated server-side on
 *     every call. See authController.startImpersonation. A Super Admin
 *     holding this capability is NOT the same thing as a Super Admin having
 *     "multiple roles" — `isSuperAdmin` is never added into a role/account
 *     count, it is its own independent reason the control has something to
 *     show. Rendered as "View as" below.
 *
 * The control itself is visible whenever EITHER (A) or (B) has something to
 * offer — otherwise there would be a header slot with nothing in it for a
 * genuine multi-role or Super Admin person. A single-role, non-Super-Admin
 * person sees nothing at all, which is the actual product requirement this
 * component exists to satisfy.
 *
 * The top banner (ImpersonationBanner) is a separate, persistent indicator
 * for an active impersonation session and owns the "exit" affordance — this
 * control is hidden entirely while impersonating rather than relabeling
 * itself, so it never flips to an "Exit" state on some pages and not others.
 */
export default function RoleSwitcher({ className }: { className?: string } = {}) {
  const { user, isSuperAdmin, isImpersonating, setUser, setToken, setImpersonation, resetSessionContext } = useAuthStore();
  const {
    accounts,
    canSwitch: hasMultipleRealRoles,
    isSwitching,
    error: accountSwitchError,
    handleSwitch,
  } = useAccountSwitcher();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'role' | 'context'>('role');
  const [selectedRole, setSelectedRole] = useState<ImpersonatableRole | null>(null);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [instituteId, setInstituteId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState('');

  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const reset = () => {
    setStep('role');
    setSelectedRole(null);
    setTenantId('');
    setInstitutes([]);
    setInstituteId('');
    setMemberSearch('');
    setMembers([]);
    setMemberId('');
    setError(null);
  };

  const handlePickRole = async (role: ImpersonatableRole) => {
    // The person already holds this role on their own account — go straight
    // to the Mahallu/institute that account is assigned to instead of asking
    // them to pick one. The picker below is only for viewing as a role they
    // have no account for.
    const ownAccount = accounts.find((a) => a.role === role && !a.isCurrent);
    if (ownAccount) {
      handleSwitch(ownAccount);
      return;
    }

    setSelectedRole(role);
    setStep('context');
    setError(null);
    if (tenants.length === 0) {
      try {
        setIsLoadingTenants(true);
        const response = await tenantService.getAll({ status: 'active', limit: 100 });
        setTenants(response.data || []);
      } catch {
        setError("Couldn't load Mahallus. Please try again.");
      } finally {
        setIsLoadingTenants(false);
      }
    }
  };

  // A tenant chosen explicitly here, not whatever TenantSwitcher currently
  // has selected — institutes/members must belong to THIS tenant, so the
  // fetch is scoped by an explicit tenantId param (the same fallback the
  // backend already offers a super admin), not the request interceptor's
  // ambient x-tenant-id header.
  useEffect(() => {
    setInstituteId('');
    setInstitutes([]);
    setMemberId('');
    setMembers([]);
    setMemberSearch('');
    if (!tenantId || !selectedRole) return;

    if (selectedRole === 'institute') {
      setIsLoadingContext(true);
      instituteService
        .getAll({ status: 'active', limit: 100, tenantId })
        .then((response) => setInstitutes(response.data || []))
        .catch(() => setError("Couldn't load institutes. Please try again."))
        .finally(() => setIsLoadingContext(false));
    }
  }, [tenantId, selectedRole]);

  useEffect(() => {
    if (selectedRole !== 'member' || !tenantId) return;
    const handle = window.setTimeout(() => {
      setIsLoadingContext(true);
      memberService
        .getAll({ search: memberSearch || undefined, limit: 20, tenantId })
        .then((response) => setMembers(response.data || []))
        .catch(() => setError("Couldn't load members. Please try again."))
        .finally(() => setIsLoadingContext(false));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [tenantId, memberSearch, selectedRole]);

  const canContinue =
    !!selectedRole &&
    !!tenantId &&
    (selectedRole !== 'institute' || !!instituteId) &&
    (selectedRole !== 'member' || !!memberId);

  const handleContinue = async () => {
    if (!selectedRole || !tenantId || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const response = await authService.startImpersonation({
        targetRole: selectedRole,
        tenantId,
        instituteId: selectedRole === 'institute' ? instituteId : undefined,
        memberId: selectedRole === 'member' ? memberId : undefined,
      });

      const tenant = tenants.find((t) => t.id === tenantId);
      const institute = institutes.find((i) => i.id === instituteId);
      const member = members.find((m) => m.id === memberId);

      setUser(response.user);
      setToken(response.token);
      // Same as an account switch: nothing of the previous context (module flags) carries into the new one.
      resetSessionContext();
      setImpersonation({
        role: selectedRole,
        tenantName: tenant?.name || '',
        instituteName: institute?.name || null,
        memberName: member?.name || null,
      });

      window.location.href = selectedRole === 'member' ? ROUTES.MEMBER.OVERVIEW : ROUTES.DASHBOARD;
    } catch (err) {
      setError(impersonationErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  // Hidden while an impersonation session is active — ImpersonationBanner is
  // the dedicated, persistent UI for that state (including exiting it), so
  // this control never relabels itself based on route or state and always
  // means the same thing: "Switch Role".
  if (isImpersonating) {
    return null;
  }

  // The control shows when EITHER independent reason applies — never
  // `isSuperAdmin` alone treated as "has multiple roles": a Super Admin with
  // zero sibling accounts still sees the control (for View As, reason B),
  // and an ordinary person with two or more active accounts sees it with no
  // Super Admin capability at all (reason A, the actual multi-role rule).
  const hasAnyRoleSwitchOption = hasMultipleRealRoles || isSuperAdmin;
  if (!hasAnyRoleSwitchOption) {
    return null;
  }

  const currentRole = user?.role || (isSuperAdmin ? 'super_admin' : '');
  const currentRoleLabel = roleLabel(currentRole);

  return (
    <div
      className={cn('relative', className)}
      ref={dropdownRef}
    >
      <button
        onClick={() => {
          setIsOpen((open) => !open);
          if (isOpen) reset();
        }}
        title={`Switch role (currently ${currentRoleLabel})`}
        aria-label={`Switch role (currently ${currentRoleLabel})`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-2 text-sm font-medium transition-colors sm:gap-2 sm:px-3',
          isOpen
            ? 'border-border bg-accent text-accent-foreground'
            : 'border-border/60 text-foreground hover:border-border hover:bg-accent hover:text-accent-foreground'
        )}
      >
        {roleIcon(currentRole)}
        <span className="min-w-0 max-w-[76px] truncate sm:max-w-[150px] md:max-w-[190px]">Switch Role</span>
        <FiChevronDown className={cn('h-4 w-4 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 top-16 z-50 flex max-h-[70vh] flex-col rounded-lg border border-border bg-popover py-2 shadow-md sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-[480px] sm:w-96 sm:max-w-[calc(100vw-2rem)]">
          {step === 'role' ? (
            <div className="space-y-1 overflow-y-auto p-1">
              {hasMultipleRealRoles && (
                <>
                  <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Your roles
                  </p>
                  {accountSwitchError && (
                    <div className="px-3 py-2 text-sm text-destructive">{accountSwitchError}</div>
                  )}
                  <AccountList accounts={accounts} isSwitching={isSwitching} onSwitch={handleSwitch} />
                </>
              )}

              {isSuperAdmin && (
                <>
                  <p
                    className={cn(
                      'px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                      hasMultipleRealRoles && 'mt-1 border-t border-border pt-2'
                    )}
                  >
                    View as
                  </p>
                  {TARGET_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handlePickRole(role)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {roleIcon(role)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{roleLabel(role)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border px-2 pb-2">
                <button
                  type="button"
                  onClick={() => setStep('role')}
                  aria-label="Back to role list"
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <FiChevronLeft className="h-4 w-4" />
                </button>
                <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-foreground">
                  {selectedRole && roleLabel(selectedRole)}
                </p>
              </div>

              <div className="space-y-3 overflow-y-auto p-3">
                {error && <div className="text-sm text-destructive">{error}</div>}

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Select Mahallu</label>
                  <select
                    aria-label="Select Mahallu"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    disabled={isLoadingTenants}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{isLoadingTenants ? 'Loading…' : 'Choose a Mahallu'}</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {toTitleCase(t.name)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRole === 'institute' && tenantId && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Select Institute</label>
                    <select
                      aria-label="Select Institute"
                      value={instituteId}
                      onChange={(e) => setInstituteId(e.target.value)}
                      disabled={isLoadingContext}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">{isLoadingContext ? 'Loading…' : 'Choose an institute'}</option>
                      {institutes.map((i) => (
                        <option key={i.id} value={i.id}>
                          {toTitleCase(i.name)}
                        </option>
                      ))}
                    </select>
                    {!isLoadingContext && institutes.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">No institutes in this Mahallu.</p>
                    )}
                  </div>
                )}

                {selectedRole === 'member' && tenantId && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Select Member</label>
                    <input
                      type="text"
                      aria-label="Search members"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search members…"
                      className="mb-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border">
                      {isLoadingContext ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>
                      ) : members.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">No members found.</p>
                      ) : (
                        members.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setMemberId(m.id)}
                            className={cn(
                              'block w-full truncate px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                              memberId === m.id && 'bg-primary/10 text-primary'
                            )}
                          >
                            {toTitleCase(m.name)}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full"
                  disabled={!canContinue || isSubmitting}
                  isLoading={isSubmitting}
                  loadingText="Switching"
                  onClick={handleContinue}
                >
                  Continue
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
