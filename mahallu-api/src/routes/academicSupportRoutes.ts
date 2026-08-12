import express from 'express';
import {
  getAllSupportCases,
  getSupportCaseById,
  createSupportCase,
  updateSupportCase,
  deleteSupportCase,
} from '../controllers/scholarshipController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const supportRouter = express.Router();
supportRouter.use(authMiddleware);
supportRouter.use(tenantMiddleware);
supportRouter.use(tenantFilter);

// ============= ACADEMIC SUPPORT ENDPOINTS =============

/**
 * @swagger
 * /api/academic-support:
 *   get:
 *     summary: List academic support cases
 *     tags: [Education]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [career_guidance, competitive_exam, dropout_risk, tuition, remedial, academic_award]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, resolved, closed]
 *       - in: query
 *         name: memberId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Matches description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated cases
 *   post:
 *     summary: Create an academic support case
 *     tags: [Education]
 *     description: |
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [memberId, type, description]
 *             properties:
 *               memberId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [career_guidance, competitive_exam, dropout_risk, tuition, remedial, academic_award]
 *               description:
 *                 type: string
 *               mentorName:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved, closed]
 *               outcome:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Member does not belong to this Mahallu
 */
supportRouter.get('/', getAllSupportCases);
supportRouter.post('/', allowRoles(['mahall']), createSupportCase);

/**
 * @swagger
 * /api/academic-support/{id}:
 *   get:
 *     summary: Get one support case
 *     tags: [Education]
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
 *         description: Case details
 *       404:
 *         description: Not found
 *   put:
 *     summary: Update a support case
 *     tags: [Education]
 *     description: |
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
 *               type:
 *                 type: string
 *               description:
 *                 type: string
 *               mentorName:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, resolved, closed]
 *               outcome:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete a support case
 *     tags: [Education]
 *     description: |
 *       **Access:** Super Admin, Mahall Admin
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
 *       404:
 *         description: Not found
 */
supportRouter.get('/:id', getSupportCaseById);
supportRouter.put('/:id', allowRoles(['mahall']), updateSupportCase);
supportRouter.delete('/:id', allowRoles(['mahall']), deleteSupportCase);

export { supportRouter };
