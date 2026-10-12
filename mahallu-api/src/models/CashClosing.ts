import mongoose, { Schema, Document } from 'mongoose';

export interface ICashClosing extends Document {
  tenantId: mongoose.Types.ObjectId;
  /** Calendar day being closed, YYYY-MM-DD (mahallu local day) */
  dateKey: string;
  date: Date;
  collectorId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  /** 'all' (whole mahallu), 'c:<collectorId>' or 'u:<userId>'; one closing per day per scope */
  scopeKey: string;
  expectedCash: number;
  breakdown: { varisangya: number; zakat: number; campaigns: number; receiptCount: number };
  countedCash: number;
  /** countedCash - expectedCash. Negative = short, positive = excess */
  difference: number;
  denominations?: Record<string, number>;
  note?: string;
  status: 'submitted' | 'verified' | 'reopened';
  submittedBy?: mongoose.Types.ObjectId;
  submittedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  reopenedBy?: mongoose.Types.ObjectId;
  reopenedAt?: Date;
  reopenReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CashClosingSchema = new Schema<ICashClosing>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    dateKey: { type: String, required: true },
    date: { type: Date, required: true },
    collectorId: { type: Schema.Types.ObjectId, ref: 'Collector' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    scopeKey: { type: String, required: true, default: 'all' },
    expectedCash: { type: Number, required: true, default: 0 },
    breakdown: {
      varisangya: { type: Number, default: 0 },
      zakat: { type: Number, default: 0 },
      campaigns: { type: Number, default: 0 },
      receiptCount: { type: Number, default: 0 },
    },
    countedCash: { type: Number, required: true, min: 0 },
    difference: { type: Number, required: true, default: 0 },
    denominations: { type: Map, of: Number },
    note: { type: String, trim: true },
    status: { type: String, enum: ['submitted', 'verified', 'reopened'], default: 'submitted', index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedAt: Date,
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    reopenedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reopenedAt: Date,
    reopenReason: String,
  },
  { timestamps: true }
);
CashClosingSchema.index({ tenantId: 1, dateKey: 1, scopeKey: 1 }, { unique: true });

export default mongoose.model<ICashClosing>('CashClosing', CashClosingSchema);
