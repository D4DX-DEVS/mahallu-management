import express from 'express';
import {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  getMembersByFamily,
  updateMemberStatus,
  bulkImportMembers,
} from '../controllers/memberController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createMemberValidation,
  updateMemberValidation,
  getMemberValidation,
  deleteMemberValidation,
} from '../validations/memberValidation';
import { param } from 'express-validator';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(allowRoles(['super_admin', 'mahall', 'survey', 'institute']));

/**
 * @swagger
 * /members:
 *   get:
 *     summary: Get all members
 *     tags: [Members]
 *     description: |
 *       Retrieve all members with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall/Institute/Survey (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: familyId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439013'
 *         description: Filter by family ID (MongoDB ObjectId)
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *           enum: [male, female]
 *         example: male
 *         description: Filter by gender
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: ahmed
 *         description: Search by name, mahallId, familyName, or phone
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, deleted]
 *         example: active
 *         description: Filter by member status (default excludes deleted)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [mahallId, name, createdAt]
 *         example: name
 *         default: createdAt
 *         description: Sort field
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
 *         description: List of members retrieved successfully
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
 *                     $ref: '#/components/schemas/Member'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *             example:
 *               success: true
 *               data:
 *                 - _id: '507f1f77bcf86cd799439014'
 *                   name: 'Ahmed Ali'
 *                   familyId: '507f1f77bcf86cd799439013'
 *                   familyName: 'Al-Hamd House'
 *                   age: 25
 *                   gender: 'male'
 *                   bloodGroup: 'O +ve'
 *                   phone: '9876543210'
 *                   tenantId: '507f1f77bcf86cd799439012'
 *               pagination:
 *                 page: 1
 *                 limit: 10
 *                 total: 100
 *                 pages: 10
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', getAllMembers);

/**
 * @swagger
 * /members/bulk-import:
 *   post:
 *     summary: Bulk import members to a family
 *     tags: [Members]
 *     description: |
 *       Import up to 500 members to a family at once (CSV parsed client-side into JSON rows).
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [familyId, members]
 *             properties:
 *               familyId:
 *                 type: string
 *                 description: The ID of the family to import members into
 *               members:
 *                 type: array
 *                 maxItems: 500
 *                 items:
 *                   type: object
 *                   required: [name]
 *                   properties:
 *                     name:
 *                       type: string
 *                     nameMl:
 *                       type: string
 *                     gender:
 *                       type: string
 *                       enum: [male, female]
 *                     age:
 *                       type: integer
 *                     maritalStatus:
 *                       type: string
 *                       enum: [single, married, divorced, widowed]
 *                     education:
 *                       type: string
 *                     occupation:
 *                       type: string
 *     responses:
 *       201:
 *         description: Number of members imported
 *       400:
 *         description: Validation errors with row numbers
 *       403:
 *         description: Family does not belong to this tenant
 */
router.post('/bulk-import', allowRoles(['mahall', 'super_admin']), bulkImportMembers);

/**
 * @swagger
 * /members/family/{familyId}:
 *   get:
 *     summary: Get members by family
 *     tags: [Members]
 *     description: Get all members belonging to a specific family
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: familyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of members in the family
 */
router.get('/family/:familyId', [param('familyId').isMongoId().withMessage('Invalid family ID')], validationHandler, getMembersByFamily);

/**
 * @swagger
 * /members/{id}:
 *   get:
 *     summary: Get member by ID
 *     tags: [Members]
 *     description: Get a specific member by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Member details
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getMemberValidation, validationHandler, getMemberById);

/**
 * @swagger
 * /members:
 *   post:
 *     summary: Create a new member
 *     tags: [Members]
 *     description: |
 *       Create a new member. Member must belong to a family.
 *       **Access:** Super Admin (any tenant), Mahall/Institute/Survey (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMemberRequest'
 *           examples:
 *             basicMember:
 *               summary: Create basic member
 *               value:
 *                 name: 'Ahmed Ali'
 *                 familyId: '507f1f77bcf86cd799439013'
 *                 familyName: 'Al-Hamd House'
 *             completeMember:
 *               summary: Create member with all details
 *               value:
 *                 name: 'Ahmed Ali'
 *                 familyId: '507f1f77bcf86cd799439013'
 *                 familyName: 'Al-Hamd House'
 *                 age: 25
 *                 gender: 'male'
 *                 bloodGroup: 'O +ve'
 *                 healthStatus: 'Healthy'
 *                 phone: '9876543210'
 *                 education: 'Bachelor Degree'
 *                 mahallId: 'MAH001'
 *     responses:
 *       201:
 *         description: Member created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Member'
 *             example:
 *               success: true
 *               data:
 *                 _id: '507f1f77bcf86cd799439014'
 *                 name: 'Ahmed Ali'
 *                 familyId: '507f1f77bcf86cd799439013'
 *                 familyName: 'Al-Hamd House'
 *                 age: 25
 *                 gender: 'male'
 *                 bloodGroup: 'O +ve'
 *                 phone: '9876543210'
 *                 tenantId: '507f1f77bcf86cd799439012'
 *                 createdAt: '2024-01-01T00:00:00.000Z'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: 'Validation failed'
 *               errors:
 *                 - msg: 'Name must be between 2 and 100 characters'
 *                   param: 'name'
 *                   location: 'body'
 *                 - msg: 'Family ID is required'
 *                   param: 'familyId'
 *                   location: 'body'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Family does not belong to this tenant
 *       404:
 *         description: Family not found
 */
router.post('/', createMemberValidation, validationHandler, createMember);

/**
 * @swagger
 * /members/{id}:
 *   put:
 *     summary: Update member
 *     tags: [Members]
 *     description: Update member details
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
 *               name: { type: string }
 *               age: { type: integer }
 *               gender: { type: string, enum: [male, female] }
 *               bloodGroup: { type: string, enum: [A +ve, A -ve, B +ve, B -ve, AB +ve, AB -ve, O +ve, O -ve] }
 *     responses:
 *       200:
 *         description: Member updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', updateMemberValidation, validationHandler, updateMember);

/**
 * @swagger
 * /members/{id}/status:
 *   put:
 *     summary: Update member status
 *     tags: [Members]
 *     description: |
 *       Update member status (active, inactive, or deleted).
 *       When status is set to deleted or inactive, linked user account will also be deactivated.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, deleted]
 *                 example: inactive
 *     responses:
 *       200:
 *         description: Member status updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/status', [param('id').isMongoId().withMessage('Invalid member ID')], validationHandler, updateMemberStatus);

/**
 * @swagger
 * /members/{id}:
 *   delete:
 *     summary: Delete member (soft delete)
 *     tags: [Members]
 *     description: |
 *       Soft delete a member by setting status to 'deleted'.
 *       Linked user account will also be deactivated.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Member status updated to deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', deleteMemberValidation, validationHandler, deleteMember);

export default router;

