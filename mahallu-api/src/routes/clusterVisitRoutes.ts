import express from 'express';
import {
  getAllVisits,
  createVisit,
  updateVisit,
  deleteVisit,
} from '../controllers/clusterController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /cluster-visits:
 *   get:
 *     summary: List cluster visits
 *     tags: [Clusters]
 *     description: |
 *       Paginated household visit log.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clusterId
 *         schema:
 *           type: string
 *       - in: query
 *         name: followUpNeeded
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Visit list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', getAllVisits);

/**
 * @swagger
 * /cluster-visits:
 *   post:
 *     summary: Record a cluster visit
 *     tags: [Clusters]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clusterId]
 *             properties:
 *               clusterId:
 *                 type: string
 *               familyId:
 *                 type: string
 *               visitDate:
 *                 type: string
 *                 format: date
 *               visitedBy:
 *                 type: string
 *               notes:
 *                 type: string
 *               issuesFound:
 *                 type: string
 *               followUpNeeded:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', allowRoles(['mahall', 'survey']), createVisit);

/**
 * @swagger
 * /cluster-visits/{id}:
 *   put:
 *     summary: Update a visit
 *     tags: [Clusters]
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
 */
router.put('/:id', allowRoles(['mahall', 'survey']), updateVisit);

/**
 * @swagger
 * /cluster-visits/{id}:
 *   delete:
 *     summary: Delete a visit
 *     tags: [Clusters]
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
 */
router.delete('/:id', allowRoles(['mahall']), deleteVisit);

export default router;
