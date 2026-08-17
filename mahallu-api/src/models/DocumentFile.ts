import mongoose, { Schema, Document } from 'mongoose';

export type DocumentOwnerType = 'member' | 'family' | 'nikah' | 'death' | 'noc';
export type DocumentType =
  | 'id_proof'
  | 'age_proof'
  | 'photo'
  | 'address_proof'
  | 'divorce_doc'
  | 'death_proof'
  | 'other';

export interface IDocumentFile extends Document {
  tenantId: mongoose.Types.ObjectId;
  ownerType: DocumentOwnerType;
  ownerId?: mongoose.Types.ObjectId; // set when attached (registration id / member id / family id)
  documentType: DocumentType;
  fileKey: string; // private object-storage key — never a public URL
  fileName: string;
  mimeType: string;
  size: number;
  uploadedByUserId: mongoose.Types.ObjectId;
  uploadedByMemberId?: mongoose.Types.ObjectId;
  status: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentFileSchema = new Schema<IDocumentFile>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: ['member', 'family', 'nikah', 'death', 'noc'],
      required: true,
    },
    ownerId: { type: Schema.Types.ObjectId, index: true },
    documentType: {
      type: String,
      enum: ['id_proof', 'age_proof', 'photo', 'address_proof', 'divorce_doc', 'death_proof', 'other'],
      required: true,
    },
    fileKey: { type: String, required: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedByMemberId: { type: Schema.Types.ObjectId, ref: 'Member', index: true },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verifiedBy: { type: String, trim: true },
    verifiedAt: Date,
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

DocumentFileSchema.index({ tenantId: 1, ownerType: 1, ownerId: 1 });

export default mongoose.model<IDocumentFile>('DocumentFile', DocumentFileSchema);
