import mongoose, { Schema, Document } from 'mongoose';
import type { Answers } from '../shared/surveyFormEngine';

export const SUBMISSION_STATUSES = ['draft', 'pending', 'accepted', 'rejected'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface ISubmissionHistory {
  status: SubmissionStatus;
  note?: string;
  by?: mongoose.Types.ObjectId;
  byName?: string;
  at: Date;
}

/**
 * One filled survey form.
 *
 * `draft` is a form a survey worker started and saved; it becomes `pending` on submit and waits for
 * a Mahallu admin to accept or reject it. Answers live in one flat map keyed `field_<id>` and are
 * read against `versionId`, the form version they were filled on.
 */
export interface ISurveySubmission extends Document {
  tenantId: mongoose.Types.ObjectId;
  surveyId: mongoose.Types.ObjectId;
  versionId: mongoose.Types.ObjectId;
  version: number;
  status: SubmissionStatus;
  answers: Answers;
  familyId?: mongoose.Types.ObjectId | null;
  memberId?: mongoose.Types.ObjectId | null;
  /** House or member name at the time of the survey, for listing and search. */
  respondentName?: string;
  submittedBy: mongoose.Types.ObjectId;
  submittedByName?: string;
  submittedAt?: Date | null;
  /** Draft only: the page the surveyor was on. */
  currentPage: number;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedByName?: string;
  reviewedAt?: Date | null;
  reviewNote?: string;
  history: ISubmissionHistory[];
  /** DocumentFile ids referenced by file and photo answers. */
  attachments: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const HistorySchema = new Schema<ISubmissionHistory>(
  {
    status: { type: String, enum: SUBMISSION_STATUSES, required: true },
    note: { type: String, trim: true, maxlength: 1000 },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, trim: true, maxlength: 200 },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const SurveySubmissionSchema = new Schema<ISurveySubmission>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    surveyId: { type: Schema.Types.ObjectId, ref: 'SurveyForm', required: true },
    versionId: { type: Schema.Types.ObjectId, ref: 'SurveyFormVersion', required: true },
    version: { type: Number, required: true, min: 1 },
    status: { type: String, enum: SUBMISSION_STATUSES, default: 'draft' },
    answers: { type: Schema.Types.Mixed, default: () => ({}) },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family', default: null },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
    respondentName: { type: String, trim: true, maxlength: 300 },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submittedByName: { type: String, trim: true, maxlength: 200 },
    submittedAt: { type: Date, default: null },
    currentPage: { type: Number, default: 0, min: 0 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedByName: { type: String, trim: true, maxlength: 200 },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 1000 },
    history: { type: [HistorySchema], default: [] },
    attachments: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }],
  },
  { timestamps: true, minimize: false }
);

SurveySubmissionSchema.index({ tenantId: 1, surveyId: 1, status: 1, submittedAt: -1 });
SurveySubmissionSchema.index({ surveyId: 1, submittedBy: 1, status: 1, updatedAt: -1 });

export default mongoose.model<ISurveySubmission>('SurveySubmission', SurveySubmissionSchema);
