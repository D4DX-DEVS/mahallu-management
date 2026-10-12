import express from 'express';
import {
  listExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  updateExamResults,
} from '../controllers/examController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /exams:
 *   get:
 *     summary: List exams
 *     tags: [Education]
 *     description: |
 *       List exams for a class or all classes.
 *       **Access:** Super Admin, Mahall Admin, Institute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, completed, cancelled]
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
 *         description: Paginated exams
 */
router.get('/', listExams);

/**
 * @swagger
 * /exams:
 *   post:
 *     summary: Create an exam
 *     tags: [Education]
 *     description: |
 *       Create a new exam for a class.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               classId:
 *                 type: string
 *               name:
 *                 type: string
 *               examDate:
 *                 type: string
 *                 format: date
 *               maxMarks:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [scheduled, completed, cancelled]
 *     responses:
 *       201:
 *         description: Exam created
 *       400:
 *         description: Invalid input or references
 */
router.post('/', allowRoles(['super_admin', 'mahall']), createExam);

/**
 * @swagger
 * /exams/{id}:
 *   get:
 *     summary: Get exam by ID
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
 *         description: Exam record with results
 *       404:
 *         description: Exam not found
 */
router.get('/:id', getExamById);

/**
 * @swagger
 * /exams/{id}:
 *   put:
 *     summary: Update an exam
 *     tags: [Education]
 *     description: |
 *       Update exam details (name, date, maxMarks, status).
 *       Does NOT update results — use /results endpoint instead.
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
 *     responses:
 *       200:
 *         description: Exam updated
 *       404:
 *         description: Exam not found
 */
router.put('/:id', allowRoles(['super_admin', 'mahall']), updateExam);

/**
 * @swagger
 * /exams/{id}:
 *   delete:
 *     summary: Delete an exam
 *     tags: [Education]
 *     description: |
 *       Delete an exam record.
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
 *         description: Exam deleted
 *       404:
 *         description: Exam not found
 */
router.delete('/:id', allowRoles(['super_admin', 'mahall']), deleteExam);

/**
 * @swagger
 * /exams/{id}/results:
 *   put:
 *     summary: Update exam results
 *     tags: [Education]
 *     description: |
 *       Update the results array for an exam. Replaces entire results array.
 *       Validates marks ≤ maxMarks and enrollments belong to the class.
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
 *               results:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     enrollmentId:
 *                       type: string
 *                     marks:
 *                       type: number
 *                     grade:
 *                       type: string
 *     responses:
 *       200:
 *         description: Results updated
 *       400:
 *         description: Invalid marks or references
 *       404:
 *         description: Exam not found
 */
router.put('/:id/results', allowRoles(['super_admin', 'mahall']), updateExamResults);

export default router;
