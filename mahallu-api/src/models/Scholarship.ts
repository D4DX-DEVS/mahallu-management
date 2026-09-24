import mongoose, { Schema, Document } from 'mongoose';

export const SCHOLARSHIP_STATUSES = ['active', 'closed'] as const;
export type ScholarshipStatus = (typeof SCHOLARSHIP_STATUSES)[number];

export const AWARD_STATUSES = ['applied', 'approved', 'paid'] as const;
export type AwardStatus = (typeof AWARD_STATUSES)[number];

export const SUPPORT_CASE_TYPES = [
  'career_guidance',
  'competitive_exam',
  'dropout_risk',
  'tuition',
  'remedial',
  'academic_award',
] as const;
export type SupportCaseType = (typeof SUPPORT_CASE_TYPES)[number];

export const SUPPORT_CASE_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type SupportCaseStatus = (typeof SUPPORT_CASE_STATUSES)[number];

export interface IScholarship extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  amount: number;
  academicYear: string;
  criteria?: string;
  status: ScholarshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ScholarshipSchema = new Schema<IScholarship>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    name: { type: String, required: [true, 'Scholarship name is required'], trim: true },
    nameMl: { type: String, trim: true },
    amount: { type: Number, required: [true, 'Amount is required'], min: 0 },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      index: true,
    },
    criteria: { type: String, trim: true },
    status: { type: String, enum: SCHOLARSHIP_STATUSES, default: 'active', index: true },
  },
  { timestamps: true }
);

ScholarshipSchema.index({ tenantId: 1, status: 1 });
ScholarshipSchema.index({ tenantId: 1, academicYear: 1 });

export interface IScholarshipAward extends Document {
  tenantId: mongoose.Types.ObjectId;
  scholarshipId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  awardedDate: Date;
  amount: number;
  status: AwardStatus;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScholarshipAwardSchema = new Schema<IScholarshipAward>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    scholarshipId: {
      type: Schema.Types.ObjectId,
      ref: 'Scholarship',
      required: [true, 'Scholarship is required'],
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Student member is required'],
      index: true,
    },
    awardedDate: { type: Date, default: Date.now, index: true },
    amount: { type: Number, required: [true, 'Amount is required'], min: 0 },
    status: { type: String, enum: AWARD_STATUSES, default: 'applied', index: true },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

ScholarshipAwardSchema.index({ tenantId: 1, scholarshipId: 1 });
ScholarshipAwardSchema.index({ tenantId: 1, status: 1 });
ScholarshipAwardSchema.index({ tenantId: 1, memberId: 1 });

export interface IAcademicSupportCase extends Document {
  tenantId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  type: SupportCaseType;
  description: string;
  mentorName?: string;
  startDate: Date;
  status: SupportCaseStatus;
  outcome?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicSupportCaseSchema = new Schema<IAcademicSupportCase>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Member is required'],
      index: true,
    },
    type: {
      type: String,
      enum: SUPPORT_CASE_TYPES,
      required: [true, 'Support case type is required'],
      index: true,
    },
    description: { type: String, required: [true, 'Description is required'], trim: true },
    mentorName: { type: String, trim: true },
    startDate: { type: Date, default: Date.now, index: true },
    status: { type: String, enum: SUPPORT_CASE_STATUSES, default: 'open', index: true },
    outcome: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

AcademicSupportCaseSchema.index({ tenantId: 1, type: 1 });
AcademicSupportCaseSchema.index({ tenantId: 1, status: 1 });
AcademicSupportCaseSchema.index({ tenantId: 1, memberId: 1 });

export const Scholarship = mongoose.model<IScholarship>('Scholarship', ScholarshipSchema);
export const ScholarshipAward = mongoose.model<IScholarshipAward>(
  'ScholarshipAward',
  ScholarshipAwardSchema
);
export const AcademicSupportCase = mongoose.model<IAcademicSupportCase>(
  'AcademicSupportCase',
  AcademicSupportCaseSchema
);
