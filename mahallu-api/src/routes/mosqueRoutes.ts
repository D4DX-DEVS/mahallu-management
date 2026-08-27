import express from 'express';
import {
  getAllMosques,
  getMosqueById,
  createMosque,
  updateMosque,
  deleteMosque,
} from '../controllers/mosqueController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /mosques:
 *   get:
 *     summary: List mosques
 *     tags: [Mosque]
 *     description: |
 *       A Mahallu can have multiple mosques.
 *       **Access:** Super Admin, Mahall Admin, Survey, Institute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Mosque list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', getAllMosques);

/**
 * @swagger
 * /mosques/{id}:
 *   get:
 *     summary: Get a mosque
 *     tags: [Mosque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mosque
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getMosqueById);

/**
 * @swagger
 * /mosques:
 *   post:
 *     summary: Create a mosque
 *     tags: [Mosque]
 *     description: |
 *       **Access:** Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
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
 *       201:
 *         description: Created
 *       403:
 *         description: Role not allowed
 */
router.post('/', allowRoles(['mahall']), createMosque);

/**
 * @swagger
 * /mosques/{id}:
 *   put:
 *     summary: Update a mosque
 *     tags: [Mosque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', allowRoles(['mahall']), updateMosque);

/**
 * @swagger
 * /mosques/{id}:
 *   delete:
 *     summary: Delete a mosque
 *     tags: [Mosque]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       403:
 *         description: Role not allowed
 */
router.delete('/:id', allowRoles(['mahall']), deleteMosque);

export default router;
