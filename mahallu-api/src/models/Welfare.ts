import mongoose, { Schema, Document } from 'mongoose';

export const WELFARE_CATEGORIES = [
  'medical',
  'housing',
  'education',
  'livelihood',
  'food',
  'marriage_assistance',
  'emergency',
  'other',
] as const;

export const WELFARE_STATUSES = [
  'pending',
  'verified',
  'approved',
  'rejected',
  'disbursed',
  'closed',
] as const;

export type WelfareStatus = (typeof WELFARE_STATUSES)[number];

/**
 * Allowed status moves (spec 7.6). Anything not listed is rejected by the
 * status endpoint - e.g. pending straight to disbursed must fail.
 */
export const WELFARE_TRANSITIONS: Record<WelfareStatus, WelfareStatus[]> = {
  pending: ['verified', 'rejected'],
  verified: ['approved', 'rejected'],
  approved: ['disbursed', 'rejected'],
  disbursed: ['closed'],
  rejected: [],
  closed: [],
};

export interface IWelfareScheme extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  category: string;
  description?: string;
  budgetAmount?: number;
  status: 'active' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

const WelfareSchemeSchema = new Schema<IWelfareScheme>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    name: { type: String, required: [true, 'Scheme name is required'], trim: true },
    nameMl: { type: String, trim: true },
    // Category key: 'welfare_category'. WELFARE_CATEGORIES above now only
    // feeds the Category seed script, not schema validation.
    category: { type: String, default: 'other' },
    description: { type: String, trim: true },
    budgetAmount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
  },
  { timestamps: true }
);

WelfareSchemeSchema.index({ tenantId: 1, status: 1 });

export interface IStatusChange {
  status: WelfareStatus;
  changedAt: Date;
  changedBy?: mongoose.Types.ObjectId;
  note?: string;
}

export interface IWelfareApplication extends Document {
  tenantId: mongoose.Types.ObjectId;
  schemeId: mongoose.Types.ObjectId;
  familyId?: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  requestedAmount: number;
  reason?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: WelfareStatus;
  verificationNotes?: string;
  approvedAmount?: number;
  disbursedDate?: Date;
  disbursedVia?: 'cash' | 'bank' | 'ledger';
  ledgerItemId?: mongoose.Types.ObjectId;
  history: IStatusChange[];
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WelfareApplicationSchema = new Schema<IWelfareApplication>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    schemeId: {
      type: Schema.Types.ObjectId,
      ref: 'WelfareScheme',
      required: [true, 'Scheme is required'],
      index: true,
    },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family', index: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    requestedAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: { type: String, enum: WELFARE_STATUSES, default: 'pending', index: true },
    verificationNotes: { type: String, trim: true },
    approvedAmount: { type: Number, min: 0 },
    disbursedDate: { type: Date },
    disbursedVia: { type: String, enum: ['cash', 'bank', 'ledger'] },
    ledgerItemId: { type: Schema.Types.ObjectId },
    history: [
      {
        status: { type: String, enum: WELFARE_STATUSES, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        note: { type: String, trim: true },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

WelfareApplicationSchema.index({ tenantId: 1, status: 1 });
WelfareApplicationSchema.index({ tenantId: 1, createdAt: -1 });

export const WelfareScheme = mongoose.model<IWelfareScheme>('WelfareScheme', WelfareSchemeSchema);
export const WelfareApplication = mongoose.model<IWelfareApplication>(
  'WelfareApplication',
  WelfareApplicationSchema
);
