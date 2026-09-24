import express from 'express';
import {
  getAllClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  getClassStudents,
  getAllEnrollments,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
  getMadrasaSummary,
} from '../controllers/madrasaController';
import { getClassProgress } from '../controllers/attendanceController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createEnrollmentValidation,
  createClassValidation,
  updateEnrollmentValidation,
  updateClassValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /madrasa/summary:
 *   get:
 *     summary: Madrasa summary
 *     tags: [Education]
 *     description: |
 *       Class and student counts, broken down by class type and enrollment status.
 *       **Access:** Super Admin, Mahall Admin, Institute
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Education totals
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/summary', listQuery(), validationHandler, getMadrasaSummary);

/**
 * @swagger
 * /madrasa/enrollments:
 *   get:
 *     summary: List student enrollments
 *     tags: [Education]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
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
 *           enum: [active, completed, dropped]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated enrollments
 *   post:
 *     summary: Enroll a student in a class
 *     tags: [Education]
 *     description: |
 *       Both the class and the student must belong to the caller's Mahallu.
 *       A student can only be enrolled in a given class once.
 *       **Access:** Super Admin, Mahall Admin, Institute
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classId, memberId]
 *             properties:
 *               classId:
 *                 type: string
 *               memberId:
 *                 type: string
 *               rollNo:
 *                 type: string
 *               enrollDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [active, completed, dropped]
 *     responses:
 *       201:
 *         description: Enrolled
 *       400:
 *         description: Already enrolled, or a reference from another tenant
 */
router.get('/enrollments', listQuery(), validationHandler, getAllEnrollments);
router.post('/enrollments', createEnrollmentValidation, validationHandler, allowRoles(['mahall', 'institute']), createEnrollment);

/**
 * @swagger
 * /madrasa/enrollments/{id}:
 *   put:
 *     summary: Update an enrollment
 *     tags: [Education]
 *     description: |
 *       Roll number and status only - `classId`, `memberId` and `tenantId` are
 *       ignored. Move a student by creating a new enrollment.
 *       **Access:** Super Admin, Mahall Admin, Institute
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
 *               rollNo:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, completed, dropped]
 *     responses:
 *       200:
 *         description: Updated enrollment
 *       404:
 *         description: Enrollment not found
 *   delete:
 *     summary: Remove an enrollment
 *     tags: [Education]
 *     description: '**Access:** Super Admin, Mahall Admin, Institute'
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
 *         description: Removed
 *       404:
 *         description: Enrollment not found
 */
router.put('/enrollments/:id', updateEnrollmentValidation, validationHandler, allowRoles(['mahall', 'institute']), updateEnrollment);
router.delete('/enrollments/:id', idParam('id', 'record'), validationHandler, allowRoles(['mahall', 'institute']), deleteEnrollment);

/**
 * @swagger
 * /madrasa/classes:
 *   get:
 *     summary: List madrasa classes
 *     tags: [Education]
 *     description: Each row carries a `studentCount` of its active enrollments.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *         example: '2025-26'
 *       - in: query
 *         name: classType
 *         schema:
 *           type: string
 *           enum: [weekend_madrasa, tuition, adult_quran, remedial, other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Matches the class name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated classes
 *   post:
 *     summary: Create a class
 *     tags: [Education]
 *     description: |
 *       Any `instituteId` or `teacherEmployeeId` must belong to the caller's Mahallu.
 *       **Access:** Super Admin, Mahall Admin, Institute
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, academicYear]
 *             properties:
 *               name:
 *                 type: string
 *               nameMl:
 *                 type: string
 *               academicYear:
 *                 type: string
 *                 example: '2025-26'
 *               classType:
 *                 type: string
 *                 enum: [weekend_madrasa, tuition, adult_quran, remedial, other]
 *               instituteId:
 *                 type: string
 *               teacherEmployeeId:
 *                 type: string
 *               subjects:
 *                 type: array
 *                 items:
 *                   type: string
 *               schedule:
 *                 type: string
 *                 example: 'Sat-Sun 9-11am'
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Institute or teacher belongs to another tenant
 */
router.get('/classes', listQuery(), validationHandler, getAllClasses);
router.post('/classes', createClassValidation, validationHandler, allowRoles(['mahall', 'institute']), createClass);

/**
 * @swagger
 * /madrasa/classes/{id}:
 *   get:
 *     summary: Get one class
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
 *         description: Class with its active studentCount
 *       404:
 *         description: Class not found
 *   put:
 *     summary: Update a class
 *     tags: [Education]
 *     description: |
 *       `tenantId` is ignored, and an institute or teacher from another tenant
 *       is rejected with 400.
 *       **Access:** Super Admin, Mahall Admin, Institute
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
 *               academicYear:
 *                 type: string
 *               classType:
 *                 type: string
 *               teacherEmployeeId:
 *                 type: string
 *               subjects:
 *                 type: array
 *                 items:
 *                   type: string
 *               schedule:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Updated class
 *       400:
 *         description: Institute or teacher belongs to another tenant
 *       404:
 *         description: Class not found
 *   delete:
 *     summary: Delete a class
 *     tags: [Education]
 *     description: |
 *       Refused while students are enrolled - mark the class inactive instead.
 *       **Access:** Super Admin, Mahall Admin, Institute
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
 *         description: Blocked by existing enrollments
 *       404:
 *         description: Class not found
 */
router.get('/classes/:id', idParam('id', 'record'), validationHandler, getClassById);
router.put('/classes/:id', updateClassValidation, validationHandler, allowRoles(['mahall', 'institute']), updateClass);
router.delete('/classes/:id', idParam('id', 'record'), validationHandler, allowRoles(['mahall', 'institute']), deleteClass);

/**
 * @swagger
 * /madrasa/classes/{id}/students:
 *   get:
 *     summary: List the students enrolled in a class
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, dropped]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated enrollments with the student populated
 *       404:
 *         description: Class not found
 */
router.get('/classes/:id/students', idParam('id', 'record'), validationHandler, getClassStudents);

/**
 * @swagger
 * /madrasa/classes/{id}/progress:
 *   get:
 *     summary: Get class progress (attendance % and exam averages per student)
 *     tags: [Education]
 *     description: |
 *       Returns per-student attendance percentage and exam score averages for the class.
 *       **Access:** Super Admin, Mahall Admin, Institute
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
 *         description: Student progress data
 *       404:
 *         description: Class not found
 */
router.get('/classes/:id/progress', idParam('id', 'record'), validationHandler, getClassProgress);

export default router;
