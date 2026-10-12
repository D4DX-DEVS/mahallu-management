import express from 'express';
import {
  getAllEmployers,
  getEmployerById,
  createEmployer,
  updateEmployer,
  deleteEmployer,
  getAllVacancies,
  getVacancyById,
  createVacancy,
  updateVacancy,
  deleteVacancy,
  getEmploymentSummary,
} from '../controllers/employmentController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { trainingsRouter } from './skillTrainingRoutes';

// Middleware stack
const applyAuth = (router: express.Router) => {
  router.use(authMiddleware);
  router.use(tenantMiddleware);
  router.use(tenantFilter);
};

// Create separate routers for each resource (trainings live in skillTrainingRoutes.ts)
const employersRouter = express.Router();
const vacanciesRouter = express.Router();
const summaryRouter = express.Router();

// Apply auth to all routers
applyAuth(employersRouter);
applyAuth(vacanciesRouter);
applyAuth(summaryRouter);

// ============= SUMMARY ENDPOINT =============

/**
 * @swagger
 * /api/employment/summary:
 *   get:
 *     summary: Employment summary
 *     tags: [Employment]
 *     description: |
 *       Aggregated counts: employers, open vacancies, trainings, job seekers, skilled workers.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employment totals
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
summaryRouter.get('/', getEmploymentSummary);

// ============= EMPLOYER ENDPOINTS =============

/**
 * @swagger
 * /api/employers:
 *   get:
 *     summary: List employers
 *     tags: [Employment]
 *     description: |
 *       Paginated list of employers.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
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
 *         description: Paginated employers list
 *   post:
 *     summary: Create employer
 *     tags: [Employment]
 *     description: |
 *       Create a new employer.
 *       **Access:** Super Admin, Mahall Admin
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
 *               businessType:
 *                 type: string
 *               contactPerson:
 *                 type: string
 *               contactNo:
 *                 type: string
 *               location:
 *                 type: string
 *               memberId:
 *                 type: string
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       201:
 *         description: Employer created
 */
employersRouter.get('/', getAllEmployers);
employersRouter.post('/', allowRoles(['mahall']), createEmployer);

/**
 * @swagger
 * /api/employers/{id}:
 *   get:
 *     summary: Get employer by ID
 *     tags: [Employment]
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
 *         description: Employer details
 *       404:
 *         description: Employer not found
 *   put:
 *     summary: Update employer
 *     tags: [Employment]
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
 *         description: Employer updated
 *   delete:
 *     summary: Delete employer
 *     tags: [Employment]
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
 *         description: Employer deleted
 */
employersRouter.get('/:id', getEmployerById);
employersRouter.put('/:id', allowRoles(['mahall']), updateEmployer);
employersRouter.delete('/:id', allowRoles(['mahall']), deleteEmployer);

// ============= JOB VACANCY ENDPOINTS =============

/**
 * @swagger
 * /api/job-vacancies:
 *   get:
 *     summary: List job vacancies
 *     tags: [Employment]
 *     description: |
 *       Paginated list of job vacancies.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by job title
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, filled, closed]
 *       - in: query
 *         name: employerId
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
 *         description: Paginated vacancies list
 *   post:
 *     summary: Create job vacancy
 *     tags: [Employment]
 *     description: |
 *       Create a new job vacancy. Either employerId or employerName must be provided.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               employerId:
 *                 type: string
 *               employerName:
 *                 type: string
 *               title:
 *                 type: string
 *               location:
 *                 type: string
 *               skillsRequired:
 *                 type: array
 *                 items:
 *                   type: string
 *               salaryRange:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [open, filled, closed]
 *               postedDate:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Vacancy created
 */
vacanciesRouter.get('/', getAllVacancies);
vacanciesRouter.post('/', allowRoles(['mahall']), createVacancy);

/**
 * @swagger
 * /api/job-vacancies/{id}:
 *   get:
 *     summary: Get job vacancy by ID
 *     tags: [Employment]
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
 *         description: Vacancy details
 *       404:
 *         description: Vacancy not found
 *   put:
 *     summary: Update vacancy
 *     tags: [Employment]
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
 *         description: Vacancy updated
 *   delete:
 *     summary: Delete vacancy
 *     tags: [Employment]
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
 *         description: Vacancy deleted
 */
vacanciesRouter.get('/:id', getVacancyById);
vacanciesRouter.put('/:id', allowRoles(['mahall']), updateVacancy);
vacanciesRouter.delete('/:id', allowRoles(['mahall']), deleteVacancy);


// Export all routers
export { employersRouter, vacanciesRouter, trainingsRouter, summaryRouter };
