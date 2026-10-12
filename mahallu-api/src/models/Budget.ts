import mongoose, { Schema, Document } from 'mongoose';

export interface IBudgetLine {
  _id?: mongoose.Types.ObjectId;
  ledgerId?: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId;
  name: string;
  type: 'income' | 'expense';
  amount: number;
}

export interface IBudget extends Document {
  tenantId: mongoose.Types.ObjectId;
  periodId: mongoose.Types.ObjectId;
  name?: string;
  lines: IBudgetLine[];
  status: 'draft' | 'approved';
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BudgetSchema = new Schema<IBudget>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    periodId: { type: Schema.Types.ObjectId, ref: 'FinancialPeriod', required: true, index: true },
    name: { type: String, trim: true },
    lines: {
      type: [
        {
          ledgerId: { type: Schema.Types.ObjectId, ref: 'Ledger' },
          categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
          name: { type: String, required: true, trim: true },
          type: { type: String, enum: ['income', 'expense'], required: true },
          amount: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
    status: { type: String, enum: ['draft', 'approved'], default: 'draft' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// One budget per period per tenant
BudgetSchema.index({ tenantId: 1, periodId: 1 }, { unique: true });

export const Budget = mongoose.model<IBudget>('Budget', BudgetSchema);
export default Budget;
