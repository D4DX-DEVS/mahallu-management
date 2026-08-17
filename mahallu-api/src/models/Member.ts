import mongoose, { Schema, Document } from 'mongoose';

export interface IMember extends Document {
  tenantId: mongoose.Types.ObjectId; // Required for multi-tenancy
  mahallId?: string;
  name: string;
  nameMl?: string;
  familyId: mongoose.Types.ObjectId;
  familyName: string;
  age?: number;
  gender?: 'male' | 'female';
  bloodGroup?: string;
  healthStatus?: string;
  phone?: string;
  education?: string;
  educationInstitutionId?: mongoose.Types.ObjectId; // Institute the member studies in (madrasa etc.)
  localityFacilityId?: mongoose.Types.ObjectId; // External school/college from the locality registry
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  marriageCount?: number;
  isOrphan?: boolean;
  isDead?: boolean;
  isFamilyHead?: boolean;
  relationship?: 'head' | 'spouse' | 'son' | 'daughter' | 'father' | 'mother' | 'other';
  // Socio-economic profile (spec 5/7) - all optional, older documents stay valid
  occupation?: string;
  occupationSector?: 'government' | 'private' | 'self_employed' | 'abroad' | 'unemployed' | 'student' | 'homemaker' | 'retired' | 'none';
  monthlyIncomeRange?: 'none' | 'below_10k' | '10k_25k' | '25k_50k' | 'above_50k';
  skills?: string[];
  isJobSeeker?: boolean;
  isZakatPayer?: boolean;
  isZakatEligible?: boolean;
  isWidow?: boolean;
  hasDisability?: boolean;
  disabilityDetails?: string;
  isMarriageable?: boolean;
  isVolunteer?: boolean;
  volunteerSkills?: string[];
  status: 'active' | 'inactive' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    mahallId: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    nameMl: {
      type: String,
      trim: true,
    },
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
      required: [true, 'Family ID is required'],
    },
    familyName: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
    },
    bloodGroup: {
      type: String,
      enum: ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'],
    },
    healthStatus: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    education: {
      type: String,
      trim: true,
    },
    educationInstitutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      index: true,
    },
    localityFacilityId: {
      type: Schema.Types.ObjectId,
      ref: 'LocalityFacility',
      index: true,
    },
    maritalStatus: {
      type: String,
      enum: ['single', 'married', 'divorced', 'widowed'],
    },
    marriageCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    isOrphan: {
      type: Boolean,
      default: false,
    },
    isDead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFamilyHead: {
      type: Boolean,
      default: false,
      index: true,
    },
    relationship: {
      type: String,
      enum: ['head', 'spouse', 'son', 'daughter', 'father', 'mother', 'other'],
    },
    occupation: {
      type: String,
      trim: true,
    },
    occupationSector: {
      type: String,
      enum: ['government', 'private', 'self_employed', 'abroad', 'unemployed', 'student', 'homemaker', 'retired', 'none'],
    },
    monthlyIncomeRange: {
      type: String,
      enum: ['none', 'below_10k', '10k_25k', '25k_50k', 'above_50k'],
    },
    skills: {
      type: [String],
      default: undefined,
    },
    isJobSeeker: { type: Boolean, default: false, index: true },
    isZakatPayer: { type: Boolean, default: false, index: true },
    isZakatEligible: { type: Boolean, default: false, index: true },
    isWidow: { type: Boolean, default: false },
    hasDisability: { type: Boolean, default: false },
    disabilityDetails: { type: String, trim: true },
    isMarriageable: { type: Boolean, default: false, index: true },
    isVolunteer: { type: Boolean, default: false, index: true },
    volunteerSkills: {
      type: [String],
      default: undefined,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'deleted'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * A widowed female member defaults to isWidow=true. It is an ASSIST, not a rule:
 * admins can untick it, and re-saving never overwrites an explicit value.
 */
MemberSchema.pre('save', function (next) {
  if (this.isModified('maritalStatus') && this.maritalStatus === 'widowed' && this.gender === 'female' && this.isWidow !== true) {
    if (!this.isModified('isWidow')) {
      this.isWidow = true;
    }
  }
  next();
});

// Register queries filter on tenant + flag + status
MemberSchema.index({ tenantId: 1, status: 1 });
MemberSchema.index({ tenantId: 1, occupationSector: 1 });

export default mongoose.model<IMember>('Member', MemberSchema);

