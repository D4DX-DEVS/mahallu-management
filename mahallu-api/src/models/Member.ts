import mongoose, { Schema, Document } from 'mongoose';

export interface IMember extends Document {
  tenantId: mongoose.Types.ObjectId; // Required for multi-tenancy
  mahallId?: string;
  name: string;
  nameMl?: string;
  familyId: mongoose.Types.ObjectId;
  familyName: string;
  age?: number;
  gender?: 'male' | 'female';
  bloodGroup?: string;
  healthStatus?: string;
  phone?: string;
  education?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  marriageCount?: number;
  isOrphan?: boolean;
  isDead?: boolean;
  isFamilyHead?: boolean;
  status: 'active' | 'inactive' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    mahallId: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    nameMl: {
      type: String,
      trim: true,
    },
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: [true, 'Family ID is required'],
    },
    familyName: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
    },
    bloodGroup: {
      type: String,
      enum: ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'],
    },
    healthStatus: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    education: {
      type: String,
      trim: true,
    },
    maritalStatus: {
      type: String,
      enum: ['single', 'married', 'divorced', 'widowed'],
    },
    marriageCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    isOrphan: {
      type: Boolean,
      default: false,
    },
    isDead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFamilyHead: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'deleted'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IMember>('Member', MemberSchema);

