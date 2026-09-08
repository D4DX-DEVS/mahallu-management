import express from 'express';
import {
  getAllSchemes,
  getSchemeById,
  createScheme,
  updateScheme,
  deleteScheme,
  getAllApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  updateApplicationStatus,
  deleteApplication,
  getWelfareSummary,
} from '../controllers/welfareController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { validCategoryValue } from '../validations/categoryValueValidation';
import { idParam, listQuery } from '../validations/common';
import {
  createWelfareApplicationValidation,
  updateWelfareApplicationValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /welfare/schemes:
 *   get:
 *     summary: List welfare schemes
 *     tags: [Welfare]
 *     description: |
 *       Paginated schemes.
 *       **Access:** Super Admin, Mahall Admin, Survey (read)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, closed]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [medical, housing, education, livelihood, food, marriage_assistance, emergency, other]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Scheme list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/schemes', listQuery(), validationHandler, getAllSchemes);

/**
 * @swagger
 * /welfare/summary:
 *   get:
 *     summary: Welfare application counts and disbursed total
 *     tags: [Welfare]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary card data
 */
router.get('/summary', listQuery(), validationHandler, getWelfareSummary);

/**
 * @swagger
 * /welfare/applications:
 *   get:
 *     summary: List welfare applications
 *     tags: [Welfare]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, verified, approved, rejected, disbursed, closed]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: schemeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Application list
 */
router.get('/applications', listQuery(), validationHandler, getAllApplications);

/**
 * @swagger
 * /welfare/applications/{id}:
 *   get:
 *     summary: Get an application with its status history
 *     tags: [Welfare]
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
 *         description: Application
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/applications/:id', idParam('id', 'record'), validationHandler, getApplicationById);

/**
 * @swagger
 * /welfare/schemes/{id}:
 *   get:
 *     summary: Get a scheme
 *     tags: [Welfare]
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
 *         description: Scheme
 */
router.get('/schemes/:id', idParam('id', 'record'), validationHandler, getSchemeById);

/**
 * @swagger
 * /welfare/schemes:
 *   post:
 *     summary: Create a welfare scheme
 *     tags: [Welfare]
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
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               budgetAmount:
 *                 type: number
 *     responses:
 *       201:
 *         description: Created
 *       403:
 *         description: Role not allowed
 */
router.post(
  '/schemes',
  allowRoles(['mahall']),
  validCategoryValue('welfare_category', 'category'),
  validationHandler,
  createScheme
);

/**
 * @swagger
 * /welfare/schemes/{id}:
 *   put:
 *     summary: Update a welfare scheme
 *     tags: [Welfare]
 *     description: |
 *       `tenantId` in the body is ignored - a scheme cannot be moved between tenants.
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
 *               nameMl:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               budgetAmount:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated scheme
 *       404:
 *         description: Scheme not found
 *   delete:
 *     summary: Delete a welfare scheme
 *     tags: [Welfare]
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
 *         description: Scheme not found
 */
router.put(
  '/schemes/:id', idParam('id', 'record'),
  allowRoles(['mahall']),
  validCategoryValue('welfare_category', 'category'),
  validationHandler,
  updateScheme
);
router.delete('/schemes/:id', idParam('id', 'record'), validationHandler, allowRoles(['mahall']), deleteScheme);

/**
 * @swagger
 * /welfare/applications:
 *   post:
 *     summary: Create a welfare application
 *     tags: [Welfare]
 *     description: |
 *       Always starts in `pending`.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [schemeId, requestedAmount]
 *             properties:
 *               schemeId:
 *                 type: string
 *               familyId:
 *                 type: string
 *               memberId:
 *                 type: string
 *               requestedAmount:
 *                 type: number
 *               reason:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/applications', createWelfareApplicationValidation, validationHandler, allowRoles(['mahall', 'survey']), createApplication);

/**
 * @swagger
 * /welfare/applications/{id}:
 *   put:
 *     summary: Edit an application's details
 *     tags: [Welfare]
 *     description: |
 *       Edits data only - use `/applications/{id}/status` to move the workflow.
 *       `tenantId` is ignored, and any `schemeId`/`familyId`/`memberId` that belongs
 *       to another tenant is rejected with 400.
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
 *               schemeId:
 *                 type: string
 *               familyId:
 *                 type: string
 *               memberId:
 *                 type: string
 *               requestedAmount:
 *                 type: number
 *               reason:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *     responses:
 *       200:
 *         description: Updated application
 *       400:
 *         description: Referenced record belongs to another tenant
 *       404:
 *         description: Application not found
 *   delete:
 *     summary: Delete a welfare application
 *     tags: [Welfare]
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
 *         description: Application not found
 */
router.put('/applications/:id', updateWelfareApplicationValidation, validationHandler, allowRoles(['mahall']), updateApplication);

/**
 * @swagger
 * /welfare/applications/{id}/status:
 *   put:
 *     summary: Move an application along the welfare workflow
 *     tags: [Welfare]
 *     description: |
 *       Valid moves: pending to verified to approved to disbursed to closed;
 *       rejection allowed until disbursement. Any other move returns 400.
 *       Disbursing with `disbursedVia: ledger` posts an expense ledger entry.
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
 *                 enum: [verified, approved, rejected, disbursed, closed]
 *               approvedAmount:
 *                 type: number
 *               verificationNotes:
 *                 type: string
 *               disbursedVia:
 *                 type: string
 *                 enum: [cash, bank, ledger]
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated application
 *       400:
 *         description: Illegal status transition
 */
router.put('/applications/:id/status', idParam('id', 'record'), validationHandler, allowRoles(['mahall']), updateApplicationStatus);
router.delete('/applications/:id', idParam('id', 'record'), validationHandler, allowRoles(['mahall']), deleteApplication);

export default router;
