import mongoose, { Schema, Document } from 'mongoose';

export const KHUTBAH_STATUSES = ['scheduled', 'delivered', 'cancelled'] as const;
export type KhutbahStatus = (typeof KHUTBAH_STATUSES)[number];

export interface IKhutbah extends Document {
  tenantId: mongoose.Types.ObjectId;
  khateebId: mongoose.Types.ObjectId;
  date: Date;
  topic: string;
  topicMl?: string;
  notes?: string;
  resourceUrl?: string;
  status: KhutbahStatus;
  createdAt: Date;
  updatedAt: Date;
}

const KhutbahSchema = new Schema<IKhutbah>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    khateebId: {
      type: Schema.Types.ObjectId,
      ref: 'Khateeb',
      required: [true, 'Khateeb is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Khutbah date is required'],
      index: true,
    },
    topic: {
      type: String,
      required: [true, 'Topic is required'],
      trim: true,
    },
    topicMl: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    resourceUrl: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: KHUTBAH_STATUSES,
      default: 'scheduled',
      index: true,
    },
  },
  { timestamps: true }
);

KhutbahSchema.index({ tenantId: 1, date: -1 });
KhutbahSchema.index({ tenantId: 1, khateebId: 1 });

export default mongoose.model<IKhutbah>('Khutbah', KhutbahSchema);
