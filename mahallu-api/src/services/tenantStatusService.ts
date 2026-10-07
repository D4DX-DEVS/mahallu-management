import Tenant from '../models/Tenant';

/**
 * Is this Mahallu allowed to use the API right now?
 *
 * authMiddleware asks on every request, so the answer is cached for a short time. Suspending or
 * re-activating a tenant calls `invalidateTenantStatus`, so the change shows up on this instance at
 * once; another instance sees it within the TTL.
 */
const TTL_MS = 30_000;
const cache = new Map<string, { active: boolean; at: number }>();

export const isTenantActive = async (tenantId: unknown): Promise<boolean> => {
  if (!tenantId) return true; // super admins and tenant-less accounts have nothing to suspend
  const key = String(tenantId);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.active;

  const tenant: any = await Tenant.findById(key).select('status');
  // A tenant that no longer exists is not an active one.
  const active = Boolean(tenant) && tenant.status === 'active';
  cache.set(key, { active, at: now });
  return active;
};

export const invalidateTenantStatus = (tenantId?: unknown): void => {
  if (tenantId) cache.delete(String(tenantId));
  else cache.clear();
};

export const TENANT_SUSPENDED_MESSAGE =
  'This Mahallu is currently suspended. Please contact the platform administrator.';
