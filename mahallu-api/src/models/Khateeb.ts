import mongoose, { Schema, Document } from 'mongoose';

export const KHATEEB_STATUSES = ['active', 'inactive'] as const;
export type KhateebStatus = (typeof KHATEEB_STATUSES)[number];

export interface IKhateeb extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  memberId?: mongoose.Types.ObjectId;
  qualifications?: string;
  contactNo?: string;
  status: KhateebStatus;
  createdAt: Date;
  updatedAt: Date;
}

const KhateebSchema = new Schema<IKhateeb>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Khateeb name is required'],
      trim: true,
    },
    nameMl: {
      type: String,
      trim: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      index: true,
    },
    qualifications: {
      type: String,
      trim: true,
    },
    contactNo: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: KHATEEB_STATUSES,
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

KhateebSchema.index({ tenantId: 1, status: 1 });

export default mongoose.model<IKhateeb>('Khateeb', KhateebSchema);
