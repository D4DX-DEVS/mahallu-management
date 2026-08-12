import express from 'express';
import {
  getAreaReport,
  getBloodBankReport,
  getOrphansReport,
  getDemographicsReport,
  getEducationReport,
} from '../controllers/reportController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  getAreaReportValidation,
  getBloodBankReportValidation,
  getOrphansReportValidation,
} from '../validations/reportValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /reports/area:
 *   get:
 *     summary: Get area-wise report
 *     tags: [Reports]
 *     description: |
 *       Get area-wise statistics report (families, members, etc. grouped by area).
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439012'
 *         description: Tenant ID (Super Admin only, optional)
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         example: 'Kerala'
 *         description: Filter by state
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *         example: 'Kozhikode'
 *         description: Filter by district
 *       - in: query
 *         name: village
 *         schema:
 *           type: string
 *         example: 'Kozhikode'
 *         description: Filter by village
 *     responses:
 *       200:
 *         description: Area report retrieved successfully
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
 *                     areas:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           area:
 *                             type: string
 *                             example: 'Area A'
 *                           totalFamilies:
 *                             type: number
 *                             example: 50
 *                           totalMembers:
 *                             type: number
 *                             example: 200
 *                           state:
 *                             type: string
 *                             example: 'Kerala'
 *                           district:
 *                             type: string
 *                             example: 'Kozhikode'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalAreas:
 *                           type: number
 *                         totalFamilies:
 *                           type: number
 *                         totalMembers:
 *                           type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/area', getAreaReportValidation, validationHandler, getAreaReport);

/**
 * @swagger
 * /reports/blood-bank:
 *   get:
 *     summary: Get blood bank report
 *     tags: [Reports]
 *     description: |
 *       Get blood bank report with members grouped by blood group.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439012'
 *         description: Tenant ID (Super Admin only, optional)
 *       - in: query
 *         name: bloodGroup
 *         schema:
 *           type: string
 *           enum: ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve']
 *         example: 'O +ve'
 *         description: Filter by blood group
 *     responses:
 *       200:
 *         description: Blood bank report retrieved successfully
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
 *                     bloodGroups:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           bloodGroup:
 *                             type: string
 *                             example: 'O +ve'
 *                           count:
 *                             type: number
 *                             example: 25
 *                           members:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 _id:
 *                                   type: string
 *                                 name:
 *                                   type: string
 *                                 phone:
 *                                   type: string
 *                                 age:
 *                                   type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalMembers:
 *                           type: number
 *                         totalBloodGroups:
 *                           type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/blood-bank', getBloodBankReportValidation, validationHandler, getBloodBankReport);

/**
 * @swagger
 * /reports/orphans:
 *   get:
 *     summary: Get orphans report
 *     tags: [Reports]
 *     description: |
 *       Get orphans report with members who are orphans (age-based or family status).
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439012'
 *         description: Tenant ID (Super Admin only, optional)
 *       - in: query
 *         name: age
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 18
 *         example: 10
 *         description: Filter by maximum age (default 18)
 *     responses:
 *       200:
 *         description: Orphans report retrieved successfully
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
 *                     orphans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           age:
 *                             type: number
 *                           gender:
 *                             type: string
 *                           familyId:
 *                             type: string
 *                           familyName:
 *                             type: string
 *                           guardianName:
 *                             type: string
 *                           contactNo:
 *                             type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalOrphans:
 *                           type: number
 *                         byAgeGroup:
 *                           type: object
 *                           properties:
 *                             '0-5':
 *                               type: number
 *                             '6-10':
 *                               type: number
 *                             '11-15':
 *                               type: number
 *                             '16-18':
 *                               type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/orphans', getOrphansReportValidation, validationHandler, getOrphansReport);

/**
 * @swagger
 * /reports/demographics:
 *   get:
 *     summary: Demographic report
 *     tags: [Reports]
 *     description: |
 *       Age band, gender, education, employment and welfare aggregates.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Demographic aggregates
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/demographics', getDemographicsReport);

/**
 * @swagger
 * /reports/education:
 *   get:
 *     summary: Education report
 *     tags: [Reports, Education]
 *     description: |
 *       Comprehensive education statistics: students count, active classes, attendance %,
 *       exams count, scholarship totals and status breakdown, academic support cases by type and status.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         description: Tenant ID (Super Admin only, optional)
 *     responses:
 *       200:
 *         description: Education report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     studentsCount:
 *                       type: number
 *                     activeClassesCount:
 *                       type: number
 *                     attendancePercentThisMonth:
 *                       type: number
 *                     examsCount:
 *                       type: number
 *                     scholarships:
 *                       type: object
 *                       properties:
 *                         activeScholarships:
 *                           type: number
 *                         totalAwardedAmount:
 *                           type: number
 *                         totalAwards:
 *                           type: number
 *                         awardsByStatus:
 *                           type: object
 *                     supportCases:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         byType:
 *                           type: object
 *                         byStatus:
 *                           type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/education', getEducationReport);

export default router;

