import { Request, Response, NextFunction } from 'express';

export interface TenantRequest extends Request {
  tenantId?: string;
  instituteId?: string;
  isSuperAdmin?: boolean;
  user?: any;
}

/**
 * Middleware to extract tenant ID from request
 * Super admin can access any tenant
 */
export const tenantMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get tenant ID from header, query, or body
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    const queryTenantId = req.query?.tenantId as string | undefined;
    const bodyTenantId = req.body?.tenantId as string | undefined;
    const explicitTenantId = headerTenantId || queryTenantId || bodyTenantId;
    
    // If user is super admin, they can access any tenant
    // Otherwise, use their assigned tenant
    if (req.user?.isSuperAdmin) {
      req.isSuperAdmin = true;
      if (explicitTenantId) {
        req.tenantId = explicitTenantId;
      }
    } else if (req.user?.tenantId) {
      req.tenantId = req.user.tenantId.toString();
    } else if (explicitTenantId) {
      req.tenantId = explicitTenantId;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to ensure tenant isolation
 * Adds tenantId filter to queries
 */
export const tenantFilter = (req: TenantRequest, res: Response, next: NextFunction) => {
  if (req.tenantId && !req.isSuperAdmin) {
    // Add tenantId to query for filtering
    if (req.query) {
      req.query.tenantId = req.tenantId;
    }
    if (req.body && !req.body.tenantId) {
      req.body.tenantId = req.tenantId;
    }
  }
  next();
};

/**
 * Middleware to ensure institute isolation for institute role users
 * Adds instituteId filter to queries for users with role 'institute'
 */
export const instituteFilter = (req: TenantRequest, res: Response, next: NextFunction) => {
  // For institute role users, auto-inject their instituteId into queries — always overwrite
  // (not just when absent) so a client-supplied instituteId can never create/query records
  // under a different institute than the one this user actually belongs to.
  if (req.user?.role === 'institute' && req.user?.instituteId) {
    const instituteId = req.user.instituteId.toString();
    if (req.query) {
      req.query.instituteId = instituteId;
    }
    if (req.body) {
      req.body.instituteId = instituteId;
    }
  }
  next();
};

