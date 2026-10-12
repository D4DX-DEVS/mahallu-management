import mongoose, { Schema, Document } from 'mongoose';

/**
 * One row per dues-reminder run. `mode:'auto'` rows are the once-per-tenant-per-month claim made by the
 * scheduler (unique on tenantId+month, enforced by a partial index); `manual` rows are an admin audit log.
 */
export interface IReminderRun extends Document {
  tenantId: mongoose.Types.ObjectId;
  month: string; // 'YYYY-MM'
  mode: 'auto' | 'manual';
  state: 'sending' | 'sent';
  claimedAt: Date;
  sentAt?: Date;
  count: number; // messages delivered
  failed: number;
  skipped: number; // families without a phone number
  triggeredBy?: mongoose.Types.ObjectId;
}

const ReminderRunSchema = new Schema<IReminderRun>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    month: { type: String, required: true },
    mode: { type: String, enum: ['auto', 'manual'], required: true },
    state: { type: String, enum: ['sending', 'sent'], default: 'sending' },
    claimedAt: { type: Date, default: Date.now },
    sentAt: Date,
    count: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'reminderRuns' }
);

// The idempotency guarantee: only one automatic run per tenant per month, even across server instances.
ReminderRunSchema.index({ tenantId: 1, month: 1 }, { unique: true, partialFilterExpression: { mode: 'auto' } });
ReminderRunSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model<IReminderRun>('ReminderRun', ReminderRunSchema);
