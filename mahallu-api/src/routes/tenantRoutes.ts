import express from 'express';
import {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantStats,
  suspendTenant,
  activateTenant,
} from '../controllers/tenantController';
import { authMiddleware, superAdminOnly } from '../middleware/authMiddleware';
import { tenantMiddleware } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createTenantValidation,
  updateTenantValidation,
  getTenantValidation,
  deleteTenantValidation,
} from '../validations/tenantValidation';
import { param } from 'express-validator';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * @swagger
 * /tenants:
 *   get:
 *     summary: Get all tenants
 *     tags: [Tenants]
 *     description: Retrieve all tenants. **Super Admin only**
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended, inactive]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [standard, premium, enterprise]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, code, or location
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
 *         description: List of tenants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tenant'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Super admin access required
 */
router.get('/', listQuery(), validationHandler, superAdminOnly, getAllTenants);

/**
 * @swagger
 * /tenants/{id}:
 *   get:
 *     summary: Get tenant by ID
 *     tags: [Tenants]
 *     description: Retrieve a specific tenant by ID. **Super Admin only**
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
 *         description: Tenant details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
 *       403:
 *         description: Super admin access required
 *       404:
 *         description: Tenant not found
 */
router.get('/:id', getTenantValidation, validationHandler, getTenantById);

/**
 * @swagger
 * /tenants/{id}/stats:
 *   get:
 *     summary: Get tenant statistics
 *     tags: [Tenants]
 *     description: Get statistics for a specific tenant. **Super Admin only**
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
 *         description: Tenant statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: number
 *                     families:
 *                       type: number
 *                     members:
 *                       type: number
 */
router.get('/:id/stats', [param('id').isMongoId().withMessage('Invalid tenant ID')], validationHandler, getTenantStats);

/**
 * @swagger
 * /tenants:
 *   post:
 *     summary: Create a new tenant
 *     tags: [Tenants]
 *     description: Create a new tenant. **Super Admin only**
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Kozhikode Mahallu'
 *               code:
 *                 type: string
 *                 pattern: '^[A-Z0-9]+$'
 *                 example: 'KOZ001'
 *               type:
 *                 type: string
 *                 enum: [standard, premium, enterprise]
 *                 default: standard
 *               location:
 *                 type: string
 *               address:
 *                 type: object
 *                 required:
 *                   - state
 *                   - district
 *                   - lsgName
 *                   - village
 *                 properties:
 *                   state:
 *                     type: string
 *                   district:
 *                     type: string
 *                   pinCode:
 *                     type: string
 *                   postOffice:
 *                     type: string
 *                   lsgName:
 *                     type: string
 *                   village:
 *                     type: string
 *               settings:
 *                 type: object
 *                 properties:
 *                   varisangyaAmount:
 *                     type: number
 *     responses:
 *       201:
 *         description: Tenant created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         description: Super admin access required
 */
router.post('/', superAdminOnly, createTenantValidation, validationHandler, createTenant);

/**
 * @swagger
 * /tenants/{id}:
 *   put:
 *     summary: Update tenant
 *     tags: [Tenants]
 *     description: Update tenant details. **Super Admin only**
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, suspended, inactive]
 *     responses:
 *       200:
 *         description: Tenant updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         description: Super admin access required
 *       404:
 *         description: Tenant not found
 */
router.put('/:id', updateTenantValidation, validationHandler, updateTenant);

/**
 * @swagger
 * /tenants/{id}:
 *   delete:
 *     summary: Delete tenant
 *     tags: [Tenants]
 *     description: Delete a tenant. **Super Admin only**
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
 *         description: Tenant deleted successfully
 *       403:
 *         description: Super admin access required
 *       404:
 *         description: Tenant not found
 */
router.delete('/:id', superAdminOnly, deleteTenantValidation, validationHandler, deleteTenant);

/**
 * @swagger
 * /tenants/{id}/suspend:
 *   post:
 *     summary: Suspend tenant
 *     tags: [Tenants]
 *     description: Suspend a tenant account. **Super Admin only**
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
 *         description: Tenant suspended successfully
 *       403:
 *         description: Super admin access required
 *       404:
 *         description: Tenant not found
 */
router.post('/:id/suspend', superAdminOnly, [param('id').isMongoId().withMessage('Invalid tenant ID')], validationHandler, suspendTenant);

/**
 * @swagger
 * /tenants/{id}/activate:
 *   post:
 *     summary: Activate tenant
 *     tags: [Tenants]
 *     description: Activate a suspended tenant. **Super Admin only**
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
 *         description: Tenant activated successfully
 *       403:
 *         description: Super admin access required
 *       404:
 *         description: Tenant not found
 */
router.post('/:id/activate', superAdminOnly, [param('id').isMongoId().withMessage('Invalid tenant ID')], validationHandler, activateTenant);

export default router;

