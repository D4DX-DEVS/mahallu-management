import express from 'express';
import {
  getAllReliefCases,
  getReliefCaseById,
  createReliefCase,
  updateReliefCase,
  updateReliefStatus,
  deleteReliefCase,
  getReliefSummary,
} from '../controllers/reliefController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createReliefCaseValidation,
  updateReliefCaseValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /relief/summary:
 *   get:
 *     summary: Emergency relief summary
 *     tags: [Emergency Relief]
 *     description: |
 *       Open cases, critical cases, assisted cases and total assistance paid.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Relief totals
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/summary', listQuery(), validationHandler, getReliefSummary);

/**
 * @swagger
 * /relief/cases:
 *   get:
 *     summary: List relief cases
 *     tags: [Emergency Relief]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [reported, verified, approved, assisted, closed]
 *       - in: query
 *         name: urgency
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Matches the case title
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated relief cases
 *   post:
 *     summary: Report a relief case
 *     tags: [Emergency Relief]
 *     description: |
 *       Always created as `reported`; verification is a separate step.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               familyId:
 *                 type: string
 *               memberId:
 *                 type: string
 *               title:
 *                 type: string
 *               titleMl:
 *                 type: string
 *               description:
 *                 type: string
 *               urgency:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               followUpDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Referenced member or family belongs to another tenant
 */
router.get('/cases', listQuery(), validationHandler, getAllReliefCases);
router.post('/cases', createReliefCaseValidation, validationHandler, allowRoles(['mahall', 'survey']), createReliefCase);

/**
 * @swagger
 * /relief/cases/{id}:
 *   get:
 *     summary: Get one relief case
 *     tags: [Emergency Relief]
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
 *         description: Relief case
 *       404:
 *         description: Relief case not found
 *   put:
 *     summary: Edit a relief case's details
 *     tags: [Emergency Relief]
 *     description: |
 *       Details only - `status` and `tenantId` are ignored; move the case with
 *       `/cases/{id}/status`.
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
 *               title:
 *                 type: string
 *               titleMl:
 *                 type: string
 *               description:
 *                 type: string
 *               urgency:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               followUpDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated relief case
 *       400:
 *         description: Referenced member or family belongs to another tenant
 *       404:
 *         description: Relief case not found
 *   delete:
 *     summary: Delete a relief case
 *     tags: [Emergency Relief]
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
 *         description: Deleted
 *       404:
 *         description: Relief case not found
 */
router.get('/cases/:id', idParam('id', 'relief case'), validationHandler, getReliefCaseById);
router.put('/cases/:id', updateReliefCaseValidation, validationHandler, allowRoles(['mahall']), updateReliefCase);
router.delete('/cases/:id', idParam('id', 'relief case'), validationHandler, allowRoles(['mahall']), deleteReliefCase);

/**
 * @swagger
 * /relief/cases/{id}/status:
 *   put:
 *     summary: Move a relief case along its workflow
 *     tags: [Emergency Relief]
 *     description: |
 *       Valid moves: reported to verified to approved to assisted to closed;
 *       a case may be closed from any stage. Any other move returns 400.
 *       Marking a case `assisted` requires `assistanceGiven` to be recorded.
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [verified, approved, assisted, closed]
 *               assistanceGiven:
 *                 type: string
 *               amount:
 *                 type: number
 *               followUpDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated relief case
 *       400:
 *         description: Illegal transition, or assistance not recorded
 *       404:
 *         description: Relief case not found
 */
router.put('/cases/:id/status', idParam('id', 'relief case'), validationHandler, allowRoles(['mahall']), updateReliefStatus);

export default router;
