import mongoose, { Schema, Document } from 'mongoose';

export interface ISurveyStats {
  totalHouseholds: number;
  totalPopulation: number;
  men: number;
  women: number;
  children: number;
  youth: number;
  seniorCitizens: number;
  students: number;
  married: number;
  unmarried: number;
  employed: number;
  unemployed: number;
  widows: number;
  orphans: number;
  disabled: number;
  familiesNeedingAssistance: number;
}

export interface ISurveySnapshot extends Document {
  tenantId: mongoose.Types.ObjectId;
  surveyDate: Date;
  type: 'comprehensive' | 'annual';
  nextReviewDate: Date;
  stats: ISurveyStats;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const statNumber = { type: Number, default: 0, min: 0 };

const SurveySnapshotSchema = new Schema<ISurveySnapshot>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    surveyDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    type: {
      type: String,
      enum: ['comprehensive', 'annual'],
      default: 'annual',
    },
    // Comprehensive survey renews every 4 years, annual update every year (spec 5.3)
    nextReviewDate: {
      type: Date,
      required: true,
    },
    stats: {
      totalHouseholds: statNumber,
      totalPopulation: statNumber,
      men: statNumber,
      women: statNumber,
      children: statNumber,
      youth: statNumber,
      seniorCitizens: statNumber,
      students: statNumber,
      married: statNumber,
      unmarried: statNumber,
      employed: statNumber,
      unemployed: statNumber,
      widows: statNumber,
      orphans: statNumber,
      disabled: statNumber,
      familiesNeedingAssistance: statNumber,
    },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

SurveySnapshotSchema.index({ tenantId: 1, surveyDate: -1 });
SurveySnapshotSchema.index({ tenantId: 1, nextReviewDate: 1 });

export default mongoose.model<ISurveySnapshot>('SurveySnapshot', SurveySnapshotSchema);
