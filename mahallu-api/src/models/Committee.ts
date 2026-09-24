import mongoose, { Schema, Document } from 'mongoose';

export interface ICommittee extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  description?: string;
  descriptionMl?: string;
  members: mongoose.Types.ObjectId[];
  termStartDate?: Date;
  termEndDate?: Date;
  maxTermYears: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const CommitteeSchema = new Schema<ICommittee>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Committee name is required'],
      trim: true,
    },
    nameMl: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    descriptionMl: {
      type: String,
      trim: true,
    },
    members: [{
      type: Schema.Types.ObjectId,
      ref: 'Member',
    }],
    termStartDate: {
      type: Date,
    },
    termEndDate: {
      type: Date,
      index: true,
    },
    maxTermYears: {
      type: Number,
      default: 3,
      min: 1,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Hot list queries: status board and the "term expiring" sweep
CommitteeSchema.index({ tenantId: 1, status: 1 });
CommitteeSchema.index({ tenantId: 1, termEndDate: 1 });

export default mongoose.model<ICommittee>('Committee', CommitteeSchema);

