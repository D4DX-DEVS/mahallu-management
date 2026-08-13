import express from 'express';
import { getDevelopmentIndex } from '../controllers/developmentIndexController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /development-index:
 *   get:
 *     summary: Mahallu Development Index
 *     tags: [Reports]
 *     description: |
 *       Twelve dimension scores (0-100) computed live from existing data —
 *       family data, worship, education, welfare, zakat, economy, youth, women,
 *       health, finance, governance, community — plus the overall score and the
 *       three weakest dimensions. Formula constants live in
 *       `config/developmentIndex.ts`.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Development index computed successfully
 *       400:
 *         description: Tenant ID is required
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Role not permitted
 */
router.get('/', allowRoles(['super_admin', 'mahall']), getDevelopmentIndex);

export default router;
