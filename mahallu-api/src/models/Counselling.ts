import mongoose, { Schema, Document } from 'mongoose';

// CounsellingCase Constants
export const COUNSELLING_CATEGORIES = [
  'marriage',
  'family',
  'adolescent',
  'education',
  'parenting',
  'behaviour',
  'career',
] as const;
export type CounsellingCategory = (typeof COUNSELLING_CATEGORIES)[number];

export const COUNSELLING_STATUSES = ['open', 'in_progress', 'follow_up', 'closed'] as const;
export type CounsellingStatus = (typeof COUNSELLING_STATUSES)[number];

// DisputeCase Constants
export const DISPUTE_TYPES = [
  'family',
  'marriage',
  'divorce',
  'community',
  'inheritance',
  'other',
] as const;
export type DisputeType = (typeof DISPUTE_TYPES)[number];

export const DISPUTE_STATUSES = ['registered', 'mediation', 'resolved', 'referred', 'closed'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

// InheritanceCase Constants
export const INHERITANCE_STATUSES = ['reported', 'documentation', 'referred', 'distributed', 'closed'] as const;
export type InheritanceStatus = (typeof INHERITANCE_STATUSES)[number];

/**
 * CounsellingCase: Track counselling sessions for various family/personal issues.
 * - Can be anonymous (clientMemberId + clientName, require at least one)
 * - Tracks session notes over time
 */
export interface ICounsellingCase extends Document {
  tenantId: mongoose.Types.ObjectId;
  caseNo: string; // Auto-generated per tenant (CNS-0001, CNS-0002, etc.)
  category: CounsellingCategory;
  clientMemberId?: mongoose.Types.ObjectId; // Optional, may be anonymous
  clientName?: string; // For anonymous clients
  counsellorName: string;
  appointmentDate: Date;
  status: CounsellingStatus;
  sessionNotes: Array<{
    date: Date;
    note: string;
    addedBy: string; // user name or id
  }>;
  closureNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CounsellingCaseSchema = new Schema<ICounsellingCase>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    caseNo: {
      type: String,
      required: [true, 'Case number is required'],
      index: true,
    },
    category: {
      type: String,
      enum: COUNSELLING_CATEGORIES,
      required: [true, 'Category is required'],
      index: true,
    },
    clientMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      index: true,
    },
    clientName: {
      type: String,
      trim: true,
    },
    counsellorName: {
      type: String,
      required: [true, 'Counsellor name is required'],
      trim: true,
    },
    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required'],
      index: true,
    },
    status: {
      type: String,
      enum: COUNSELLING_STATUSES,
      default: 'open',
      index: true,
    },
    sessionNotes: [
      {
        date: { type: Date, default: Date.now },
        note: String,
        addedBy: String,
      },
    ],
    closureNotes: String,
  },
  { timestamps: true }
);

CounsellingCaseSchema.index({ tenantId: 1, status: 1 });
CounsellingCaseSchema.index({ tenantId: 1, category: 1 });
CounsellingCaseSchema.index({ tenantId: 1, appointmentDate: -1 });

/**
 * DisputeCase (Maslahat): Track community/family disputes and mediation efforts.
 */
export interface IDisputeCase extends Document {
  tenantId: mongoose.Types.ObjectId;
  caseNo: string; // Auto-generated per tenant (MSL-0001, MSL-0002, etc.)
  type: DisputeType;
  parties: string[]; // Names of involved parties
  description: string;
  mediators: string[]; // Names of mediators
  status: DisputeStatus;
  resolutionNotes?: string;
  referredTo?: string; // If referred to scholar/authority
  createdAt: Date;
  updatedAt: Date;
}

const DisputeCaseSchema = new Schema<IDisputeCase>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    caseNo: {
      type: String,
      required: [true, 'Case number is required'],
      index: true,
    },
    type: {
      type: String,
      enum: DISPUTE_TYPES,
      required: [true, 'Dispute type is required'],
      index: true,
    },
    parties: {
      type: [String],
      required: [true, 'Parties involved are required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    mediators: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: DISPUTE_STATUSES,
      default: 'registered',
      index: true,
    },
    resolutionNotes: String,
    referredTo: String,
  },
  { timestamps: true }
);

DisputeCaseSchema.index({ tenantId: 1, status: 1 });
DisputeCaseSchema.index({ tenantId: 1, type: 1 });

/**
 * InheritanceCase: Track inheritance-related matters.
 * System tracks only — no rulings issued.
 */
export interface IInheritanceCase extends Document {
  tenantId: mongoose.Types.ObjectId;
  caseNo: string; // Auto-generated per tenant (INH-0001, INH-0002, etc.)
  deceasedMemberId?: mongoose.Types.ObjectId;
  deceasedName?: string; // Required if no member ID
  deathRegistrationId?: mongoose.Types.ObjectId; // Ref to death registration if available
  heirs: Array<{
    name: string;
    relation: string;
    contactNo?: string;
  }>;
  status: InheritanceStatus;
  referredScholar?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InheritanceCaseSchema = new Schema<IInheritanceCase>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    caseNo: {
      type: String,
      required: [true, 'Case number is required'],
      index: true,
    },
    deceasedMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      index: true,
    },
    deceasedName: String,
    deathRegistrationId: {
      type: Schema.Types.ObjectId,
      ref: 'DeathRegistration',
      index: true,
    },
    heirs: [
      {
        name: { type: String, required: true },
        relation: { type: String, required: true },
        contactNo: String,
      },
    ],
    status: {
      type: String,
      enum: INHERITANCE_STATUSES,
      default: 'reported',
      index: true,
    },
    referredScholar: String,
    notes: String,
  },
  { timestamps: true }
);

InheritanceCaseSchema.index({ tenantId: 1, status: 1 });

export const CounsellingCase = mongoose.model<ICounsellingCase>(
  'CounsellingCase',
  CounsellingCaseSchema
);
export const DisputeCase = mongoose.model<IDisputeCase>('DisputeCase', DisputeCaseSchema);
export const InheritanceCase = mongoose.model<IInheritanceCase>(
  'InheritanceCase',
  InheritanceCaseSchema
);
