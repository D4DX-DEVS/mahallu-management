import { User } from '@/types';

/**
 * Gets the active tenant ID for the current session.
 * Prioritizes currentTenantId (when super admin is viewing as a tenant)
 * over the user's own tenantId.
 *
 * @param user - The user object
 * @param currentTenantId - Optional current tenant ID (for super admin switching)
 * @returns The tenant ID string or null
 */
export const getTenantId = (user: User | null, currentTenantId?: string | null): string | null => {
  // Super admin viewing as specific tenant takes priority
  if (currentTenantId) return currentTenantId;

  // Return user's own tenant ID
  return user?.tenantId || null;
};
