import express from 'express';
import {
  getAllNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createNotificationValidation,
  markAsReadValidation,
} from '../validations/notificationValidation';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get all notifications
 *     tags: [Notifications]
 *     description: |
 *       Retrieve all notifications for the authenticated user with pagination and filtering.
 *       **Access:** All authenticated users (Super Admin, Mahall, Institute, Survey)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: recipientType
 *         schema:
 *           type: string
 *           enum: [user, member, all]
 *         example: all
 *         description: Filter by recipient type
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [info, warning, success, error]
 *         example: info
 *         description: Filter by notification type
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         example: false
 *         description: Filter by read status
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
 *         description: List of notifications retrieved successfully
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
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllNotifications);

/**
 * @swagger
 * /notifications:
 *   post:
 *     summary: Create a new notification
 *     tags: [Notifications]
 *     description: |
 *       Create a new notification for users or members.
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNotificationRequest'
 *           examples:
 *             userNotification:
 *               summary: Create notification for specific user
 *               value:
 *                 recipientId: '507f1f77bcf86cd799439011'
 *                 recipientType: 'user'
 *                 title: 'New Family Added'
 *                 message: 'A new family has been added to your mahallu'
 *                 type: 'info'
 *             allUsersNotification:
 *               summary: Create notification for all users
 *               value:
 *                 recipientType: 'all'
 *                 title: 'Ramadan Mubarak'
 *                 message: 'Wishing all community members a blessed Ramadan'
 *                 type: 'success'
 *                 link: '/ramadan-info'
 *     responses:
 *       201:
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', createNotificationValidation, validationHandler, createNotification);

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     description: |
 *       Mark a specific notification as read.
 *       **Access:** All authenticated users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439025'
 *         description: MongoDB ObjectId of the notification
 *     responses:
 *       200:
 *         description: Notification marked as read successfully
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
 *                   example: 'Notification marked as read'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id/read', markAsReadValidation, validationHandler, markAsRead);

/**
 * @swagger
 * /notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     description: |
 *       Mark all notifications for the authenticated user as read.
 *       **Access:** All authenticated users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read successfully
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
 *                   example: 'All notifications marked as read'
 *                 count:
 *                   type: integer
 *                   example: 5
 *                   description: Number of notifications marked as read
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.put('/read-all', markAllAsRead);

export default router;

