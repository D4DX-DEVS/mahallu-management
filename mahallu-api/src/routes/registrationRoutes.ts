import express from 'express';
import {
  getAllNikahRegistrations,
  getNikahRegistrationById,
  createNikahRegistration,
  updateNikahRegistration,
  getAllDeathRegistrations,
  getDeathRegistrationById,
  createDeathRegistration,
  updateDeathRegistration,
  getAllNOCs,
  getNOCById,
  createNOC,
  updateNOC,
} from '../controllers/registrationController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createNikahRegistrationValidation,
  getNikahRegistrationValidation,
  updateNikahRegistrationValidation,
  createDeathRegistrationValidation,
  getDeathRegistrationValidation,
  updateDeathRegistrationValidation,
  createNOCValidation,
  updateNOCValidation,
  getNOCValidation,
} from '../validations/registrationValidation';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /registrations/nikah:
 *   get:
 *     summary: Get all Nikah registrations
 *     tags: [Registrations]
 *     description: |
 *       Retrieve all Nikah (marriage) registrations with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         example: pending
 *         description: Filter by status
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-01-01'
 *         description: Filter registrations from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-12-31'
 *         description: Filter registrations until this date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: ahmed
 *         description: Search by groom name, bride name, or mahallId
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
 *         description: List of Nikah registrations retrieved successfully
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
 *                     $ref: '#/components/schemas/NikahRegistration'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/nikah', listQuery(), validationHandler, getAllNikahRegistrations);

