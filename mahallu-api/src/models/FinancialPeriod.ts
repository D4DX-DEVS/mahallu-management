import mongoose, { Schema, Document } from 'mongoose';

export interface IPeriodAccountSnapshot {
  accountId: mongoose.Types.ObjectId;
  accountType: 'mahallu' | 'institute';
  name: string;
  balance: number;
}

export interface IPeriodLedgerTotal {
  ledgerId: mongoose.Types.ObjectId;
  name: string;
  type: 'income' | 'expense';
  total: number;
  count: number;
}

export interface IFinancialPeriod extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  startDate: Date;
  /** Inclusive; stored as the last millisecond of the end day (UTC). */
  endDate: Date;
  status: 'open' | 'closed';
  closedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;
  closingNote?: string;
  /** Account balances captured when the period was closed (carried forward as opening balances). */
  openingBalances: IPeriodAccountSnapshot[];
  balancesAsOf?: Date;
  totals?: { income: number; expense: number; net: number };
  ledgerTotals: IPeriodLedgerTotal[];
  history: Array<{
    action: 'created' | 'closed' | 'reopened';
    by?: mongoose.Types.ObjectId;
    byName?: string;
    at: Date;
    note?: string;
  }>;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerTotalSchema = new Schema(
  {
    ledgerId: { type: Schema.Types.ObjectId },
    name: String,
    type: { type: String, enum: ['income', 'expense'] },
    total: Number,
    count: Number,
  },
  { _id: false }
);

const FinancialPeriodSchema = new Schema<IFinancialPeriod>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    closedAt: Date,
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    closingNote: { type: String, trim: true },
    openingBalances: {
      type: [
        {
          _id: false,
          accountId: { type: Schema.Types.ObjectId },
          accountType: { type: String, enum: ['mahallu', 'institute'] },
          name: String,
          balance: Number,
        },
      ],
      default: [],
    },
    balancesAsOf: Date,
    totals: {
      income: { type: Number },
      expense: { type: Number },
      net: { type: Number },
    },
    ledgerTotals: { type: [LedgerTotalSchema], default: [] },
    history: {
      type: [
        {
          _id: false,
          action: { type: String, enum: ['created', 'closed', 'reopened'] },
          by: { type: Schema.Types.ObjectId, ref: 'User' },
          byName: String,
          at: { type: Date, default: Date.now },
          note: String,
        },
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

FinancialPeriodSchema.index({ tenantId: 1, startDate: 1, endDate: 1 });
FinancialPeriodSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const FinancialPeriod = mongoose.model<IFinancialPeriod>('FinancialPeriod', FinancialPeriodSchema);
export default FinancialPeriod;
