import mongoose, { Schema, Document, Types } from 'mongoose';
import { TENANT_TYPES, TenantType } from '../config/tenantTypes';

export const DEMO_REQUEST_STATUSES = ['pending', 'accepted', 'rejected'] as const;
export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];

/** Whether the requester was told about a rejection. Only ever 'sent' after the provider confirmed it. */
export type RejectionNotificationStatus = 'sent' | 'failed';

/**
 * A "Request a demo" submission from the public landing page.
 *
 * There is no tenant or user behind it until platform staff accept it and create the Mahallu
 * from the tenant form (the tenant's id is then recorded in `tenantId`). Requests saved before
 * review existed have no `status`; everything that reads or filters by it treats a missing
 * status as 'pending'.
 */
export interface IDemoRequest extends Document {
  mahalluName: string;
  contactNumber: string;
  whatsappNumber: string;
  type?: TenantType;
  location?: string;
  address?: {
    state?: string;
    district?: string;
    pinCode?: string;
    postOffice?: string;
    village?: string;
  };
  status: DemoRequestStatus;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  rejectionReason?: string;
  rejectionNotification?: {
    channel: 'whatsapp';
    status: RejectionNotificationStatus;
    attemptedAt: Date;
  };
  /** The Mahallu created from this request. Set once; a request can only produce one. */
  tenantId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DemoRequestSchema = new Schema<IDemoRequest>(
  {
    mahalluName: { type: String, required: true, trim: true, maxlength: 150 },
    contactNumber: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, required: true, trim: true },
    type: { type: String, enum: TENANT_TYPES },
    location: { type: String, trim: true, maxlength: 300 },
    address: {
      state: { type: String, trim: true, maxlength: 200 },
      district: { type: String, trim: true, maxlength: 200 },
      pinCode: { type: String, trim: true, maxlength: 20 },
      postOffice: { type: String, trim: true, maxlength: 200 },
      village: { type: String, trim: true, maxlength: 200 },
    },
    status: { type: String, enum: DEMO_REQUEST_STATUSES, default: 'pending' },
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    rejectionNotification: {
      channel: { type: String, enum: ['whatsapp'] },
      status: { type: String, enum: ['sent', 'failed'] },
      attemptedAt: Date,
    },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  },
  { timestamps: true }
);

DemoRequestSchema.index({ createdAt: -1 });

export default mongoose.model<IDemoRequest>('DemoRequest', DemoRequestSchema);
