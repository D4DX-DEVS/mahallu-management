import express from 'express';
import * as c from '../controllers/cashClosingController';
import { authMiddleware, allowRoles, requirePermission } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(allowRoles(['mahall']));

router.get('/preview', c.previewCashClosing);
router.get('/', c.listCashClosings);
router.post('/', requirePermission('canCloseCashDay'), c.submitCashClosing);
router.get('/:id', c.getCashClosing);
router.post('/:id/verify', requirePermission('canVerifyCashDay'), c.verifyCashClosing);
router.post('/:id/reopen', requirePermission('canVerifyCashDay'), c.reopenCashClosing);

export default router;
