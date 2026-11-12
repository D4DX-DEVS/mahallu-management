import { Response } from 'express';
import mongoose from 'mongoose';
import SurveyForm, { ISurveyForm } from '../models/SurveyForm';
import SurveyFormVersion, { ISurveyFormVersion } from '../models/SurveyFormVersion';
import SurveySubmission, { ISurveySubmission, SubmissionStatus } from '../models/SurveySubmission';
import Family from '../models/Family';
import Member from '../models/Member';
import DocumentFile from '../models/DocumentFile';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';
import { csvEscape } from './exportController';
import { getSignedDownloadUrl } from '../services/uploadService';
import {
  Answers,
  FIELD_TYPES,
  SurveyFormContent,
  allFields,
  answerKey,
  fileDocumentIds,
  formatAnswer,
  maxIds,
  normalizeAnswers,
  normalizeFormContent,
  sanitizeAnswers,
  validateAnswers,
  validateFormStructure,
} from '../shared/surveyFormEngine';

/* ------------------------------------------------------------------------------------------------
 * Scope and access
 * ---------------------------------------------------------------------------------------------- */

const NOT_FOUND = "We couldn't find that survey. It may have been removed.";
const SUBMISSION_NOT_FOUND = "We couldn't find that response. It may have been removed.";
const NO_TENANT = 'Please select a Mahallu before continuing.';

const GLOBAL_LOCKED = 'This survey is shared with all Mahallus. Only the Super Admin can change it.';

const isAdmin = (req: AuthRequest): boolean => req.isSuperAdmin === true || req.user?.role === 'mahall';
const isGlobal = (survey: Pick<ISurveyForm, 'scope'>): boolean => survey.scope === 'global';

/** Tenant filter for this request. A Super Admin with no Mahallu selected reads across all of them. */
const scoped = (req: AuthRequest, extra: Record<string, unknown> = {}) =>
  req.tenantId ? { ...extra, tenantId: req.tenantId } : extra;

const userId = (req: AuthRequest) => req.user?._id;
const userName = (req: AuthRequest): string => String(req.user?.name || req.user?.username || 'Staff').slice(0, 200);

/** Surveys survey workers may see: never the ones still being set up. */
const VISIBLE_TO_WORKERS = ['published', 'closed'];

/**
 * The surveys this request can see: its own Mahallu's, plus the global ones. Outside the Super Admin,
 * a global survey shows only once published, so nobody fills a form the Super Admin is still building.
 * A Super Admin with no Mahallu selected sees every survey.
 */
const visibleSurveys = (req: AuthRequest, extra: Record<string, unknown> = {}) => {
  if (!req.tenantId) return extra;
  const global = req.isSuperAdmin ? { scope: 'global' } : { scope: 'global', status: { $in: VISIBLE_TO_WORKERS } };
  return { ...extra, $or: [{ tenantId: req.tenantId }, global] };
};

const loadSurvey = async (req: AuthRequest, id: string): Promise<ISurveyForm | null> => {
  const survey = await SurveyForm.findOne(visibleSurveys(req, { _id: id }));
  if (!survey) return null;
  if (!isAdmin(req) && !VISIBLE_TO_WORKERS.includes(survey.status)) return null;
  return survey;
};

/** Who may change a survey's details, form and status: its Mahallu's admins, or for a global survey the Super Admin. */
const canManage = (req: AuthRequest, survey: Pick<ISurveyForm, 'scope'>): boolean =>
  isGlobal(survey) ? req.isSuperAdmin === true : isAdmin(req);

/** Loads a survey the caller may manage; answers 404 / 403 itself and returns null otherwise. */
const loadManagedSurvey = async (req: AuthRequest, res: Response, id: string): Promise<ISurveyForm | null> => {
  const survey = await loadSurvey(req, id);
  if (!survey) {
    res.status(404).json({ success: false, message: NOT_FOUND });
    return null;
  }
  if (!canManage(req, survey)) {
    res.status(403).json({ success: false, message: GLOBAL_LOCKED });
    return null;
  }
  return survey;
};

const asObjectId = (id: unknown) => new mongoose.Types.ObjectId(String(id));

/**
 * Which responses of a survey this request may read. Responses are always stored under the Mahallu
 * that filled them, so a request inside a Mahallu reads that Mahallu's responses only, global survey
 * or not. Only a Super Admin with no Mahallu selected reads a global survey's responses from all of
 * them. ObjectIds, because the same filter also feeds aggregations, which do not cast.
 */
const responseScope = (req: AuthRequest, survey: ISurveyForm): Record<string, unknown> => {
  if (req.tenantId) return { tenantId: asObjectId(req.tenantId) };
  return isGlobal(survey) ? {} : { tenantId: survey.tenantId };
};

/** The Mahallu a new response belongs to: the survey's own, or for a global survey the filler's. */
const fillTenantOf = (req: AuthRequest, survey: ISurveyForm): mongoose.Types.ObjectId | null => {
  if (!isGlobal(survey)) return survey.tenantId;
  return req.tenantId ? asObjectId(req.tenantId) : null;
};

