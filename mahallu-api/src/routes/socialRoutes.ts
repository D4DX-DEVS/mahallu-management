import express from 'express';
import {
  getAllBanners,
  createBanner,
  getBannerById,
  updateBanner,
  deleteBanner,
  getAllFeeds,
  createFeed,
  getActivityLogs,
  getAllSupport,
  createSupport,
  updateSupport,
} from '../controllers/socialController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  bannerIdParamValidation,
  createBannerValidation,
  updateBannerValidation,
  createFeedValidation,
  createSupportValidation,
  updateSupportValidation,
} from '../validations/socialValidation';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /social/banners:
 *   get:
 *     summary: Get all banners
 *     tags: [Social]
 *     description: |
 *       Retrieve all banners with pagination and filtering.
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
 *         description: List of banners retrieved successfully
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
 *                     $ref: '#/components/schemas/Banner'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/banners', listQuery(), validationHandler, getAllBanners);
router.get('/banners/:id', bannerIdParamValidation, validationHandler, getBannerById);

/**
 * @swagger
 * /social/banners:
 *   post:
 *     summary: Create a new banner
 *     tags: [Social]
 *     description: |
 *       Create a new banner for display.
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBannerRequest'
 *           examples:
 *             basicBanner:
 *               summary: Create basic banner
 *               value:
 *                 title: 'Ramadan Mubarak'
 *                 image: 'https://example.com/banner.jpg'
 *             completeBanner:
 *               summary: Create banner with all details
 *               value:
 *                 title: 'Ramadan Mubarak'
 *                 image: 'https://example.com/banner.jpg'
 *                 link: 'https://example.com/ramadan-info'
 *                 status: 'active'
 *                 startDate: '2024-03-10T00:00:00.000Z'
 *                 endDate: '2024-04-09T23:59:59.000Z'
 *     responses:
 *       201:
 *         description: Banner created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Banner'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/banners', createBannerValidation, validationHandler, createBanner);
router.put('/banners/:id', updateBannerValidation, validationHandler, updateBanner);
router.delete('/banners/:id', bannerIdParamValidation, validationHandler, deleteBanner);

/**
 * @swagger
 * /social/feeds:
 *   get:
 *     summary: Get all feeds
 *     tags: [Social]
 *     description: |
 *       Retrieve all feeds (posts) with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
 *         example: published
 *         description: Filter by status
 *       - in: query
 *         name: isSuperFeed
 *         schema:
 *           type: boolean
 *         example: false
 *         description: Filter by super feed flag
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439011'
 *         description: Filter by author user ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: ramadan
 *         description: Search by title or content
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
 *         description: List of feeds retrieved successfully
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
 *                     $ref: '#/components/schemas/Feed'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/feeds', listQuery(), validationHandler, getAllFeeds);

/**
 * @swagger
 * /social/feeds:
 *   post:
 *     summary: Create a new feed
 *     tags: [Social]
 *     description: |
 *       Create a new feed (post).
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFeedRequest'
 *           examples:
 *             basicFeed:
 *               summary: Create basic feed
 *               value:
 *                 title: 'Ramadan Announcement'
 *                 content: 'Ramadan Mubarak to all community members'
 *                 authorId: '507f1f77bcf86cd799439011'
 *             completeFeed:
 *               summary: Create feed with all details
 *               value:
 *                 title: 'Ramadan Announcement'
 *                 content: 'Ramadan Mubarak to all community members. Please note the prayer timings.'
 *                 image: 'https://example.com/ramadan.jpg'
 *                 authorId: '507f1f77bcf86cd799439011'
 *                 isSuperFeed: false
 *                 status: 'published'
 *     responses:
 *       201:
 *         description: Feed created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Feed'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/feeds', createFeedValidation, validationHandler, createFeed);

/**
 * @swagger
 * /social/activity-logs:
 *   get:
 *     summary: Get activity logs
 *     tags: [Social]
 *     description: |
 *       Retrieve activity logs with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439011'
 *         description: Filter by user ID
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         example: 'user'
 *         description: Filter by entity type (user, family, member, etc.)
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         example: 'create'
 *         description: Filter by action (create, update, delete, etc.)
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-01-01'
 *         description: Filter logs from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-12-31'
 *         description: Filter logs until this date
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
 *         description: Activity logs retrieved successfully
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
 *                     $ref: '#/components/schemas/ActivityLog'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/activity-logs', listQuery(), validationHandler, getActivityLogs);

/**
 * @swagger
 * /social/support:
 *   get:
 *     summary: Get all support tickets
 *     tags: [Social]
 *     description: |
 *       Retrieve all support tickets with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, resolved, closed]
 *         example: open
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         example: high
 *         description: Filter by priority
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439011'
 *         description: Filter by user ID
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
 *         description: List of support tickets retrieved successfully
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
 *                     $ref: '#/components/schemas/Support'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/support', listQuery(), validationHandler, getAllSupport);

/**
 * @swagger
 * /social/support:
 *   post:
 *     summary: Create a new support ticket
 *     tags: [Social]
 *     description: |
 *       Create a new support ticket.
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSupportRequest'
 *           examples:
 *             basicSupport:
 *               summary: Create basic support ticket
 *               value:
 *                 subject: 'Login Issue'
 *                 message: "We couldn't sign you in. Please try again."
 *             completeSupport:
 *               summary: Create support ticket with priority
 *               value:
 *                 subject: 'Login Issue'
 *                 message: "We couldn't sign you in. Please try again."
 *                 priority: 'high'
 *     responses:
 *       201:
 *         description: Support ticket created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Support'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/support', createSupportValidation, validationHandler, createSupport);

/**
 * @swagger
 * /social/support/{id}:
 *   put:
 *     summary: Update support ticket
 *     tags: [Social]
 *     description: |
 *       Update support ticket (respond, change status, priority).
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439024'
 *         description: MongoDB ObjectId of the support ticket
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSupportRequest'
 *           examples:
 *             respondSupport:
 *               summary: Respond to support ticket
 *               value:
 *                 status: 'in_progress'
 *                 response: 'We are looking into this issue. Will update you soon.'
 *             resolveSupport:
 *               summary: Resolve support ticket
 *               value:
 *                 status: 'resolved'
 *                 response: 'Issue has been resolved. Please try logging in again.'
 *     responses:
 *       200:
 *         description: Support ticket updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Support'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/support/:id', updateSupportValidation, validationHandler, updateSupport);

export default router;

