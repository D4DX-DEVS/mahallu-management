import mongoose, { Schema, Document } from 'mongoose';

export const ANNOUNCEMENT_CATEGORIES = [
  'announcement',
  'program',
  'emergency',
  'welfare',
  'education',
  'news',
] as const;

export const ANNOUNCEMENT_CHANNELS = ['push', 'whatsapp', 'sms', 'email'] as const;

export interface IAnnouncement extends Document {
  tenantId: mongoose.Types.ObjectId;
  title: string;
  titleMl?: string;
  body: string;
  category: string;
  audience: 'all' | 'families' | 'committee' | 'cluster' | 'custom';
  audienceRefIds: mongoose.Types.ObjectId[];
  channels: string[];
  /** Per-channel outcome of the last send, e.g. { push: 'sent', sms: 'not_configured' } */
  deliveryResults?: Record<string, string>;
  sentAt?: Date;
  status: 'draft' | 'sent';
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    title: { type: String, required: [true, 'Title is required'], trim: true },
    titleMl: { type: String, trim: true },
    body: { type: String, required: [true, 'Body is required'] },
    category: { type: String, enum: ANNOUNCEMENT_CATEGORIES, default: 'announcement' },
    audience: {
      type: String,
      enum: ['all', 'families', 'committee', 'cluster', 'custom'],
      default: 'all',
    },
    audienceRefIds: { type: [Schema.Types.ObjectId], default: [] },
    channels: {
      type: [{ type: String, enum: ANNOUNCEMENT_CHANNELS }],
      default: ['push'],
    },
    deliveryResults: { type: Map, of: String },
    sentAt: { type: Date },
    status: { type: String, enum: ['draft', 'sent'], default: 'draft', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ tenantId: 1, status: 1 });
AnnouncementSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
