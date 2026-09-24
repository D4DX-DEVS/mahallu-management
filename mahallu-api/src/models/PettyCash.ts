import mongoose, { Schema, Document } from 'mongoose';

export interface IPettyCash extends Document {
  tenantId: mongoose.Types.ObjectId;
  instituteId: mongoose.Types.ObjectId;
  custodianName: string;
  floatAmount: number;
  currentBalance: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface IPettyCashTransaction extends Document {
  tenantId: mongoose.Types.ObjectId;
  instituteId: mongoose.Types.ObjectId;
  pettyCashId: mongoose.Types.ObjectId;
  type: 'float' | 'expense' | 'replenishment';
  amount: number;
  description: string;
  categoryId?: mongoose.Types.ObjectId;
  receiptNo?: string;
  date: Date;
  createdBy?: mongoose.Types.ObjectId;
  postedToLedger: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PettyCashSchema = new Schema<IPettyCash>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    instituteId: { type: Schema.Types.ObjectId, ref: 'Institute', required: true },
    custodianName: { type: String, required: true, trim: true },
    floatAmount: { type: Number, required: true, min: 0 },
    currentBalance: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

const PettyCashTransactionSchema = new Schema<IPettyCashTransaction>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    instituteId: { type: Schema.Types.ObjectId, ref: 'Institute', required: true },
    pettyCashId: { type: Schema.Types.ObjectId, ref: 'PettyCash', required: true },
    type: { type: String, enum: ['float', 'expense', 'replenishment'], required: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    receiptNo: String,
    date: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    postedToLedger: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PettyCash = mongoose.model<IPettyCash>('PettyCash', PettyCashSchema);
export const PettyCashTransaction = mongoose.model<IPettyCashTransaction>('PettyCashTransaction', PettyCashTransactionSchema);
