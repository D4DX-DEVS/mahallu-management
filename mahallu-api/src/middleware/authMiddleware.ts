import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
  tenantId?: string;
  instituteId?: string;
  isSuperAdmin?: boolean;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Server configuration error: missing JWT secret' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }) as any;
    if (!decoded || typeof decoded.userId !== 'string') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'User account is inactive' });
    }

    // Tenant users must always belong to a tenant; otherwise controllers that only
    // filter `if (tenantId)` would return data across every tenant.
    if (!user.isSuperAdmin && !user.tenantId) {
      return res.status(403).json({ success: false, message: 'Account is not linked to a tenant' });
    }

    // Member (mobile app) accounts may only use their own portal endpoints, auth,
    // dashboard stats and read-only announcements — not the admin/CMS API surface.
    if (user.role === 'member' && !user.isSuperAdmin) {
      const urlPath = (req.originalUrl || '').split('?')[0].replace(/\/+$/, '');
      const allowed =
        urlPath.startsWith('/api/auth/') ||
        urlPath.startsWith('/api/member-user') ||
        urlPath === '/api/dashboard/stats' ||
        (req.method === 'GET' && (urlPath === '/api/announcements' || urlPath.startsWith('/api/announcements/')));
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Access denied for your role' });
      }
    }

    req.user = user;
    req.isSuperAdmin = user.isSuperAdmin;
    
    // Check for x-tenant-id header (used when super admin views as tenant)
    const headerTenantId = req.headers['x-tenant-id'] as string;
    
    if (user.isSuperAdmin && headerTenantId && /^[a-f\d]{24}$/i.test(headerTenantId)) {
      // Super admin is viewing as a specific tenant
      req.tenantId = headerTenantId;
    } else {
      // Regular user or super admin not viewing as tenant
      req.tenantId = user.tenantId?.toString();
    }

    // Set instituteId for institute role users
    if (user.role === 'institute' && user.instituteId) {
      req.instituteId = user.instituteId.toString();
    }

    // Check for x-institute-id header (used by frontend to filter by institute)
    const headerInstituteId = req.headers['x-institute-id'] as string;
    if (headerInstituteId && /^[a-f\d]{24}$/i.test(headerInstituteId) && (user.isSuperAdmin || user.role === 'mahall')) {
      req.instituteId = headerInstituteId;
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
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
      message: 'Super admin access required',
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
      message: 'Member user access required',
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
        message: 'Access denied for your role',
      });
    }

    next();
  };
};


/**
 * Granular permission flags stored on User.permissions. An unset flag falls back to the
 * role default below, so existing users keep exactly today's behaviour:
 * mahall admins can do everything except hard-delete receipts (new, explicit grant);
 * every other role gets nothing. Super admins always pass.
 */
export const PERMISSION_FLAGS = [
  'canDeleteReceipts',
  'canCancelReceipts',
  'canApprovePayments',
  'canCloseCashDay',
  'canVerifyCashDay',
  'canManageCampaigns',
  'canManagePeriods',
] as const;

export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];

export const PERMISSION_DEFAULTS: Record<string, Record<PermissionFlag, boolean>> = {
  super_admin: {
    canDeleteReceipts: true, canCancelReceipts: true, canApprovePayments: true,
    canCloseCashDay: true, canVerifyCashDay: true, canManageCampaigns: true, canManagePeriods: true,
  },
  mahall: {
    canDeleteReceipts: false, canCancelReceipts: true, canApprovePayments: true,
    canCloseCashDay: true, canVerifyCashDay: true, canManageCampaigns: true, canManagePeriods: true,
  },
  survey: {
    canDeleteReceipts: false, canCancelReceipts: false, canApprovePayments: false,
    canCloseCashDay: false, canVerifyCashDay: false, canManageCampaigns: false, canManagePeriods: false,
  },
  institute: {
    canDeleteReceipts: false, canCancelReceipts: false, canApprovePayments: false,
    canCloseCashDay: false, canVerifyCashDay: false, canManageCampaigns: false, canManagePeriods: false,
  },
  member: {
    canDeleteReceipts: false, canCancelReceipts: false, canApprovePayments: false,
    canCloseCashDay: false, canVerifyCashDay: false, canManageCampaigns: false, canManagePeriods: false,
  },
};

/** Effective value of one flag for a user (explicit boolean wins, else the role default). */
export const hasPermission = (user: any, flag: PermissionFlag): boolean => {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  const explicit = user.permissions?.[flag];
  if (typeof explicit === 'boolean') return explicit;
  return PERMISSION_DEFAULTS[user.role]?.[flag] ?? false;
};

/** Express guard: `router.post('/x', requirePermission('canManageCampaigns'), handler)`. */
export const requirePermission = (flag: PermissionFlag) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (hasPermission(req.user, flag)) return next();
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to do this. Ask your mahallu admin to enable it on your user.',
      permission: flag,
    });
  };
};
