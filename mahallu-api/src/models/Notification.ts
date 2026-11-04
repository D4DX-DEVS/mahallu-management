import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  tenantId: mongoose.Types.ObjectId;
  /** User or Member id for a single recipient; the Family / Committee id for those targets. */
  recipientId?: mongoose.Types.ObjectId;
  recipientType: 'user' | 'member' | 'all' | 'family' | 'committee';
  /**
   * Group audience (several users/members, a family, a committee), resolved when sent: the user AND member
   * ids of everyone in it. A group notification is read per user (readBy), like a broadcast.
   * Not selected by default: ask for it with .select('+recipientIds').
   */
  recipientIds?: mongoose.Types.ObjectId[];
  title: string;
  titleMl?: string;
  message: string;
  messageMl?: string;
  type: 'info' | 'warning' | 'success' | 'error';
  /** Read flag of an INDIVIDUAL notification. A broadcast (recipientType 'all') is read per user, see readBy. */
  isRead: boolean;
  /** Users who have read a broadcast. Not selected by default: ask for it with .select('+readBy'). */
  readBy?: mongoose.Types.ObjectId[];
  link?: string;
  imageUrl?: string;
  /** Outcome of the OneSignal push sent on create. */
  pushStatus?: 'pending' | 'sent' | 'partial' | 'failed' | 'skipped';
  pushIds?: string[];
  pushRecipients?: number;
  pushError?: string;
  pushedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    recipientId: Schema.Types.ObjectId,
    recipientType: {
      type: String,
      enum: ['user', 'member', 'all', 'family', 'committee'],
      default: 'all',
    },
    title: { type: String, required: true, trim: true },
    titleMl: { type: String, trim: true },
    message: { type: String, required: true },
    messageMl: { type: String },
    type: {
      type: String,
      enum: ['info', 'warning', 'success', 'error'],
      default: 'info',
    },
    isRead: { type: Boolean, default: false },
    readBy: { type: [Schema.Types.ObjectId], default: undefined, select: false },
    recipientIds: { type: [Schema.Types.ObjectId], default: undefined, select: false },
    link: String,
    imageUrl: { type: String },
    pushStatus: { type: String, enum: ['pending', 'sent', 'partial', 'failed', 'skipped'] },
    pushIds: { type: [String], default: undefined },
    pushRecipients: Number,
    pushError: String,
    pushedAt: Date,
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ tenantId: 1, createdAt: -1 });

/** Read per user (readBy) rather than by the notification's own flag: a broadcast or any group notification. */
export const readsPerUser = (doc: { recipientType?: string; recipientIds?: unknown[] }): boolean =>
  doc.recipientType === 'all' ||
  doc.recipientType === 'family' ||
  doc.recipientType === 'committee' ||
  (Array.isArray(doc.recipientIds) && doc.recipientIds.length > 0);

/** Has this viewer read it? A broadcast is read per user (readBy), anything else by its own flag. */
export const isReadBy = (doc: { isRead?: boolean; readBy?: unknown[] }, viewerId?: unknown): boolean => {
  if (doc.isRead === true) return true; // an individual one, or a broadcast read for everyone before per-user tracking
  if (!viewerId || !Array.isArray(doc.readBy)) return false;
  return doc.readBy.some((id) => String(id) === String(viewerId));
};

/**
 * The notification as ONE viewer should see it: `isRead` is that viewer's own state and the list of
 * other users who read it is not exposed. The response shape the CMS and mobile apps read is unchanged.
 */
export const notificationForViewer = (doc: any, viewerId?: unknown): Record<string, any> => {
  const plain = typeof doc?.toJSON === 'function' ? doc.toJSON() : { ...doc };
  const read = isReadBy(doc, viewerId);
  delete plain.readBy;
  delete plain.recipientIds;
  plain.isRead = read;
  return plain;
};

export default mongoose.model<INotification>('Notification', NotificationSchema);

