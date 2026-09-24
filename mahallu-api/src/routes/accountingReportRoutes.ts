import express from 'express';
import {
  getDayBook,
  getTrialBalance,
  getBalanceSheet,
  getLedgerReport,
  getIncomeExpenditure,
  getConsolidatedReport,
} from '../controllers/accountingReportController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter, instituteFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(instituteFilter);

/**
 * @swagger
 * /accounting-reports/day-book:
 *   get:
 *     summary: Get Day Book
 *     tags: [Accounting Reports]
 *     description: |
 *       Chronological list of all transactions for an institute within a date range.
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
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Day book entries with totals
 */
router.get('/day-book', listQuery(), validationHandler, getDayBook);

/**
 * @swagger
 * /accounting-reports/trial-balance:
 *   get:
 *     summary: Get Trial Balance
 *     tags: [Accounting Reports]
 *     description: |
 *       Aggregate income vs expense totals by ledger.
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
 *         name: asOfDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Calculate balance as of this date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Trial balance with debit/credit columns
 */
router.get('/trial-balance', listQuery(), validationHandler, getTrialBalance);

/**
 * @swagger
 * /accounting-reports/balance-sheet:
 *   get:
 *     summary: Get Balance Sheet
 *     tags: [Accounting Reports]
 *     description: |
 *       Assets (bank balances) vs liabilities, income summary vs expense summary.
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
 *         name: asOfDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Calculate balance as of this date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Balance sheet with assets, income, expenses and summary
 */
router.get('/balance-sheet', listQuery(), validationHandler, getBalanceSheet);
router.get('/ledger-report', listQuery(), validationHandler, getLedgerReport);
router.get('/income-expenditure', listQuery(), validationHandler, getIncomeExpenditure);
router.get('/consolidated', listQuery(), validationHandler, getConsolidatedReport);

export default router;
