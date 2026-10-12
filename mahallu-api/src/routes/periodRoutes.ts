import express from 'express';
import {
  listPeriods,
  getPeriod,
  createPeriod,
  previewClose,
  closePeriod,
  reopenPeriod,
  deletePeriod,
} from '../controllers/periodController';
import { authMiddleware, allowRoles, requirePermission } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/** Financial periods (financial years) with year-end close and period lock. */
router.get('/', allowRoles(['mahall']), listPeriods);
router.post('/', allowRoles(['mahall']), requirePermission('canManagePeriods'), createPeriod);
router.get('/:id', allowRoles(['mahall']), getPeriod);
router.get('/:id/close-preview', allowRoles(['mahall']), previewClose);
router.post('/:id/close', allowRoles(['mahall']), requirePermission('canManagePeriods'), closePeriod);
// Reopen is gated inside the controller: super admin or a user with permissions.financeAdmin
router.post('/:id/reopen', allowRoles(['mahall']), reopenPeriod);
router.delete('/:id', allowRoles(['mahall']), requirePermission('canManagePeriods'), deletePeriod);

export default router;
