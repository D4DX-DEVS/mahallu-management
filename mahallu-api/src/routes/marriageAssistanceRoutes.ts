import express from 'express';
import {
  getAllAssistances,
  getAssistanceById,
  createAssistance,
  updateAssistance,
  updateAssistanceStatus,
  deleteAssistance,
} from '../controllers/marriageAssistanceController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createMarriageAssistanceValidation,
  updateMarriageAssistanceValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /marriage-assistance:
 *   get:
 *     summary: List marriage assistance records
 *     tags: [Registrations]
 *     description: |
 *       Paginated list of marriage assistance requests.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [proposal_support, financial_assistance, premarital_counselling]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [requested, approved, completed]
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
 *         description: Marriage assistance list with pagination
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllAssistances);

/**
 * @swagger
 * /marriage-assistance/{id}:
 *   get:
 *     summary: Get a marriage assistance record
 *     tags: [Registrations]
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
 *         description: Marriage assistance record
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam('id', 'application'), validationHandler, getAssistanceById);

/**
 * @swagger
 * /marriage-assistance:
 *   post:
 *     summary: Create a marriage assistance request
 *     tags: [Registrations]
 *     description: |
 *       Create a new marriage assistance request. Either memberId or familyId is required.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               memberId:
 *                 type: string
 *               familyId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [proposal_support, financial_assistance, premarital_counselling]
 *               amount:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Missing required fields or invalid tenant reference
 */
router.post('/', createMarriageAssistanceValidation, validationHandler, allowRoles(['mahall']), createAssistance);

/**
 * @swagger
 * /marriage-assistance/{id}:
 *   put:
 *     summary: Update a marriage assistance record
 *     tags: [Registrations]
 *     description: |
 *       Update record details. Use `/marriage-assistance/{id}/status` for status transitions.
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
 *               amount:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated record
 *       404:
 *         description: Record not found
 */
router.put('/:id', updateMarriageAssistanceValidation, validationHandler, allowRoles(['mahall']), updateAssistance);

/**
 * @swagger
 * /marriage-assistance/{id}/status:
 *   put:
 *     summary: Update marriage assistance status
 *     tags: [Registrations]
 *     description: |
 *       Move record through workflow: requested -> approved -> completed.
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
 *                 enum: [approved, completed]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated record
 *       400:
 *         description: Invalid status transition
 */
router.put('/:id/status', idParam('id', 'application'), validationHandler, allowRoles(['mahall']), updateAssistanceStatus);

/**
 * @swagger
 * /marriage-assistance/{id}:
 *   delete:
 *     summary: Delete a marriage assistance record
 *     tags: [Registrations]
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
 *         description: Record not found
 */
router.delete('/:id', idParam('id', 'application'), validationHandler, allowRoles(['mahall']), deleteAssistance);

export default router;
