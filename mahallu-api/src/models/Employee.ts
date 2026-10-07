import mongoose, { Schema, Document } from 'mongoose';
import { MAX_AMOUNT } from '../utils/money';

export interface IEmployee extends Document {
  tenantId: mongoose.Types.ObjectId;
  instituteId: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  phone?: string;
  email?: string;
  designation: string;
  designationMl?: string;
  department?: string;
  joinDate: Date;
  salary: number;
  status: 'active' | 'inactive';
  address?: string;
  qualifications?: string;
  bankAccount?: {
    accountNumber: string;
    bankName: string;
    ifscCode: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
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
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
    },
    nameMl: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
    },
    designationMl: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    salary: {
      type: Number,
      required: [true, 'Salary is required'],
      min: [0, 'Please enter a salary of zero or more.'],
      max: [MAX_AMOUNT, 'Please enter a smaller salary.'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    address: {
      type: String,
      trim: true,
    },
    qualifications: {
      type: String,
      trim: true,
    },
    bankAccount: {
      // Digits only, kept as text so leading zeros survive. An empty value is skipped.
      accountNumber: { type: String, trim: true, match: [/^[0-9]+$/, 'Please enter the account number using digits only.'] },
      bankName: String,
      ifscCode: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for faster queries
EmployeeSchema.index({ tenantId: 1, instituteId: 1 });

export default mongoose.model<IEmployee>('Employee', EmployeeSchema);
