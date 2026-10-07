import express from 'express';
import { authMiddleware, requireAdmin } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import { listReconciliationIssues, resolveReconciliationIssue } from '../controllers/reconciliationController';

const router = express.Router();

// Records of money flows whose automatic undo failed and that an administrator must review.
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(requireAdmin);

/**
 * @swagger
 * /reconciliation:
 *   get:
 *     summary: List flows that need administrator review (admin only, tenant-scoped)
 *     tags: [Reconciliation]
 */
router.get('/', listQuery(), validationHandler, listReconciliationIssues);

/**
 * @swagger
 * /reconciliation/{id}/resolve:
 *   put:
 *     summary: Mark a flow as reviewed (body { note }, 3-500 characters)
 *     tags: [Reconciliation]
 */
router.put('/:id/resolve', idParam('id', 'issue'), validationHandler, resolveReconciliationIssue);

export default router;
