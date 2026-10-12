import express from 'express';
import {
  generateSurvey,
  getAllSurveys,
  getSurveyById,
  getSurveyStatus,
  deleteSurvey,
} from '../controllers/surveyController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /surveys:
 *   get:
 *     summary: List survey snapshots
 *     tags: [Survey]
 *     description: |
 *       Paginated history of demographic snapshots.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [comprehensive, annual]
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
 *         description: Snapshot list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', getAllSurveys);

/**
 * @swagger
 * /surveys/status:
 *   get:
 *     summary: Latest snapshot and renewal status
 *     tags: [Survey]
 *     description: |
 *       Returns the newest snapshot, whether its renewal is overdue, and live stats.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Survey status
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/status', getSurveyStatus);

/**
 * @swagger
 * /surveys/{id}:
 *   get:
 *     summary: Get a snapshot with its predecessor
 *     tags: [Survey]
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
 *         description: Snapshot and previous snapshot
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getSurveyById);

/**
 * @swagger
 * /surveys/generate:
 *   post:
 *     summary: Generate a survey snapshot from live data
 *     tags: [Survey]
 *     description: |
 *       Computes every demographic stat from current Family/Member records and stores it.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [comprehensive, annual]
 *               surveyDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Snapshot created
 *       403:
 *         description: Role not allowed
 */
router.post('/generate', allowRoles(['mahall', 'survey']), generateSurvey);

/**
 * @swagger
 * /surveys/{id}:
 *   delete:
 *     summary: Delete a survey snapshot
 *     tags: [Survey]
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
router.delete('/:id', allowRoles(['mahall']), deleteSurvey);

export default router;
