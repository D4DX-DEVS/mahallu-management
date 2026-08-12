import { Response } from 'express';
import mongoose from 'mongoose';
import {
  QardLoan,
  QardRepayment,
  QARD_TRANSITIONS,
  QardStatus,
  buildRepaymentSchedule,
  applyRepayment,
  markOverdue,
} from '../models/QardLoan';
import Member from '../models/Member';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

const round2 = (value: number): number => Math.round(value * 100) / 100;

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
    return 'Member does not belong to this Mahallu';
  }
  if (familyId && !(await refBelongsToTenant(Family, familyId, req.tenantId))) {
    return 'Family does not belong to this Mahallu';
  }
  return null;
};

export const getAllLoans = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.status) query.status = req.query.status;
    if (req.query.purpose) query.purpose = req.query.purpose;
    if (req.query.familyId) query.familyId = req.query.familyId;
    if (req.query.search) {
      query.applicantName = { $regex: String(req.query.search), $options: 'i' };
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLoanById = async (req: AuthRequest, res: Response) => {
  try {
    const loan = await QardLoan.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate('applicantMemberId', 'name nameMl contactNo')
      .populate('familyId', 'houseName mahallId');

    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createLoan = async (req: AuthRequest, res: Response) => {
  try {
    const refError = await validateRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }
    if (!req.body.applicantMemberId && !req.body.applicantName) {
      return res
        .status(400)
        .json({ success: false, message: 'Either applicantMemberId or applicantName is required' });
    }

    // A new application always starts at `applied`; approval is a separate step.
    const loan = await QardLoan.create({
      ...stripImmutable(req.body),
      tenantId: req.tenantId,
      status: 'applied',
      approvedAmount: undefined,
      disbursedDate: undefined,
      outstandingBalance: 0,
      repaymentSchedule: [],
    });

    res.status(201).json({ success: true, data: loan });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateLoan = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await QardLoan.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    const refError = await validateRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    // Status, money and schedule move only through the dedicated endpoints.
    const payload = stripImmutable(req.body);
    delete payload.status;
    delete payload.approvedAmount;
    delete payload.outstandingBalance;
    delete payload.repaymentSchedule;
    delete payload.disbursedDate;

    const loan = await QardLoan.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: loan });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateLoanStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, approvedAmount, notes, allowOverApproval } = req.body;

    const loan = await QardLoan.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    const next = status as QardStatus;
    const allowed = QARD_TRANSITIONS[loan.status] || [];
    if (!allowed.includes(next)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move a loan from ${loan.status} to ${next}. Allowed: ${
          allowed.join(', ') || 'none'
        }`,
      });
    }

    if (next === 'approved') {
      const amount = approvedAmount === undefined ? loan.amount : Number(approvedAmount);
      if (!(amount > 0)) {
        return res
          .status(400)
          .json({ success: false, message: 'Approved amount must be greater than zero' });
      }
      if (amount > loan.amount && !allowOverApproval) {
        return res.status(400).json({
          success: false,
          message: `Approved amount ${amount} exceeds the requested ${loan.amount}. Set allowOverApproval to override.`,
        });
      }
      loan.approvedAmount = round2(amount);
      loan.approvedBy = toObjectId(req.user?.id) ?? loan.approvedBy;
    }

    if (next === 'disbursed') {
      const principal = loan.approvedAmount ?? loan.amount;
      if (!(principal > 0)) {
        return res
          .status(400)
          .json({ success: false, message: 'Loan has no approved amount to disburse' });
      }
      const disbursedDate = req.body.disbursedDate ? new Date(req.body.disbursedDate) : new Date();
      const schedule = buildRepaymentSchedule(principal, loan.repaymentMonths, disbursedDate);

      loan.disbursedDate = disbursedDate;
      loan.repaymentSchedule = schedule;
      loan.monthlyInstallment = schedule[0]?.amount ?? 0;
      loan.outstandingBalance = round2(principal);
    }

    if (next === 'closed' && loan.outstandingBalance > 0 && loan.status !== 'defaulted') {
      return res.status(400).json({
        success: false,
        message: `Cannot close a loan with ${loan.outstandingBalance} still outstanding`,
      });
    }

    loan.status = next;
    if (notes) loan.notes = notes;
    await loan.save();

    res.json({ success: true, data: loan });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteLoan = async (req: AuthRequest, res: Response) => {
  try {
    const loan = await QardLoan.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    const repayments = await QardRepayment.countDocuments({ loanId: loan._id });
    if (repayments > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete a loan with ${repayments} recorded repayment(s)`,
      });
    }

    await loan.deleteOne();
    res.json({ success: true, message: 'Loan deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createRepayment = async (req: AuthRequest, res: Response) => {
  try {
    const { loanId, amount, paymentDate, receiptNo, remarks } = req.body;
    const paid = Number(amount);

    if (!(paid > 0)) {
      return res
        .status(400)
        .json({ success: false, message: 'Repayment amount must be greater than zero' });
    }

    const loan = await QardLoan.findOne({ _id: loanId, ...tenantScope(req) });
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    if (!['disbursed', 'repaying'].includes(loan.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot record a repayment against a loan that is ${loan.status}`,
      });
    }
    if (paid > loan.outstandingBalance) {
      return res.status(400).json({
        success: false,
        message: `Repayment ${paid} exceeds the outstanding balance of ${loan.outstandingBalance}`,
      });
    }

    const when = paymentDate ? new Date(paymentDate) : new Date();
    const result = applyRepayment(loan.repaymentSchedule, paid, when);

    loan.repaymentSchedule = result.schedule;
    loan.outstandingBalance = round2(loan.outstandingBalance - result.applied);
    loan.status = loan.outstandingBalance <= 0 ? 'closed' : 'repaying';
    await loan.save();

    const repayment = await QardRepayment.create({
      tenantId: req.tenantId,
      loanId: loan._id,
      amount: result.applied,
      paymentDate: when,
      receiptNo,
      remarks,
    });

    res.status(201).json({
      success: true,
      data: { repayment, outstandingBalance: loan.outstandingBalance, status: loan.status },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};
