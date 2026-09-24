import express from 'express';
import { getRegister, getRegisterSummary } from '../controllers/registerController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /registers/summary:
 *   get:
 *     summary: Counts for every community register
 *     tags: [Registers]
 *     description: |
 *       Single aggregate returning the row count of each derived register.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Register counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                         example: zakat-payers
 *                       label:
 *                         type: string
 *                         example: Zakat Payers
 *                       source:
 *                         type: string
 *                         enum: [member, family]
 *                       count:
 *                         type: integer
 *                         example: 42
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/summary', listQuery(), validationHandler, getRegisterSummary);

/**
 * @swagger
 * /registers/{key}:
 *   get:
 *     summary: Get a community register
 *     tags: [Registers]
 *     description: |
 *       Paginated, tenant-scoped view derived from Member/Family data.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum: [zakat-payers, zakat-beneficiaries, job-seekers, skilled-workers, students, marriageable, volunteers, widows, orphans, disabled, elderly, unemployed, welfare]
 *         example: job-seekers
 *         description: Register key
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive search on the register's name fields
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *           enum: [male, female]
 *         description: Marriageable register only
 *       - in: query
 *         name: minAge
 *         schema:
 *           type: integer
 *           default: 60
 *         description: Elderly register only
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Register rows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Unknown register key
 */
router.get('/:key', listQuery(), validationHandler, getRegister);

export default router;
