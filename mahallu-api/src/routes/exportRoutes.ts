import express from 'express';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { exportEntityCsv } from '../controllers/exportController';

const router = express.Router();

router.use(authMiddleware);
router.use(allowRoles(['super_admin', 'mahall']));

router.get('/:entity', exportEntityCsv);

export default router;
