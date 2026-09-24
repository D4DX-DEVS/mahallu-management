import express from 'express';
import { getDashboardStats, getRecentFamilies, getActivityTimeline, getFinancialSummary } from '../controllers/dashboardController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get('/recent-families', listQuery(), validationHandler, allowRoles(['super_admin', 'mahall', 'survey', 'institute']), getRecentFamilies);
router.get('/activity-timeline', listQuery(), validationHandler, allowRoles(['super_admin', 'mahall', 'survey', 'institute']), getActivityTimeline);

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     description: |
 *       Get comprehensive dashboard statistics for the authenticated user's tenant.
 *       Includes user counts, family counts, member counts, and their distributions.
 *       **Access:** All authenticated users (Super Admin, Mahall, Institute, Survey)
 *       - Super Admin: Gets statistics for all tenants (if tenantId query param provided) or all data
 *       - Other roles: Gets statistics for their own tenant only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439012'
 *         description: Tenant ID (Super Admin only, optional)
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 25
 *                           description: Total number of users
 *                         active:
 *                           type: number
 *                           example: 20
 *                           description: Number of active users
 *                         inactive:
 *                           type: number
 *                           example: 5
 *                           description: Number of inactive users
 *                     families:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 150
 *                           description: Total number of families
 *                         approved:
 *                           type: number
 *                           example: 120
 *                           description: Number of approved families
 *                         pending:
 *                           type: number
 *                           example: 20
 *                           description: Number of pending families
 *                         unapproved:
 *                           type: number
 *                           example: 10
 *                           description: Number of unapproved families
 *                     members:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 500
 *                           description: Total number of members
 *                         male:
 *                           type: number
 *                           example: 250
 *                           description: Number of male members
 *                         female:
 *                           type: number
 *                           example: 250
 *                           description: Number of female members
 *             example:
 *               success: true
 *               data:
 *                 users:
 *                   total: 25
 *                   active: 20
 *                   inactive: 5
 *                 families:
 *                   total: 150
 *                   approved: 120
 *                   pending: 20
 *                   unapproved: 10
 *                 members:
 *                   total: 500
 *                   male: 250
 *                   female: 250
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         description: Internal server error
 */
router.get('/stats', listQuery(), validationHandler, allowRoles(['super_admin', 'mahall', 'survey', 'institute', 'member']), getDashboardStats);
router.get('/financial-summary', listQuery(), validationHandler, allowRoles(['super_admin', 'mahall', 'institute']), getFinancialSummary);

export default router;

