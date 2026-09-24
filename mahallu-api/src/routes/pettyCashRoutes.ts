import express from 'express';
import {
  getAllPettyCash,
  getPettyCash,
  createPettyCash,
  updatePettyCash,
  getPettyCashTransactions,
  recordExpense,
  replenishPettyCash,
} from '../controllers/pettyCashController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter, instituteFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createPettyCashValidation,
  updatePettyCashValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(instituteFilter);

// Petty Cash Funds
router.get('/', listQuery(), validationHandler, getAllPettyCash);
router.get('/:id', idParam('id', 'entry'), validationHandler, getPettyCash);
router.post('/', createPettyCashValidation, validationHandler, createPettyCash);
router.put('/:id', updatePettyCashValidation, validationHandler, updatePettyCash);

// Petty Cash Transactions
router.get('/:id/transactions', idParam('id', 'entry'), validationHandler, getPettyCashTransactions);
router.post('/:id/expense', idParam('id', 'entry'), validationHandler, recordExpense);
router.post('/:id/replenish', idParam('id', 'entry'), validationHandler, replenishPettyCash);

export default router;
