import mongoose, { Schema, Document } from 'mongoose';
import { registerIndexMonitor } from '../utils/indexMonitor';

export type CertificateType = 'nikah' | 'death' | 'noc';

export interface ICertificate extends Document {
  tenantId: mongoose.Types.ObjectId;
  certificateNo: string;
  type: CertificateType;
  registrationId: mongoose.Types.ObjectId;
  subjectMemberIds: mongoose.Types.ObjectId[]; // members this certificate concerns
  issuedBy: string;
  issueDate: Date;
  pdfKey: string; // private object-storage key
  status: 'valid' | 'revoked';
  /**
   * `${tenantId}:${type}:${registrationId}`, set ONLY while the certificate is valid and removed when it
   * is revoked. A partial unique index on it makes a second valid certificate for the same registration
   * impossible even if two requests race. Older rows simply have no issueKey.
   */
  issueKey?: string;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CertificateSchema = new Schema<ICertificate>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    certificateNo: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['nikah', 'death', 'noc'],
      required: true,
    },
    registrationId: { type: Schema.Types.ObjectId, required: true, index: true },
    subjectMemberIds: [{ type: Schema.Types.ObjectId, ref: 'Member', index: true }],
    issuedBy: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    pdfKey: { type: String, required: true },
    status: {
      type: String,
      enum: ['valid', 'revoked'],
      default: 'valid',
    },
    revokedReason: { type: String, trim: true },
    issueKey: { type: String },
  },
  { timestamps: true }
);

// certificateNo is globally unique so the public verify endpoint needs no tenant hint
CertificateSchema.index({ certificateNo: 1 }, { unique: true });

// At most one VALID certificate per (tenant, type, registration). issueKey is only written on valid
// certificates, so existing rows (no issueKey) can never make the index build fail.
CertificateSchema.index(
  { issueKey: 1 },
  { unique: true, partialFilterExpression: { issueKey: { $type: 'string' } } }
);

const Certificate = mongoose.model<ICertificate>('Certificate', CertificateSchema);

// A failed index build must never crash the app: it is reported through the shared index monitor
// (utils/indexMonitor.ts) and issuing still works, because certificateService serialises issuing with a
// per-registration claim; only the database-level backstop is missing until the index builds.
registerIndexMonitor(Certificate);

export default Certificate;
