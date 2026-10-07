import { Response } from 'express';
import mongoose from 'mongoose';
import {
  QardLoan,
  QardRepayment,
  QARD_TRANSITIONS,
  QARD_STATUSES,
  QARD_INITIAL_STATUS,
  QARD_MONEY_OUT_STATUSES,
  QardStatus,
  IInstallment,
  buildRepaymentSchedule,
  rebuildSchedule,
  markOverdue,
} from '../models/QardLoan';
import Member from '../models/Member';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { refBelongsToTenant } from '../utils/sanitizeUpdate';
import {
  round2,
  isMoney,
  pick,
  differs,
  requireMahallWriter,
  sendConflict,
  sendInvalid,
  sendNotFound,
} from '../utils/workflow';
import { MAX_AMOUNT } from '../validations/common';

import { sendFailure } from '../utils/userMessages';
import { runUndos, sendReconciliationRequired } from '../utils/reconciliation';
import { regexLiteral } from '../utils/queryGuard';

const NOT_FOUND = "We couldn't find that loan. It may have been removed.";
const CHANGED = 'This loan was changed by someone else a moment ago. Please refresh and try again.';

/** Retries of the optimistic balance update before giving up with a 409. */
const MAX_BALANCE_ATTEMPTS = 20;

const REPAYABLE: readonly QardStatus[] = ['disbursed', 'repaying'];

/** Fields of a new application a client may supply. Everything else is server-owned. */
const CREATE_FIELDS = [
  'applicantMemberId',
  'familyId',
  'applicantName',
  'amount',
  'purpose',
  'purposeDetails',
  'appliedDate',
  'repaymentMonths',
  'notes',
] as const;

/** Details that stay editable at any state. */
const DETAIL_FIELDS = [
  'applicantMemberId',
  'familyId',
  'applicantName',
  'purpose',
  'purposeDetails',
  'appliedDate',
  'notes',
] as const;

/** Money terms: editable only while the loan is still at its initial state. */
const TERM_FIELDS = ['amount', 'repaymentMonths'] as const;

/** Scope every read/write to the caller's tenant. */
const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

const toObjectId = (value: unknown): mongoose.Types.ObjectId | undefined =>
  mongoose.Types.ObjectId.isValid(String(value))
    ? new mongoose.Types.ObjectId(String(value))
    : undefined;

/** Confirm any member/family reference on the body belongs to the caller's tenant. */
const validateRefs = async (req: AuthRequest): Promise<string | null> => {
  const { applicantMemberId, familyId } = req.body;
  if (applicantMemberId && !(await refBelongsToTenant(Member, applicantMemberId, req.tenantId))) {
    return 'This member belongs to another Mahallu.';
  }
  if (familyId && !(await refBelongsToTenant(Family, familyId, req.tenantId))) {
    return 'Family does not belong to this Mahallu';
  }
  return null;
};

/** The schedule as plain objects, whether it came from a hydrated document or a lean read. */
const plainSchedule = (loan: any): IInstallment[] =>
  Array.from((loan?.repaymentSchedule as any[]) || []).map((i: any) => ({
    dueDate: i.dueDate,
    amount: i.amount,
    paidAmount: i.paidAmount,
    status: i.status,
  }));

const isDuplicateKey = (error: any): boolean => error?.code === 11000;

const CLIENT_REQUEST_ID = /^[A-Za-z0-9._:-]{8,100}$/;

export const getAllLoans = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.status) query.status = req.query.status;
    if (req.query.purpose) query.purpose = req.query.purpose;
    if (req.query.familyId) query.familyId = req.query.familyId;
    if (req.query.search) {
      query.applicantName = { $regex: regexLiteral(String(req.query.search)), $options: 'i' };
    }

    const [loans, total] = await Promise.all([
      QardLoan.find(query)
        .populate('applicantMemberId', 'name nameMl contactNo')
        .populate('familyId', 'houseName mahallId')
        .sort({ appliedDate: -1 })
        .skip(skip)
        .limit(limit),
      QardLoan.countDocuments(query),
    ]);

    res.json(createPaginationResponse(loans, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the loans right now. Please try again.');
  }
};

