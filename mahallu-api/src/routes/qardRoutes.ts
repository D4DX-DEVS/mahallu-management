import express from 'express';
import {
  getAllLoans,
  getLoanById,
  createLoan,
  updateLoan,
  updateLoanStatus,
  deleteLoan,
  getRepayments,
  createRepayment,
  getQardSummary,
} from '../controllers/qardController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createQardLoanValidation,
  createQardRepaymentValidation,
  updateQardLoanValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /qard/summary:
 *   get:
 *     summary: Qard Hasan portfolio summary
 *     tags: [Qard Hasan]
 *     description: |
 *       Total disbursed, outstanding and repaid, plus counts by status.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Portfolio totals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalDisbursed:
 *                       type: number
 *                     totalOutstanding:
 *                       type: number
 *                     totalRepaid:
 *                       type: number
 *                     activeLoans:
 *                       type: number
 *                     pendingApplications:
 *                       type: number
 *                     defaultedLoans:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/summary', listQuery(), validationHandler, getQardSummary);

/**
 * @swagger
 * /qard/repayments:
 *   get:
 *     summary: List repayments
 *     tags: [Qard Hasan]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: loanId
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
 *         description: Paginated repayments
 *   post:
 *     summary: Record a repayment against a loan
 *     tags: [Qard Hasan]
 *     description: |
 *       The amount is applied to the oldest unpaid installments first, then
 *       deducted from `outstandingBalance`. The loan auto-closes when the
 *       balance reaches zero. A repayment larger than the outstanding balance,
 *       or against a loan that is not disbursed/repaying, is rejected with 400.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [loanId, amount]
 *             properties:
 *               loanId:
 *                 type: string
 *               amount:
 *                 type: number
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               receiptNo:
 *                 type: string
 *               remarks:
 *                 type: string
 *     responses:
 *       201:
 *         description: Repayment recorded, with the new outstanding balance
 *       400:
 *         description: Amount exceeds the outstanding balance, or the loan is not repayable
 *       404:
 *         description: Loan not found
 */
router.get('/repayments', listQuery(), validationHandler, getRepayments);
router.post('/repayments', createQardRepaymentValidation, validationHandler, allowRoles(['mahall']), createRepayment);

/**
 * @swagger
 * /qard/loans:
 *   get:
 *     summary: List Qard Hasan loans
 *     tags: [Qard Hasan]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [applied, under_review, approved, rejected, disbursed, repaying, closed, defaulted]
 *       - in: query
 *         name: purpose
 *         schema:
 *           type: string
 *           enum: [medical, education, housing, business, marriage, other]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Matches the applicant name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Paginated loans
 *   post:
 *     summary: Create a loan application
 *     tags: [Qard Hasan]
 *     description: |
 *       Always created as `applied` with no approved amount and an empty
 *       schedule. Needs either `applicantMemberId` or `applicantName`.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               applicantMemberId:
 *                 type: string
 *               familyId:
 *                 type: string
 *               applicantName:
 *                 type: string
 *               amount:
 *                 type: number
 *               purpose:
 *                 type: string
 *                 enum: [medical, education, housing, business, marriage, other]
 *               purposeDetails:
 *                 type: string
 *               repaymentMonths:
 *                 type: integer
 *                 default: 12
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Missing applicant, or a reference from another tenant
 */
router.get('/loans', listQuery(), validationHandler, getAllLoans);
router.post('/loans', createQardLoanValidation, validationHandler, allowRoles(['mahall']), createLoan);

/**
 * @swagger
 * /qard/loans/{id}:
 *   get:
 *     summary: Get one loan with its schedule and repayment history
 *     tags: [Qard Hasan]
 *     description: Overdue installments are re-stamped on read.
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
 *         description: Loan, repaymentSchedule and repayments
 *       404:
 *         description: Loan not found
 *   put:
 *     summary: Edit a loan's details
 *     tags: [Qard Hasan]
 *     description: |
 *       Details only. `status`, `approvedAmount`, `disbursedDate`,
 *       `outstandingBalance`, `repaymentSchedule` and `tenantId` are ignored -
 *       use `/loans/{id}/status` and `/repayments` to move money.
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
 *               applicantName:
 *                 type: string
 *               amount:
 *                 type: number
 *               purpose:
 *                 type: string
 *               purposeDetails:
 *                 type: string
 *               repaymentMonths:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated loan
 *       400:
 *         description: Referenced member or family belongs to another tenant
 *       404:
 *         description: Loan not found
 *   delete:
 *     summary: Delete a loan
 *     tags: [Qard Hasan]
 *     description: |
 *       Refused once repayments have been recorded against the loan.
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
 *         description: Deleted
 *       400:
 *         description: Blocked by existing repayments
 *       404:
 *         description: Loan not found
 */
router.get('/loans/:id', idParam('id', 'loan'), validationHandler, getLoanById);
router.put('/loans/:id', updateQardLoanValidation, validationHandler, allowRoles(['mahall']), updateLoan);
router.delete('/loans/:id', idParam('id', 'loan'), validationHandler, allowRoles(['mahall']), deleteLoan);

/**
 * @swagger
 * /qard/loans/{id}/status:
 *   put:
 *     summary: Move a loan along its lifecycle
 *     tags: [Qard Hasan]
 *     description: |
 *       Valid moves: applied to under_review to approved to disbursed to
 *       repaying to closed; rejection allowed until disbursement; disbursed or
 *       repaying may go to defaulted, and defaulted may be written off to
 *       closed. Any other move returns 400.
 *
 *       Approving with an amount above the requested figure needs
 *       `allowOverApproval: true`. Disbursing generates the repayment schedule
 *       (approvedAmount divided over repaymentMonths, monthly from
 *       disbursedDate) and sets the outstanding balance. Closing a loan that
 *       still has an outstanding balance is refused unless it is defaulted.
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [under_review, approved, rejected, disbursed, repaying, closed, defaulted]
 *               approvedAmount:
 *                 type: number
 *               allowOverApproval:
 *                 type: boolean
 *               disbursedDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated loan
 *       400:
 *         description: Illegal transition, over-approval, or an unpaid balance on close
 *       404:
 *         description: Loan not found
 */
router.put('/loans/:id/status', idParam('id', 'loan'), validationHandler, allowRoles(['mahall']), updateLoanStatus);

export default router;
