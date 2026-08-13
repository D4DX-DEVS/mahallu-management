import mongoose, { Schema, Document } from 'mongoose';

export interface IMahalluAccount extends Document {
  tenantId: mongoose.Types.ObjectId;
  accountName: string;
  accountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  balance: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface IInstituteAccount extends Document {
  tenantId: mongoose.Types.ObjectId;
  instituteId: mongoose.Types.ObjectId;
  accountName: string;
  accountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  balance: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategory extends Document {
  tenantId: mongoose.Types.ObjectId;
  instituteId?: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  description?: string;
  type: 'income' | 'expense';
  createdAt: Date;
  updatedAt: Date;
}

export interface IMasterWallet extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  balance: number;
  type: 'main' | 'reserve' | 'charity';
  createdAt: Date;
  updatedAt: Date;
}

export interface ILedger extends Document {
  tenantId: mongoose.Types.ObjectId;
  instituteId?: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  description?: string;
  type: 'income' | 'expense';
  createdAt: Date;
  updatedAt: Date;
}

export interface ILedgerItem extends Document {
  tenantId: mongoose.Types.ObjectId;
  instituteId?: mongoose.Types.ObjectId;
  ledgerId: mongoose.Types.ObjectId;
  date: Date;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  categoryId?: mongoose.Types.ObjectId;
  paymentMethod?: string;
  referenceNo?: string;
  source?: 'manual' | 'salary' | 'varisangya' | 'zakat' | 'petty_cash' | 'welfare' | 'zakat_distribution';
  sourceId?: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InstituteAccountSchema = new Schema<IInstituteAccount>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    instituteId: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      required: true,
    },
    accountName: { type: String, required: true, trim: true },
    accountNumber: String,
    bankName: String,
    ifscCode: String,
    balance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

const CategorySchema = new Schema<ICategory>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    instituteId: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      default: null,
    },
    name: { type: String, required: true, trim: true },
    nameMl: { type: String, trim: true },
    description: String,
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
  },
  { timestamps: true }
);

const MasterWalletSchema = new Schema<IMasterWallet>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    balance: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ['main', 'reserve', 'charity'],
      default: 'main',
    },
  },
  { timestamps: true }
);

const LedgerSchema = new Schema<ILedger>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    instituteId: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      default: null,
    },
    name: { type: String, required: true, trim: true },
    nameMl: { type: String, trim: true },
    description: String,
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
  },
  { timestamps: true }
);

const LedgerItemSchema = new Schema<ILedgerItem>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    instituteId: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      default: null,
    },
    ledgerId: {
      type: Schema.Types.ObjectId,
      ref: 'Ledger',
      required: true,
    },
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
    description: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    paymentMethod: String,
    referenceNo: String,
    source: {
      type: String,
      enum: ['manual', 'salary', 'varisangya', 'zakat', 'petty_cash', 'welfare', 'zakat_distribution'],
      default: 'manual',
    },
    sourceId: { type: Schema.Types.ObjectId },
    projectId: { type: Schema.Types.ObjectId, ref: 'DevelopmentProject', index: true },
  },
  { timestamps: true }
);

const MahalluAccountSchema = new Schema<IMahalluAccount>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    accountName: { type: String, required: true, trim: true },
    accountNumber: String,
    bankName: String,
    ifscCode: String,
    balance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

export const InstituteAccount = mongoose.model<IInstituteAccount>('InstituteAccount', InstituteAccountSchema);
export const MahalluAccount = mongoose.model<IMahalluAccount>('MahalluAccount', MahalluAccountSchema);
export const Category = mongoose.model<ICategory>('Category', CategorySchema);
export const MasterWallet = mongoose.model<IMasterWallet>('MasterWallet', MasterWalletSchema);
export const Ledger = mongoose.model<ILedger>('Ledger', LedgerSchema);
export const LedgerItem = mongoose.model<ILedgerItem>('LedgerItem', LedgerItemSchema);