export const getLoanById = async (req: AuthRequest, res: Response) => {
  try {
    const loan = await QardLoan.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate('applicantMemberId', 'name nameMl contactNo')
      .populate('familyId', 'houseName mahallId');

    if (!loan) {
      return sendNotFound(res, NOT_FOUND);
    }

    // Stamp overdue installments on read so the schedule is never stale.
    const schedule = markOverdue(loan.repaymentSchedule, new Date());
    const repayments = await QardRepayment.find({ loanId: loan._id, ...tenantScope(req) }).sort({
      paymentDate: -1,
    });

    res.json({
      success: true,
      data: { ...loan.toObject(), repaymentSchedule: schedule, repayments },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the loan right now. Please try again.');
  }
};

export const createLoan = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const refError = await validateRefs(req);
    if (refError) {
      return sendInvalid(res, refError);
    }
    if (!req.body.applicantMemberId && !req.body.applicantName) {
      return sendInvalid(res, 'Please choose a member, or enter the applicant’s name.');
    }

    // A new application always starts at its initial state; approval is a separate step. Only the
    // application details are taken from the body - money, schedule and status are the server's.
    const loan = await QardLoan.create({
      ...pick(req.body, CREATE_FIELDS),
      tenantId: req.tenantId,
      status: QARD_INITIAL_STATUS,
      outstandingBalance: 0,
      repaymentSchedule: [],
    });

    res.status(201).json({ success: true, data: loan });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the loan. Please try again.');
  }
};

export const updateLoan = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const existing = await QardLoan.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return sendNotFound(res, NOT_FOUND);
    }

    const refError = await validateRefs(req);
    if (refError) {
      return sendInvalid(res, refError);
    }

    // Status, approval, schedule and balance move only through the dedicated endpoints: they are
    // not in the allow-list, so a body that names them changes nothing.
    const payload = pick(req.body, DETAIL_FIELDS);

    // The amount and the term decide the schedule and the balance. Once the loan has left its
    // initial state they are fixed - a different term would leave the schedule disagreeing with it.
    const touchesTerms = TERM_FIELDS.filter((field) => differs(req.body[field], (existing as any)[field]));
    if (touchesTerms.length > 0) {
      if (existing.status !== QARD_INITIAL_STATUS) {
        return sendConflict(
          res,
          `The amount and repayment period can't be changed once a loan has moved past "${QARD_INITIAL_STATUS}".`
        );
      }
      for (const field of touchesTerms) payload[field] = Number(req.body[field]);
    }

    const loan = await QardLoan.findOneAndUpdate(
      { _id: req.params.id, tenantId: existing.tenantId, status: existing.status },
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!loan) return sendConflict(res, CHANGED);

    res.json({ success: true, data: loan });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the loan. Please try again.');
  }
};

/**
 * The only way a loan changes state. Every move is checked against QARD_TRANSITIONS and applied
 * with one conditional update keyed on the status that was read, so two callers can never both
 * "approve" or both "disburse" the same loan.
 */
