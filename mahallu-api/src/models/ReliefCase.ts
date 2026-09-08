import mongoose, { Schema, Document } from 'mongoose';

export const RELIEF_URGENCIES = ['low', 'medium', 'high', 'critical'] as const;
export type ReliefUrgency = (typeof RELIEF_URGENCIES)[number];

export const RELIEF_STATUSES = ['reported', 'verified', 'approved', 'assisted', 'closed'] as const;
export type ReliefStatus = (typeof RELIEF_STATUSES)[number];

/** Legal moves through a relief case; anything else is a 400. */
export const RELIEF_TRANSITIONS: Record<ReliefStatus, ReliefStatus[]> = {
  reported: ['verified', 'closed'],
  verified: ['approved', 'closed'],
  approved: ['assisted', 'closed'],
  assisted: ['closed'],
  closed: [],
};

export interface IReliefCase extends Document {
  tenantId: mongoose.Types.ObjectId;
  familyId?: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  title: string;
  titleMl?: string;
  description?: string;
  urgency: ReliefUrgency;
  status: ReliefStatus;
  assistanceGiven?: string;
  amount?: number;
  followUpDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReliefCaseSchema = new Schema<IReliefCase>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family', index: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', index: true },
    title: { type: String, required: [true, 'Title is required'], trim: true },
    titleMl: { type: String, trim: true },
    description: { type: String, trim: true },
    urgency: { type: String, enum: RELIEF_URGENCIES, default: 'medium', index: true },
    status: { type: String, enum: RELIEF_STATUSES, default: 'reported', index: true },
    assistanceGiven: { type: String, trim: true },
    amount: { type: Number, min: 0 },
    followUpDate: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

ReliefCaseSchema.index({ tenantId: 1, status: 1 });
ReliefCaseSchema.index({ tenantId: 1, urgency: 1 });

export default mongoose.model<IReliefCase>('ReliefCase', ReliefCaseSchema);
