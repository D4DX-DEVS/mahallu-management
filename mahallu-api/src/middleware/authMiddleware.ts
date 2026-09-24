import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
  tenantId?: string;
  instituteId?: string;
  isSuperAdmin?: boolean;
}

/*
 * What a member account is allowed to reach.
 *
 * `allowRoles` guards the routers someone remembered to guard — families,
 * members, users, collectibles. The other ~88 admin endpoints had no role check
 * at all, so a resident's own token could read the Mahallu's trial balance,
 * balance sheet, day book, salary payments, employee records, zakat
 * beneficiaries, qard loans, relief cases and welfare applications. The CMS
 * hides those screens from members; the API did not.
 *
 * Members work through `/api/member-user/*`, plus the shared endpoints below —
 * the mobile app marks a notification read via `/api/notifications/:id/read`,
 * the member portal raises profile edits through `/api/change-requests` and
 * attaches files for a NOC or death registration through `/api/documents`
 * (which scopes a non-admin to their own uploads). Anything outside this list
 * is not a member's to read.
 */
const MEMBER_ALLOWED_PREFIXES = [
  '/api/auth',
  '/api/member-user',
  '/api/notifications',
  '/api/change-requests',
  '/api/categories/by-key',
  '/api/documents',
];

/** A 24-character hex id. Anything else is not a scope this API will adopt. */
const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);

const isMemberAllowedPath = (url: string): boolean => {
  const path = (url || '').split('?')[0];
  return MEMBER_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
};

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Something went wrong on our side. Please try again in a moment.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: "We couldn't find that user. It may have been removed." });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'This account is inactive. Please contact your Mahallu admin.' });
    }

    if (user.role === 'member' && !user.isSuperAdmin && !isMemberAllowedPath(req.originalUrl)) {
      return res.status(403).json({
        success: false,
        message: "Your role doesn't have access to this. Please contact your Mahallu admin.",
      });
    }

    req.user = user;
    req.isSuperAdmin = user.isSuperAdmin;

    // Headers name a scope, so they have to look like an id before they become
    // one. An arbitrary string reached a query as a cast failure and answered
    // 404 for what is really a malformed request.
    const headerTenantId = req.headers['x-tenant-id'];
    const headerInstituteId = req.headers['x-institute-id'];

    if (user.isSuperAdmin && isObjectId(headerTenantId)) {
      // Super admin is viewing as a specific tenant
      req.tenantId = headerTenantId;
    } else {
      // Regular user, or super admin not viewing as a tenant
      req.tenantId = user.tenantId?.toString();
    }

    // Set instituteId for institute role users
    if (user.role === 'institute' && user.instituteId) {
      req.instituteId = user.instituteId.toString();
    }

    // Check for x-institute-id header (used by frontend to filter by institute)
    if (isObjectId(headerInstituteId) && (user.isSuperAdmin || user.role === 'mahall')) {
      req.instituteId = headerInstituteId;
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Your session has ended. Please sign in again to continue.' });
  }
};

export const superAdminOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: "You don't have permission to do this. Please contact your Mahallu admin.",
    });
  }
  next();
};

export const memberUserOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.role !== 'member') {
    return res.status(403).json({
      success: false,
      message: 'This is available to member accounts only.',
    });
  }
  next();
};

export const allowRoles = (allowedRoles: Array<'super_admin' | 'mahall' | 'survey' | 'institute' | 'member'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.isSuperAdmin) {
      return next();
    }

    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Your role doesn't have access to this. Please contact your Mahallu admin.",
      });
    }

    next();
  };
};

