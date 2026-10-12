import type { User } from '@/types';

/**
 * What the CMS may ask the API for, by role. Mirrors authMiddleware in mahallu-api:
 * member (mobile portal) accounts are limited to /auth, /member-user, /dashboard/stats and
 * read-only announcements, so the admin shell must not call anything else for them.
 */
type Role = User['role'] | undefined | null;

const isPortalOnly = (role: Role, isSuperAdmin?: boolean) => role === 'member' && !isSuperAdmin;

/** GET /tenants/:id (tenant name, module features). */
export const canReadTenantInfo = (role: Role, isSuperAdmin?: boolean) => !isPortalOnly(role, isSuperAdmin);

/** GET /notifications (bell and unread count). */
export const canReadNotifications = (role: Role, isSuperAdmin?: boolean) => !isPortalOnly(role, isSuperAdmin);

const isAdminish = (role: Role, isSuperAdmin?: boolean) => !!isSuperAdmin || role === 'super_admin' || role === 'mahall';

/** GET /dashboard/financial-summary and /dashboard/overview (API: super_admin, mahall, institute). */
export const canReadFinancialDashboard = (role: Role, isSuperAdmin?: boolean) =>
  isAdminish(role, isSuperAdmin) || role === 'institute';

/** Committees, meetings and expiring-committee lookups (committee menu and routes are super_admin and mahall only). */
export const canReadCommittees = (role: Role, isSuperAdmin?: boolean) => isAdminish(role, isSuperAdmin);

/** Master-account ledger items (finance menu: super_admin, mahall, institute). */
export const canReadLedger = (role: Role, isSuperAdmin?: boolean) =>
  isAdminish(role, isSuperAdmin) || role === 'institute';

/** Collectible dues (API: super_admin and mahall only). */
export const canReadDues = (role: Role, isSuperAdmin?: boolean) => isAdminish(role, isSuperAdmin);

/** Welfare applications and summary (survey and mahall menus; not institute). */
export const canReadWelfare = (role: Role, isSuperAdmin?: boolean) =>
  isAdminish(role, isSuperAdmin) || role === 'survey';
