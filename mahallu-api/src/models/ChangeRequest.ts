import mongoose, { Schema, Document } from 'mongoose';

export interface IFieldChange {
  field: string;
  oldValue?: string;
  newValue: string;
}

export interface IChangeRequest extends Document {
  tenantId: mongoose.Types.ObjectId;
  targetType: 'member' | 'family';
  targetId: mongoose.Types.ObjectId;
  requestedByMemberId: mongoose.Types.ObjectId;
  changes: IFieldChange[];
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChangeRequestSchema = new Schema<IChangeRequest>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['member', 'family'],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    requestedByMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    changes: [
      {
        field: { type: String, required: true },
        oldValue: String,
        newValue: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedBy: { type: String, trim: true },
    reviewedAt: Date,
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

ChangeRequestSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model<IChangeRequest>('ChangeRequest', ChangeRequestSchema);
