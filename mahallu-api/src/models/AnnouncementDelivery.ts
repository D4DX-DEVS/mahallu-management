import mongoose, { Schema, Document } from 'mongoose';

export const DELIVERY_STATUSES = ['queued', 'sent', 'failed', 'skipped'] as const;

export interface IAnnouncementDelivery extends Document {
  tenantId: mongoose.Types.ObjectId;
  announcementId: mongoose.Types.ObjectId;
  channel: 'push' | 'whatsapp' | 'sms' | 'email';
  /** Masked on purpose (98****3210, a***@x.com); the full contact lives on the family or user */
  recipient: string;
  familyId?: mongoose.Types.ObjectId;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  error?: string;
  createdAt: Date;
}

const AnnouncementDeliverySchema = new Schema<IAnnouncementDelivery>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    announcementId: { type: Schema.Types.ObjectId, ref: 'Announcement', required: true, index: true },
    channel: { type: String, enum: ['push', 'whatsapp', 'sms', 'email'], required: true },
    recipient: { type: String, required: true },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family' },
    status: { type: String, enum: DELIVERY_STATUSES, required: true },
    error: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
AnnouncementDeliverySchema.index({ announcementId: 1, channel: 1, status: 1 });

export default mongoose.model<IAnnouncementDelivery>('AnnouncementDelivery', AnnouncementDeliverySchema);
