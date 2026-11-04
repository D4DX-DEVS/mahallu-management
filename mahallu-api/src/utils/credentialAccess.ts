/**
 * Who may change whose sign-in details (username and password).
 *
 * Decided on the server from the signed-in account and the target record, never from anything the
 * client says about itself.
 *
 *   Super Admin  - any Mahallu admin, survey or institute account. Not another Super Admin, not self.
 *   Mahallu admin - the survey and institute accounts of their OWN Mahallu. Not other admins (those are
 *                  the platform's to manage), not self (that is "change password"), nothing in another
 *                  Mahallu - which is answered as "not found" so existence is not revealed.
 *   Everyone else - nothing.
 *
 * Member accounts have no password sign-in (they use an OTP to their own phone), so they have no
 * credentials to manage here.
 */

export const STAFF_LOGIN_ROLES = ['mahall', 'survey', 'institute'] as const;

type PermissionSet = { view?: boolean; add?: boolean; edit?: boolean; delete?: boolean; sensitiveModules?: string[] } | undefined | null;

/**
 * True when `requested` would give an account access it does not have in `current`: a flag switched on
 * that was off, or a restricted module added. Used so an administrator editing THEIR OWN record can keep
 * or reduce their access but never widen it; widening is for someone else to grant.
 */
export const widensPermissions = (current: PermissionSet, requested: unknown): boolean => {
  if (!requested || typeof requested !== 'object' || Array.isArray(requested)) return false;
  const next = requested as NonNullable<PermissionSet>;
  for (const flag of ['view', 'add', 'edit', 'delete'] as const) {
    if (next[flag] === true && current?.[flag] !== true) return true;
  }
  if (Array.isArray(next.sensitiveModules)) {
    const held = new Set(current?.sensitiveModules ?? []);
    if (next.sensitiveModules.some((module) => !held.has(module))) return true;
  }
  return false;
};

export interface CredentialActor {
  id: string;
  role?: string;
  isSuperAdmin?: boolean;
  tenantId?: string;
  /** A Super Admin "View As" session: reshaped to look like another role, never allowed to change credentials. */
  impersonating?: boolean;
}

export interface CredentialTarget {
  id: string;
  role: string;
  tenantId?: string | null;
}

export type CredentialDecision = { ok: true } | { ok: false; status: number; message: string };

const NOT_FOUND = "We couldn't find that user. It may have been removed.";

export const decideCredentialAccess = (actor: CredentialActor, target: CredentialTarget): CredentialDecision => {
  if (actor.impersonating) {
    return { ok: false, status: 403, message: "Sign-in details can't be changed while viewing as another account." };
  }

  const isSuperAdmin = actor.isSuperAdmin === true;
  const isMahallAdmin = !isSuperAdmin && actor.role === 'mahall';
  if (!isSuperAdmin && !isMahallAdmin) {
    return { ok: false, status: 403, message: "You don't have permission to do this. Please contact your Mahallu admin." };
  }

  // A Mahallu admin never learns that a user of another Mahallu exists.
  if (isMahallAdmin && (!actor.tenantId || String(target.tenantId ?? '') !== String(actor.tenantId))) {
    return { ok: false, status: 404, message: NOT_FOUND };
  }

  if (String(target.id) === String(actor.id)) {
    return { ok: false, status: 403, message: 'To change your own password, use Change password in your profile.' };
  }

  if (target.role === 'super_admin') {
    return { ok: false, status: 403, message: "A platform administrator's sign-in details can't be changed here." };
  }

  if (target.role === 'member') {
    return { ok: false, status: 400, message: 'Member accounts sign in with an OTP to their own phone, so they have no password to manage.' };
  }

  if (!(STAFF_LOGIN_ROLES as readonly string[]).includes(target.role)) {
    return { ok: false, status: 400, message: "That account type doesn't have sign-in details to manage." };
  }

  if (isMahallAdmin && target.role === 'mahall') {
    return {
      ok: false,
      status: 403,
      message: "Only the platform administrator can change another Mahallu admin's sign-in details.",
    };
  }

  return { ok: true };
};
