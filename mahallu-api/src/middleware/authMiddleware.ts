import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
  tenantId?: string;
  instituteId?: string;
  isSuperAdmin?: boolean;
  /**
   * Present only on a Super Admin "View As" session. `req.user`/`req.isSuperAdmin`/
   * `req.tenantId`/`req.instituteId` are deliberately reshaped to look exactly like a
   * real account of `impersonation.role` for that request — every existing RBAC/
   * tenant/institute check keeps working unmodified. This field is the one place
   * the ORIGINAL Super Admin identity survives, for exit and audit only; ordinary
   * authorization code should never read it.
   */
  impersonation?: {
    isImpersonating: true;
    originalUserId: string;
    role: 'mahall' | 'survey' | 'institute' | 'member';
    tenantId: string;
    instituteId?: string | null;
    memberId?: string | null;
  };
}

/** Full access within the impersonated role's own scope — there is no real
 * target account to copy a custom permission grant from, so impersonation
 * shows the role's complete capability, not a narrowed one. */
const IMPERSONATION_PERMISSIONS = {
  view: true,
  add: true,
  edit: true,
  delete: true,
  sensitiveModules: ['counselling', 'maslahat', 'inheritance', 'health', 'welfare'] as const,
};

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
    // The impersonation JWT's userId is ALWAYS the real Super Admin's own id —
    // there may be no User document at all for the role being impersonated, so
    // every request re-resolves the REAL account first, exactly like a normal
    // session, before optionally overlaying an impersonated context on top.
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: "We couldn't find that user. It may have been removed." });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'This account is inactive. Please contact your Mahallu admin.' });
    }

    if (decoded.imp) {
      // Defense in depth: even though the token's signature already proves it
      // was minted by this server for this user, only ever honor an
      // impersonation claim while the underlying real account is STILL a
      // super admin right now — a downgraded/deactivated account loses every
      // impersonation session it ever started, not just new ones.
      if (!user.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'This role switch is no longer valid. Please sign in again.',
        });
      }

      const imp = decoded.imp as {
        role: 'mahall' | 'survey' | 'institute' | 'member';
        tenantId: string;
        instituteId?: string | null;
        memberId?: string | null;
      };

      if (!['mahall', 'survey', 'institute', 'member'].includes(imp.role) || !isObjectId(imp.tenantId)) {
        return res.status(401).json({ success: false, message: 'Your session has ended. Please sign in again to continue.' });
      }

      req.impersonation = {
        isImpersonating: true,
        originalUserId: (user._id as any).toString(),
        role: imp.role,
        tenantId: imp.tenantId,
        instituteId: imp.instituteId ?? null,
        memberId: imp.memberId ?? null,
      };

      // Reshaped to look exactly like a real account of the impersonated role.
      // Every existing RBAC/tenant/institute check downstream reads only these
      // fields, so nothing else in the codebase needs to know impersonation
      // exists — the member-only path restriction below applies too, exactly
      // as it would for a genuine member account.
      req.user = {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: imp.role,
        tenantId: imp.tenantId,
        instituteId: imp.instituteId ?? null,
        memberId: imp.memberId ?? null,
        status: 'active',
        isSuperAdmin: false,
        permissions: IMPERSONATION_PERMISSIONS,
      };
      req.isSuperAdmin = false;
      req.tenantId = imp.tenantId;
      if (imp.role === 'institute' && imp.instituteId) {
        req.instituteId = imp.instituteId;
      }

      if (imp.role === 'member' && !isMemberAllowedPath(req.originalUrl)) {
        return res.status(403).json({
          success: false,
          message: "Your role doesn't have access to this. Please contact your Mahallu admin.",
        });
      }

      return next();
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

