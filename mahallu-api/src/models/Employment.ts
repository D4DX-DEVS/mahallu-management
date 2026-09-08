import mongoose, { Schema, Document } from 'mongoose';

export const EMPLOYMENT_OUTCOMES = ['none', 'employed', 'self_employed'] as const;
export type EmploymentOutcome = (typeof EMPLOYMENT_OUTCOMES)[number];

export interface IEmployer extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  businessType?: string;
  contactPerson?: string;
  contactNo?: string;
  location?: string;
  memberId?: mongoose.Types.ObjectId; // Optional - employer who is a member
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const EmployerSchema = new Schema<IEmployer>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    name: { type: String, required: [true, 'Employer name is required'], trim: true },
    businessType: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    contactNo: { type: String, trim: true },
    location: { type: String, trim: true },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', index: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

EmployerSchema.index({ tenantId: 1, status: 1 });
EmployerSchema.index({ tenantId: 1, name: 1 });

export interface IJobVacancy extends Document {
  tenantId: mongoose.Types.ObjectId;
  employerId?: mongoose.Types.ObjectId; // Optional ref to Employer
  employerName?: string; // Optional free-text fallback for one-off posts
  title: string;
  location?: string;
  skillsRequired: string[];
  salaryRange?: string;
  status: 'open' | 'filled' | 'closed';
  postedDate: Date;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobVacancySchema = new Schema<IJobVacancy>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    employerId: { type: Schema.Types.ObjectId, ref: 'Employer', index: true },
    employerName: { type: String, trim: true },
    title: { type: String, required: [true, 'Job title is required'], trim: true },
    location: { type: String, trim: true },
    skillsRequired: { type: [String], default: [] },
    salaryRange: { type: String, trim: true },
    status: { type: String, enum: ['open', 'filled', 'closed'], default: 'open' },
    postedDate: { type: Date, default: Date.now },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

JobVacancySchema.index({ tenantId: 1, status: 1 });
JobVacancySchema.index({ tenantId: 1, employerId: 1 });
JobVacancySchema.index({ tenantId: 1, postedDate: -1 });

// Validate that either employerId or employerName is present
JobVacancySchema.pre('save', function (next) {
  if (!this.employerId && !this.employerName) {
    next(new Error('Either employerId or employerName must be provided'));
  } else {
    next();
  }
});

export interface ISkillTrainingParticipant {
  memberId: mongoose.Types.ObjectId;
  certificateIssued?: boolean;
  employmentOutcome?: EmploymentOutcome;
}

export interface ISkillTraining extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  trainerName?: string;
  startDate: Date;
  endDate: Date;
  participants: ISkillTrainingParticipant[];
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const SkillTrainingSchema = new Schema<ISkillTraining>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    name: { type: String, required: [true, 'Training name is required'], trim: true },
    trainerName: { type: String, trim: true },
    startDate: { type: Date, required: [true, 'Start date is required'] },
    endDate: { type: Date, required: [true, 'End date is required'] },
    participants: [
      {
        memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
        certificateIssued: { type: Boolean, default: false },
        employmentOutcome: {
          type: String,
          enum: EMPLOYMENT_OUTCOMES,
          default: 'none',
        },
      },
    ],
    status: { type: String, enum: ['planned', 'ongoing', 'completed', 'cancelled'], default: 'planned' },
  },
  { timestamps: true }
);

SkillTrainingSchema.index({ tenantId: 1, status: 1 });
SkillTrainingSchema.index({ tenantId: 1, startDate: -1 });

export const Employer = mongoose.model<IEmployer>('Employer', EmployerSchema);
export const JobVacancy = mongoose.model<IJobVacancy>('JobVacancy', JobVacancySchema);
export const SkillTraining = mongoose.model<ISkillTraining>('SkillTraining', SkillTrainingSchema);
