import mongoose, { Schema, Document } from 'mongoose';
import type { RespondentType, SurveyFormContent } from '../shared/surveyFormEngine';

/**
 * An immutable snapshot of a survey's form, written each time it is published.
 *
 * Every submission records the version it was filled against, so renaming a label, removing an
 * option or deleting a field later never changes how an earlier submission reads.
 */
export interface ISurveyFormVersion extends Document {
  tenantId: mongoose.Types.ObjectId;
  surveyId: mongoose.Types.ObjectId;
  version: number;
  content: SurveyFormContent;
  respondentType: RespondentType;
  publishedAt: Date;
  publishedBy?: mongoose.Types.ObjectId;
}

const SurveyFormVersionSchema = new Schema<ISurveyFormVersion>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    surveyId: { type: Schema.Types.ObjectId, ref: 'SurveyForm', required: true },
    version: { type: Number, required: true, min: 1 },
    content: { type: Schema.Types.Mixed, required: true },
    respondentType: { type: String, enum: ['none', 'family', 'member'], default: 'none' },
    publishedAt: { type: Date, required: true, default: Date.now },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { minimize: false }
);

SurveyFormVersionSchema.index({ surveyId: 1, version: 1 }, { unique: true });

export default mongoose.model<ISurveyFormVersion>('SurveyFormVersion', SurveyFormVersionSchema);
