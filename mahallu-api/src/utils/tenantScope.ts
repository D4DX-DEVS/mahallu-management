import { AuthRequest } from '../middleware/authMiddleware';

/**
 * Mongo filter fragment that confines a query to the caller's tenant.
 * Non-super-admin users always have req.tenantId (enforced in authMiddleware);
 * a super admin without an x-tenant-id header is unscoped.
 */
export const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};
