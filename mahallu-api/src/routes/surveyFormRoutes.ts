import express from 'express';
import {
  listSurveys,
  createSurvey,
  getSurvey,
  updateSurvey,
  deleteSurvey,
  setSurveyStatus,
  getBuilder,
  saveBuilder,
  publishSurvey,
  getFillForm,
  createSubmission,
  updateSubmission,
  deleteSubmission,
  listSubmissions,
  exportSubmissions,
  listMySubmissions,
  getSubmission,
  reviewSubmission,
  getSubmissionFileUrl,
} from '../controllers/surveyFormController';
import { authMiddleware, requireAdmin, requireFieldStaff } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  listSurveyFormsValidation,
  createSurveyFormValidation,
  updateSurveyFormValidation,
  surveyIdValidation,
  submissionIdValidation,
  saveBuilderValidation,
  publishSurveyValidation,
  surveyStatusValidation,
  createSubmissionValidation,
  updateSubmissionValidation,
  listSubmissionsValidation,
  reviewSubmissionValidation,
  submissionFileValidation,
} from '../validations/surveyFormValidation';

/**
 * Configurable surveys (/api/survey-forms).
 *
 *   Mahallu admin / Super Admin   create surveys, build and publish the form, open/close, review responses
 *   Survey worker                 sees published surveys, fills them, and reads their own responses
 *
 * Every endpoint is behind requireFieldStaff; the admin-only ones add requireAdmin. Reads a survey
 * worker may make (a survey, its published form, one response) are scoped to them in the controller.
 *
 * The /submissions/:subId routes are registered before /:id/... so "submissions" is never read as a
 * survey id.
 *
 * @swagger
 * tags:
 *   - name: Survey forms
 *     description: |
 *       Configurable multi-page survey forms, their published versions and responses.
 *       GET / · POST / · GET|PUT|DELETE /{id} · POST /{id}/status · GET|PUT /{id}/builder · POST /{id}/publish ·
 *       GET /{id}/form · POST /{id}/submissions · GET /{id}/submissions (admin) · GET /{id}/submissions/export (admin) ·
 *       GET /{id}/my-submissions · GET|PUT|DELETE /submissions/{subId} · POST /submissions/{subId}/review (admin) ·
 *       GET /submissions/{subId}/files/{docId}
 */
const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(requireFieldStaff);

// One response
router.get('/submissions/:subId', submissionIdValidation, validationHandler, getSubmission);
router.put('/submissions/:subId', updateSubmissionValidation, validationHandler, updateSubmission);
router.delete('/submissions/:subId', submissionIdValidation, validationHandler, deleteSubmission);
router.post('/submissions/:subId/review', reviewSubmissionValidation, validationHandler, requireAdmin, reviewSubmission);
router.get('/submissions/:subId/files/:docId', submissionFileValidation, validationHandler, getSubmissionFileUrl);

// Surveys
router.get('/', listSurveyFormsValidation, validationHandler, listSurveys);
router.post('/', createSurveyFormValidation, validationHandler, requireAdmin, createSurvey);
router.get('/:id', surveyIdValidation, validationHandler, getSurvey);
router.put('/:id', updateSurveyFormValidation, validationHandler, requireAdmin, updateSurvey);
router.delete('/:id', surveyIdValidation, validationHandler, requireAdmin, deleteSurvey);
router.post('/:id/status', surveyStatusValidation, validationHandler, requireAdmin, setSurveyStatus);

// Builder
router.get('/:id/builder', surveyIdValidation, validationHandler, requireAdmin, getBuilder);
router.put('/:id/builder', saveBuilderValidation, validationHandler, requireAdmin, saveBuilder);
router.post('/:id/publish', publishSurveyValidation, validationHandler, requireAdmin, publishSurvey);

// Filling and responses
router.get('/:id/form', surveyIdValidation, validationHandler, getFillForm);
router.post('/:id/submissions', createSubmissionValidation, validationHandler, createSubmission);
router.get('/:id/submissions', listSubmissionsValidation, validationHandler, requireAdmin, listSubmissions);
router.get('/:id/submissions/export', listSubmissionsValidation, validationHandler, requireAdmin, exportSubmissions);
router.get('/:id/my-submissions', listSubmissionsValidation, validationHandler, listMySubmissions);

export default router;
