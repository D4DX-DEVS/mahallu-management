import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';

/**
 * Check if a resource belongs to the user's tenant
 * Super admin can access any tenant's resources
 */
export const checkTenantOwnership = (
  req: AuthRequest,
  resourceTenantId: any,
  resourceName: string = 'Resource'
): boolean => {
  // Super admin can access any tenant's resources
  if (req.isSuperAdmin) {
    return true;
  }

  // If user has no tenant, deny access
  if (!req.tenantId) {
    return false;
  }

  // Compare tenant IDs (handle both string and ObjectId)
  const userTenantId = req.tenantId.toString();
  const resourceTenantIdStr = resourceTenantId?.toString();

  return userTenantId === resourceTenantIdStr;
};

/**
 * Middleware helper to verify tenant ownership
 * Returns 403 if resource doesn't belong to user's tenant
 */
export const verifyTenantOwnership = (
  req: AuthRequest,
  res: Response,
  resourceTenantId: any,
  resourceName: string = 'Resource'
): boolean => {
  if (!checkTenantOwnership(req, resourceTenantId, resourceName)) {
    res.status(403).json({
      success: false,
      message: `${resourceName} does not belong to your tenant or you don't have permission to access it`,
    });
    return false;
  }
  return true;
};

/**
 * Check if a resource belongs to the user's own institute.
 * Only meaningful for role === 'institute' — every other role's access is
 * already decided by tenant ownership, so this always passes for them.
 */
export const checkInstituteOwnership = (
  req: AuthRequest,
  resourceInstituteId: any
): boolean => {
  if (req.user?.role !== 'institute') {
    return true;
  }

  // authMiddleware already resolves req.instituteId to this user's own
  // instituteId for role === 'institute' (and only lets super_admin/mahall
  // override it via header), so it's the correct, already-scoped value to
  // compare against — not req.user.instituteId directly.
  if (!req.instituteId) {
    return false;
  }

  const userInstituteId = req.instituteId.toString();
  const resourceInstituteIdStr = resourceInstituteId?.toString();

  return userInstituteId === resourceInstituteIdStr;
};

/**
 * Middleware helper to verify institute ownership for an institute-role user.
 * Returns 403 if the resource belongs to a different institute.
 * Call this alongside verifyTenantOwnership, not in place of it — tenant
 * ownership must still be checked for every role.
 */
export const verifyInstituteOwnership = (
  req: AuthRequest,
  res: Response,
  resourceInstituteId: any,
  resourceName: string = 'Resource'
): boolean => {
  if (!checkInstituteOwnership(req, resourceInstituteId)) {
    res.status(403).json({
      success: false,
      message: `${resourceName} does not belong to your institute or you don't have permission to access it`,
    });
    return false;
  }
  return true;
};