/** A survey worker sees only their own responses; an admin sees every response in the Mahallu. */
const loadSubmission = async (req: AuthRequest, id: string): Promise<ISurveySubmission | null> => {
  const submission = await SurveySubmission.findOne(scoped(req, { _id: id }));
  if (!submission) return null;
  if (!isAdmin(req) && String(submission.submittedBy) !== String(userId(req))) return null;
  return submission;
};

/* ------------------------------------------------------------------------------------------------
 * Dates and the fill window
 * ---------------------------------------------------------------------------------------------- */

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Kolkata';

/** Today's calendar date where the Mahallu is, as YYYY-MM-DD. */
const todayIso = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(new Date());
const isoDate = (d?: Date | null): string | null => (d ? new Date(d).toISOString().slice(0, 10) : null);

export type FillState = 'draft' | 'scheduled' | 'open' | 'ended' | 'closed';

/** Whether survey workers can submit right now, and if not, why. */
export const fillStateOf = (survey: Pick<ISurveyForm, 'status' | 'startDate' | 'endDate' | 'publishedVersion'>): FillState => {
  if (survey.status === 'draft' || !survey.publishedVersion) return 'draft';
  if (survey.status === 'closed') return 'closed';
  const today = todayIso();
  const start = isoDate(survey.startDate);
  const end = isoDate(survey.endDate || null);
  if (start && today < start) return 'scheduled';
  if (end && today > end) return 'ended';
  return 'open';
};

const FILL_BLOCKED: Record<Exclude<FillState, 'open'>, string> = {
  draft: 'This survey has not been published yet.',
  scheduled: 'This survey has not started yet.',
  ended: 'This survey period has ended.',
  closed: 'This survey is closed to new responses.',
};

/** A YYYY-MM-DD body value as a Date at midnight UTC, so the calendar day never shifts. */
const toDate = (value: unknown): Date | null => {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/* ------------------------------------------------------------------------------------------------
 * Serialising
 * ---------------------------------------------------------------------------------------------- */

const surveySummary = (req: AuthRequest, survey: ISurveyForm, extra: Record<string, unknown> = {}) => {
  const plain = survey.toObject({ versionKey: false }) as unknown as Record<string, unknown>;
  delete plain.draft;
  return { ...plain, scope: survey.scope || 'mahallu', fillState: fillStateOf(survey), canManage: canManage(req, survey), ...extra };
};

/**
 * Response counts per survey: by status for admins, the caller's own for survey workers. Always
 * inside the caller's Mahallu, so a global survey never shows another Mahallu's numbers.
 */
const countsBySurvey = async (req: AuthRequest, surveyIds: mongoose.Types.ObjectId[]) => {
  const match: Record<string, unknown> = { surveyId: { $in: surveyIds } };
  if (req.tenantId) match.tenantId = asObjectId(req.tenantId);
  if (!isAdmin(req)) match.submittedBy = userId(req);
  const rows: Array<{ _id: { surveyId: mongoose.Types.ObjectId; status: SubmissionStatus }; n: number }> =
    await SurveySubmission.aggregate([
      { $match: match },
      { $group: { _id: { surveyId: '$surveyId', status: '$status' }, n: { $sum: 1 } } },
    ]);
  const out = new Map<string, Record<SubmissionStatus | 'responses', number>>();
  for (const id of surveyIds) out.set(String(id), { draft: 0, pending: 0, accepted: 0, rejected: 0, responses: 0 });
  for (const row of rows) {
    const entry = out.get(String(row._id.surveyId));
    if (!entry) continue;
    entry[row._id.status] = row.n;
    if (row._id.status !== 'draft') entry.responses += row.n;
  }
  return out;
};

/* ------------------------------------------------------------------------------------------------
 * Surveys
 * ---------------------------------------------------------------------------------------------- */

export const listSurveys = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: Record<string, any> = visibleSurveys(req);
    const { status, type, search, scope } = req.query;
    if (scope === 'global' || scope === 'mahallu') query.scope = scope === 'global' ? 'global' : { $ne: 'global' };
    if (type) query.type = type;
    if (status) query.status = status;
    if (!isAdmin(req)) {
      query.status = status && VISIBLE_TO_WORKERS.includes(String(status)) ? status : { $in: VISIBLE_TO_WORKERS };
    }
    if (search) query.title = { $regex: regexLiteral(search), $options: 'i' };

    const [surveys, total] = await Promise.all([
      SurveyForm.find(query).select('-draft').sort({ createdAt: -1 }).skip(skip).limit(limit),
      SurveyForm.countDocuments(query),
    ]);
    const counts = await countsBySurvey(req, surveys.map((s) => s._id as mongoose.Types.ObjectId));
    const data = surveys.map((survey) => surveySummary(req, survey, { counts: counts.get(String(survey._id)) }));
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error) {
    sendFailure(res, error, "We couldn't load the surveys right now. Please try again.");
  }
};

