import mongoose, { Schema, Document } from 'mongoose';

export const QARD_PURPOSES = [
  'medical',
  'education',
  'housing',
  'business',
  'marriage',
  'other',
] as const;
export type QardPurpose = (typeof QARD_PURPOSES)[number];

export const QARD_STATUSES = [
  'applied',
  'under_review',
  'approved',
  'rejected',
  'disbursed',
  'repaying',
  'closed',
  'defaulted',
] as const;
export type QardStatus = (typeof QARD_STATUSES)[number];

/** Legal moves through the loan lifecycle; anything else is a 400. */
export const QARD_TRANSITIONS: Record<QardStatus, QardStatus[]> = {
  applied: ['under_review', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['disbursed', 'rejected'],
  disbursed: ['repaying', 'closed', 'defaulted'],
  repaying: ['closed', 'defaulted'],
  defaulted: ['closed'],
  rejected: [],
  closed: [],
};

export const INSTALLMENT_STATUSES = ['due', 'partial', 'paid', 'overdue'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export interface IInstallment {
  dueDate: Date;
  amount: number;
  paidAmount: number;
  status: InstallmentStatus;
}

/** Money is stored in rupees, so keep every derived figure at 2 decimals. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Add whole months without the `setMonth` overflow bug: a loan disbursed on
 * the 31st must fall due on the 30th (or 28th/29th), not roll into the next
 * month.
 */
export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date.getTime());
  const targetDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(targetDay, lastDayOfMonth));
  return result;
};

/**
 * Split `principal` into `months` monthly installments starting one month
 * after `startDate`. The final installment absorbs any rounding remainder so
 * the schedule always sums back to the principal exactly.
 */
export const buildRepaymentSchedule = (
  principal: number,
  months: number,
  startDate: Date
): IInstallment[] => {
  if (!(principal > 0) || !Number.isInteger(months) || months < 1) return [];

  const base = round2(principal / months);
  const schedule: IInstallment[] = [];
  let allocated = 0;

  for (let index = 0; index < months; index += 1) {
    const isLast = index === months - 1;
    const amount = isLast ? round2(principal - allocated) : base;
    allocated = round2(allocated + amount);
    schedule.push({
      dueDate: addMonths(startDate, index + 1),
      amount,
      paidAmount: 0,
      status: 'due',
    });
  }

  return schedule;
};

const statusFor = (installment: IInstallment, asOf: Date): InstallmentStatus => {
  if (installment.paidAmount >= installment.amount) return 'paid';
  if (new Date(installment.dueDate).getTime() < asOf.getTime()) return 'overdue';
  return installment.paidAmount > 0 ? 'partial' : 'due';
};

/**
 * Apply a payment to the oldest unpaid installments first. Returns a new
 * schedule plus how much landed and how much could not be applied - the caller
 * rejects a payment that exceeds the outstanding balance, so `unapplied`
 * should normally be 0.
 */
export const applyRepayment = (
  schedule: IInstallment[],
  amount: number,
  asOf: Date
): { schedule: IInstallment[]; applied: number; unapplied: number } => {
  let remaining = round2(amount);
  const next = schedule.map((installment) => ({ ...installment }));

  for (const installment of next) {
    if (remaining <= 0) break;
    const owed = round2(installment.amount - installment.paidAmount);
    if (owed <= 0) continue;

    const payment = Math.min(owed, remaining);
    installment.paidAmount = round2(installment.paidAmount + payment);
    remaining = round2(remaining - payment);
    installment.status = statusFor(installment, asOf);
  }

  return { schedule: next, applied: round2(amount - remaining), unapplied: remaining };
};

/** Re-stamp `overdue` on read, so a schedule is never stale without a cron job. */
export const markOverdue = (schedule: IInstallment[], asOf: Date): IInstallment[] =>
  schedule.map((installment) => ({ ...installment, status: statusFor(installment, asOf) }));

export interface IQardLoan extends Document {
  tenantId: mongoose.Types.ObjectId;
  applicantMemberId?: mongoose.Types.ObjectId;
  familyId?: mongoose.Types.ObjectId;
  applicantName?: string;
  amount: number;
  purpose: QardPurpose;
  purposeDetails?: string;
  appliedDate: Date;
  status: QardStatus;
  approvedAmount?: number;
  approvedBy?: mongoose.Types.ObjectId;
  disbursedDate?: Date;
  repaymentMonths: number;
  monthlyInstallment?: number;
  outstandingBalance: number;
  repaymentSchedule: IInstallment[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentSchema = new Schema<IInstallment>(
  {
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: INSTALLMENT_STATUSES, default: 'due' },
  },
  { _id: false }
);

const QardLoanSchema = new Schema<IQardLoan>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    applicantMemberId: { type: Schema.Types.ObjectId, ref: 'Member', index: true },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family', index: true },
    applicantName: { type: String, trim: true },
    amount: { type: Number, required: [true, 'Requested amount is required'], min: 0 },
    purpose: { type: String, enum: QARD_PURPOSES, default: 'other' },
    purposeDetails: { type: String, trim: true },
    appliedDate: { type: Date, default: Date.now },
    status: { type: String, enum: QARD_STATUSES, default: 'applied', index: true },
    approvedAmount: { type: Number, min: 0 },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    disbursedDate: { type: Date },
    repaymentMonths: { type: Number, default: 12, min: 1 },
    monthlyInstallment: { type: Number, min: 0 },
    outstandingBalance: { type: Number, default: 0, min: 0 },
    repaymentSchedule: { type: [InstallmentSchema], default: [] },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

QardLoanSchema.index({ tenantId: 1, status: 1 });

export interface IQardRepayment extends Document {
  tenantId: mongoose.Types.ObjectId;
  loanId: mongoose.Types.ObjectId;
  amount: number;
  paymentDate: Date;
  receiptNo?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QardRepaymentSchema = new Schema<IQardRepayment>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    loanId: {
      type: Schema.Types.ObjectId,
      ref: 'QardLoan',
      required: [true, 'Loan is required'],
      index: true,
    },
    amount: { type: Number, required: [true, 'Amount is required'], min: 0 },
    paymentDate: { type: Date, default: Date.now },
    receiptNo: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

QardRepaymentSchema.index({ tenantId: 1, loanId: 1 });

export const QardLoan = mongoose.model<IQardLoan>('QardLoan', QardLoanSchema);
export const QardRepayment = mongoose.model<IQardRepayment>('QardRepayment', QardRepaymentSchema);