export const updateLoanStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const { status, approvedAmount, notes, allowOverApproval } = req.body;

    if (!QARD_STATUSES.includes(status)) {
      return sendInvalid(res, 'Please choose a valid status.');
    }
    if (allowOverApproval !== undefined && typeof allowOverApproval !== 'boolean') {
      return sendInvalid(res, 'Please choose yes or no for approving more than requested.');
    }
    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
      return sendInvalid(res, 'Please keep the notes to 2000 characters or less.');
    }

    const loan = await QardLoan.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!loan) {
      return sendNotFound(res, NOT_FOUND);
    }

    const next = status as QardStatus;
    const allowed = QARD_TRANSITIONS[loan.status] || [];
    if (!allowed.includes(next)) {
      return sendConflict(
        res,
        `Cannot move a loan from ${loan.status} to ${next}. Allowed: ${allowed.join(', ') || 'none'}`
      );
    }

    const set: Record<string, any> = { status: next };
    const extraFilter: Record<string, any> = {};

    if (next === 'approved') {
      const amount = approvedAmount === undefined || approvedAmount === null ? loan.amount : approvedAmount;
      if (!isMoney(amount) || !(Number(amount) > 0) || Number(amount) > MAX_AMOUNT) {
        return sendInvalid(
          res,
          'Please enter an approved amount greater than zero, with at most 2 decimals.'
        );
      }
      if (Number(amount) > loan.amount && allowOverApproval !== true) {
        return sendInvalid(
          res,
          `The approved amount ₹${amount} is more than the requested ₹${loan.amount}.`
        );
      }
      set.approvedAmount = round2(Number(amount));
      const approver = toObjectId(req.user?.id);
      if (approver) set.approvedBy = approver;
    }

    if (next === 'disbursed') {
      const principal = loan.approvedAmount ?? loan.amount;
      if (!(principal > 0)) {
        return sendInvalid(res, 'This loan has no approved amount to disburse yet.');
      }
      const disbursedDate = req.body.disbursedDate ? new Date(req.body.disbursedDate) : new Date();
      if (Number.isNaN(disbursedDate.getTime())) {
        return sendInvalid(res, 'Please choose a valid disbursement date.');
      }
      const schedule = buildRepaymentSchedule(principal, loan.repaymentMonths, disbursedDate);
      if (schedule.length === 0) {
        return sendInvalid(res, 'This loan has no valid repayment period, so it can not be disbursed.');
      }

      set.disbursedDate = disbursedDate;
      set.repaymentSchedule = schedule;
      set.monthlyInstallment = schedule[0]?.amount ?? 0;
      set.outstandingBalance = round2(principal);
    }

    if (next === 'closed') {
      // A loan with money still owed is never closed - a defaulted one included.
      if (loan.outstandingBalance > 0) {
        return sendConflict(
          res,
          `This loan still has ₹${loan.outstandingBalance} outstanding, so it can't be closed.`
        );
      }
      extraFilter.outstandingBalance = { $lte: 0 };
    }

    if (typeof notes === 'string' && notes.trim()) set.notes = notes.trim();

    const updated = await QardLoan.findOneAndUpdate(
      { _id: req.params.id, tenantId: loan.tenantId, status: loan.status, ...extraFilter },
      { $set: set },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return sendConflict(res, 'This loan has already been processed or changed. Please refresh and try again.');
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the loan status. Please try again.');
  }
};

export const deleteLoan = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const loan = await QardLoan.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!loan) {
      return sendNotFound(res, NOT_FOUND);
    }

    // A loan whose money has gone out is a financial record, not a draft.
    if (QARD_MONEY_OUT_STATUSES.includes(loan.status)) {
      return sendConflict(res, "A loan that has been disbursed is kept on record and can't be deleted.");
    }

    const repayments = await QardRepayment.countDocuments({ loanId: loan._id });
    if (repayments > 0) {
      return sendConflict(
        res,
        `This loan has ${repayments} repayment(s) recorded, so it can't be deleted.`
      );
    }

    // Status in the filter: a disbursement that lands right now makes this a no-op, not a delete.
    const deleted = await QardLoan.findOneAndDelete({
      _id: loan._id,
      tenantId: loan.tenantId,
      status: { $nin: [...QARD_MONEY_OUT_STATUSES] },
    });
    if (!deleted) return sendConflict(res, CHANGED);

    res.json({ success: true, message: 'Loan deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the loan. Please try again.');
  }
};

export const getRepayments = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };
    if (req.query.loanId) query.loanId = req.query.loanId;

    const [repayments, total] = await Promise.all([
      QardRepayment.find(query).sort({ paymentDate: -1 }).skip(skip).limit(limit),
      QardRepayment.countDocuments(query),
    ]);

    res.json(createPaginationResponse(repayments, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the repayments right now. Please try again.');
  }
};