const surveyDetailsFromBody = (body: Record<string, any>) => ({
  title: String(body.title || '').trim(),
  type: body.type || 'household',
  description: typeof body.description === 'string' ? body.description.trim() : '',
  startDate: toDate(body.startDate),
  endDate: toDate(body.endDate),
  targetCount: body.targetCount === undefined || body.targetCount === null || body.targetCount === '' ? null : Number(body.targetCount),
  respondentType: body.respondentType || 'none',
});

export const createSurvey = async (req: AuthRequest, res: Response) => {
  try {
    const global = req.body.scope === 'global';
    if (global && !req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Only the Super Admin can create a survey for all Mahallus.' });
    }
    if (!global && !req.tenantId) return res.status(400).json({ success: false, message: NO_TENANT });
    const details = surveyDetailsFromBody(req.body);
    const survey = await SurveyForm.create({
      ...details,
      scope: global ? 'global' : 'mahallu',
      tenantId: global ? null : req.tenantId,
      draft: { pages: [{ id: 1, title: 'Page 1', fields: [] }], instructions: [] },
      nextPageId: 2,
      nextFieldId: 1,
      createdBy: userId(req),
      updatedBy: userId(req),
    });
    res.status(201).json({ success: true, data: surveySummary(req, survey), message: 'Survey created' });
  } catch (error) {
    sendFailure(res, error, "We couldn't create the survey. Please try again.");
  }
};

export const getSurvey = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadSurvey(req, req.params.id);
    if (!survey) return res.status(404).json({ success: false, message: NOT_FOUND });
    const counts = (await countsBySurvey(req, [survey._id as mongoose.Types.ObjectId])).get(String(survey._id));
    res.json({ success: true, data: surveySummary(req, survey, { counts }) });
  } catch (error) {
    sendFailure(res, error, "We couldn't load the survey right now. Please try again.");
  }
};

export const updateSurvey = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadManagedSurvey(req, res, req.params.id);
    if (!survey) return;
    const body = req.body as Record<string, any>;
    const details: Record<string, unknown> = {};
    if (body.title !== undefined) details.title = String(body.title).trim();
    if (body.type !== undefined) details.type = body.type;
    if (body.description !== undefined) details.description = typeof body.description === 'string' ? body.description.trim() : '';
    if (body.startDate) details.startDate = toDate(body.startDate) || survey.startDate;
    if (body.endDate !== undefined) details.endDate = toDate(body.endDate);
    if (body.targetCount !== undefined) {
      details.targetCount = body.targetCount === null || body.targetCount === '' ? null : Number(body.targetCount);
    }
    if (body.respondentType !== undefined) details.respondentType = body.respondentType;

    const start = (details.startDate as Date | undefined) || survey.startDate;
    const end = details.endDate !== undefined ? (details.endDate as Date | null) : survey.endDate;
    if (end && start && end < start) {
      return res.status(400).json({ success: false, message: 'The end date cannot be before the start date.' });
    }

    if (details.respondentType !== undefined && details.respondentType !== survey.respondentType) {
      const answered = await SurveySubmission.exists({ surveyId: survey._id });
      if (answered) {
        return res.status(409).json({
          success: false,
          message: 'This survey already has responses, so who it is about can no longer change.',
        });
      }
    }
    survey.set({ ...details, updatedBy: userId(req) });
    await survey.save();
    res.json({ success: true, data: surveySummary(req, survey), message: 'Survey updated' });
  } catch (error) {
    sendFailure(res, error, "We couldn't update the survey. Please try again.");
  }
};

export const deleteSurvey = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadManagedSurvey(req, res, req.params.id);
    if (!survey) return;
    const responses = await SurveySubmission.countDocuments({ surveyId: survey._id, status: { $ne: 'draft' } });
    if (responses > 0) {
      return res.status(409).json({
        success: false,
        message: `This survey has ${responses} submitted response${responses === 1 ? '' : 's'}, so it cannot be deleted. Close it instead.`,
      });
    }
    await SurveySubmission.deleteMany({ surveyId: survey._id });
    await SurveyFormVersion.deleteMany({ surveyId: survey._id });
    await survey.deleteOne();
    res.json({ success: true, message: 'Survey deleted' });
  } catch (error) {
    sendFailure(res, error, "We couldn't delete the survey. Please try again.");
  }
};

export const setSurveyStatus = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadManagedSurvey(req, res, req.params.id);
    if (!survey) return;
    const next = req.body.status as 'published' | 'closed';
    if (next === 'published' && !survey.publishedVersion) {
      return res.status(409).json({ success: false, message: 'Publish the form before opening the survey.' });
    }
    if (next === 'closed' && survey.status === 'draft') {
      return res.status(409).json({ success: false, message: 'Only a published survey can be closed.' });
    }
    survey.status = next;
    survey.updatedBy = userId(req);
    await survey.save();
    res.json({ success: true, data: surveySummary(req, survey), message: next === 'closed' ? 'Survey closed' : 'Survey reopened' });
  } catch (error) {
    sendFailure(res, error, "We couldn't change the survey status. Please try again.");
  }
};

