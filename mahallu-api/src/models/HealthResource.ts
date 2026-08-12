import mongoose, { Schema, Document } from 'mongoose';

export const HEALTH_RESOURCE_TYPES = [
  'doctor',
  'blood_donor',
  'palliative_case',
  'patient_support',
  'elderly_care',
] as const;

export type HealthResourceType = (typeof HEALTH_RESOURCE_TYPES)[number];

export interface IHealthResource extends Document {
  tenantId: mongoose.Types.ObjectId;
  type: HealthResourceType;
  memberId?: mongoose.Types.ObjectId;
  name: string;
  specialty?: string; // for doctors
  bloodGroup?: string; // for blood donors
  contactNo: string;
  availability?: string;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const HealthResourceSchema = new Schema<IHealthResource>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: HEALTH_RESOURCE_TYPES,
      required: [true, 'Health resource type is required'],
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    specialty: {
      type: String,
      trim: true,
    },
    bloodGroup: {
      type: String,
      enum: ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'],
    },
    contactNo: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
    },
    availability: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for hot queries
HealthResourceSchema.index({ tenantId: 1, status: 1 });
HealthResourceSchema.index({ tenantId: 1, type: 1, status: 1 });
HealthResourceSchema.index({ tenantId: 1, bloodGroup: 1 });

export default mongoose.model<IHealthResource>('HealthResource', HealthResourceSchema);
