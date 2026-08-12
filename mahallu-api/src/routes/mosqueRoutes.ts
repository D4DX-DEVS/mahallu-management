import express from 'express';
import { getMosqueProfile, upsertMosqueProfile } from '../controllers/mosqueController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /mosque-profile:
 *   get:
 *     summary: Get the mosque profile
 *     tags: [Mosque]
 *     description: |
 *       One profile per Mahallu. Returns null before the first save.
 *       **Access:** Super Admin, Mahall Admin, Survey, Institute
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mosque profile or null
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   nullable: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', getMosqueProfile);

/**
 * @swagger
 * /mosque-profile:
 *   put:
 *     summary: Create or update the mosque profile
 *     tags: [Mosque]
 *     description: |
 *       Upserts the tenant's single mosque profile.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               nameMl:
 *                 type: string
 *               capacity:
 *                 type: integer
 *               facilities:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [parking, wudu_area, women_prayer_area, ac, library, madrasa_hall, janazah_facility, other]
 *               prayerFacilityNotes:
 *                 type: string
 *               imamName:
 *                 type: string
 *               imamMemberId:
 *                 type: string
 *               muazzinName:
 *                 type: string
 *               khateebName:
 *                 type: string
 *               staffNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Saved profile
 *       403:
 *         description: Role not allowed
 */
router.put('/', allowRoles(['mahall']), upsertMosqueProfile);

export default router;
