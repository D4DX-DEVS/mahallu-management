import express from 'express';
import {
  getAllCommittees,
  getCommitteeById,
  createCommittee,
  updateCommittee,
  deleteCommittee,
  getCommitteeMeetings,
} from '../controllers/committeeController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createCommitteeValidation,
  updateCommitteeValidation,
  getCommitteeValidation,
  deleteCommitteeValidation,
} from '../validations/committeeValidation';
import { param } from 'express-validator';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /committees:
 *   get:
 *     summary: Get all committees
 *     tags: [Committees]
 *     description: |
 *       Retrieve all committees with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
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
 *         example: finance
 *         description: Search by name or description
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
 *         description: List of committees retrieved successfully
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
 *                     $ref: '#/components/schemas/Committee'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllCommittees);

/**
 * @swagger
 * /committees/{id}:
 *   get:
 *     summary: Get committee by ID
 *     tags: [Committees]
 *     description: |
 *       Get a specific committee by ID with member details.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439018'
 *         description: MongoDB ObjectId of the committee
 *     responses:
 *       200:
 *         description: Committee details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Committee'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getCommitteeValidation, validationHandler, getCommitteeById);

/**
 * @swagger
 * /committees/{id}/meetings:
 *   get:
 *     summary: Get committee meetings
 *     tags: [Committees]
 *     description: |
 *       Get all meetings for a specific committee.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439018'
 *         description: MongoDB ObjectId of the committee
 *     responses:
 *       200:
 *         description: List of committee meetings
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
 *                     $ref: '#/components/schemas/Meeting'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id/meetings', [param('id').isMongoId().withMessage('Invalid committee ID')], validationHandler, getCommitteeMeetings);

/**
 * @swagger
 * /committees:
 *   post:
 *     summary: Create a new committee
 *     tags: [Committees]
 *     description: |
 *       Create a new committee.
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCommitteeRequest'
 *           examples:
 *             basicCommittee:
 *               summary: Create basic committee
 *               value:
 *                 name: 'Finance Committee'
 *             completeCommittee:
 *               summary: Create committee with members
 *               value:
 *                 name: 'Finance Committee'
 *                 description: 'Manages financial matters'
 *                 members:
 *                   - '507f1f77bcf86cd799439014'
 *                   - '507f1f77bcf86cd799439015'
 *                 status: 'active'
 *     responses:
 *       201:
 *         description: Committee created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Committee'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', createCommitteeValidation, validationHandler, createCommittee);

/**
 * @swagger
 * /committees/{id}:
 *   put:
 *     summary: Update committee
 *     tags: [Committees]
 *     description: |
 *       Update committee details.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439018'
 *         description: MongoDB ObjectId of the committee
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCommitteeRequest'
 *     responses:
 *       200:
 *         description: Committee updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Committee'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', updateCommitteeValidation, validationHandler, updateCommittee);

/**
 * @swagger
 * /committees/{id}:
 *   delete:
 *     summary: Delete committee
 *     tags: [Committees]
 *     description: |
 *       Delete a committee.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439018'
 *         description: MongoDB ObjectId of the committee
 *     responses:
 *       200:
 *         description: Committee deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', deleteCommitteeValidation, validationHandler, deleteCommittee);

export default router;

