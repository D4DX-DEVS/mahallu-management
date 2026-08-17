import mongoose, { Schema, Document } from 'mongoose';

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
  },
  { timestamps: true }
);

// certificateNo is globally unique so the public verify endpoint needs no tenant hint
CertificateSchema.index({ certificateNo: 1 }, { unique: true });

export default mongoose.model<ICertificate>('Certificate', CertificateSchema);
