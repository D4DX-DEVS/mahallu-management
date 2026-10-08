import mongoose, { Schema, Document } from 'mongoose';
import { registerIndexMonitor } from '../utils/indexMonitor';

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
  status?: 'pending' | 'verified' | 'rejected'; // member submissions start pending; admin entries are verified
  source?: 'admin' | 'member';
  rejectionReason?: string;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  /** Client-generated id that makes a retried / double-submitted create idempotent (unique per tenant). */
  clientRequestId?: string;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
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
  status?: 'pending' | 'verified' | 'rejected';
  source?: 'admin' | 'member';
  rejectionReason?: string;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  clientRequestId?: string;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWallet extends Document {
  tenantId: mongoose.Types.ObjectId;
  familyId?: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  /** Owner key: `m:<memberId>` for a member wallet, `f:<familyId>` for a family wallet. */
  key?: string;
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
  /** payment = the original credit, adjustment = amount edit delta, reversal = payment deleted. */
  kind?: 'payment' | 'adjustment' | 'reversal';
  /** Idempotency key (unique per tenant) so a retried step never writes the same journal row twice. */
  entryKey?: string;
  createdAt: Date;
}

/**
 * Payments whose money was received: verified, or older rows with no status (they predate the field and
 * were always received). Pending (waiting for an admin) and rejected payments never count.
 */
export const RECEIVED_PAYMENT_STATUS = { $nin: ['pending', 'rejected'] };
export const isReceivedPayment = (doc: { status?: string }): boolean => doc.status !== 'pending' && doc.status !== 'rejected';

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
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'verified', index: true },
    source: { type: String, enum: ['admin', 'member'], default: 'admin' },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    clientRequestId: { type: String, trim: true, minlength: 8, maxlength: 64 },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
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
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'verified', index: true },
    source: { type: String, enum: ['admin', 'member'], default: 'admin' },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    clientRequestId: { type: String, trim: true, minlength: 8, maxlength: 64 },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
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
    key: { type: String },
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
    kind: { type: String, enum: ['payment', 'adjustment', 'reversal'], default: 'payment' },
    entryKey: { type: String },
  },
  { timestamps: true }
);

/*
 * Indexes.
 *
 * Every unique index here is PARTIAL (it only covers rows that carry the field) so rows written
 * before the field existed are never a problem, and none of them is required for the code to stay
 * correct: each path also checks in code (exists check, find-then-claim) and treats a duplicate-key
 * error as "somebody else got there first". If an index cannot be built (old duplicate data) Mongoose
 * reports it on the model's 'index' event, which is logged below, and the app keeps running with the
 * code-level guard only. Clean the duplicates, restart, and the index is built.
 */
VarisangyaSchema.index(
  { tenantId: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);
VarisangyaSchema.index(
  { tenantId: 1, receiptNo: 1 },
  { unique: true, partialFilterExpression: { receiptNo: { $type: 'string' } } }
);
VarisangyaSchema.index({ tenantId: 1, paymentDate: -1 });
VarisangyaSchema.index({ tenantId: 1, familyId: 1, paymentDate: -1 });
VarisangyaSchema.index({ tenantId: 1, memberId: 1, paymentDate: -1 });

ZakatSchema.index(
  { tenantId: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);
ZakatSchema.index(
  { tenantId: 1, receiptNo: 1 },
  { unique: true, partialFilterExpression: { receiptNo: { $type: 'string' } } }
);
ZakatSchema.index({ tenantId: 1, paymentDate: -1 });
ZakatSchema.index({ tenantId: 1, payerId: 1, paymentDate: -1 });

// One wallet per owner. `key` is only set by the atomic find-or-create, so older wallets (no key) can
// never block the index from building; the find step still reuses them.
WalletSchema.index({ tenantId: 1, key: 1 }, { unique: true, partialFilterExpression: { key: { $type: 'string' } } });
WalletSchema.index({ tenantId: 1, familyId: 1 });
WalletSchema.index({ tenantId: 1, memberId: 1 });

TransactionSchema.index(
  { tenantId: 1, entryKey: 1 },
  { unique: true, partialFilterExpression: { entryKey: { $type: 'string' } } }
);
TransactionSchema.index({ walletId: 1, createdAt: -1 });
TransactionSchema.index({ tenantId: 1, referenceType: 1, referenceId: 1 });

export const Varisangya = mongoose.model<IVarisangya>('Varisangya', VarisangyaSchema);
export const Zakat = mongoose.model<IZakat>('Zakat', ZakatSchema);
export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);

// A failed index build must be visible in the log and in the index state, not silent (see the note above
// the indexes and utils/indexMonitor.ts).
for (const model of [Varisangya, Zakat, Wallet, Transaction]) registerIndexMonitor(model);
