import express from 'express';
import {
  getAllMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
} from '../controllers/meetingController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createMeetingValidation,
  updateMeetingValidation,
  getMeetingValidation,
  deleteMeetingValidation,
} from '../validations/meetingValidation';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /meetings:
 *   get:
 *     summary: Get all meetings
 *     tags: [Meetings]
 *     description: |
 *       Retrieve all meetings with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: committeeId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439018'
 *         description: Filter by committee ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, completed, cancelled]
 *         example: scheduled
 *         description: Filter by status
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-01-01'
 *         description: Filter meetings from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-12-31'
 *         description: Filter meetings until this date
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
 *         description: List of meetings retrieved successfully
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
 *                     $ref: '#/components/schemas/Meeting'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllMeetings);

/**
 * @swagger
 * /meetings/{id}:
 *   get:
 *     summary: Get meeting by ID
 *     tags: [Meetings]
 *     description: |
 *       Get a specific meeting by ID with attendance details.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439019'
 *         description: MongoDB ObjectId of the meeting
 *     responses:
 *       200:
 *         description: Meeting details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Meeting'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getMeetingValidation, validationHandler, getMeetingById);

/**
 * @swagger
 * /meetings:
 *   post:
 *     summary: Create a new meeting
 *     tags: [Meetings]
 *     description: |
 *       Create a new meeting for a committee.
 *       **Access:** Super Admin (any tenant), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMeetingRequest'
 *           examples:
 *             basicMeeting:
 *               summary: Create basic meeting
 *               value:
 *                 committeeId: '507f1f77bcf86cd799439018'
 *                 title: 'Monthly Finance Meeting'
 *                 meetingDate: '2024-02-01T10:00:00.000Z'
 *             completeMeeting:
 *               summary: Create meeting with all details
 *               value:
 *                 committeeId: '507f1f77bcf86cd799439018'
 *                 title: 'Monthly Finance Meeting'
 *                 meetingDate: '2024-02-01T10:00:00.000Z'
 *                 agenda: 'Review monthly expenses and budget'
 *                 totalMembers: 10
 *                 attendance:
 *                   - '507f1f77bcf86cd799439014'
 *                   - '507f1f77bcf86cd799439015'
 *                 attendancePercent: 20
 *                 status: 'scheduled'
 *     responses:
 *       201:
 *         description: Meeting created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Meeting'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Committee not found
 */
router.post('/', createMeetingValidation, validationHandler, createMeeting);

/**
 * @swagger
 * /meetings/{id}:
 *   put:
 *     summary: Update meeting
 *     tags: [Meetings]
 *     description: |
 *       Update meeting details including attendance.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439019'
 *         description: MongoDB ObjectId of the meeting
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMeetingRequest'
 *           examples:
 *             updateAttendance:
 *               summary: Update meeting attendance
 *               value:
 *                 attendance:
 *                   - '507f1f77bcf86cd799439014'
 *                   - '507f1f77bcf86cd799439015'
 *                   - '507f1f77bcf86cd799439016'
 *                 totalMembers: 10
 *                 attendancePercent: 30
 *                 status: 'completed'
 *                 minutes: 'Meeting completed successfully'
 *     responses:
 *       200:
 *         description: Meeting updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Meeting'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', updateMeetingValidation, validationHandler, updateMeeting);

/**
 * @swagger
 * /meetings/{id}:
 *   delete:
 *     summary: Delete meeting
 *     tags: [Meetings]
 *     description: |
 *       Delete a meeting.
 *       **Access:** Super Admin (all tenants), Mahall Admin (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439019'
 *         description: MongoDB ObjectId of the meeting
 *     responses:
 *       200:
 *         description: Meeting deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', deleteMeetingValidation, validationHandler, deleteMeeting);

export default router;

