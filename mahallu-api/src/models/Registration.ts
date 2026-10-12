import mongoose, { Schema, Document } from 'mongoose';

export interface INikahRegistration extends Document {
  tenantId: mongoose.Types.ObjectId;
  groomName: string;
  groomNameMl?: string;
  groomAge?: number;
  groomId?: mongoose.Types.ObjectId; // Member ID
  brideName: string;
  brideNameMl?: string;
  brideAge?: number;
  brideId?: mongoose.Types.ObjectId; // Member ID
  mahallMemberType?: 'groom' | 'bride';
  nikahDate: Date;
  venue?: string;
  mahallId?: string;
  waliName?: string;
  witness1?: string;
  witness2?: string;
  mahrAmount?: number;
  mahrDescription?: string;
  // Certificate data (optional)
  certificateNo?: string;
  certificateIssuedAt?: Date;
  groomFatherName?: string;
  brideFatherName?: string;
  groomAddress?: string;
  brideAddress?: string;
  officiantName?: string;
  approvedBy?: string;
  approvedAt?: Date;
  // Where the bride lives after the nikah. 'stay' (default) moves nobody.
  brideFamilyAction?: 'stay' | 'move' | 'newFamily';
  newFamilyHouseName?: string;
  // Side effects bookkeeping (see services/lifecycleService.ts)
  effectsApplied?: boolean;
  effects?: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDeathRegistration extends Document {
  tenantId: mongoose.Types.ObjectId;
  deceasedName: string;
  deceasedNameMl?: string;
  deceasedId?: mongoose.Types.ObjectId; // Member ID
  deathDate: Date;
  placeOfDeath?: string;
  causeOfDeath?: string;
  mahallId?: string;
  familyId?: mongoose.Types.ObjectId;
  informantName?: string;
  informantRelation?: string;
  informantPhone?: string;
  graveRecordId?: mongoose.Types.ObjectId; // Link to GraveRecord (backward compatible)
  graveId?: mongoose.Types.ObjectId; // Optional grave link chosen at approval (mirrors graveRecordId)
  spouseMemberId?: mongoose.Types.ObjectId; // Optional: explicitly name the surviving spouse
  certificateNo?: string;
  approvedBy?: string;
  approvedAt?: Date;
  previousStatus?: string; // member status before this registration was applied
  effectsApplied?: boolean;
  effects?: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface INOC extends Document {
  tenantId: mongoose.Types.ObjectId;
  applicantName: string;
  applicantNameMl?: string;
  applicantId?: mongoose.Types.ObjectId;
  applicantPhone?: string;
  purposeTitle?: string;
  purposeTitleMl?: string;
  purposeDescription?: string;
  purpose?: string;
  type: 'common' | 'nikah';
  nikahRegistrationId?: mongoose.Types.ObjectId; // For nikah NOC
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  issuedDate?: Date;
  expiryDate?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NikahRegistrationSchema = new Schema<INikahRegistration>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    groomName: { type: String, required: true, trim: true },
    groomNameMl: { type: String, trim: true },
    groomAge: Number,
    groomId: { type: Schema.Types.ObjectId, ref: 'Member' },
    brideName: { type: String, required: true, trim: true },
    brideNameMl: { type: String, trim: true },
    brideAge: Number,
    brideId: { type: Schema.Types.ObjectId, ref: 'Member' },
    mahallMemberType: {
      type: String,
      enum: ['groom', 'bride'],
    },
    nikahDate: { type: Date, required: true },
    venue: { type: String, trim: true },
    mahallId: String,
    waliName: String,
    witness1: String,
    witness2: String,
    mahrAmount: Number,
    mahrDescription: String,
    certificateNo: { type: String, trim: true },
    certificateIssuedAt: Date,
    groomFatherName: { type: String, trim: true },
    brideFatherName: { type: String, trim: true },
    groomAddress: { type: String, trim: true },
    brideAddress: { type: String, trim: true },
    officiantName: { type: String, trim: true },
    approvedBy: { type: String, trim: true },
    approvedAt: Date,
    brideFamilyAction: { type: String, enum: ['stay', 'move', 'newFamily'] },
    newFamilyHouseName: { type: String, trim: true },
    effectsApplied: { type: Boolean, default: undefined },
    effects: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    remarks: String,
  },
  { timestamps: true }
);

const DeathRegistrationSchema = new Schema<IDeathRegistration>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    deceasedName: { type: String, required: true, trim: true },
    deceasedNameMl: { type: String, trim: true },
    deceasedId: { type: Schema.Types.ObjectId, ref: 'Member' },
    deathDate: { type: Date, required: true },
    placeOfDeath: String,
    causeOfDeath: String,
    mahallId: String,
    familyId: { type: Schema.Types.ObjectId, ref: 'Family' },
    informantName: String,
    informantRelation: String,
    informantPhone: String,
    graveRecordId: { type: Schema.Types.ObjectId, ref: 'GraveRecord' },
    graveId: { type: Schema.Types.ObjectId, ref: 'GraveRecord' },
    spouseMemberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    certificateNo: { type: String, trim: true },
    approvedBy: { type: String, trim: true },
    approvedAt: Date,
    previousStatus: String,
    effectsApplied: { type: Boolean, default: undefined },
    effects: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    remarks: String,
  },
  { timestamps: true }
);

const NOCSchema = new Schema<INOC>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    applicantName: { type: String, required: true, trim: true },
    applicantNameMl: { type: String, trim: true },
    applicantId: { type: Schema.Types.ObjectId, ref: 'Member' },
    applicantPhone: String,
    purposeTitle: { type: String, trim: true },
    purposeTitleMl: { type: String, trim: true },
    purposeDescription: { type: String },
    purpose: { type: String, trim: true },
    type: {
      type: String,
      enum: ['common', 'nikah'],
      required: true,
    },
    nikahRegistrationId: { type: Schema.Types.ObjectId, ref: 'NikahRegistration' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    issuedDate: Date,
    expiryDate: Date,
    remarks: String,
    approvedBy: { type: String, trim: true },
  },
  { timestamps: true }
);

export const NikahRegistration = mongoose.model<INikahRegistration>('NikahRegistration', NikahRegistrationSchema);
export const DeathRegistration = mongoose.model<IDeathRegistration>('DeathRegistration', DeathRegistrationSchema);
export const NOC = mongoose.model<INOC>('NOC', NOCSchema);

