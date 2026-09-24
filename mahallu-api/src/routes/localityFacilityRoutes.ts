import express from 'express';
import {
  getAllFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility,
} from '../controllers/surveyController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createFacilityValidation,
  updateFacilityValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /locality-facilities:
 *   get:
 *     summary: List locality facilities
 *     tags: [Survey]
 *     description: |
 *       Schools, hospitals, institutions and other facilities in the locality.
 *       **Access:** Super Admin, Mahall Admin, Survey
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [school, college, hospital, religious_institution, public_institution, library, organization, public_space, business, other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Facility list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllFacilities);

/**
 * @swagger
 * /locality-facilities/{id}:
 *   get:
 *     summary: Get a facility
 *     tags: [Survey]
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
 *         description: Facility
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam('id', 'facility'), validationHandler, getFacilityById);

/**
 * @swagger
 * /locality-facilities:
 *   post:
 *     summary: Create a facility
 *     tags: [Survey]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               nameMl:
 *                 type: string
 *               type:
 *                 type: string
 *               address:
 *                 type: string
 *               contactNo:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 *       403:
 *         description: Role not allowed
 */
router.post('/', createFacilityValidation, validationHandler, allowRoles(['mahall', 'survey']), createFacility);

/**
 * @swagger
 * /locality-facilities/{id}:
 *   put:
 *     summary: Update a facility
 *     tags: [Survey]
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
 *         description: Updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', updateFacilityValidation, validationHandler, allowRoles(['mahall', 'survey']), updateFacility);

/**
 * @swagger
 * /locality-facilities/{id}:
 *   delete:
 *     summary: Delete a facility
 *     tags: [Survey]
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
 *       403:
 *         description: Role not allowed
 */
router.delete('/:id', idParam('id', 'facility'), validationHandler, allowRoles(['mahall']), deleteFacility);

export default router;
