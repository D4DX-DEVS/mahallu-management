import express from 'express';
import {
  getAllInstitutes,
  getInstituteById,
  createInstitute,
  updateInstitute,
  deleteInstitute,
} from '../controllers/instituteController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createInstituteValidation,
  updateInstituteValidation,
  getInstituteValidation,
  deleteInstituteValidation,
} from '../validations/instituteValidation';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /institutes:
 *   get:
 *     summary: Get all institutes
 *     tags: [Institutes]
 *     description: |
 *       Retrieve all institutes with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [institute, program, madrasa]
 *         example: institute
 *         description: Filter by institute type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         example: active
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: kozhikode
 *         description: Search by name, place, or description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         example: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of institutes retrieved successfully
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
 *                     $ref: '#/components/schemas/Institute'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *             example:
 *               success: true
 *               data:
 *                 - _id: '507f1f77bcf86cd799439015'
 *                   name: 'Al-Azhar Institute'
 *                   place: 'Kozhikode'
 *                   type: 'institute'
 *                   joinDate: '2024-01-01T00:00:00.000Z'
 *                   status: 'active'
 *                   tenantId: '507f1f77bcf86cd799439012'
 *               pagination:
 *                 page: 1
 *                 limit: 10
 *                 total: 25
 *                 pages: 3
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllInstitutes);

/**
 * @swagger
 * /institutes/{id}:
 *   get:
 *     summary: Get institute by ID
 *     tags: [Institutes]
 *     description: |
 *       Get a specific institute by ID.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439015'
 *         description: MongoDB ObjectId of the institute
 *     responses:
 *       200:
 *         description: Institute details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Institute'
 *             example:
 *               success: true
 *               data:
 *                 _id: '507f1f77bcf86cd799439015'
 *                 name: 'Al-Azhar Institute'
 *                 place: 'Kozhikode'
 *                 type: 'institute'
 *                 joinDate: '2024-01-01T00:00:00.000Z'
 *                 description: 'Islamic educational institute'
 *                 contactNo: '9876543210'
 *                 email: 'info@alazhar.in'
 *                 address:
 *                   state: 'Kerala'
 *                   district: 'Kozhikode'
 *                   pinCode: '673001'
 *                   postOffice: 'Kozhikode HO'
 *                 status: 'active'
 *                 tenantId: '507f1f77bcf86cd799439012'
 *                 createdAt: '2024-01-01T00:00:00.000Z'
 *                 updatedAt: '2024-01-15T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getInstituteValidation, validationHandler, getInstituteById);

/**
 * @swagger
 * /institutes:
 *   post:
 *     summary: Create a new institute
 *     tags: [Institutes]
 *     description: |
 *       Create a new institute (institute, program, or madrasa).
 *       **Access:** Super Admin (any tenant), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInstituteRequest'
 *           examples:
 *             basicInstitute:
 *               summary: Create basic institute
 *               value:
 *                 name: 'Al-Azhar Institute'
 *                 place: 'Kozhikode'
 *                 type: 'institute'
 *             completeInstitute:
 *               summary: Create institute with all details
 *               value:
 *                 name: 'Al-Azhar Institute'
 *                 place: 'Kozhikode'
 *                 type: 'institute'
 *                 joinDate: '2024-01-01T00:00:00.000Z'
 *                 description: 'Islamic educational institute'
 *                 contactNo: '9876543210'
 *                 email: 'info@alazhar.in'
 *                 address:
 *                   state: 'Kerala'
 *                   district: 'Kozhikode'
 *                   pinCode: '673001'
 *                   postOffice: 'Kozhikode HO'
 *                 status: 'active'
 *     responses:
 *       201:
 *         description: Institute created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Institute'
 *             example:
 *               success: true
 *               data:
 *                 _id: '507f1f77bcf86cd799439015'
 *                 name: 'Al-Azhar Institute'
 *                 place: 'Kozhikode'
 *                 type: 'institute'
 *                 joinDate: '2024-01-01T00:00:00.000Z'
 *                 status: 'active'
 *                 tenantId: '507f1f77bcf86cd799439012'
 *                 createdAt: '2024-01-01T00:00:00.000Z'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', createInstituteValidation, validationHandler, createInstitute);

/**
 * @swagger
 * /institutes/{id}:
 *   put:
 *     summary: Update institute
 *     tags: [Institutes]
 *     description: |
 *       Update institute details.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439015'
 *         description: MongoDB ObjectId of the institute
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateInstituteRequest'
 *           examples:
 *             updateName:
 *               summary: Update institute name
 *               value:
 *                 name: 'Al-Azhar Institute Updated'
 *             updateStatus:
 *               summary: Update institute status
 *               value:
 *                 status: 'inactive'
 *             updateMultiple:
 *               summary: Update multiple fields
 *               value:
 *                 name: 'Al-Azhar Institute Updated'
 *                 description: 'Updated description'
 *                 contactNo: '9876543211'
 *                 status: 'active'
 *     responses:
 *       200:
 *         description: Institute updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Institute'
 *             example:
 *               success: true
 *               data:
 *                 _id: '507f1f77bcf86cd799439015'
 *                 name: 'Al-Azhar Institute Updated'
 *                 place: 'Kozhikode'
 *                 type: 'institute'
 *                 status: 'active'
 *                 updatedAt: '2024-01-15T10:30:00.000Z'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', updateInstituteValidation, validationHandler, updateInstitute);

/**
 * @swagger
 * /institutes/{id}:
 *   delete:
 *     summary: Delete institute
 *     tags: [Institutes]
 *     description: |
 *       Delete an institute.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439015'
 *         description: MongoDB ObjectId of the institute
 *     responses:
 *       200:
 *         description: Institute deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Institute deleted'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', deleteInstituteValidation, validationHandler, deleteInstitute);

export default router;

