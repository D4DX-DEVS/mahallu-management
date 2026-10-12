import mongoose, { Schema, Document } from 'mongoose';

export const CAMPAIGN_TYPES = ['fitr', 'udhiya', 'ramadan_relief', 'building_fund', 'custom'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];
export const CAMPAIGN_STATUSES = ['draft', 'active', 'closed'] as const;
export const CONTRIBUTION_METHODS = ['cash', 'upi', 'bank', 'cheque', 'card', 'online', 'other'] as const;

export interface ICampaign extends Document {
  tenantId: mongoose.Types.ObjectId;
  type: CampaignType;
  name: string;
  nameMl?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  targetAmount?: number;
  /** Fitr only: amount payable per living member */
  perHeadAmount?: number;
  status: 'draft' | 'active' | 'closed';
  /** Optional income ledger; when set, approved contributions are posted to it */
  ledgerId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    type: { type: String, enum: CAMPAIGN_TYPES, required: true, default: 'custom' },
    name: { type: String, required: [true, 'Campaign name is required'], trim: true },
    nameMl: { type: String, trim: true },
    description: { type: String, trim: true },
    startDate: Date,
    endDate: Date,
    targetAmount: { type: Number, min: 0 },
    perHeadAmount: { type: Number, min: 0 },
    status: { type: String, enum: CAMPAIGN_STATUSES, default: 'draft', index: true },
    ledgerId: { type: Schema.Types.ObjectId, ref: 'Ledger' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
CampaignSchema.index({ tenantId: 1, status: 1, startDate: -1 });

export interface ICampaignContribution extends Document {
  tenantId: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  familyId?: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  donorName?: string;
  /** Hide the donor name on public/top-contributor lists */
  anonymous?: boolean;
  amount: number;
  method: string;
  paymentDate: Date;
  receiptNo: string;
  collectorId?: mongoose.Types.ObjectId;
  status: 'approved' | 'cancelled';
  cancelReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  remarks?: string;
  udhiyaBookingId?: mongoose.Types.ObjectId;
  ledgerPosted?: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignContributionSchema = new Schema<ICampaignContribution>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family' },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    donorName: { type: String, trim: true },
    anonymous: { type: Boolean, default: false },
    amount: { type: Number, required: true, min: [1, 'Amount must be greater than zero'] },
    method: { type: String, default: 'cash' },
    paymentDate: { type: Date, required: true, default: Date.now },
    receiptNo: { type: String, required: true },
    collectorId: { type: Schema.Types.ObjectId, ref: 'Collector' },
    status: { type: String, enum: ['approved', 'cancelled'], default: 'approved', index: true },
    cancelReason: String,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    remarks: String,
    udhiyaBookingId: { type: Schema.Types.ObjectId, ref: 'UdhiyaBooking' },
    ledgerPosted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
CampaignContributionSchema.index({ tenantId: 1, receiptNo: 1 }, { unique: true });
CampaignContributionSchema.index({ tenantId: 1, campaignId: 1, status: 1, paymentDate: 1 });
CampaignContributionSchema.index({ tenantId: 1, paymentDate: 1, method: 1, status: 1 });

export interface IUdhiyaBooking extends Document {
  tenantId: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  animal: 'goat' | 'sheep' | 'cow' | 'buffalo' | 'camel' | 'other';
  /** A cow/buffalo/camel can be shared by up to 7; a goat or sheep is 1 */
  shareCount: number;
  perSharePrice: number;
  participants: Array<{
    _id?: mongoose.Types.ObjectId;
    name: string;
    familyId?: mongoose.Types.ObjectId;
    shares: number;
    paid: boolean;
    contributionId?: mongoose.Types.ObjectId;
  }>;
  collectionDay?: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UdhiyaBookingSchema = new Schema<IUdhiyaBooking>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    animal: { type: String, enum: ['goat', 'sheep', 'cow', 'buffalo', 'camel', 'other'], default: 'cow' },
    shareCount: { type: Number, required: true, min: 1, max: 7, default: 7 },
    perSharePrice: { type: Number, required: true, min: 0 },
    participants: [
      {
        name: { type: String, required: true, trim: true },
        familyId: { type: Schema.Types.ObjectId, ref: 'Family' },
        shares: { type: Number, default: 1, min: 1 },
        paid: { type: Boolean, default: false },
        contributionId: { type: Schema.Types.ObjectId, ref: 'CampaignContribution' },
      },
    ],
    collectionDay: Date,
    note: String,
  },
  { timestamps: true }
);

/** Atomic per-tenant counter for campaign receipts (key 'camp:<tenantId>'). */
const CampaignCounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { collection: 'campaign_counters' });

export const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);
export const CampaignContribution = mongoose.model<ICampaignContribution>('CampaignContribution', CampaignContributionSchema);
export const UdhiyaBooking = mongoose.model<IUdhiyaBooking>('UdhiyaBooking', UdhiyaBookingSchema);
export const CampaignCounter = mongoose.model('CampaignCounter', CampaignCounterSchema);

export const nextCampaignReceiptNo = async (tenantId: string): Promise<string> => {
  const doc: any = await CampaignCounter.findOneAndUpdate(
    { _id: `camp:${tenantId}` } as any,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `CMP-${String(doc.seq).padStart(5, '0')}`;
};