/**
 * Turns a Mahallu's survey into a global one: the same survey (name, form, versions) becomes
 * available to every Mahallu and only the Super Admin can change it from then on. Responses already
 * collected stay with the Mahallu that filled them. One way only: once other Mahallus have responses
 * of their own, the survey can no longer belong to a single Mahallu.
 */
export const shareSurveyWithAllMahallus = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadSurvey(req, req.params.id);
    if (!survey) return res.status(404).json({ success: false, message: NOT_FOUND });
    if (isGlobal(survey)) return res.status(409).json({ success: false, message: 'This survey is already shared with all Mahallus.' });
    survey.set({ scope: 'global', tenantId: null, updatedBy: userId(req) });
    await survey.save();
    await SurveyFormVersion.updateMany({ surveyId: survey._id }, { $set: { tenantId: null } });
    res.json({ success: true, data: surveySummary(req, survey), message: 'Survey shared with all Mahallus' });
  } catch (error) {
    sendFailure(res, error, "We couldn't share the survey. Please try again.");
  }
};

/* ------------------------------------------------------------------------------------------------
 * Builder
 * ---------------------------------------------------------------------------------------------- */

const builderPayload = (req: AuthRequest, survey: ISurveyForm) => ({
  ...surveySummary(req, survey),
  draft: normalizeFormContent(survey.draft),
});

export const getBuilder = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadManagedSurvey(req, res, req.params.id);
    if (!survey) return;
    res.json({ success: true, data: builderPayload(req, survey) });
  } catch (error) {
    sendFailure(res, error, "We couldn't load the form builder right now. Please try again.");
  }
};

/**
 * Saves the whole draft form. The request carries the revision it was loaded at: if someone else
 * saved in between, the save is refused with 409 instead of silently overwriting their work.
 */
export const saveBuilder = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadManagedSurvey(req, res, req.params.id);
    if (!survey) return;

    const draft = normalizeFormContent(req.body.draft);
    const problems = validateFormStructure(draft, { forPublish: false, respondentType: survey.respondentType });
    if (problems.length) return res.status(400).json({ success: false, message: problems[0], problems });

    const used = maxIds(draft);
    const nextFieldId = Math.max(survey.nextFieldId, Number(req.body.nextFieldId) || 0, used.field + 1);
    const nextPageId = Math.max(survey.nextPageId, Number(req.body.nextPageId) || 0, used.page + 1);

    const updated = await SurveyForm.findOneAndUpdate(
      { _id: survey._id, revision: Number(req.body.revision) },
      {
        $set: {
          draft,
          nextFieldId,
          nextPageId,
          hasUnpublishedChanges: survey.publishedVersion > 0,
          updatedBy: userId(req),
        },
        $inc: { revision: 1 },
      },
      { new: true }
    );
    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Someone else saved this form after you opened it. Reload the builder to see their changes.',
      });
    }
    res.json({ success: true, data: builderPayload(req, updated), message: 'Form saved' });
  } catch (error) {
    sendFailure(res, error, "We couldn't save the form. Please try again.");
  }
};

/** Freezes the saved draft as the next version; survey workers fill that version from now on. */
export const publishSurvey = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadManagedSurvey(req, res, req.params.id);
    if (!survey) return;
    if (req.body.revision !== undefined && Number(req.body.revision) !== survey.revision) {
      return res.status(409).json({ success: false, message: 'The form changed since you opened it. Reload the builder and try again.' });
    }

    const content = normalizeFormContent(survey.draft);
    const problems = validateFormStructure(content, { forPublish: true, respondentType: survey.respondentType });
    if (problems.length) {
      return res.status(400).json({ success: false, message: 'The form is not ready to publish yet.', problems });
    }

    const versionNumber = survey.publishedVersion + 1;
    let version: ISurveyFormVersion;
    try {
      version = await SurveyFormVersion.create({
        tenantId: survey.tenantId,
        surveyId: survey._id,
        version: versionNumber,
        content,
        respondentType: survey.respondentType,
        publishedAt: new Date(),
        publishedBy: userId(req),
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        return res.status(409).json({ success: false, message: 'This form was just published by someone else. Reload and check.' });
      }
      throw error;
    }

    survey.set({
      publishedVersion: versionNumber,
      publishedVersionId: version._id,
      publishedAt: version.publishedAt,
      hasUnpublishedChanges: false,
      status: survey.status === 'draft' ? 'published' : survey.status,
      updatedBy: userId(req),
    });
    await survey.save();
    res.json({ success: true, data: builderPayload(req, survey), message: `Version ${versionNumber} published` });
  } catch (error) {
    sendFailure(res, error, "We couldn't publish the form. Please try again.");
  }
};

/* ------------------------------------------------------------------------------------------------
 * Filling
 * ---------------------------------------------------------------------------------------------- */

const loadPublishedVersion = async (survey: ISurveyForm) =>
  survey.publishedVersionId ? SurveyFormVersion.findById(survey.publishedVersionId) : null;

const versionPayload = (version: ISurveyFormVersion) => ({
  _id: version._id,
  version: version.version,
  content: normalizeFormContent(version.content),
  publishedAt: version.publishedAt,
});

