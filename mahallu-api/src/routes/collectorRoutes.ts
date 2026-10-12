import express from 'express';
import * as c from '../controllers/collectorController';
import { authMiddleware, allowRoles, requirePermission } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(allowRoles(['mahall']));

router.get('/', c.listCollectors);
router.post('/', requirePermission('canCloseCashDay'), c.createCollector);
router.get('/:id/day', c.collectorDay);
router.put('/:id', requirePermission('canCloseCashDay'), c.updateCollector);
router.delete('/:id', requirePermission('canCloseCashDay'), c.deleteCollector);

export default router;
