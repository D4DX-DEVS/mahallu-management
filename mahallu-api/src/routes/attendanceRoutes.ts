import express from 'express';
import {
  upsertAttendance,
  listAttendance,
  getAttendanceById,
  getClassProgress,
} from '../controllers/attendanceController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  upsertAttendanceValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /class-attendance:
 *   post:
 *     summary: Create or update class attendance
 *     tags: [Education]
 *     description: |
 *       Upsert attendance for a class on a given date. One document per class per date.
 *       Records array contains presence marking for each enrolled student.
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
 *               date:
 *                 type: string
 *                 format: date
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     enrollmentId:
 *                       type: string
 *                     present:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Attendance record created/updated
 *       400:
 *         description: Invalid input or references
 */
router.post('/', upsertAttendanceValidation, validationHandler, allowRoles(['super_admin', 'mahall']), upsertAttendance);

/**
 * @swagger
 * /class-attendance:
 *   get:
 *     summary: List class attendance records
 *     tags: [Education]
 *     description: |
 *       List attendance records, filtered by classId and/or month (YYYY-MM).
 *       **Access:** Super Admin, Mahall Admin, Institute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           pattern: 'YYYY-MM'
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
 *         description: Paginated attendance records
 */
router.get('/', listQuery(), validationHandler, listAttendance);

/**
 * @swagger
 * /class-attendance/{id}:
 *   get:
 *     summary: Get attendance record by ID
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
 *         description: Attendance record
 *       404:
 *         description: Record not found
 */
router.get('/:id', idParam('id', 'record'), validationHandler, getAttendanceById);

export default router;
