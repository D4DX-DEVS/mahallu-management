import express from 'express';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { exportEntityCsv } from '../controllers/exportController';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(allowRoles(['super_admin', 'mahall']));

router.get('/:entity', listQuery(), validationHandler, exportEntityCsv);

export default router;