/**
 * Move the outstanding balance of a loan by `delta` (positive = a payment, negative = taking one
 * back) with a conditional update, and rebuild the schedule from the persisted state.
 *
 * The update only applies if the balance and status are still the ones that were read, so two
 * payments racing each other can never both be applied against the same balance: the loser re-reads
 * and recomputes, and is refused if the money is no longer owed.
 */
type BalanceMove =
  | { ok: true; loan: any; before: any }
  | { ok: false; reason: 'missing' | 'state' | 'exceeds' | 'busy'; loan?: any };

const moveBalance = async (
  loanId: unknown,
  tenantId: unknown,
  delta: number,
  when: Date,
  restoreStatus?: QardStatus
): Promise<BalanceMove> => {
  const payment = delta > 0;
  for (let attempt = 0; attempt < MAX_BALANCE_ATTEMPTS; attempt += 1) {
    const current: any = await QardLoan.findOne({ _id: loanId, tenantId });
    if (!current) return { ok: false, reason: 'missing' };
    if (payment && !REPAYABLE.includes(current.status)) return { ok: false, reason: 'state', loan: current };

    const outstanding = round2(current.outstandingBalance);
    const principal = round2(current.approvedAmount ?? current.amount);
    const newOutstanding = round2(outstanding - delta);
    if (newOutstanding < 0 || newOutstanding > principal) {
      return { ok: false, reason: 'exceeds', loan: current };
    }

    const totalPaid = round2(principal - newOutstanding);
    const existingSchedule = plainSchedule(current);
    const schedule = existingSchedule.length ? rebuildSchedule(existingSchedule, totalPaid, when) : [];
    const status: QardStatus =
      newOutstanding <= 0
        ? 'closed'
        : payment || totalPaid > 0
          ? 'repaying'
          : restoreStatus ?? current.status;

    const updated = await QardLoan.findOneAndUpdate(
      {
        _id: current._id,
        tenantId: current.tenantId,
        status: current.status,
        outstandingBalance: current.outstandingBalance,
      },
      { $set: { repaymentSchedule: schedule, outstandingBalance: newOutstanding, status } },
      { new: true }
    );
    if (updated) return { ok: true, loan: updated, before: current };
  }
  return { ok: false, reason: 'busy' };
};