/** The published form, for the fill wizard. */
export const getFillForm = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadSurvey(req, req.params.id);
    if (!survey) return res.status(404).json({ success: false, message: NOT_FOUND });
    const version = await loadPublishedVersion(survey);
    if (!version) return res.status(404).json({ success: false, message: FILL_BLOCKED.draft });
    res.json({ success: true, data: { survey: surveySummary(req, survey), version: versionPayload(version) } });
  } catch (error) {
    sendFailure(res, error, "We couldn't load the form right now. Please try again.");
  }
};

class InputProblem extends Error {
  constructor(message: string, readonly errors?: Record<string, string>) {
    super(message);
  }
}

/** The family / member a response is about, checked against the Mahallu the response belongs to. */
const resolveRespondent = async (
  survey: ISurveyForm,
  tenantId: mongoose.Types.ObjectId,
  body: Record<string, any>,
  submitting: boolean
): Promise<{ familyId: mongoose.Types.ObjectId | null; memberId: mongoose.Types.ObjectId | null; respondentName?: string }> => {
  const none = { familyId: null, memberId: null };
  const isId = (v: unknown): v is string => typeof v === 'string' && mongoose.isValidObjectId(v);
  if (survey.respondentType === 'family') {
    if (!isId(body.familyId)) {
      if (submitting) throw new InputProblem('Please choose the family this response is about.');
      return none;
    }
    const family = await Family.findOne({ _id: body.familyId, tenantId }).select('houseName familyHead');
    if (!family) throw new InputProblem("We couldn't find that family in this Mahallu.");
    const name = [family.houseName, family.familyHead].filter(Boolean).join(' - ');
    return { familyId: family._id as mongoose.Types.ObjectId, memberId: null, respondentName: name };
  }
  if (survey.respondentType === 'member') {
    if (!isId(body.memberId)) {
      if (submitting) throw new InputProblem('Please choose the member this response is about.');
      return none;
    }
    const member = await Member.findOne({ _id: body.memberId, tenantId }).select('name familyId familyName');
    if (!member) throw new InputProblem("We couldn't find that member in this Mahallu.");
    const name = [member.name, member.familyName].filter(Boolean).join(' - ');
    return { familyId: member.familyId || null, memberId: member._id as mongoose.Types.ObjectId, respondentName: name };
  }
  return none;
};

/**
 * Files referenced by the answers must be survey uploads in this Mahallu that this person uploaded
 * (or an admin did), not already attached to a different response.
 */
const checkAttachments = async (
  req: AuthRequest,
  tenantId: mongoose.Types.ObjectId,
  ids: string[],
  submissionId?: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId[]> => {
  if (ids.length === 0) return [];
  const unique = Array.from(new Set(ids));
  const docs = await DocumentFile.find({ _id: { $in: unique }, tenantId, ownerType: 'survey' }).select(
    'uploadedByUserId ownerId'
  );
  const usable = docs.filter(
    (doc) =>
      (isAdmin(req) || String(doc.uploadedByUserId) === String(userId(req))) &&
      (!doc.ownerId || (submissionId && String(doc.ownerId) === String(submissionId)))
  );
  if (usable.length !== unique.length) {
    throw new InputProblem("One of the uploaded files couldn't be found. Please upload it again.");
  }
  return usable.map((doc) => doc._id as mongoose.Types.ObjectId);
};

const syncAttachmentOwners = async (submission: ISurveySubmission) => {
  await DocumentFile.updateMany({ _id: { $in: submission.attachments } }, { $set: { ownerId: submission._id } });
  await DocumentFile.updateMany(
    { ownerType: 'survey', ownerId: submission._id, _id: { $nin: submission.attachments } },
    { $unset: { ownerId: 1 } }
  );
};

/**
 * The submit pipeline: sanitise -> (submit only) drop hidden answers, validate, normalise ->
 * recompute auto-sums -> check the respondent and the files. The client's copy of any of this is
 * never trusted.
 */
const prepareAnswers = (content: SurveyFormContent, raw: unknown, submitting: boolean): Answers => {
  const answers = sanitizeAnswers(content, raw, { dropHidden: submitting });
  if (!submitting) return answers;
  const errors = validateAnswers(content, answers);
  if (Object.keys(errors).length) throw new InputProblem('Please correct the highlighted answers.', errors);
  return normalizeAnswers(content, answers);
};

const answerProblem = (res: Response, error: unknown) => {
  if (error instanceof InputProblem) {
    res.status(400).json({ success: false, message: error.message, ...(error.errors ? { errors: error.errors } : {}) });
    return true;
  }
  return false;
};

export const createSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadSurvey(req, req.params.id);
    if (!survey) return res.status(404).json({ success: false, message: NOT_FOUND });
    const state = fillStateOf(survey);
    if (state !== 'open') return res.status(409).json({ success: false, message: FILL_BLOCKED[state] });
    const tenantId = fillTenantOf(req, survey);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Please select the Mahallu this response is for.' });
    const version = await loadPublishedVersion(survey);
    if (!version) return res.status(409).json({ success: false, message: FILL_BLOCKED.draft });

    const submitting = req.body.submit === true;
    const content = normalizeFormContent(version.content);
    const answers = prepareAnswers(content, req.body.answers, submitting);
    const respondent = await resolveRespondent(survey, tenantId, req.body, submitting);
    const attachments = await checkAttachments(req, tenantId, fileDocumentIds(content, answers));
    const now = new Date();

    const submission = await SurveySubmission.create({
      tenantId,
      surveyId: survey._id,
      versionId: version._id,
      version: version.version,
      status: submitting ? 'pending' : 'draft',
      answers,
      ...respondent,
      submittedBy: userId(req),
      submittedByName: userName(req),
      submittedAt: submitting ? now : null,
      currentPage: Math.max(0, Number(req.body.currentPage) || 0),
      history: submitting ? [{ status: 'pending', by: userId(req), byName: userName(req), at: now }] : [],
      attachments,
    });
    await syncAttachmentOwners(submission);
    res.status(201).json({
      success: true,
      data: submission,
      message: submitting ? 'Response submitted' : 'Draft saved',
    });
  } catch (error) {
    if (answerProblem(res, error)) return;
    sendFailure(res, error, "We couldn't save the response. Please try again.");
  }
};

