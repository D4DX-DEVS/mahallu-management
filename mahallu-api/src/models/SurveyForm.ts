import mongoose, { Schema, Document } from 'mongoose';
import type { RespondentType, SurveyFormContent } from '../shared/surveyFormEngine';

export const SURVEY_TYPES = [
  'household',
  'demographic',
  'welfare',
  'education',
  'health',
  'employment',
  'feedback',
  'other',
] as const;
export type SurveyType = (typeof SURVEY_TYPES)[number];

export const SURVEY_STATUSES = ['draft', 'published', 'closed'] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];

export const RESPONDENT_TYPES: readonly RespondentType[] = ['none', 'family', 'member'];

/**
 * A configurable survey: its details, the form being edited in the builder (`draft`) and a pointer
 * to the version survey workers fill (`publishedVersionId`).
 *
 * The draft is stored as Mixed and always passes through `normalizeFormContent` and
 * `validateFormStructure` first: a Mongoose sub-schema would silently drop any field property it
 * does not list, and the engine is the one place that knows the shape.
 */
export interface ISurveyForm extends Document {
  tenantId: mongoose.Types.ObjectId;
  title: string;
  type: SurveyType;
  description?: string;
  startDate: Date;
  endDate?: Date | null;
  targetCount?: number | null;
  respondentType: RespondentType;
  status: SurveyStatus;
  draft: SurveyFormContent;
  /** Next field / page id the builder hands out. Never decreases, so an id is never reused. */
  nextFieldId: number;
  nextPageId: number;
  /** Bumped on every builder save; a save sent with an older revision is refused (409). */
  revision: number;
  publishedVersion: number;
  publishedVersionId?: mongoose.Types.ObjectId | null;
  publishedAt?: Date | null;
  hasUnpublishedChanges: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SurveyFormSchema = new Schema<ISurveyForm>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: SURVEY_TYPES, default: 'household' },
    description: { type: String, trim: true, maxlength: 2000 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    targetCount: { type: Number, min: 1, max: 1_000_000, default: null },
    respondentType: { type: String, enum: RESPONDENT_TYPES, default: 'none' },
    status: { type: String, enum: SURVEY_STATUSES, default: 'draft', index: true },
    draft: { type: Schema.Types.Mixed, default: () => ({ pages: [], instructions: [] }) },
    nextFieldId: { type: Number, default: 1, min: 1 },
    nextPageId: { type: Number, default: 1, min: 1 },
    revision: { type: Number, default: 0, min: 0 },
    publishedVersion: { type: Number, default: 0, min: 0 },
    publishedVersionId: { type: Schema.Types.ObjectId, ref: 'SurveyFormVersion', default: null },
    publishedAt: { type: Date, default: null },
    hasUnpublishedChanges: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false }
);

SurveyFormSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export default mongoose.model<ISurveyForm>('SurveyForm', SurveyFormSchema);
