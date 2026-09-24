import express from 'express';
import {
  getAllAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetMaintenanceRecords,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
} from '../controllers/assetController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createAssetValidation,
  updateAssetValidation,
  getAssetValidation,
  deleteAssetValidation,
  createMaintenanceValidation,
  updateMaintenanceValidation,
  deleteMaintenanceValidation,
} from '../validations/assetValidation';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /assets:
 *   get:
 *     summary: Get all assets
 *     tags: [Assets]
 *     description: |
 *       Retrieve all assets with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, in_use, under_maintenance, disposed, damaged]
 *         description: Filter by status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [furniture, electronics, vehicle, building, land, equipment, other]
 *         description: Filter by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, description, or location
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of assets retrieved successfully
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
 *                     $ref: '#/components/schemas/Asset'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllAssets);

/**
 * @swagger
 * /assets/{id}:
 *   get:
 *     summary: Get asset by ID
 *     tags: [Assets]
 *     description: |
 *       Get a specific asset by ID.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the asset
 *     responses:
 *       200:
 *         description: Asset details retrieved successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getAssetValidation, validationHandler, getAssetById);

/**
 * @swagger
 * /assets:
 *   post:
 *     summary: Create a new asset
 *     tags: [Assets]
 *     description: |
 *       Create a new asset.
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
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
 *               - purchaseDate
 *               - estimatedValue
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Projector'
 *               description:
 *                 type: string
 *                 example: 'Epson HD Projector for meeting hall'
 *               purchaseDate:
 *                 type: string
 *                 format: date
 *                 example: '2024-01-15'
 *               estimatedValue:
 *                 type: number
 *                 example: 45000
 *               category:
 *                 type: string
 *                 enum: [furniture, electronics, vehicle, building, land, equipment, other]
 *                 example: 'electronics'
 *               status:
 *                 type: string
 *                 enum: [active, in_use, under_maintenance, disposed, damaged]
 *                 example: 'active'
 *               location:
 *                 type: string
 *                 example: 'Meeting Hall'
 *     responses:
 *       201:
 *         description: Asset created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', createAssetValidation, validationHandler, createAsset);

/**
 * @swagger
 * /assets/{id}:
 *   put:
 *     summary: Update asset
 *     tags: [Assets]
 *     description: |
 *       Update asset details.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the asset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               purchaseDate:
 *                 type: string
 *                 format: date
 *               estimatedValue:
 *                 type: number
 *               category:
 *                 type: string
 *                 enum: [furniture, electronics, vehicle, building, land, equipment, other]
 *               status:
 *                 type: string
 *                 enum: [active, in_use, under_maintenance, disposed, damaged]
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Asset updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', updateAssetValidation, validationHandler, updateAsset);

/**
 * @swagger
 * /assets/{id}:
 *   delete:
 *     summary: Delete asset
 *     tags: [Assets]
 *     description: |
 *       Delete an asset and all its maintenance records.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the asset
 *     responses:
 *       200:
 *         description: Asset deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', deleteAssetValidation, validationHandler, deleteAsset);

// ==================== MAINTENANCE ROUTES ====================

/**
 * @swagger
 * /assets/{id}/maintenance:
 *   get:
 *     summary: Get maintenance records for an asset
 *     tags: [Asset Maintenance]
 *     description: |
 *       Retrieve all maintenance records for a specific asset.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the asset
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
 *         description: Maintenance records retrieved successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/:id/maintenance', getAssetValidation, validationHandler, getAssetMaintenanceRecords);

/**
 * @swagger
 * /assets/{id}/maintenance:
 *   post:
 *     summary: Create maintenance record
 *     tags: [Asset Maintenance]
 *     description: |
 *       Add a new maintenance record for an asset.
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the asset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - maintenanceDate
 *               - description
 *             properties:
 *               maintenanceDate:
 *                 type: string
 *                 format: date
 *                 example: '2024-06-15'
 *               description:
 *                 type: string
 *                 example: 'Annual servicing'
 *               cost:
 *                 type: number
 *                 example: 5000
 *               performedBy:
 *                 type: string
 *                 example: 'ABC Services'
 *               nextMaintenanceDate:
 *                 type: string
 *                 format: date
 *                 example: '2025-06-15'
 *               status:
 *                 type: string
 *                 enum: [scheduled, in_progress, completed, cancelled]
 *     responses:
 *       201:
 *         description: Maintenance record created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:id/maintenance', createMaintenanceValidation, validationHandler, createMaintenanceRecord);

/**
 * @swagger
 * /assets/{id}/maintenance/{maintenanceId}:
 *   put:
 *     summary: Update maintenance record
 *     tags: [Asset Maintenance]
 *     description: |
 *       Update an existing maintenance record.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the asset
 *       - in: path
 *         name: maintenanceId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the maintenance record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maintenanceDate:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *               cost:
 *                 type: number
 *               performedBy:
 *                 type: string
 *               nextMaintenanceDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [scheduled, in_progress, completed, cancelled]
 *     responses:
 *       200:
 *         description: Maintenance record updated successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/maintenance/:maintenanceId', updateMaintenanceValidation, validationHandler, updateMaintenanceRecord);

/**
 * @swagger
 * /assets/{id}/maintenance/{maintenanceId}:
 *   delete:
 *     summary: Delete maintenance record
 *     tags: [Asset Maintenance]
 *     description: |
 *       Delete a maintenance record.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the asset
 *       - in: path
 *         name: maintenanceId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the maintenance record
 *     responses:
 *       200:
 *         description: Maintenance record deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id/maintenance/:maintenanceId', deleteMaintenanceValidation, validationHandler, deleteMaintenanceRecord);

export default router;
