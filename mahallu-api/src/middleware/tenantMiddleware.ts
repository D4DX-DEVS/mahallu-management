import { Request, Response, NextFunction } from 'express';

export interface TenantRequest extends Request {
  tenantId?: string;
  instituteId?: string;
  isSuperAdmin?: boolean;
  user?: any;
}

/** A 24-character hex id. Anything else never becomes a tenant scope. */
const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);

/**
 * Decides which Mahallu this request is operating inside.
 *
 * Only a super admin may name one. For everyone else the answer comes from
 * their own user record and from nowhere else.
 *
 * It used to fall through to a request-supplied `x-tenant-id` / `?tenantId` /
 * body `tenantId` for any user whose account had no tenant of its own —
 * and `tenantId` on User defaults to `null`, so an ordinary admin account
 * created without one, or one whose Mahallu had been removed, could name any
 * Mahallu in the system and work inside it. Scope now comes from the token's
 * user or not at all.
 */
export const tenantMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.isSuperAdmin) {
      req.isSuperAdmin = true;
      const requested =
        (req.headers['x-tenant-id'] as string | undefined) ||
        (req.query?.tenantId as string | undefined) ||
        (req.body?.tenantId as string | undefined);

      // A malformed id reaching a query answers with a cast failure; refuse it here.
      if (requested !== undefined) {
        if (!isObjectId(requested)) {
          return res.status(400).json({
            success: false,
            message: 'Please select a Mahallu before continuing.',
          });
        }
        req.tenantId = requested;
      }
    } else if (req.user?.tenantId) {
      req.tenantId = req.user.tenantId.toString();
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Pins every query and every write to the caller's own Mahallu.
 *
 * The body value is overwritten rather than filled in only when missing.
 * Leaving a client-supplied `tenantId` in place let a signed-in admin of one
 * Mahallu POST a record straight into another — `create({ ...req.body })` is
 * the shape used by 29 controllers, and `tenantId: req.tenantId || req.body.tenantId`
 * by several more. `instituteFilter` below already overwrites for exactly this
 * reason; tenant scope deserves at least the same.
 */
export const tenantFilter = (req: TenantRequest, res: Response, next: NextFunction) => {
  if (req.tenantId && !req.isSuperAdmin) {
    if (req.query) {
      req.query.tenantId = req.tenantId;
    }
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
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
