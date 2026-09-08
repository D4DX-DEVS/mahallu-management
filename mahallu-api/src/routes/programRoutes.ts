import express from 'express';
import {
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  getProgramRegistrations,
  registerMemberForProgram,
  setProgramAttendance,
  removeProgramRegistration,
} from '../controllers/programController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createProgramValidation,
  updateProgramValidation,
  getProgramValidation,
  deleteProgramValidation,
} from '../validations/programValidation';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /programs:
 *   get:
 *     summary: Get all programs
 *     tags: [Programs]
 *     description: |
 *       Retrieve all programs with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         example: education
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
 *         description: List of programs retrieved successfully
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
 *                     $ref: '#/components/schemas/Program'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllPrograms);

/**
 * @swagger
 * /programs/{id}:
 *   get:
 *     summary: Get program by ID
 *     tags: [Programs]
 *     description: |
 *       Get a specific program by ID.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439016'
 *         description: MongoDB ObjectId of the program
 *     responses:
 *       200:
 *         description: Program details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Program'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getProgramValidation, validationHandler, getProgramById);

/**
 * @swagger
 * /programs:
 *   post:
 *     summary: Create a new program
 *     tags: [Programs]
 *     description: |
 *       Create a new program.
 *       **Access:** Super Admin (any tenant), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProgramRequest'
 *           examples:
 *             basicProgram:
 *               summary: Create basic program
 *               value:
 *                 name: 'Youth Education Program'
 *                 place: 'Kozhikode'
 *                 type: 'program'
 *             completeProgram:
 *               summary: Create program with all details
 *               value:
 *                 name: 'Youth Education Program'
 *                 place: 'Kozhikode'
 *                 type: 'program'
 *                 joinDate: '2024-01-01T00:00:00.000Z'
 *                 description: 'Educational program for youth'
 *                 contactNo: '9876543210'
 *                 email: 'program@example.com'
 *                 address:
 *                   state: 'Kerala'
 *                   district: 'Kozhikode'
 *                   pinCode: '673001'
 *                   postOffice: 'Kozhikode HO'
 *                 status: 'active'
 *     responses:
 *       201:
 *         description: Program created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Program'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', createProgramValidation, validationHandler, createProgram);

/**
 * @swagger
 * /programs/{id}:
 *   put:
 *     summary: Update program
 *     tags: [Programs]
 *     description: |
 *       Update program details.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439016'
 *         description: MongoDB ObjectId of the program
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProgramRequest'
 *     responses:
 *       200:
 *         description: Program updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Program'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', updateProgramValidation, validationHandler, updateProgram);

/**
 * @swagger
 * /programs/{id}:
 *   delete:
 *     summary: Delete program
 *     tags: [Programs]
 *     description: |
 *       Delete a program.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439016'
 *         description: MongoDB ObjectId of the program
 *     responses:
 *       200:
 *         description: Program deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', deleteProgramValidation, validationHandler, deleteProgram);

/**
 * @swagger
 * /programs/{id}/registrations:
 *   get:
 *     summary: List event registrations for a program (paginated)
 *     tags: [Programs]
 *     description: |
 *       Registrations recorded against a program run as an event (Task C3).
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Registrations retrieved successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   post:
 *     summary: Register a member for a program event
 *     tags: [Programs]
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
 *             required: [memberId]
 *             properties:
 *               memberId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Member registered
 *       409:
 *         description: Member is already registered
 */
router.get('/:id/registrations', idParam('id', 'program'), validationHandler, getProgramRegistrations);
router.post('/:id/registrations', idParam('id', 'program'), validationHandler, registerMemberForProgram);

/**
 * @swagger
 * /programs/{id}/registrations/{memberId}:
 *   put:
 *     summary: Mark a registered member present or absent
 *     tags: [Programs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [attended]
 *             properties:
 *               attended:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Attendance updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Remove a registration
 *     tags: [Programs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Registration removed
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/registrations/:memberId', idParam('id', 'program'), idParam('memberId', 'member'), validationHandler, setProgramAttendance);
router.delete('/:id/registrations/:memberId', idParam('id', 'program'), idParam('memberId', 'member'), validationHandler, removeProgramRegistration);

export default router;

