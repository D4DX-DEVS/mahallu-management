import type { User } from '@/types';

export type PermissionFlag =
  | 'canDeleteReceipts' | 'canCancelReceipts' | 'canApprovePayments'
  | 'canCloseCashDay' | 'canVerifyCashDay' | 'canManageCampaigns' | 'canManagePeriods';

/** Mirrors PERMISSION_DEFAULTS in mahallu-api middleware/authMiddleware.ts (mahall admins). */
export const MAHALL_DEFAULTS: Record<PermissionFlag, boolean> = {
  canDeleteReceipts: false,
  canCancelReceipts: true,
  canApprovePayments: true,
  canCloseCashDay: true,
  canVerifyCashDay: true,
  canManageCampaigns: true,
  canManagePeriods: true,
};

/** Effective flag for a user: explicit value wins, else super admin = yes, mahall = default, others = no. */
export function hasFlag(user: User | null | undefined, flag: PermissionFlag): boolean {
  if (!user) return false;
  if (user.isSuperAdmin || user.role === 'super_admin') return true;
  const explicit = user.permissions?.[flag];
  if (typeof explicit === 'boolean') return explicit;
  return user.role === 'mahall' ? MAHALL_DEFAULTS[flag] : false;
}
