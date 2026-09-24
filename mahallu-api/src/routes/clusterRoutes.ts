import express from 'express';
import {
  getAllClusters,
  getClusterById,
  createCluster,
  updateCluster,
  deleteCluster,
  getClusterFamilies,
  assignFamilies,
  unassignFamily,
} from '../controllers/clusterController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createClusterValidation,
  updateClusterValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /clusters:
 *   get:
 *     summary: List clusters
 *     tags: [Clusters]
 *     description: |
 *       Paginated clusters with coordinator and family count.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
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
 *         description: Cluster list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllClusters);

/**
 * @swagger
 * /clusters/{id}:
 *   get:
 *     summary: Get a cluster
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
 *         description: Cluster with family count
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam('id', 'cluster'), validationHandler, getClusterById);

/**
 * @swagger
 * /clusters/{id}/families:
 *   get:
 *     summary: Families in a cluster
 *     tags: [Clusters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated families
 */
router.get('/:id/families', idParam('id', 'cluster'), validationHandler, getClusterFamilies);

/**
 * @swagger
 * /clusters:
 *   post:
 *     summary: Create a cluster
 *     tags: [Clusters]
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
 *               code:
 *                 type: string
 *               coordinatorMemberId:
 *                 type: string
 *               teamMemberIds:
 *                 type: array
 *                 maxItems: 3
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Created
 *       403:
 *         description: Role not allowed
 */
router.post('/', createClusterValidation, validationHandler, allowRoles(['mahall', 'survey']), createCluster);

/**
 * @swagger
 * /clusters/{id}/assign-families:
 *   post:
 *     summary: Bulk-assign families to a cluster
 *     tags: [Clusters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [familyIds]
 *             properties:
 *               familyIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Assigned count
 */
router.post('/:id/assign-families', idParam('id', 'cluster'), validationHandler, allowRoles(['mahall', 'survey']), assignFamilies);

/**
 * @swagger
 * /clusters/{id}:
 *   put:
 *     summary: Update a cluster
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
router.put('/:id', updateClusterValidation, validationHandler, allowRoles(['mahall', 'survey']), updateCluster);

/**
 * @swagger
 * /clusters/{id}/families/{familyId}:
 *   delete:
 *     summary: Remove a family from a cluster
 *     tags: [Clusters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: familyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Removed
 */
router.delete('/:id/families/:familyId', idParam('id', 'cluster'), idParam('familyId', 'family'), validationHandler, allowRoles(['mahall', 'survey']), unassignFamily);

/**
 * @swagger
 * /clusters/{id}:
 *   delete:
 *     summary: Delete a cluster
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
router.delete('/:id', idParam('id', 'cluster'), validationHandler, allowRoles(['mahall']), deleteCluster);

export default router;
