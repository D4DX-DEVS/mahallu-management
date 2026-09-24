import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicalCamp extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  campDate: Date;
  location: string;
  organizer?: string;
  attendeeCount?: number;
  notes?: string;
  status: 'planned' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const MedicalCampSchema = new Schema<IMedicalCamp>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Camp name is required'],
      trim: true,
    },
    campDate: {
      type: Date,
      required: [true, 'Camp date is required'],
      index: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    organizer: {
      type: String,
      trim: true,
    },
    attendeeCount: {
      type: Number,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['planned', 'completed', 'cancelled'],
      default: 'planned',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for hot queries
MedicalCampSchema.index({ tenantId: 1, status: 1 });
MedicalCampSchema.index({ tenantId: 1, campDate: 1 });

export default mongoose.model<IMedicalCamp>('MedicalCamp', MedicalCampSchema);
