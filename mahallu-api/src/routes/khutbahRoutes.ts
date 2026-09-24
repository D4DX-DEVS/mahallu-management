import express from 'express';
import {
  getAllKhateebs,
  getKhateebById,
  createKhateeb,
  updateKhateeb,
  deleteKhateeb,
  getAllKhutbahs,
  getKhutbahById,
  createKhutbah,
  updateKhutbah,
  deleteKhutbah,
  getMosqueInstituteHandler,
} from '../controllers/khutbahController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { param } from 'express-validator';
import { idParam, listQuery } from '../validations/common';
import {
  createKhateebValidation,
  createKhutbahValidation,
  updateKhateebValidation,
  updateKhutbahValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

// KHATEEBS CRUD

/**
 * @swagger
 * /khateebs:
 *   get:
 *     summary: Get all khateebs
 *     tags: [Religious]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: List of khateebs
 */
router.get('/khateebs', listQuery(), validationHandler, getAllKhateebs);

/**
 * @swagger
 * /khateebs/{id}:
 *   get:
 *     summary: Get khateeb by ID
 *     tags: [Religious]
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
 *         description: Khateeb details
 */
router.get('/khateebs/:id', param('id').isMongoId(), validationHandler, getKhateebById);

/**
 * @swagger
 * /khateebs:
 *   post:
 *     summary: Create a khateeb
 *     tags: [Religious]
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
 *               memberId:
 *                 type: string
 *               qualifications:
 *                 type: string
 *               contactNo:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       201:
 *         description: Khateeb created
 */
router.post('/khateebs', createKhateebValidation, validationHandler, allowRoles(['mahall']), createKhateeb);

/**
 * @swagger
 * /khateebs/{id}:
 *   put:
 *     summary: Update a khateeb
 *     tags: [Religious]
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
 *               qualifications:
 *                 type: string
 *               contactNo:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Khateeb updated
 */
router.put('/khateebs/:id', allowRoles(['mahall']), updateKhateebValidation, validationHandler, updateKhateeb);

/**
 * @swagger
 * /khateebs/{id}:
 *   delete:
 *     summary: Delete a khateeb
 *     tags: [Religious]
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
 *         description: Khateeb deleted
 */
router.delete('/khateebs/:id', allowRoles(['mahall']), param('id').isMongoId(), validationHandler, deleteKhateeb);

// KHUTBAHS CRUD

/**
 * @swagger
 * /khutbahs:
 *   get:
 *     summary: Get all khutbahs
 *     tags: [Religious]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: khateebId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, delivered, cancelled]
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: '2025-01'
 *       - in: query
 *         name: upcoming
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of khutbahs
 */
router.get('/khutbahs', listQuery(), validationHandler, getAllKhutbahs);

/**
 * @swagger
 * /khutbahs/{id}:
 *   get:
 *     summary: Get khutbah by ID
 *     tags: [Religious]
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
 *         description: Khutbah details
 */
router.get('/khutbahs/:id', param('id').isMongoId(), validationHandler, getKhutbahById);

/**
 * @swagger
 * /khutbahs:
 *   post:
 *     summary: Create a khutbah
 *     tags: [Religious]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [khateebId, date, topic]
 *             properties:
 *               khateebId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               topic:
 *                 type: string
 *               topicMl:
 *                 type: string
 *               notes:
 *                 type: string
 *               resourceUrl:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [scheduled, delivered, cancelled]
 *     responses:
 *       201:
 *         description: Khutbah created
 */
router.post('/khutbahs', createKhutbahValidation, validationHandler, allowRoles(['mahall']), createKhutbah);

/**
 * @swagger
 * /khutbahs/{id}:
 *   put:
 *     summary: Update a khutbah
 *     tags: [Religious]
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
 *               khateebId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               topic:
 *                 type: string
 *               topicMl:
 *                 type: string
 *               notes:
 *                 type: string
 *               resourceUrl:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [scheduled, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Khutbah updated
 */
router.put('/khutbahs/:id', allowRoles(['mahall']), updateKhutbahValidation, validationHandler, updateKhutbah);

/**
 * @swagger
 * /khutbahs/{id}:
 *   delete:
 *     summary: Delete a khutbah
 *     tags: [Religious]
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
 *         description: Khutbah deleted
 */
router.delete('/khutbahs/:id', allowRoles(['mahall']), param('id').isMongoId(), validationHandler, deleteKhutbah);

// MOSQUE INSTITUTE ENDPOINT

/**
 * @swagger
 * /religious/mosque-institute:
 *   get:
 *     summary: Get or create mosque institute
 *     tags: [Religious]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mosque institute
 */
router.get('/religious/mosque-institute', listQuery(), validationHandler, getMosqueInstituteHandler);

export default router;