/** Updates the caller's own draft, and submits it when `submit` is true. */
export const updateSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const submission = await SurveySubmission.findOne(scoped(req, { _id: req.params.subId, submittedBy: userId(req) }));
    if (!submission) return res.status(404).json({ success: false, message: SUBMISSION_NOT_FOUND });
    if (submission.status !== 'draft') {
      return res.status(409).json({ success: false, message: 'This response has already been submitted and can no longer be edited.' });
    }
    const survey = await loadSurvey(req, String(submission.surveyId));
    if (!survey) return res.status(404).json({ success: false, message: NOT_FOUND });
    const state = fillStateOf(survey);
    if (state !== 'open') return res.status(409).json({ success: false, message: FILL_BLOCKED[state] });
    // A draft always moves to the version currently published, so the surveyor finishes the live form.
    const version = await loadPublishedVersion(survey);
    if (!version) return res.status(409).json({ success: false, message: FILL_BLOCKED.draft });

    const submitting = req.body.submit === true;
    const content = normalizeFormContent(version.content);
    const answers = prepareAnswers(content, req.body.answers, submitting);
    const respondent = await resolveRespondent(survey, submission.tenantId, req.body, submitting);
    const attachments = await checkAttachments(
      req,
      submission.tenantId,
      fileDocumentIds(content, answers),
      submission._id as mongoose.Types.ObjectId
    );
    const now = new Date();

    submission.set({
      versionId: version._id,
      version: version.version,
      answers,
      ...respondent,
      attachments,
      currentPage: Math.max(0, Number(req.body.currentPage) || 0),
    });
    submission.markModified('answers');
    if (submitting) {
      submission.status = 'pending';
      submission.submittedAt = now;
      submission.history.push({ status: 'pending', by: userId(req), byName: userName(req), at: now });
    }
    await submission.save();
    await syncAttachmentOwners(submission);
    res.json({ success: true, data: submission, message: submitting ? 'Response submitted' : 'Draft saved' });
  } catch (error) {
    if (answerProblem(res, error)) return;
    sendFailure(res, error, "We couldn't save the response. Please try again.");
  }
};

export const deleteSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const submission = await loadSubmission(req, req.params.subId);
    if (!submission) return res.status(404).json({ success: false, message: SUBMISSION_NOT_FOUND });
    if (!isAdmin(req) && submission.status !== 'draft') {
      return res.status(403).json({ success: false, message: 'Only a draft can be deleted. Please contact your Mahallu admin.' });
    }
    await DocumentFile.updateMany({ ownerType: 'survey', ownerId: submission._id }, { $unset: { ownerId: 1 } });
    await submission.deleteOne();
    res.json({ success: true, message: submission.status === 'draft' ? 'Draft deleted' : 'Response deleted' });
  } catch (error) {
    sendFailure(res, error, "We couldn't delete the response. Please try again.");
  }
};

/* ------------------------------------------------------------------------------------------------
 * Reading responses
 * ---------------------------------------------------------------------------------------------- */

const LIST_FIELDS = '-answers -attachments';

const populateRespondent = <T>(query: mongoose.Query<T, any>) =>
  query.populate('familyId', 'houseName familyHead').populate('memberId', 'name familyName');

