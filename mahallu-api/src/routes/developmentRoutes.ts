import express from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectExpenditure,
} from '../controllers/developmentController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /development-projects:
 *   get:
 *     summary: List development projects
 *     tags: [Development]
 *     description: |
 *       Paginated list of community development projects.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: area
 *         schema:
 *           type: string
 *           enum: [roads, water, sanitation, environment, education, healthcare, public_facility, govt_scheme, infrastructure, other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [proposed, approved, in_progress, completed, dropped]
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
 *         description: Project list with pagination
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', getAllProjects);

/**
 * @swagger
 * /development-projects/{id}:
 *   get:
 *     summary: Get a development project
 *     tags: [Development]
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
 *         description: Project details
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getProjectById);

/**
 * @swagger
 * /development-projects/{id}/expenditure:
 *   get:
 *     summary: Get project expenditure from linked ledger items
 *     tags: [Development]
 *     description: |
 *       Returns total project expenditure and paginated list of ledger items linked to this project.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
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
 *         description: Expenditure summary with paginated ledger items
 *       404:
 *         description: Project not found
 */
router.get('/:id/expenditure', getProjectExpenditure);

/**
 * @swagger
 * /development-projects:
 *   post:
 *     summary: Create a development project
 *     tags: [Development]
 *     description: |
 *       Create a new community development project.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, area, estimatedCost]
 *             properties:
 *               name:
 *                 type: string
 *               nameMl:
 *                 type: string
 *               area:
 *                 type: string
 *                 enum: [roads, water, sanitation, environment, education, healthcare, public_facility, govt_scheme, infrastructure, other]
 *               proposal:
 *                 type: string
 *               estimatedCost:
 *                 type: number
 *               fundingSource:
 *                 type: string
 *               responsibleTeam:
 *                 type: string
 *               committeeId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               targetDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Project created
 *       403:
 *         description: Role not allowed
 */
router.post('/', allowRoles(['mahall']), createProject);

/**
 * @swagger
 * /development-projects/{id}:
 *   put:
 *     summary: Update a development project
 *     tags: [Development]
 *     description: |
 *       Update project details or progress.
 *       `tenantId` in the body is ignored - a project cannot be moved between tenants.
 *       **Access:** Super Admin, Mahall Admin
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
 *             properties:
 *               name:
 *                 type: string
 *               area:
 *                 type: string
 *               estimatedCost:
 *                 type: number
 *               progressPercent:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [proposed, approved, in_progress, completed, dropped]
 *               completionReport:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated project
 *       404:
 *         description: Project not found
 */
router.put('/:id', allowRoles(['mahall']), updateProject);

/**
 * @swagger
 * /development-projects/{id}:
 *   delete:
 *     summary: Delete a development project
 *     tags: [Development]
 *     description: '**Access:** Super Admin, Mahall Admin'
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
 *         description: Project deleted
 *       404:
 *         description: Project not found
 */
router.delete('/:id', allowRoles(['mahall']), deleteProject);

export default router;
