import mongoose, { Schema, Document } from 'mongoose';

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
  status?: 'pending' | 'verified'; // member submissions start pending; admin entries are verified
  source?: 'admin' | 'member';
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
  status?: 'pending' | 'verified';
  source?: 'admin' | 'member';
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
    status: { type: String, enum: ['pending', 'verified'], default: 'verified', index: true },
    source: { type: String, enum: ['admin', 'member'], default: 'admin' },
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
    status: { type: String, enum: ['pending', 'verified'], default: 'verified', index: true },
    source: { type: String, enum: ['admin', 'member'], default: 'admin' },
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
  },
  { timestamps: true }
);

export const Varisangya = mongoose.model<IVarisangya>('Varisangya', VarisangyaSchema);
export const Zakat = mongoose.model<IZakat>('Zakat', ZakatSchema);
export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);

