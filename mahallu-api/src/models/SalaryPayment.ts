import mongoose, { Schema, Document } from 'mongoose';

export interface ISalaryPayment extends Document {
  tenantId: mongoose.Types.ObjectId;
  instituteId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  month: number;
  year: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netAmount: number;
  paymentDate: Date;
  paymentMethod: string;
  referenceNo?: string;
  status: 'paid' | 'pending' | 'cancelled';
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalaryPaymentSchema = new Schema<ISalaryPayment>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    instituteId: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      required: [true, 'Please select an institute before continuing.'],
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee ID is required'],
      index: true,
    },
    month: {
      type: Number,
      required: [true, 'Month is required'],
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: 2000,
    },
    baseSalary: {
      type: Number,
      required: [true, 'Base salary is required'],
      min: 0,
    },
    allowances: {
      type: Number,
      default: 0,
      min: 0,
    },
    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: [true, 'Net amount is required'],
      min: 0,
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank', 'upi', 'cheque'],
      required: [true, 'Payment method is required'],
    },
    referenceNo: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'cancelled'],
      default: 'pending',
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate salary payment for same employee in same month/year
SalaryPaymentSchema.index(
  { instituteId: 1, employeeId: 1, month: 1, year: 1 },
  { unique: true }
);

export default mongoose.model<ISalaryPayment>('SalaryPayment', SalaryPaymentSchema);
