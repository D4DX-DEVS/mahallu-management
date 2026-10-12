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

/** The eight asnaf, i.e. ZAKAT_CATEGORIES without the catch-all 'other'. A distribution needs one of these. */
export const ASNAF_CATEGORIES = ZAKAT_CATEGORIES.filter((c) => c !== 'other');

export const DISTRIBUTION_STATUSES = ['proposed', 'approved', 'rejected', 'cancelled'] as const;
export type DistributionStatus = (typeof DISTRIBUTION_STATUSES)[number];

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
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', index: true },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family' },
    // Free-text fallback for a beneficiary who is not on the member roll
    name: { type: String, trim: true },
    category: { type: String, enum: ZAKAT_CATEGORIES, default: 'other' },
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
  /** Legacy documents have no status and count as approved. */
  status?: DistributionStatus;
  asnafCategory?: string;
  voucherNo?: string;
  ledgerItemId?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ZakatDistributionSchema = new Schema<IZakatDistribution>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
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
    // Schema default is 'approved' so records that pre-date the approval step stay approved.
    // New records are created as 'proposed' by the controller when approval is required.
    status: { type: String, enum: DISTRIBUTION_STATUSES, default: 'approved', index: true },
    asnafCategory: { type: String, enum: ASNAF_CATEGORIES },
    voucherNo: { type: String, trim: true },
    ledgerItemId: { type: Schema.Types.ObjectId, ref: 'LedgerItem' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    rejectionReason: { type: String, trim: true },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    cancelReason: { type: String, trim: true },
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

/** Per-tenant zakat distribution controls. No document = defaults. */
export interface IZakatSettings extends Document {
  tenantId: mongoose.Types.ObjectId;
  /** Distributions above the threshold are created as 'proposed' and need approval. */
  requireApproval: boolean;
  /** Amounts at or below this skip approval (0 = every distribution needs it). */
  approvalThreshold: number;
  /** When the tenant has more than one admin, the approver must not be the creator. */
  requireDifferentApprover: boolean;
}

const ZakatSettingsSchema = new Schema<IZakatSettings>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    requireApproval: { type: Boolean, default: true },
    approvalThreshold: { type: Number, default: 0, min: 0 },
    requireDifferentApprover: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ZakatSettings = mongoose.model<IZakatSettings>('ZakatSettings', ZakatSettingsSchema);

/** Atomic per-tenant counter for distribution voucher numbers (key 'zdist:<tenantId>'). */
const ZakatVoucherCounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
const ZakatVoucherCounter = mongoose.model('ZakatVoucherCounter', ZakatVoucherCounterSchema);

export const nextDistributionVoucherNo = async (tenantId: string | mongoose.Types.ObjectId): Promise<string> => {
  const counter = await ZakatVoucherCounter.findOneAndUpdate(
    { _id: `zdist:${tenantId}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `ZD-${String(counter!.seq).padStart(5, '0')}`;
};
