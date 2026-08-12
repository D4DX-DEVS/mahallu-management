import express from 'express';
import {
  getAllVolunteers,
  getVolunteerById,
  createVolunteer,
  updateVolunteer,
  deleteVolunteer,
  getVolunteerAssignments,
  getAllAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getVolunteerSummary,
} from '../controllers/volunteerController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

// Middleware stack
const applyAuth = (router: express.Router) => {
  router.use(authMiddleware);
  router.use(tenantMiddleware);
  router.use(tenantFilter);
};

// Create separate routers for each resource
const volunteersRouter = express.Router();
const assignmentsRouter = express.Router();

// Apply auth to all routers
applyAuth(volunteersRouter);
applyAuth(assignmentsRouter);

// ============= VOLUNTEERS ENDPOINTS =============

/**
 * @swagger
 * /api/volunteers/summary:
 *   get:
 *     summary: Volunteer summary statistics
 *     tags: [Volunteers]
 *     description: |
 *       Total active volunteers, breakdown by wing and service type,
 *       and assignments by status.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Volunteer summary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
volunteersRouter.get('/summary', getVolunteerSummary);

/**
 * @swagger
 * /api/volunteers:
 *   get:
 *     summary: List volunteers
 *     tags: [Volunteers]
 *     description: |
 *       List volunteers with optional filters by wing, service type, availability, and status.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: wing
 *         schema:
 *           type: string
 *           enum: [youth, women, general]
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *           enum: [janazah, grave_digging, patient_transport, palliative, emergency, first_aid, disaster, environment, govt_scheme_support, medical, other]
 *       - in: query
 *         name: availability
 *         schema:
 *           type: string
 *           enum: [anytime, weekends, emergency_only]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: memberId
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
 *         description: Paginated volunteers list with populated member info
 *   post:
 *     summary: Create a volunteer profile
 *     tags: [Volunteers]
 *     description: |
 *       Creates a volunteer profile and sets isVolunteer flag on the member.
 *       The member must belong to this Mahallu.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [memberId, wings, serviceTypes]
 *             properties:
 *               memberId:
 *                 type: string
 *               wings:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [youth, women, general]
 *               serviceTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [janazah, grave_digging, patient_transport, palliative, emergency, first_aid, disaster, environment, govt_scheme_support, medical, other]
 *               availability:
 *                 type: string
 *                 enum: [anytime, weekends, emergency_only]
 *                 default: anytime
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 default: active
 *     responses:
 *       201:
 *         description: Volunteer profile created
 *       400:
 *         description: Member does not belong to this Mahallu or validation error
 */
volunteersRouter.get('/', getAllVolunteers);
volunteersRouter.post('/', allowRoles(['mahall']), createVolunteer);

/**
 * @swagger
 * /api/volunteers/{id}:
 *   get:
 *     summary: Get a volunteer profile
 *     tags: [Volunteers]
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
 *         description: Volunteer profile with populated member info
 *       404:
 *         description: Volunteer not found
 *   put:
 *     summary: Update a volunteer profile
 *     tags: [Volunteers]
 *     description: |
 *       Updates volunteer wings, service types, availability, notes, and status.
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
 *               wings:
 *                 type: array
 *                 items:
 *                   type: string
 *               serviceTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *               availability:
 *                 type: string
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Volunteer profile updated
 *       404:
 *         description: Volunteer not found
 *   delete:
 *     summary: Delete a volunteer profile
 *     tags: [Volunteers]
 *     description: '**Access:** Super Admin, Mahall Admin'
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
 *         description: Volunteer deleted
 *       404:
 *         description: Volunteer not found
 */
volunteersRouter.get('/:id', getVolunteerById);
volunteersRouter.put('/:id', allowRoles(['mahall']), updateVolunteer);
volunteersRouter.delete('/:id', allowRoles(['mahall']), deleteVolunteer);

/**
 * @swagger
 * /api/volunteers/{id}/assignments:
 *   get:
 *     summary: Get service history for a volunteer
 *     tags: [Volunteers]
 *     description: |
 *       Returns paginated list of assignments this volunteer has been assigned to.
 *       **Access:** Super Admin, Mahall Admin
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated service history
 *       404:
 *         description: Volunteer not found
 */
volunteersRouter.get('/:id/assignments', getVolunteerAssignments);

// ============= VOLUNTEER ASSIGNMENTS ENDPOINTS =============

/**
 * @swagger
 * /api/volunteer-assignments:
 *   get:
 *     summary: List volunteer assignments
 *     tags: [Volunteers]
 *     description: |
 *       List assignments with optional filters by service type, status, and date range.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [assigned, completed, cancelled]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
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
 *         description: Paginated assignments list
 *   post:
 *     summary: Create a volunteer assignment
 *     tags: [Volunteers]
 *     description: |
 *       Assigns multiple volunteers to a service task.
 *       All volunteers must belong to this Mahallu.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [volunteerIds, serviceType, date, description]
 *             properties:
 *               volunteerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               serviceType:
 *                 type: string
 *                 enum: [janazah, grave_digging, patient_transport, palliative, emergency, first_aid, disaster, environment, govt_scheme_support, medical, other]
 *               date:
 *                 type: string
 *                 format: date-time
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [assigned, completed, cancelled]
 *                 default: assigned
 *               completionNotes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Assignment created
 *       400:
 *         description: One or more volunteers belong to another Mahallu or validation error
 */
assignmentsRouter.get('/', getAllAssignments);
assignmentsRouter.post('/', allowRoles(['mahall']), createAssignment);

/**
 * @swagger
 * /api/volunteer-assignments/{id}:
 *   get:
 *     summary: Get an assignment
 *     tags: [Volunteers]
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
 *         description: Assignment with populated volunteer info
 *       404:
 *         description: Assignment not found
 *   put:
 *     summary: Update an assignment
 *     tags: [Volunteers]
 *     description: |
 *       Updates assignment status, description, and completion notes.
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
 *               volunteerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               serviceType:
 *                 type: string
 *               date:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *               completionNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Assignment updated
 *       404:
 *         description: Assignment not found
 *   delete:
 *     summary: Delete an assignment
 *     tags: [Volunteers]
 *     description: '**Access:** Super Admin, Mahall Admin'
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
 *         description: Assignment deleted
 *       404:
 *         description: Assignment not found
 */
assignmentsRouter.get('/:id', getAssignmentById);
assignmentsRouter.put('/:id', allowRoles(['mahall']), updateAssignment);
assignmentsRouter.delete('/:id', allowRoles(['mahall']), deleteAssignment);

// Export all routers
export { volunteersRouter, assignmentsRouter };
