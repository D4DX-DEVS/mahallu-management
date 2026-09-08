import mongoose, { Schema, Document } from 'mongoose';
import { calculateAge } from '../utils/age';

export interface IMember extends Document {
  tenantId: mongoose.Types.ObjectId; // Required for multi-tenancy
  mahallId?: string;
  name: string;
  nameMl?: string;
  familyId: mongoose.Types.ObjectId;
  familyName: string;
  age?: number;
  dateOfBirth?: Date; // When set, `age` is derived from it on save
  gender?: string; // Category key: 'gender'
  bloodGroup?: string;
  healthStatus?: string;
  healthNotes?: string; // Free-text illness/condition details, captured when healthStatus is not 'healthy'
  phone?: string;
  education?: string;
  educationInstitutionId?: mongoose.Types.ObjectId; // Institute the member studies in (madrasa etc.)
  localityFacilityId?: mongoose.Types.ObjectId; // External school/college, picked from the locality registry
  externalInstitution?: string; // Free-text external school/college, for one not in the locality registry
  maritalStatus?: string; // Category key: 'marital_status'
  marriageCount?: number;
  isOrphan?: boolean;
  isDead?: boolean;
  isFamilyHead?: boolean;
  relationship?: string; // Category key: 'relationship'
  relationshipOther?: string; // Free-text relationship, captured when relationship is 'other'
  // Socio-economic profile (spec 5/7) - all optional, older documents stay valid
  occupation?: string;
  occupationSector?: string; // Category key: 'occupation_sector'
  monthlyIncomeRange?: string; // Category key: 'monthly_income_range'
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
      required: [true, 'Please select a Mahallu before continuing.'],
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
    dateOfBirth: {
      type: Date,
    },
    gender: {
      // Valid values now come from the Category system (key: 'gender') and
      // are enforced by validCategoryValue in memberValidation.ts.
      type: String,
    },
    bloodGroup: {
      // Category key: 'blood_group'.
      type: String,
    },
    healthStatus: {
      type: String,
      trim: true,
    },
    healthNotes: {
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
    externalInstitution: {
      type: String,
      trim: true,
    },
    maritalStatus: {
      // Category key: 'marital_status'.
      type: String,
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
      // Category key: 'relationship'.
      type: String,
    },
    relationshipOther: {
      type: String,
      trim: true,
    },
    occupation: {
      type: String,
      trim: true,
    },
    occupationSector: {
      // Category key: 'occupation_sector'.
      type: String,
    },
    monthlyIncomeRange: {
      // Category key: 'monthly_income_range'.
      type: String,
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

/** A known date of birth is the source of truth for age. */
MemberSchema.pre('save', function (next) {
  if (this.isModified('dateOfBirth') && this.dateOfBirth) {
    const derived = calculateAge(this.dateOfBirth);
    if (derived !== undefined) this.age = derived;
  }
  next();
});

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

