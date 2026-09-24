import express from 'express';
import {
  getAllSalaryPayments,
  getSalaryPaymentById,
  createSalaryPayment,
  updateSalaryPayment,
  deleteSalaryPayment,
  getSalarySummary,
  getEmployeeSalaryHistory,
} from '../controllers/salaryController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createSalaryPaymentValidation,
  updateSalaryPaymentValidation,
  getSalaryPaymentValidation,
  deleteSalaryPaymentValidation,
  getEmployeeSalaryHistoryValidation,
} from '../validations/salaryValidation';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /salary-payments:
 *   get:
 *     summary: Get all salary payments
 *     tags: [Salary Payments]
 *     description: |
 *       Retrieve all salary payments with pagination and filtering.
 *       **Access:** Super Admin, Mahall Admin, Institute User (own institute)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instituteId
 *         schema:
 *           type: string
 *         description: Filter by institute ID
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *         description: Filter by employee ID
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Filter by month (1-12)
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Filter by year
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [paid, pending, cancelled]
 *         description: Filter by payment status
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
 *         description: List of salary payments
 */
router.get('/', listQuery(), validationHandler, getAllSalaryPayments);

/**
 * @swagger
 * /salary-payments/summary:
 *   get:
 *     summary: Get salary summary
 *     tags: [Salary Payments]
 *     description: Get aggregated salary summary grouped by institute and month/year
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instituteId
 *         schema:
 *           type: string
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Salary summary data
 */
router.get('/summary', listQuery(), validationHandler, getSalarySummary);

/**
 * @swagger
 * /salary-payments/employee/{employeeId}:
 *   get:
 *     summary: Get salary history for an employee
 *     tags: [Salary Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Employee salary history
 */
router.get('/employee/:employeeId', getEmployeeSalaryHistoryValidation, validationHandler, getEmployeeSalaryHistory);

/**
 * @swagger
 * /salary-payments/{id}:
 *   get:
 *     summary: Get salary payment by ID
 *     tags: [Salary Payments]
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
 *         description: Salary payment details
 */
router.get('/:id', getSalaryPaymentValidation, validationHandler, getSalaryPaymentById);

/**
 * @swagger
 * /salary-payments:
 *   post:
 *     summary: Create a salary payment
 *     tags: [Salary Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [instituteId, employeeId, month, year, baseSalary, paymentDate, paymentMethod]
 *             properties:
 *               instituteId:
 *                 type: string
 *               employeeId:
 *                 type: string
 *               month:
 *                 type: integer
 *               year:
 *                 type: integer
 *               baseSalary:
 *                 type: number
 *               allowances:
 *                 type: number
 *               deductions:
 *                 type: number
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, bank, upi, cheque]
 *               status:
 *                 type: string
 *                 enum: [paid, pending, cancelled]
 *               remarks:
 *                 type: string
 *     responses:
 *       201:
 *         description: Salary payment created
 */
router.post('/', createSalaryPaymentValidation, validationHandler, createSalaryPayment);

/**
 * @swagger
 * /salary-payments/{id}:
 *   put:
 *     summary: Update a salary payment
 *     tags: [Salary Payments]
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
 *         description: Salary payment updated
 */
router.put('/:id', updateSalaryPaymentValidation, validationHandler, updateSalaryPayment);

/**
 * @swagger
 * /salary-payments/{id}:
 *   delete:
 *     summary: Delete a salary payment
 *     tags: [Salary Payments]
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
 *         description: Salary payment deleted
 */
router.delete('/:id', deleteSalaryPaymentValidation, validationHandler, deleteSalaryPayment);

export default router;