/** Answer filters (`answers={"field_5":["opt_a"]}`), kept only for choice questions of this form. */
const answerFilters = (content: SurveyFormContent | null, raw: unknown): Record<string, unknown> => {
  if (!content || typeof raw !== 'string' || !raw.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Record<string, unknown> = {};
  for (const field of allFields(content)) {
    if (!FIELD_TYPES[field.type]?.filterable) continue;
    const key = answerKey(field.id);
    const wanted = (parsed as Record<string, unknown>)[key];
    const values = (Array.isArray(wanted) ? wanted : [wanted]).filter((v): v is string => typeof v === 'string' && v !== '').slice(0, 20);
    if (values.length === 0) continue;
    if (field.type === 'checkbox') {
      const yes = values.includes('true');
      const no = values.includes('false');
      if (yes && !no) out[`answers.${key}`] = true;
      else if (no && !yes) out[`answers.${key}`] = { $ne: true };
      continue;
    }
    const allowed = new Set((field.options || []).map((o) => o.value));
    const valid = values.filter((v) => allowed.has(v));
    if (valid.length) out[`answers.${key}`] = { $in: valid };
  }
  return out;
};

/** The admin list filters, shared by the list and the CSV export so both hold the same rows. */
const submissionQuery = async (req: AuthRequest, survey: ISurveyForm, includeStatus = true) => {
  const query: Record<string, any> = { surveyId: survey._id, ...responseScope(req, survey), status: { $ne: 'draft' } };
  const { status, from, to, submittedBy, search, familyId, answers } = req.query;
  if (includeStatus && status && ['pending', 'accepted', 'rejected'].includes(String(status))) query.status = status;
  const fromDate = toDate(from);
  const toDay = toDate(to);
  if (fromDate || toDay) {
    query.submittedAt = {};
    if (fromDate) query.submittedAt.$gte = fromDate;
    if (toDay) query.submittedAt.$lt = new Date(toDay.getTime() + 24 * 60 * 60 * 1000);
  }
  // ObjectIds, not strings: the same filter feeds the status-count aggregation, which does not cast.
  if (submittedBy && mongoose.isValidObjectId(submittedBy)) query.submittedBy = asObjectId(submittedBy);
  if (familyId && mongoose.isValidObjectId(familyId)) query.familyId = asObjectId(familyId);
  if (search) {
    const pattern = { $regex: regexLiteral(search), $options: 'i' };
    query.$or = [{ respondentName: pattern }, { submittedByName: pattern }];
  }
  const version = await loadPublishedVersion(survey);
  Object.assign(query, answerFilters(version ? normalizeFormContent(version.content) : null, answers));
  return { query, version };
};

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { submittedAt: -1 },
  oldest: { submittedAt: 1 },
  respondent: { respondentName: 1, submittedAt: -1 },
};

/** Every submitted response of a survey, for review. Mahallu admin and Super Admin only. */
export const listSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadSurvey(req, req.params.id);
    if (!survey) return res.status(404).json({ success: false, message: NOT_FOUND });
    const { page, limit, skip } = getPaginationParams(req);
    const { query } = await submissionQuery(req, survey);
    const { query: withoutStatus } = await submissionQuery(req, survey, false);
    const sort = SORTS[String(req.query.sort)] || SORTS.newest;

    // A Super Admin reading a global survey across every Mahallu sees which Mahallu each response is from.
    const acrossMahallus = !req.tenantId && isGlobal(survey);
    const list = populateRespondent(SurveySubmission.find(query).select(LIST_FIELDS).sort(sort).skip(skip).limit(limit));
    const [rows, total, byStatus, surveyors] = await Promise.all([
      acrossMahallus ? list.populate('tenantId', 'name') : list,
      SurveySubmission.countDocuments(query),
      SurveySubmission.aggregate([{ $match: withoutStatus }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      SurveySubmission.aggregate([
        { $match: { surveyId: survey._id, ...responseScope(req, survey), status: { $ne: 'draft' } } },
        { $group: { _id: '$submittedBy', name: { $first: '$submittedByName' }, n: { $sum: 1 } } },
        { $sort: { name: 1 } },
        { $limit: 200 },
      ]),
    ]);
    const statusCounts = { all: 0, pending: 0, accepted: 0, rejected: 0 } as Record<string, number>;
    for (const row of byStatus) {
      statusCounts[row._id] = row.n;
      statusCounts.all += row.n;
    }
    res.json({
      ...createPaginationResponse(rows, total, page, limit),
      meta: { statusCounts, surveyors: surveyors.map((s) => ({ id: String(s._id), name: s.name || 'Staff', count: s.n })) },
    });
  } catch (error) {
    sendFailure(res, error, "We couldn't load the responses right now. Please try again.");
  }
};

const EXPORT_CAP = 5000;

