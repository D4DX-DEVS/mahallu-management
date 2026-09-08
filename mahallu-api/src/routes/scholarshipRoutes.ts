import express from 'express';
import {
  getAllScholarships,
  getScholarshipById,
  createScholarship,
  updateScholarship,
  deleteScholarship,
  getAllAwards,
  getAwardsByScholarship,
  createAward,
  updateAward,
  deleteAward,
} from '../controllers/scholarshipController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { supportRouter } from './academicSupportRoutes';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createScholarshipValidation,
  createAwardValidation,
  updateScholarshipValidation,
  updateAwardValidation,
} from '../validations/moduleValidation';

// Middleware stack
const applyAuth = (router: express.Router) => {
  router.use(authMiddleware);
  router.use(tenantMiddleware);
  router.use(tenantFilter);
};

// Create separate routers for each resource (academic support lives in academicSupportRoutes.ts)
const scholarshipsRouter = express.Router();
const awardsRouter = express.Router();

// Apply auth to all routers
applyAuth(scholarshipsRouter);
applyAuth(awardsRouter);

// ============= SCHOLARSHIPS ENDPOINTS =============

/**
 * @swagger
 * /api/scholarships:
 *   get:
 *     summary: List scholarships
 *     tags: [Education]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *         example: '2025-26'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, closed]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated scholarships
 *   post:
 *     summary: Create a scholarship
 *     tags: [Education]
 *     description: |
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, amount, academicYear]
 *             properties:
 *               name:
 *                 type: string
 *               nameMl:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               academicYear:
 *                 type: string
 *                 example: '2025-26'
 *               criteria:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, closed]
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Invalid input
 */
scholarshipsRouter.get('/', listQuery(), validationHandler, getAllScholarships);
scholarshipsRouter.post('/', createScholarshipValidation, validationHandler, allowRoles(['mahall']), createScholarship);

/**
 * @swagger
 * /api/scholarships/{id}:
 *   get:
 *     summary: Get one scholarship
 *     tags: [Education]
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
 *         description: Scholarship details
 *       404:
 *         description: Not found
 *   put:
 *     summary: Update a scholarship
 *     tags: [Education]
 *     description: |
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
 *               nameMl:
 *                 type: string
 *               amount:
 *                 type: number
 *               criteria:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, closed]
 *     responses:
 *       200:
 *         description: Updated
 *       404:
 *         description: Not found
 *   delete:
 *     summary: Delete a scholarship
 *     tags: [Education]
 *     description: |
 *       Rejected if awards exist; mark closed instead.
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
 *         description: Deleted
 *       400:
 *         description: Cannot delete — awards exist
 *       404:
 *         description: Not found
 */
scholarshipsRouter.get('/:id', idParam('id', 'scholarship'), validationHandler, getScholarshipById);
scholarshipsRouter.put('/:id', updateScholarshipValidation, validationHandler, allowRoles(['mahall']), updateScholarship);
scholarshipsRouter.delete('/:id', idParam('id', 'scholarship'), validationHandler, allowRoles(['mahall']), deleteScholarship);

/**
 * @swagger
 * /api/scholarships/{id}/awards:
 *   get:
 *     summary: Get awards for a specific scholarship
 *     tags: [Education]
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
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated awards for scholarship
 *       404:
 *         description: Scholarship not found
 */
scholarshipsRouter.get('/:id/awards', idParam('id', 'scholarship'), validationHandler, getAwardsByScholarship);

// ============= SCHOLARSHIP AWARDS ENDPOINTS =============

/**
 * @swagger
 * /api/scholarship-awards:
 *   get:
 *     summary: List scholarship awards
 *     tags: [Education]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: scholarshipId
 *         schema:
 *           type: string
 *       - in: query
 *         name: memberId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [applied, approved, paid]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated awards
 *   post:
 *     summary: Create a scholarship award
 *     tags: [Education]
 *     description: |
 *       Both the scholarship and member must belong to the caller's Mahallu.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scholarshipId, memberId, amount]
 *             properties:
 *               scholarshipId:
 *                 type: string
 *               memberId:
 *                 type: string
 *               awardedDate:
 *                 type: string
 *                 format: date
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               status:
 *                 type: string
 *                 enum: [applied, approved, paid]
 *               remarks:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Invalid input or reference from another tenant
 */
awardsRouter.get('/', listQuery(), validationHandler, getAllAwards);
awardsRouter.post('/', createAwardValidation, validationHandler, allowRoles(['mahall']), createAward);

/**
 * @swagger
 * /api/scholarship-awards/{id}:
 *   put:
 *     summary: Update a scholarship award
 *     tags: [Education]
 *     description: |
 *       Validates status transitions: applied → approved → paid.
 *       Cannot skip steps or go backwards.
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
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [applied, approved, paid]
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid status transition
 *       404:
 *         description: Award not found
 *   delete:
 *     summary: Remove a scholarship award
 *     tags: [Education]
 *     description: |
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
 *         description: Deleted
 *       404:
 *         description: Award not found
 */
awardsRouter.put('/:id', updateAwardValidation, validationHandler, allowRoles(['mahall']), updateAward);
awardsRouter.delete('/:id', idParam('id', 'award'), validationHandler, allowRoles(['mahall']), deleteAward);


// Export all routers
export { scholarshipsRouter, awardsRouter, supportRouter };
