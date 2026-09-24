import express from 'express';
import {
  getAllFamilies,
  getFamilyById,
  createFamily,
  updateFamily,
  deleteFamily,
  getFamilyStats,
  bulkImportFamilies,
} from '../controllers/familyController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createFamilyValidation,
  updateFamilyValidation,
  getFamilyValidation,
  deleteFamilyValidation,
} from '../validations/familyValidation';
import { idParam, listQuery } from '../validations/common';
import {
  bulkImportFamiliesValidation,
} from '../validations/moduleValidation';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(allowRoles(['super_admin', 'mahall', 'survey', 'institute']));

/**
 * @swagger
 * /families:
 *   get:
 *     summary: Get all families
 *     tags: [Families]
 *     description: |
 *       Retrieve all families with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall/Institute/Survey (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [approved, unapproved, pending] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of families
 */
router.get('/', listQuery(), validationHandler, getAllFamilies);
router.get('/stats', listQuery(), validationHandler, getFamilyStats);

/**
 * @swagger
 * /families/bulk-import:
 *   post:
 *     summary: Bulk import families
 *     tags: [Families]
 *     description: |
 *       Import up to 500 families at once (CSV parsed client-side into JSON rows).
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [families]
 *             properties:
 *               families:
 *                 type: array
 *                 maxItems: 500
 *                 items:
 *                   type: object
 *                   required: [houseName]
 *                   properties:
 *                     houseName:
 *                       type: string
 *                     houseNameMl:
 *                       type: string
 *                     familyHead:
 *                       type: string
 *                     familyHeadMl:
 *                       type: string
 *                     contactNo:
 *                       type: string
 *                     area:
 *                       type: string
 *                     areaMl:
 *                       type: string
 *                     place:
 *                       type: string
 *                     placeMl:
 *                       type: string
 *                     varisangyaGrade:
 *                       type: string
 *     responses:
 *       201:
 *         description: Number of families imported
 *       400:
 *         description: Validation errors with row numbers
 */
router.post('/bulk-import', bulkImportFamiliesValidation, validationHandler, allowRoles(['mahall', 'super_admin']), bulkImportFamilies);

/**
 * @swagger
 * /families/{id}:
 *   get:
 *     summary: Get family by ID
 *     tags: [Families]
 *     description: Get a specific family by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Family details
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getFamilyValidation, validationHandler, getFamilyById);

/**
 * @swagger
 * /families:
 *   post:
 *     summary: Create a new family
 *     tags: [Families]
 *     description: |
 *       Create a new family.
 *       **Access:** Super Admin (any tenant), Mahall/Institute/Survey (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFamilyRequest'
 *           examples:
 *             basicFamily:
 *               summary: Create basic family
 *               value:
 *                 houseName: 'Al-Hamd House'
 *                 state: 'Kerala'
 *                 district: 'Kozhikode'
 *                 lsgName: 'Kozhikode Corporation'
 *                 village: 'Kozhikode'
 *             completeFamily:
 *               summary: Create family with all details
 *               value:
 *                 houseName: 'Al-Hamd House'
 *                 mahallId: 'MAH001'
 *                 varisangyaGrade: 'Grade A'
 *                 familyHead: 'Ahmed Ali'
 *                 contactNo: '9876543210'
 *                 wardNumber: 'Ward 5'
 *                 houseNo: 'H-123'
 *                 area: 'Area A'
 *                 place: 'Kozhikode'
 *                 via: 'Via Calicut'
 *                 state: 'Kerala'
 *                 district: 'Kozhikode'
 *                 pinCode: '673001'
 *                 postOffice: 'Kozhikode HO'
 *                 lsgName: 'Kozhikode Corporation'
 *                 village: 'Kozhikode'
 *                 status: 'pending'
 *     responses:
 *       201:
 *         description: Family created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Family'
 *             example:
 *               success: true
 *               data:
 *                 _id: '507f1f77bcf86cd799439013'
 *                 houseName: 'Al-Hamd House'
 *                 state: 'Kerala'
 *                 district: 'Kozhikode'
 *                 lsgName: 'Kozhikode Corporation'
 *                 village: 'Kozhikode'
 *                 status: 'pending'
 *                 tenantId: '507f1f77bcf86cd799439012'
 *                 createdAt: '2024-01-01T00:00:00.000Z'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', createFamilyValidation, validationHandler, createFamily);

/**
 * @swagger
 * /families/{id}:
 *   put:
 *     summary: Update family
 *     tags: [Families]
 *     description: Update family details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               houseName: { type: string }
 *               status: { type: string, enum: [approved, unapproved, pending] }
 *     responses:
 *       200:
 *         description: Family updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', updateFamilyValidation, validationHandler, updateFamily);

/**
 * @swagger
 * /families/{id}:
 *   delete:
 *     summary: Delete family
 *     tags: [Families]
 *     description: Delete a family
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Family deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', deleteFamilyValidation, validationHandler, deleteFamily);

export default router;

