import mongoose, { Schema, Document } from 'mongoose';

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * Mongo filter fragment: only money that actually counts (approved).
 * Legacy documents have no status field and are treated as approved.
 */
export const APPROVED_FILTER = { status: { $nin: ['pending', 'rejected', 'cancelled'] } } as const;

/**
 * Same as APPROVED_FILTER but keeps cancelled receipts (they stay visible in lists so the
 * receipt number sequence has no gaps). NEVER use this for sums or balances.
 */
export const LISTABLE_FILTER = { status: { $nin: ['pending', 'rejected'] } } as const;

export interface IPrintLogEntry {
  at: Date;
  by?: mongoose.Types.ObjectId;
  kind: 'original' | 'duplicate';
}

export interface IEditHistoryEntry {
  at: Date;
  by?: mongoose.Types.ObjectId;
  changes: Record<string, { from: any; to: any }>;
}

const PrintLogSchema = new Schema<IPrintLogEntry>(
  {
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    kind: { type: String, enum: ['original', 'duplicate'], required: true },
  },
  { _id: false }
);

const EditHistorySchema = new Schema<IEditHistoryEntry>(
  {
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    changes: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

/** Fields shared by Varisangya and Zakat receipts (all optional: legacy documents stay valid). */
const receiptAuditFields = {
  /** Who collected the money (field collector) and which login recorded it: used for cash-day closing */
  collectorId: { type: Schema.Types.ObjectId, ref: 'Collector', index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: Date,
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  cancelReason: String,
  printLog: { type: [PrintLogSchema], default: undefined },
  editHistory: { type: [EditHistorySchema], default: undefined },
};

export interface IVarisangya extends Document {
  tenantId: mongoose.Types.ObjectId;
  familyId?: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  amount: number;
  paymentDate: Date;
  paymentMethod?: string;
  receiptNo?: string;
  remarks?: string;
  remarksMl?: string;
  status?: PaymentStatus;
  source?: 'admin' | 'member';
  requestedBy?: mongoose.Types.ObjectId;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectReason?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelReason?: string;
  printLog?: IPrintLogEntry[];
  editHistory?: IEditHistoryEntry[];
  collectorId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IZakat extends Document {
  tenantId: mongoose.Types.ObjectId;
  payerName: string;
  payerId?: mongoose.Types.ObjectId; // Member ID
  amount: number;
  paymentDate: Date;
  paymentMethod?: string;
  receiptNo?: string;
  category?: string;
  remarks?: string;
  remarksMl?: string;
  status?: PaymentStatus;
  source?: 'admin' | 'member';
  requestedBy?: mongoose.Types.ObjectId;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectReason?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelReason?: string;
  printLog?: IPrintLogEntry[];
  editHistory?: IEditHistoryEntry[];
  collectorId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWallet extends Document {
  tenantId: mongoose.Types.ObjectId;
  familyId?: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  balance: number;
  lastTransactionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransaction extends Document {
  tenantId: mongoose.Types.ObjectId;
  walletId: mongoose.Types.ObjectId;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  referenceId?: mongoose.Types.ObjectId; // Varisangya/Zakat ID
  referenceType?: 'varisangya' | 'zakat';
  reversalOf?: mongoose.Types.ObjectId; // set on a reversal: the transaction it cancels
  reversedBy?: mongoose.Types.ObjectId; // set on the original: its reversal
  createdAt: Date;
}

const VarisangyaSchema = new Schema<IVarisangya>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family' },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    amount: { type: Number, required: true, min: 0 },
    paymentDate: { type: Date, required: true },
    paymentMethod: String,
    receiptNo: String,
    remarks: String,
    remarksMl: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'approved', index: true },
    source: { type: String, enum: ['admin', 'member'] },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectReason: String,
    ...receiptAuditFields,
  },
  { timestamps: true }
);

// One receipt number per tenant (partial: documents without a number are not indexed).
// Checked read-only against live data before adding: no duplicates existed.
VarisangyaSchema.index(
  { tenantId: 1, receiptNo: 1 },
  { unique: true, partialFilterExpression: { receiptNo: { $gt: '' } } }
);

const ZakatSchema = new Schema<IZakat>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    payerName: { type: String, required: true, trim: true },
    payerId: { type: Schema.Types.ObjectId, ref: 'Member' },
    amount: { type: Number, required: true, min: 0 },
    paymentDate: { type: Date, required: true },
    paymentMethod: String,
    receiptNo: String,
    category: String,
    remarks: String,
    remarksMl: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'approved', index: true },
    source: { type: String, enum: ['admin', 'member'] },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectReason: String,
    ...receiptAuditFields,
  },
  { timestamps: true }
);

ZakatSchema.index(
  { tenantId: 1, receiptNo: 1 },
  { unique: true, partialFilterExpression: { receiptNo: { $gt: '' } } }
);

const WalletSchema = new Schema<IWallet>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family' },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    balance: { type: Number, default: 0, min: 0 },
    lastTransactionDate: Date,
  },
  { timestamps: true }
);

const TransactionSchema = new Schema<ITransaction>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
    referenceId: Schema.Types.ObjectId,
    referenceType: {
      type: String,
      enum: ['varisangya', 'zakat'],
    },
    reversalOf: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'Transaction' },
  },
  { timestamps: true }
);

export const Varisangya = mongoose.model<IVarisangya>('Varisangya', VarisangyaSchema);
export const Zakat = mongoose.model<IZakat>('Zakat', ZakatSchema);
export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);

