import { useState } from 'react';
import { FiEye, FiX } from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { ROUTES } from '@/constants/routes';
import { toTitleCase } from '@/utils/format';
import { roleLabel } from '@/utils/roleLabels';
import { errorMessage } from '@/utils/errors';
import { toast } from '@/store/toastStore';
import { logError } from '@/utils/safeLog';

/**
 * Rendered once, full-bleed above the entire app shell — same placement as
 * TenantBanner, and the two never show together: isSuperAdmin is false for
 * the whole duration of an impersonation session, so TenantBanner (which
 * only renders for a super admin viewing a tenant) is already hidden by that
 * existing check alone, with no new condition needed here.
 *
 * Calm, not alarming — warning tokens rather than destructive/red, since
 * this is an expected, authorized testing tool, not an error state.
 */
export default function ImpersonationBanner() {
  const { impersonationContext, setUser, setToken, resetSessionContext } = useAuthStore();
  const [isExiting, setIsExiting] = useState(false);

  if (!impersonationContext) {
    return null;
  }

  const contextLabel = [impersonationContext.instituteName, impersonationContext.memberName, impersonationContext.tenantName]
    .filter(Boolean)[0];

  const handleExit = async () => {
    if (isExiting) return;
    try {
      setIsExiting(true);
      const response = await authService.exitImpersonation();
      setUser(response.user);
      setToken(response.token);
      // Also drops the impersonated Mahallu's module flags, which would otherwise survive the reload.
      resetSessionContext();
      window.location.href = ROUTES.DASHBOARD;
    } catch (err) {
      // Staying silent left the banner looking stuck: say that the exit failed.
      logError('Exit role switch failed', err);
      toast.error(errorMessage(err, { action: 'exit role switch' }));
      setIsExiting(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[65] flex h-9 flex-shrink-0 items-center justify-center gap-2 bg-warning px-3 text-label text-warning-foreground sm:px-4">
      <FiEye className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate font-medium">
        Viewing as {roleLabel(impersonationContext.role)}
        {contextLabel ? ` · ${toTitleCase(contextLabel)}` : ''}
      </span>
      <button
        type="button"
        onClick={handleExit}
        disabled={isExiting}
        className="ml-1 flex flex-shrink-0 items-center gap-1 rounded-sm bg-warning-foreground/15 px-2 py-0.5 text-label font-medium transition-colors hover:bg-warning-foreground/25 disabled:opacity-60"
      >
        <FiX className="h-3 w-3" aria-hidden="true" />
        <span className="hidden sm:inline">{isExiting ? 'Exiting…' : 'Exit Role Switch'}</span>
      </button>
    </div>
  );
}
