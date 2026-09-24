import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
} from '../controllers/userController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createUserValidation,
  updateUserValidation,
  getUserValidation,
  deleteUserValidation,
} from '../validations/userValidation';
import { param } from 'express-validator';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(allowRoles(['super_admin', 'mahall']));

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     description: |
 *       Retrieve all users with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall/Institute/Survey (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [super_admin, mahall, survey, institute]
 *         example: mahall
 *         description: Filter by user role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         example: active
 *         description: Filter by user status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: john
 *         description: Search by name, phone, or email
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439012'
 *         description: Filter by tenant ID (Super Admin only)
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
 *         description: List of users retrieved successfully
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
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *             example:
 *               success: true
 *               data:
 *                 - _id: '507f1f77bcf86cd799439011'
 *                   name: 'John Doe'
 *                   phone: '9876543210'
 *                   email: 'john@example.com'
 *                   role: 'mahall'
 *                   status: 'active'
 *                   permissions:
 *                     view: true
 *                     add: true
 *                     edit: true
 *                     delete: false
 *               pagination:
 *                 page: 1
 *                 limit: 10
 *                 total: 50
 *                 pages: 5
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     description: Get a specific user by ID. Access based on tenant ownership.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439011'
 *         description: MongoDB ObjectId of the user
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               data:
 *                 _id: '507f1f77bcf86cd799439011'
 *                 name: 'John Doe'
 *                 phone: '9876543210'
 *                 email: 'john@example.com'
 *                 role: 'mahall'
 *                 tenantId: '507f1f77bcf86cd799439012'
 *                 status: 'active'
 *                 permissions:
 *                   view: true
 *                   add: true
 *                   edit: true
 *                   delete: false
 *                 isSuperAdmin: false
 *                 joiningDate: '2024-01-01T00:00:00.000Z'
 *                 createdAt: '2024-01-01T00:00:00.000Z'
 *                 updatedAt: '2024-01-15T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getUserValidation, validationHandler, getUserById);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     description: |
 *       Create a new user.
 *       **Access:** Super Admin (any tenant), Mahall/Institute/Survey (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *           examples:
 *             mahallUser:
 *               summary: Create Mahall Admin User
 *               value:
 *                 name: 'Ahmed Ali'
 *                 phone: '9876543210'
 *                 email: 'ahmed@example.com'
 *                 role: 'mahall'
 *                 password: 'password123'
 *                 permissions:
 *                   view: true
 *                   add: true
 *                   edit: true
 *                   delete: false
 *             instituteUser:
 *               summary: Create Institute User
 *               value:
 *                 name: 'Institute Manager'
 *                 phone: '9876543211'
 *                 email: 'institute@example.com'
 *                 role: 'institute'
 *                 password: 'password123'
 *                 permissions:
 *                   view: true
 *                   add: true
 *                   edit: true
 *                   delete: false
 *             surveyUser:
 *               summary: Create Survey User
 *               value:
 *                 name: 'Survey User'
 *                 phone: '9876543212'
 *                 role: 'survey'
 *                 password: 'password123'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               data:
 *                 _id: '507f1f77bcf86cd799439011'
 *                 name: 'Ahmed Ali'
 *                 phone: '9876543210'
 *                 email: 'ahmed@example.com'
 *                 role: 'mahall'
 *                 status: 'active'
 *                 permissions:
 *                   view: true
 *                   add: true
 *                   edit: true
 *                   delete: false
 *                 createdAt: '2024-01-01T00:00:00.000Z'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: 'Some details are missing or incorrect. Please check the form and try again.'
 *               errors:
 *                 - msg: 'Phone number must be exactly 10 digits'
 *                   param: 'phone'
 *                   location: 'body'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', createUserValidation, validationHandler, createUser);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     description: Update user details. Access based on tenant ownership.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439011'
 *         description: MongoDB ObjectId of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *           examples:
 *             updateName:
 *               summary: Update user name
 *               value:
 *                 name: 'Ahmed Ali Updated'
 *             updateStatus:
 *               summary: Update user status
 *               value:
 *                 status: 'inactive'
 *             updateEmail:
 *               summary: Update user email
 *               value:
 *                 email: 'ahmed.updated@example.com'
 *             updateMultiple:
 *               summary: Update multiple fields
 *               value:
 *                 name: 'Ahmed Ali Updated'
 *                 email: 'ahmed.updated@example.com'
 *                 status: 'active'
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               data:
 *                 _id: '507f1f77bcf86cd799439011'
 *                 name: 'Ahmed Ali Updated'
 *                 phone: '9876543210'
 *                 email: 'ahmed.updated@example.com'
 *                 role: 'mahall'
 *                 status: 'active'
 *                 updatedAt: '2024-01-15T10:30:00.000Z'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', updateUserValidation, validationHandler, updateUser);

/**
 * @swagger
 * /users/{id}/status:
 *   put:
 *     summary: Update user status
 *     tags: [Users]
 *     description: |
 *       Update user status (active or inactive).
 *       When member user status is updated, linked member status will also be updated.
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: inactive
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/status', [param('id').isMongoId().withMessage('Invalid user ID')], validationHandler, updateUserStatus);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user (soft delete)
 *     tags: [Users]
 *     description: |
 *       Soft delete a user by setting status to 'inactive'.
 *       For member users, linked member status will be set to 'deleted'.
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
 *         description: User status updated to inactive successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', deleteUserValidation, validationHandler, deleteUser);

export default router;

