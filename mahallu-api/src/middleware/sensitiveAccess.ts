import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

/**
 * Middleware factory for sensitive modules access control.
 * Per-module restricted access: not a single boolean, but an array of allowed modules.
 *
 * Usage: router.get('/health-resources/sensitive', sensitiveAccess('health'), controller);
 *
 * Access granted if:
 * 1. User is super_admin, OR
 * 2. User.permissions.sensitiveModules includes the moduleKey
 */
export const sensitiveAccess = (moduleKey: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.isSuperAdmin) {
      return next();
    }

    const sensitiveModules = req.user?.permissions?.sensitiveModules;

    if (!sensitiveModules || !sensitiveModules.includes(moduleKey)) {
      return res.status(403).json({
        success: false,
        message: "This section isn't available for your account. Please contact your Mahallu admin.",
      });
    }

    next();
  };
};
