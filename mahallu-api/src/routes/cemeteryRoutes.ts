import express from 'express';
import {
  getAllCemeteries,
  getCemeteryById,
  createCemetery,
  updateCemetery,
  deleteCemetery,
  getAllGraveRecords,
  getGraveRecordById,
  createGraveRecord,
  updateGraveRecord,
  deleteGraveRecord,
  getCemeteryGraves,
} from '../controllers/cemeteryController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

// Middleware stack helper
const applyAuth = (router: express.Router) => {
  router.use(authMiddleware);
  router.use(tenantMiddleware);
  router.use(tenantFilter);
};

// Create separate routers for each resource type
export const cemeteriesRouter = express.Router();
export const gravesRouter = express.Router();

// Apply auth to both routers
applyAuth(cemeteriesRouter);
applyAuth(gravesRouter);

// ==================== CEMETERY ROUTES ====================

/**
 * @swagger
 * /api/cemeteries:
 *   get:
 *     summary: List cemeteries
 *     tags: [Cemetery]
 *     description: |
 *       Paginated list of cemeteries with grave count (used capacity).
 *       **Access:** Super Admin, Mahall Admin
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
 *         description: Cemetery list with usedCount aggregation
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
cemeteriesRouter.get('/', getAllCemeteries);

/**
 * @swagger
 * /api/cemeteries/{id}:
 *   get:
 *     summary: Get a cemetery
 *     tags: [Cemetery]
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
 *         description: Cemetery with grave count
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
cemeteriesRouter.get('/:id', getCemeteryById);

/**
 * @swagger
 * /api/cemeteries/{id}/graves:
 *   get:
 *     summary: Get graves in a cemetery
 *     tags: [Cemetery]
 *     description: Paginated grave records for a specific cemetery with search
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Graves in cemetery
 *       404:
 *         description: Cemetery not found
 */
cemeteriesRouter.get('/:id/graves', getCemeteryGraves);

/**
 * @swagger
 * /api/cemeteries:
 *   post:
 *     summary: Create a cemetery
 *     tags: [Cemetery]
 *     description: |
 *       **Access:** Mahall Admin only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, capacity]
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: string
 *               capacity:
 *                 type: number
 *                 minimum: 1
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 default: active
 *     responses:
 *       201:
 *         description: Cemetery created
 *       400:
 *         description: Validation error
 */
cemeteriesRouter.post('/', allowRoles(['mahall']), createCemetery);

/**
 * @swagger
 * /api/cemeteries/{id}:
 *   put:
 *     summary: Update a cemetery
 *     tags: [Cemetery]
 *     description: |
 *       **Access:** Mahall Admin only
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
 *     responses:
 *       200:
 *         description: Cemetery updated
 *       404:
 *         description: Cemetery not found
 */
cemeteriesRouter.put('/:id', allowRoles(['mahall']), updateCemetery);

/**
 * @swagger
 * /api/cemeteries/{id}:
 *   delete:
 *     summary: Delete a cemetery
 *     tags: [Cemetery]
 *     description: |
 *       **Access:** Mahall Admin only
 *       **Constraint:** Cannot delete if cemetery has graves
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
 *         description: Cemetery deleted
 *       400:
 *         description: Cemetery has graves
 *       404:
 *         description: Cemetery not found
 */
cemeteriesRouter.delete('/:id', allowRoles(['mahall']), deleteCemetery);

// ==================== GRAVE RECORDS ROUTES ====================

/**
 * @swagger
 * /api/grave-records:
 *   get:
 *     summary: List grave records
 *     tags: [Cemetery]
 *     description: |
 *       Paginated grave records with search by deceased name or grave number.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cemeteryId
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Grave records list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
gravesRouter.get('/', getAllGraveRecords);

/**
 * @swagger
 * /api/grave-records/{id}:
 *   get:
 *     summary: Get a grave record
 *     tags: [Cemetery]
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
 *         description: Grave record
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
gravesRouter.get('/:id', getGraveRecordById);

/**
 * @swagger
 * /api/grave-records:
 *   post:
 *     summary: Create a grave record
 *     tags: [Cemetery]
 *     description: |
 *       **Access:** Mahall Admin only
 *       **Validation:** Cemetery must exist, graveNo must be unique per cemetery
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cemeteryId, graveNo, deceasedName]
 *             properties:
 *               cemeteryId:
 *                 type: string
 *               graveNo:
 *                 type: string
 *               deceasedMemberId:
 *                 type: string
 *               deceasedName:
 *                 type: string
 *               dateOfDeath:
 *                 type: string
 *                 format: date
 *               burialDate:
 *                 type: string
 *                 format: date
 *               familyId:
 *                 type: string
 *               rowLabel:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Grave record created
 *       400:
 *         description: Validation error or duplicate graveNo
 */
gravesRouter.post('/', allowRoles(['mahall']), createGraveRecord);

/**
 * @swagger
 * /api/grave-records/{id}:
 *   put:
 *     summary: Update a grave record
 *     tags: [Cemetery]
 *     description: |
 *       **Access:** Mahall Admin only
 *       **Note:** cemeteryId and graveNo cannot be changed
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
 *     responses:
 *       200:
 *         description: Grave record updated
 *       404:
 *         description: Grave record not found
 */
gravesRouter.put('/:id', allowRoles(['mahall']), updateGraveRecord);

/**
 * @swagger
 * /api/grave-records/{id}:
 *   delete:
 *     summary: Delete a grave record
 *     tags: [Cemetery]
 *     description: |
 *       **Access:** Mahall Admin only
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
 *         description: Grave record deleted
 *       404:
 *         description: Grave record not found
 */
gravesRouter.delete('/:id', allowRoles(['mahall']), deleteGraveRecord);
