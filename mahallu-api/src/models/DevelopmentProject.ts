import mongoose, { Schema, Document } from 'mongoose';

export const PROJECT_AREAS = [
  'roads',
  'water',
  'sanitation',
  'environment',
  'education',
  'healthcare',
  'public_facility',
  'govt_scheme',
  'infrastructure',
  'other',
] as const;
export type ProjectArea = (typeof PROJECT_AREAS)[number];

export const PROJECT_STATUSES = ['proposed', 'approved', 'in_progress', 'completed', 'dropped'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface IDevelopmentProject extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  area: ProjectArea;
  proposal?: string;
  estimatedCost: number;
  fundingSource?: string;
  responsibleTeam?: string;
  committeeId?: mongoose.Types.ObjectId;
  startDate?: Date;
  targetDate?: Date;
  progressPercent: number;
  status: ProjectStatus;
  completionReport?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DevelopmentProjectSchema = new Schema<IDevelopmentProject>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    name: { type: String, required: [true, 'Project name is required'], trim: true },
    nameMl: { type: String, trim: true },
    area: {
      type: String,
      enum: PROJECT_AREAS,
      required: [true, 'Project area is required'],
      index: true,
    },
    proposal: { type: String, trim: true },
    estimatedCost: { type: Number, required: [true, 'Estimated cost is required'], min: 0 },
    fundingSource: { type: String, trim: true },
    responsibleTeam: { type: String, trim: true },
    committeeId: { type: Schema.Types.ObjectId, ref: 'Committee', index: true },
    startDate: Date,
    targetDate: Date,
    progressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'proposed',
      index: true,
    },
    completionReport: String,
  },
  { timestamps: true }
);

// Compound indexes for pagination and filtering
DevelopmentProjectSchema.index({ tenantId: 1, status: 1 });
DevelopmentProjectSchema.index({ tenantId: 1, area: 1 });
DevelopmentProjectSchema.index({ tenantId: 1, createdAt: -1 });

export const DevelopmentProject = mongoose.model<IDevelopmentProject>(
  'DevelopmentProject',
  DevelopmentProjectSchema
);
