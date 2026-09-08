import mongoose, { Schema, Document } from 'mongoose';

export const MARRIAGE_ASSISTANCE_TYPES = [
  'proposal_support',
  'financial_assistance',
  'premarital_counselling',
] as const;
export type MarriageAssistanceType = (typeof MARRIAGE_ASSISTANCE_TYPES)[number];

export const MARRIAGE_ASSISTANCE_STATUSES = ['requested', 'approved', 'completed'] as const;
export type MarriageAssistanceStatus = (typeof MARRIAGE_ASSISTANCE_STATUSES)[number];

export interface IMarriageAssistance extends Document {
  tenantId: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  familyId?: mongoose.Types.ObjectId;
  type: MarriageAssistanceType;
  amount?: number;
  status: MarriageAssistanceStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MarriageAssistanceSchema = new Schema<IMarriageAssistance>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      index: true,
    },
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      index: true,
    },
    type: {
      type: String,
      enum: MARRIAGE_ASSISTANCE_TYPES,
      required: [true, 'Type is required'],
      index: true,
    },
    amount: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: MARRIAGE_ASSISTANCE_STATUSES,
      default: 'requested',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound index for tenant scoped queries
MarriageAssistanceSchema.index({ tenantId: 1, status: 1 });
MarriageAssistanceSchema.index({ tenantId: 1, type: 1 });

export const MarriageAssistance = mongoose.model<IMarriageAssistance>(
  'MarriageAssistance',
  MarriageAssistanceSchema
);
