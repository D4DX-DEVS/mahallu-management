import { body, query, ValidationChain } from 'express-validator';
import {
  dateField,
  dateOrder,
  enumField,
  enumQuery,
  idParam,
  idQuery,
  intField,
  listQuery,
  optionalText,
  requiredText,
} from './common';
import { SURVEY_TYPES, SURVEY_STATUSES, RESPONDENT_TYPES } from '../models/SurveyForm';

/**
 * Request shapes for /api/survey-forms. Answers and form definitions are checked in depth by the
 * shared survey form engine inside the controller; these chains refuse what is not even the right
 * kind of value before any of that runs.
 */

const surveyDetails = (mode: 'create' | 'update'): ValidationChain[] => [
  mode === 'create'
    ? requiredText('title', 'survey name', { min: 3, max: 200 })
    : body('title').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Please enter a survey name of 3 to 200 characters.'),
  enumField('type', SURVEY_TYPES, 'survey type', { required: mode === 'create' }),
  optionalText('description', 'description', 2000),
  dateField('startDate', 'start date', { required: mode === 'create' }),
  dateField('endDate', 'end date'),
  dateOrder('startDate', 'endDate', 'The end date cannot be before the start date.'),
  intField('targetCount', 'target count', { min: 1, max: 1_000_000 }),
  enumField('respondentType', RESPONDENT_TYPES, 'respondent'),
];

export const listSurveyFormsValidation = [
  ...listQuery(),
  enumQuery('status', SURVEY_STATUSES, 'status'),
  enumQuery('type', SURVEY_TYPES, 'survey type'),
];

export const createSurveyFormValidation = surveyDetails('create');
export const updateSurveyFormValidation = [idParam('id', 'survey'), ...surveyDetails('update')];

export const surveyIdValidation = [idParam('id', 'survey')];
export const submissionIdValidation = [idParam('subId', 'response')];

export const saveBuilderValidation = [
  idParam('id', 'survey'),
  body('draft').isObject().withMessage('Please send the form to save.'),
  body('draft.pages').isArray({ max: 30 }).withMessage('A form can have up to 30 pages.'),
  body('revision').isInt({ min: 0 }).withMessage('Please reload the builder and try again.'),
  body('nextFieldId').optional().isInt({ min: 1, max: 1_000_000 }).withMessage('Please reload the builder and try again.'),
  body('nextPageId').optional().isInt({ min: 1, max: 1_000_000 }).withMessage('Please reload the builder and try again.'),
];

export const publishSurveyValidation = [
  idParam('id', 'survey'),
  body('revision').optional().isInt({ min: 0 }).withMessage('Please reload the builder and try again.'),
];

export const surveyStatusValidation = [
  idParam('id', 'survey'),
  enumField('status', ['published', 'closed'], 'survey status', { required: true }),
];

const answerBody = (): ValidationChain[] => [
  body('answers').optional().isObject().withMessage('Please send the answers as a form.'),
  body('submit').optional().isBoolean({ strict: true }).withMessage('Please choose whether to submit.'),
  body('familyId').optional({ values: 'falsy' }).isMongoId().withMessage('Please choose a valid family.'),
  body('memberId').optional({ values: 'falsy' }).isMongoId().withMessage('Please choose a valid member.'),
  body('currentPage').optional().isInt({ min: 0, max: 100 }).withMessage('Please choose a valid page.'),
];

export const createSubmissionValidation = [idParam('id', 'survey'), ...answerBody()];
export const updateSubmissionValidation = [idParam('subId', 'response'), ...answerBody()];

export const listSubmissionsValidation = [
  idParam('id', 'survey'),
  ...listQuery(),
  enumQuery('status', ['pending', 'accepted', 'rejected', 'draft'], 'status'),
  enumQuery('sort', ['newest', 'oldest', 'respondent'], 'sort order'),
  query('from').optional({ values: 'falsy' }).isISO8601().withMessage('Please choose a valid start date.'),
  query('to').optional({ values: 'falsy' }).isISO8601().withMessage('Please choose a valid end date.'),
  idQuery('submittedBy', 'surveyor'),
  idQuery('familyId', 'family'),
  query('answers').optional({ values: 'falsy' }).isString().isLength({ max: 4000 }).withMessage('Please use fewer answer filters.'),
];

export const reviewSubmissionValidation = [
  idParam('subId', 'response'),
  enumField('decision', ['accepted', 'rejected'], 'decision', { required: true }),
  optionalText('note', 'note', 1000),
];

export const submissionFileValidation = [idParam('subId', 'response'), idParam('docId', 'file')];