export const createRepayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireMahallWriter(req, res)) return;
    const { loanId, amount, paymentDate, receiptNo, remarks } = req.body;

    if (!isMoney(amount) || !(Number(amount) > 0) || Number(amount) > MAX_AMOUNT) {
      return sendInvalid(
        res,
        'Please enter a repayment amount greater than zero, with at most 2 decimals.'
      );
    }
    const paid = round2(Number(amount));

    const rawRequestId = req.body.clientRequestId;
    let clientRequestId: string | undefined;
    if (rawRequestId !== undefined && rawRequestId !== null && rawRequestId !== '') {
      if (typeof rawRequestId !== 'string' || !CLIENT_REQUEST_ID.test(rawRequestId)) {
        return sendInvalid(res, 'The request id is not valid. Please try again.');
      }
      clientRequestId = rawRequestId;
    }

    const when = paymentDate ? new Date(paymentDate) : new Date();
    if (Number.isNaN(when.getTime())) {
      return sendInvalid(res, 'Please choose a valid payment date.');
    }

    const loan: any = await QardLoan.findOne({ _id: loanId, ...tenantScope(req) });
    if (!loan) {
      return sendNotFound(res, NOT_FOUND);
    }

    /** The answer for a request that was already applied: the same repayment, nothing new. */
    const replay = async (prior: any) => {
      if (String(prior.loanId) !== String(loan._id) || !(round2(prior.amount) === paid)) {
        return sendConflict(res, 'That request id was already used for a different repayment.');
      }
      const fresh: any = await QardLoan.findOne({ _id: loan._id, tenantId: loan.tenantId });
      return res.status(200).json({
        success: true,
        data: {
          repayment: prior,
          outstandingBalance: (fresh ?? loan).outstandingBalance,
          status: (fresh ?? loan).status,
          duplicate: true,
        },
      });
    };

    if (clientRequestId) {
      const prior = await QardRepayment.findOne({ tenantId: loan.tenantId, clientRequestId });
      if (prior) return replay(prior);
    }

    if (!REPAYABLE.includes(loan.status)) {
      return sendConflict(res, `A repayment can't be recorded on a loan that is ${loan.status}.`);
    }

    const moved = await moveBalance(loan._id, loan.tenantId, paid, when);
    if (!moved.ok) {
      if (moved.reason === 'missing') return sendNotFound(res, NOT_FOUND);
      if (moved.reason === 'state') {
        return sendConflict(
          res,
          `A repayment can't be recorded on a loan that is ${moved.loan?.status ?? 'not active'}.`
        );
      }
      if (moved.reason === 'exceeds') {
        return sendInvalid(
          res,
          `The repayment of ₹${paid} is more than the outstanding balance of ₹${round2(
            moved.loan?.outstandingBalance ?? 0
          )}.`
        );
      }
      return sendConflict(
        res,
        'Another repayment was being recorded at the same moment. Please check the loan and try again.'
      );
    }

    let repayment: any;
    try {
      repayment = await QardRepayment.create({
        tenantId: loan.tenantId,
        loanId: loan._id,
        amount: paid,
        paymentDate: when,
        receiptNo,
        remarks,
        ...(clientRequestId ? { clientRequestId } : {}),
      });
    } catch (error: any) {
      // The balance already moved, but there is no repayment row to show for it: put it back.
      const { failed } = await runUndos(
        { flow: 'qard repayment', entity: 'QardLoan', entityId: loan._id, tenantId: loan.tenantId, state: { amountMoved: paid, repaymentRowWritten: false } },
        [
          {
            label: 'reverse loan balance',
            undo: async () => {
              const undone = await moveBalance(loan._id, loan.tenantId, -paid, when, moved.before.status);
              if (!undone.ok) throw new Error(`balance could not be reversed (${undone.reason})`);
            },
          },
        ],
        error
      );
      // The balance moved and there is no repayment row to show for it: never answer with a success
      // (not even the "duplicate" replay below) and never a generic error.
      if (failed.length > 0) return sendReconciliationRequired(res);
      if (clientRequestId && isDuplicateKey(error)) {
        // A concurrent request with the same id won; answer with its result.
        const winner = await QardRepayment.findOne({ tenantId: loan.tenantId, clientRequestId });
        if (winner) return replay(winner);
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      data: {
        repayment,
        outstandingBalance: moved.loan.outstandingBalance,
        status: moved.loan.status,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the repayment. Please try again.');
  }
};

export const getQardSummary = async (req: AuthRequest, res: Response) => {
  try {
    const match: any = {};
    // Aggregation does not cast strings to ObjectId the way find() does.
    if (req.tenantId) match.tenantId = new mongoose.Types.ObjectId(req.tenantId);

    const [byStatus, totals] = await Promise.all([
      QardLoan.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
      QardLoan.aggregate([
        { $match: { ...match, status: { $in: ['disbursed', 'repaying', 'closed', 'defaulted'] } } },
        {
          $group: {
            _id: null,
            totalDisbursed: { $sum: { $ifNull: ['$approvedAmount', '$amount'] } },
            totalOutstanding: { $sum: '$outstandingBalance' },
            loans: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statusCounts = byStatus.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const totalDisbursed = totals[0]?.totalDisbursed ?? 0;
    const totalOutstanding = totals[0]?.totalOutstanding ?? 0;

    res.json({
      success: true,
      data: {
        totalDisbursed: round2(totalDisbursed),
        totalOutstanding: round2(totalOutstanding),
        totalRepaid: round2(totalDisbursed - totalOutstanding),
        activeLoans: (statusCounts.disbursed ?? 0) + (statusCounts.repaying ?? 0),
        pendingApplications: (statusCounts.applied ?? 0) + (statusCounts.under_review ?? 0),
        defaultedLoans: statusCounts.defaulted ?? 0,
        closedLoans: statusCounts.closed ?? 0,
        byStatus: statusCounts,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the qard summary right now. Please try again.');
  }
};
