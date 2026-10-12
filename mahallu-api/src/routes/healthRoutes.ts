import express from 'express';
import {
  getAllHealthResources,
  getAllSensitiveHealthResources,
  getHealthResourceById,
  createHealthResource,
  createSensitiveHealthResource,
  updateHealthResource,
  deleteHealthResource,
  getHealthSummary,
} from '../controllers/healthResourceController';
import {
  getAllMedicalCamps,
  getMedicalCampById,
  createMedicalCamp,
  updateMedicalCamp,
  deleteMedicalCamp,
} from '../controllers/medicalCampController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { sensitiveAccess } from '../middleware/sensitiveAccess';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

// ===== Health Resources =====

/**
 * @swagger
 * /api/health-resources/summary:
 *   get:
 *     summary: Health resources summary
 *     tags: [Health]
 *     description: |
 *       Get summary stats: doctors count, blood donors by group, elderly care count.
 *       Sensitive counts (palliative cases, patient support) only returned if user has health permission.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health summary statistics
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/health-resources/summary', getHealthSummary);

/**
 * @swagger
 * /api/health-resources:
 *   get:
 *     summary: List health resources (non-sensitive types)
 *     tags: [Health]
 *     description: |
 *       List doctors, blood donors, and elderly care resources.
 *       Palliative cases and patient support are restricted; use /health-resources/sensitive endpoint.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [doctor, blood_donor, elderly_care]
 *       - in: query
 *         name: bloodGroup
 *         schema:
 *           type: string
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
 *         description: Paginated health resources list
 *   post:
 *     summary: Create a health resource (non-sensitive)
 *     tags: [Health]
 *     description: |
 *       Create a doctor, blood donor, or elderly care resource.
 *       Use /health-resources/sensitive for palliative cases and patient support.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, name, contactNo]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [doctor, blood_donor, elderly_care]
 *               memberId:
 *                 type: string
 *               name:
 *                 type: string
 *               specialty:
 *                 type: string
 *               bloodGroup:
 *                 type: string
 *               contactNo:
 *                 type: string
 *               availability:
 *                 type: string
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       201:
 *         description: Health resource created
 */
router.get('/health-resources', getAllHealthResources);
router.post('/health-resources', allowRoles(['mahall', 'super_admin']), createHealthResource);

/**
 * @swagger
 * /api/health-resources/{id}:
 *   get:
 *     summary: Get a health resource by ID
 *     tags: [Health]
 *     description: |
 *       Retrieve a single health resource.
 *       **Access:** Super Admin, Mahall Admin, Survey
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
 *         description: Health resource details
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Update a health resource
 *     tags: [Health]
 *     description: |
 *       Update a health resource.
 *       Sensitive resources require health permission.
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
 *               name:
 *                 type: string
 *               contactNo:
 *                 type: string
 *               specialty:
 *                 type: string
 *               bloodGroup:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Health resource updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete a health resource
 *     tags: [Health]
 *     description: |
 *       Delete a health resource.
 *       Sensitive resources require health permission.
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
 *         description: Health resource deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// Registered before the ':id' handlers below — '/sensitive' must not be captured as an id.
router.get('/health-resources/sensitive', sensitiveAccess('health'), getAllSensitiveHealthResources);
router.post(
  '/health-resources/sensitive',
  allowRoles(['mahall', 'super_admin']),
  sensitiveAccess('health'),
  createSensitiveHealthResource
);

router.get('/health-resources/:id', getHealthResourceById);
router.put('/health-resources/:id', allowRoles(['mahall', 'super_admin']), updateHealthResource);
router.delete('/health-resources/:id', allowRoles(['mahall', 'super_admin']), deleteHealthResource);

/**
 * @swagger
 * /api/health-resources/sensitive:
 *   get:
 *     summary: List sensitive health resources
 *     tags: [Health]
 *     description: |
 *       List palliative cases and patient support resources.
 *       Requires 'health' sensitive module permission.
 *       **Access:** Super Admin, Authorized health staff (with sensitiveModules: ['health'])
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated sensitive resources list
 *       403:
 *         description: Access restricted
 *   post:
 *     summary: Create a sensitive health resource
 *     tags: [Health]
 *     description: |
 *       Create a palliative case or patient support resource.
 *       Requires 'health' sensitive module permission.
 *       **Access:** Super Admin, Authorized health staff
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, name, contactNo]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [palliative_case, patient_support]
 *               memberId:
 *                 type: string
 *               name:
 *                 type: string
 *               contactNo:
 *                 type: string
 *               availability:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sensitive resource created
 *       403:
 *         description: Access restricted
 */
// (sensitive routes are registered above the '/health-resources/:id' handlers)

// ===== Medical Camps =====

/**
 * @swagger
 * /api/medical-camps:
 *   get:
 *     summary: List medical camps
 *     tags: [Health]
 *     description: |
 *       List medical camps with optional filters.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [planned, completed, cancelled]
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
 *         description: Paginated medical camps list
 *   post:
 *     summary: Create a medical camp
 *     tags: [Health]
 *     description: |
 *       Create a new medical camp.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, campDate, location]
 *             properties:
 *               name:
 *                 type: string
 *               campDate:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: string
 *               organizer:
 *                 type: string
 *               attendeeCount:
 *                 type: number
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [planned, completed, cancelled]
 *     responses:
 *       201:
 *         description: Medical camp created
 */
router.get('/medical-camps', getAllMedicalCamps);
router.post('/medical-camps', allowRoles(['mahall', 'super_admin']), createMedicalCamp);

/**
 * @swagger
 * /api/medical-camps/{id}:
 *   get:
 *     summary: Get a medical camp by ID
 *     tags: [Health]
 *     description: |
 *       Retrieve a single medical camp.
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
 *         description: Medical camp details
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Update a medical camp
 *     tags: [Health]
 *     description: |
 *       Update a medical camp.
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
 *               campDate:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: string
 *               organizer:
 *                 type: string
 *               attendeeCount:
 *                 type: number
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Medical camp updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete a medical camp
 *     tags: [Health]
 *     description: |
 *       Delete a medical camp.
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
 *         description: Medical camp deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/medical-camps/:id', getMedicalCampById);
router.put('/medical-camps/:id', allowRoles(['mahall', 'super_admin']), updateMedicalCamp);
router.delete('/medical-camps/:id', allowRoles(['mahall', 'super_admin']), deleteMedicalCamp);

export default router;