/**
 * @swagger
 * /registrations/nikah/{id}:
 *   get:
 *     summary: Get Nikah registration by ID
 *     tags: [Registrations]
 *     description: |
 *       Get a specific Nikah registration by ID.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439020'
 *         description: MongoDB ObjectId of the Nikah registration
 *     responses:
 *       200:
 *         description: Nikah registration details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NikahRegistration'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/nikah/:id', getNikahRegistrationValidation, validationHandler, getNikahRegistrationById);

/**
 * @swagger
 * /registrations/nikah:
 *   post:
 *     summary: Create a new Nikah registration
 *     tags: [Registrations]
 *     description: |
 *       Create a new Nikah (marriage) registration.
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNikahRegistrationRequest'
 *           examples:
 *             basicNikah:
 *               summary: Create basic Nikah registration
 *               value:
 *                 groomName: 'Ahmed Ali'
 *                 brideName: 'Fatima Khan'
 *                 nikahDate: '2024-02-14T10:00:00.000Z'
 *             completeNikah:
 *               summary: Create Nikah registration with all details
 *               value:
 *                 groomName: 'Ahmed Ali'
 *                 groomAge: 28
 *                 groomId: '507f1f77bcf86cd799439014'
 *                 brideName: 'Fatima Khan'
 *                 brideAge: 25
 *                 brideId: '507f1f77bcf86cd799439015'
 *                 nikahDate: '2024-02-14T10:00:00.000Z'
 *                 mahallId: 'MAH001'
 *                 waliName: 'Mohammed Khan'
 *                 witness1: 'Abdul Rahman'
 *                 witness2: 'Ibrahim Ali'
 *                 mahrAmount: 50000
 *                 mahrDescription: 'Gold and cash'
 *                 status: 'pending'
 *                 remarks: 'Registration pending approval'
 *     responses:
 *       201:
 *         description: Nikah registration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NikahRegistration'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/nikah', createNikahRegistrationValidation, validationHandler, createNikahRegistration);

/**
 * @swagger
 * /registrations/nikah/{id}:
 *   put:
 *     summary: Update Nikah registration
 *     tags: [Registrations]
 *     description: |
 *       Update an existing Nikah registration.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the Nikah registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNikahRegistrationRequest'
 *     responses:
 *       200:
 *         description: Nikah registration updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/nikah/:id', updateNikahRegistrationValidation, validationHandler, updateNikahRegistration);

/**
 * @swagger
 * /registrations/death:
 *   get:
 *     summary: Get all Death registrations
 *     tags: [Registrations]
 *     description: |
 *       Retrieve all Death registrations with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         example: pending
 *         description: Filter by status
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-01-01'
 *         description: Filter registrations from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-12-31'
 *         description: Filter registrations until this date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: ahmed
 *         description: Search by deceased name or mahallId
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
 *         description: List of Death registrations retrieved successfully
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
 *                     $ref: '#/components/schemas/DeathRegistration'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/death', listQuery(), validationHandler, getAllDeathRegistrations);

/**
 * @swagger
 * /registrations/death/{id}:
 *   get:
 *     summary: Get Death registration by ID
 *     tags: [Registrations]
 *     description: |
 *       Get a specific Death registration by ID.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439021'
 *         description: MongoDB ObjectId of the Death registration
 *     responses:
 *       200:
 *         description: Death registration details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DeathRegistration'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/death/:id', getDeathRegistrationValidation, validationHandler, getDeathRegistrationById);

/**
 * @swagger
 * /registrations/death:
 *   post:
 *     summary: Create a new Death registration
 *     tags: [Registrations]
 *     description: |
 *       Create a new Death registration.
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDeathRegistrationRequest'
 *           examples:
 *             basicDeath:
 *               summary: Create basic Death registration
 *               value:
 *                 deceasedName: 'Ahmed Ali'
 *                 deathDate: '2024-02-10T00:00:00.000Z'
 *             completeDeath:
 *               summary: Create Death registration with all details
 *               value:
 *                 deceasedName: 'Ahmed Ali'
 *                 deceasedId: '507f1f77bcf86cd799439014'
 *                 deathDate: '2024-02-10T00:00:00.000Z'
 *                 placeOfDeath: 'Kozhikode Hospital'
 *                 causeOfDeath: 'Natural causes'
 *                 mahallId: 'MAH001'
 *                 familyId: '507f1f77bcf86cd799439013'
 *                 informantName: 'Mohammed Ali'
 *                 informantRelation: 'Son'
 *                 informantPhone: '9876543210'
 *                 status: 'pending'
 *                 remarks: 'Registration pending approval'
 *     responses:
 *       201:
 *         description: Death registration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DeathRegistration'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/death', createDeathRegistrationValidation, validationHandler, createDeathRegistration);

/**
 * @swagger
 * /registrations/death/{id}:
 *   put:
 *     summary: Update Death registration
 *     tags: [Registrations]
 *     description: |
 *       Update an existing Death registration.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the Death registration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDeathRegistrationRequest'
 *     responses:
 *       200:
 *         description: Death registration updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/death/:id', updateDeathRegistrationValidation, validationHandler, updateDeathRegistration);

/**
 * @swagger
 * /registrations/noc:
 *   get:
 *     summary: Get all NOCs (No Objection Certificates)
 *     tags: [Registrations]
 *     description: |
 *       Retrieve all NOCs with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [common, nikah]
 *         example: common
 *         description: Filter by NOC type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         example: pending
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: ahmed
 *         description: Search by applicant name
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
 *         description: List of NOCs retrieved successfully
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
 *                     $ref: '#/components/schemas/NOC'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/noc', listQuery(), validationHandler, getAllNOCs);

/**
 * @swagger
 * /registrations/noc/{id}:
 *   get:
 *     summary: Get NOC by ID
 *     tags: [Registrations]
 *     description: |
 *       Get a specific NOC by ID.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439022'
 *         description: MongoDB ObjectId of the NOC
 *     responses:
 *       200:
 *         description: NOC details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NOC'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/noc/:id', getNOCValidation, validationHandler, getNOCById);

/**
 * @swagger
 * /registrations/noc:
 *   post:
 *     summary: Create a new NOC
 *     tags: [Registrations]
 *     description: |
 *       Create a new NOC (No Objection Certificate).
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNOCRequest'
 *           examples:
 *             commonNOC:
 *               summary: Create common NOC
 *               value:
 *                 applicantName: 'Ahmed Ali'
 *                 purpose: 'Travel abroad for business'
 *                 type: 'common'
 *             nikahNOC:
 *               summary: Create NOC for Nikah
 *               value:
 *                 applicantName: 'Ahmed Ali'
 *                 applicantId: '507f1f77bcf86cd799439014'
 *                 applicantPhone: '9876543210'
 *                 purpose: 'NOC for Nikah registration'
 *                 type: 'nikah'
 *                 nikahRegistrationId: '507f1f77bcf86cd799439020'
 *                 status: 'pending'
 *     responses:
 *       201:
 *         description: NOC created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NOC'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/noc', createNOCValidation, validationHandler, createNOC);

/**
 * @swagger
 * /registrations/noc/{id}:
 *   put:
 *     summary: Update NOC
 *     tags: [Registrations]
 *     description: |
 *       Update NOC details (approve/reject, set issued/expiry dates).
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439022'
 *         description: MongoDB ObjectId of the NOC
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateNOCRequest'
 *           examples:
 *             approveNOC:
 *               summary: Approve NOC
 *               value:
 *                 status: 'approved'
 *                 issuedDate: '2024-02-15T00:00:00.000Z'
 *                 expiryDate: '2024-08-15T00:00:00.000Z'
 *                 remarks: 'NOC approved for travel'
 *             rejectNOC:
 *               summary: Reject NOC
 *               value:
 *                 status: 'rejected'
 *                 remarks: 'Incomplete documentation'
 *     responses:
 *       200:
 *         description: NOC updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NOC'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/noc/:id', updateNOCValidation, validationHandler, updateNOC);

export default router;

