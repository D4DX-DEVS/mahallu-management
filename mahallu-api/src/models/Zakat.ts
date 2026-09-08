import mongoose, { Schema, Document } from 'mongoose';

/** The eight Qur'anic categories of zakat recipients (spec 11). */
export const ZAKAT_CATEGORIES = [
  'fakir',
  'miskin',
  'amil',
  'muallaf',
  'riqab',
  'gharim',
  'fisabilillah',
  'ibnussabil',
  'other',
] as const;

export const PRIORITY_AREAS = [
  'medical',
  'housing',
  'education',
  'livelihood',
  'living_expenses',
] as const;

export interface IZakatBeneficiary extends Document {
  tenantId: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  familyId?: mongoose.Types.ObjectId;
  name?: string;
  category: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedDate?: Date;
  priorityArea?: string;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const ZakatBeneficiarySchema = new Schema<IZakatBeneficiary>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', index: true },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family' },
    // Free-text fallback for a beneficiary who is not on the member roll
    name: { type: String, trim: true },
    // Category key: 'zakat_asnaf_category'. ZAKAT_CATEGORIES above now only
    // feeds the Category seed script, not schema validation.
    category: { type: String, default: 'other' },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedDate: { type: Date },
    priorityArea: { type: String, enum: PRIORITY_AREAS },
    notes: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

ZakatBeneficiarySchema.index({ tenantId: 1, verificationStatus: 1 });
ZakatBeneficiarySchema.index({ tenantId: 1, status: 1 });

export interface IZakatDistribution extends Document {
  tenantId: mongoose.Types.ObjectId;
  beneficiaryId: mongoose.Types.ObjectId;
  amount: number;
  distributionDate: Date;
  type: 'regular' | 'monthly' | 'fitr' | 'qurbani';
  paymentMethod?: string;
  receiptNo?: string;
  remarks?: string;
  postToLedger: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ZakatDistributionSchema = new Schema<IZakatDistribution>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    beneficiaryId: {
      type: Schema.Types.ObjectId,
      ref: 'ZakatBeneficiary',
      required: [true, 'Beneficiary is required'],
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    distributionDate: { type: Date, required: true, default: Date.now },
    type: {
      type: String,
      enum: ['regular', 'monthly', 'fitr', 'qurbani'],
      default: 'regular',
      index: true,
    },
    paymentMethod: { type: String, trim: true },
    receiptNo: { type: String, trim: true },
    remarks: { type: String, trim: true },
    postToLedger: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ZakatDistributionSchema.index({ tenantId: 1, distributionDate: -1 });

export const ZakatBeneficiary = mongoose.model<IZakatBeneficiary>(
  'ZakatBeneficiary',
  ZakatBeneficiarySchema
);
export const ZakatDistribution = mongoose.model<IZakatDistribution>(
  'ZakatDistribution',
  ZakatDistributionSchema
);
