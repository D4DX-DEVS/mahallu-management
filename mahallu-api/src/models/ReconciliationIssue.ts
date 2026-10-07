import mongoose, { Schema, Document } from 'mongoose';

/**
 * A money-affecting step failed AND the step that should have undone it failed too, so the data may be
 * half-written. The record is the durable "somebody must look at this" marker (the log line alone is
 * lost on the next restart). It holds ids, the flow and step, and a short scrubbed error class + message:
 * no personal data and no secrets (see utils/reconciliation.ts).
 *
 * One OPEN record exists per (tenant, flow, entity id, step): a retry storm updates its counter instead
 * of creating more. Resolving closes it; a later failure of the same step opens a fresh one.
 */

export interface IReconciliationIssue extends Document {
  /** Absent when the failing flow could not say which Mahallu it was working for. */
  tenantId?: mongoose.Types.ObjectId | null;
  flow: string;
  entity: string;
  entityId: string;
  step: string;
  reason: string;
  /** Small flat map of ids / amounts describing what is half-done. Scrubbed. */
  state?: Record<string, string | number | boolean | null>;
  status: 'open' | 'resolved';
  /** How many times this same failure was reported while open. */
  occurrences: number;
  lastSeenAt: Date;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReconciliationIssueSchema = new Schema<IReconciliationIssue>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    flow: { type: String, required: true, maxlength: 120 },
    entity: { type: String, required: true, maxlength: 80 },
    entityId: { type: String, required: true, maxlength: 64 },
    step: { type: String, required: true, maxlength: 120 },
    reason: { type: String, default: '', maxlength: 300 },
    state: { type: Schema.Types.Mixed },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    occurrences: { type: Number, default: 1 },
    lastSeenAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

// The admin list: open issues first, newest first.
ReconciliationIssueSchema.index({ status: 1, createdAt: -1 });
// Idempotency: at most one OPEN record per failing step of one record. Partial, so resolved history is unlimited.
ReconciliationIssueSchema.index(
  { tenantId: 1, flow: 1, entityId: 1, step: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } }
);

export const ReconciliationIssue = mongoose.model<IReconciliationIssue>('ReconciliationIssue', ReconciliationIssueSchema);
export default ReconciliationIssue;
