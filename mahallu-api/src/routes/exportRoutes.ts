import express, { NextFunction, Response } from 'express';
import { authMiddleware, allowRoles, AuthRequest } from '../middleware/authMiddleware';
import { exportEntityCsv, SUPER_ADMIN_ONLY_EXPORTS } from '../controllers/exportController';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

const superAdminOnlyGuard = allowRoles(['super_admin']);

/**
 * The Nikah, death and NOC exports are registration records, which are Super Admin only. Every other
 * entity keeps the router-wide Mahallu admin + Super Admin access below.
 */
export const registrationExportGuard = (req: AuthRequest, res: Response, next: NextFunction) =>
  SUPER_ADMIN_ONLY_EXPORTS.includes(req.params.entity) ? superAdminOnlyGuard(req, res, next) : next();

router.use(authMiddleware);
router.use(allowRoles(['super_admin', 'mahall']));

router.get('/:entity', registrationExportGuard, listQuery(), validationHandler, exportEntityCsv);

export default router;