/** CSV of the filtered responses, one column per question of the published form. */
export const exportSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadSurvey(req, req.params.id);
    if (!survey) return res.status(404).json({ success: false, message: NOT_FOUND });
    const { query, version } = await submissionQuery(req, survey);
    const questions = version
      ? allFields(normalizeFormContent(version.content)).filter((f) => f.type !== 'heading')
      : [];
    const acrossMahallus = !req.tenantId && isGlobal(survey);
    const found = SurveySubmission.find(query)
      .select(['tenantId', 'submittedAt', 'status', 'respondentName', 'submittedByName', 'version', 'reviewNote', 'answers'].join(' '))
      .sort(SORTS[String(req.query.sort)] || SORTS.newest)
      .limit(EXPORT_CAP);
    const rows = await (acrossMahallus ? found.populate('tenantId', 'name') : found).lean();

    const headers = [
      'Submitted on',
      ...(acrossMahallus ? ['Mahallu'] : []),
      'Status',
      'Respondent',
      'Surveyor',
      'Form version',
      'Review note',
      ...questions.map((q) => q.label),
    ];
    const lines = rows.map((row: any) => [
      row.submittedAt ? new Date(row.submittedAt).toISOString().slice(0, 10) : '',
      ...(acrossMahallus ? [row.tenantId?.name || ''] : []),
      row.status,
      row.respondentName || '',
      row.submittedByName || '',
      row.version,
      row.reviewNote || '',
      ...questions.map((q) => formatAnswer(q, (row.answers || {})[answerKey(q.id)])),
    ]);
    const csv = [headers, ...lines].map((line) => line.map(csvEscape).join(',')).join('\r\n');
    const safeName = survey.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'survey';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-responses.csv"`);
    res.send(`﻿${csv}`);
  } catch (error) {
    sendFailure(res, error, "We couldn't export the responses. Please try again.");
  }
};

/** The caller's own responses and drafts for a survey. */
export const listMySubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const survey = await loadSurvey(req, req.params.id);
    if (!survey) return res.status(404).json({ success: false, message: NOT_FOUND });
    const { page, limit, skip } = getPaginationParams(req);
    const query: Record<string, unknown> = { surveyId: survey._id, ...responseScope(req, survey), submittedBy: userId(req) };
    if (req.query.status && ['draft', 'pending', 'accepted', 'rejected'].includes(String(req.query.status))) {
      query.status = req.query.status;
    }
    const [rows, total] = await Promise.all([
      populateRespondent(SurveySubmission.find(query).select(LIST_FIELDS).sort({ updatedAt: -1 }).skip(skip).limit(limit)),
      SurveySubmission.countDocuments(query),
    ]);
    res.json(createPaginationResponse(rows, total, page, limit));
  } catch (error) {
    sendFailure(res, error, "We couldn't load your responses right now. Please try again.");
  }
};

/** One response with the form version it was filled on, so it always reads as it was answered. */
export const getSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const submission = await loadSubmission(req, req.params.subId);
    if (!submission) return res.status(404).json({ success: false, message: SUBMISSION_NOT_FOUND });
    const [survey, version] = await Promise.all([
      SurveyForm.findById(submission.surveyId).select('-draft'),
      SurveyFormVersion.findById(submission.versionId),
    ]);
    await submission.populate([
      { path: 'familyId', select: 'houseName familyHead contactNo houseNo wardNumber area place' },
      { path: 'memberId', select: 'name familyName gender age phone' },
    ]);
    res.json({
      success: true,
      data: {
        submission,
        survey: survey ? surveySummary(req, survey) : null,
        version: version ? versionPayload(version) : null,
      },
    });
  } catch (error) {
    sendFailure(res, error, "We couldn't load the response right now. Please try again.");
  }
};

/** Accept or reject a submitted response. A decision can be changed later; each one is kept in history. */
export const reviewSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const submission = await loadSubmission(req, req.params.subId);
    if (!submission) return res.status(404).json({ success: false, message: SUBMISSION_NOT_FOUND });
    if (submission.status === 'draft') {
      return res.status(409).json({ success: false, message: 'This response is still a draft and has not been submitted.' });
    }
    const decision = req.body.decision as 'accepted' | 'rejected';
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    if (decision === 'rejected' && !note) {
      return res.status(400).json({ success: false, message: 'Please enter a reason for rejecting this response.' });
    }
    if (submission.status === decision) {
      return res.status(409).json({ success: false, message: `This response is already ${decision}.` });
    }
    const now = new Date();
    submission.set({
      status: decision,
      reviewedBy: userId(req),
      reviewedByName: userName(req),
      reviewedAt: now,
      reviewNote: note,
    });
    submission.history.push({ status: decision, note, by: userId(req), byName: userName(req), at: now });
    await submission.save();
    res.json({ success: true, data: submission, message: decision === 'accepted' ? 'Response accepted' : 'Response rejected' });
  } catch (error) {
    sendFailure(res, error, "We couldn't save the review. Please try again.");
  }
};

/** Short-lived link to a file attached to a response the caller may read. */
export const getSubmissionFileUrl = async (req: AuthRequest, res: Response) => {
  try {
    const submission = await loadSubmission(req, req.params.subId);
    if (!submission) return res.status(404).json({ success: false, message: SUBMISSION_NOT_FOUND });
    const attached = submission.attachments.some((id) => String(id) === req.params.docId);
    const doc = attached ? await DocumentFile.findOne({ _id: req.params.docId, tenantId: submission.tenantId }) : null;
    if (!doc) return res.status(404).json({ success: false, message: "We couldn't find that file. It may have been removed." });
    const url = await getSignedDownloadUrl(doc.fileKey);
    res.json({ success: true, data: { url, fileName: doc.fileName, mimeType: doc.mimeType, expiresIn: 300 } });
  } catch (error) {
    sendFailure(res, error, "We couldn't open the file right now. Please try again.");
  }
};
