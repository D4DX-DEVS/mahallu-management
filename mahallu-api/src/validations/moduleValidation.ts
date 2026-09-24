import { body, ValidationChain } from 'express-validator';
import {
  amountField,
  boolField,
  dateField,
  dateOrder,
  enumField,
  idArrayField,
  idParam,
  intField,
  optionalLongText,
  optionalRef,
  optionalText,
  phoneField,
  requiredRef,
  requiredText,
} from './common';
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CHANNELS } from '../models/Announcement';
import {
  COUNSELLING_CATEGORIES,
  COUNSELLING_STATUSES,
  DISPUTE_TYPES,
  DISPUTE_STATUSES,
  INHERITANCE_STATUSES,
} from '../models/Counselling';
import { PROJECT_AREAS, PROJECT_STATUSES } from '../models/DevelopmentProject';
import { HEALTH_RESOURCE_TYPES } from '../models/HealthResource';
import { KHUTBAH_STATUSES } from '../models/Khutbah';
import { BOOK_CATEGORIES, RESOURCE_TYPES } from '../models/Library';
import { CLASS_TYPES, ENROLLMENT_STATUSES } from '../models/Madrasa';
import { MARRIAGE_ASSISTANCE_TYPES, MARRIAGE_ASSISTANCE_STATUSES } from '../models/MarriageAssistance';
import { QARD_PURPOSES } from '../models/QardLoan';
import { RELIEF_URGENCIES } from '../models/ReliefCase';
import { SUPPORT_CASE_TYPES, SUPPORT_CASE_STATUSES } from '../models/Scholarship';
import { VOLUNTEER_WINGS, SERVICE_TYPES } from '../models/VolunteerProfile';

/**
 * Body rules for the create and update endpoints that had none.
 *
 * Every entity is written once as a builder taking a `Mode`, because create and
 * update differ in exactly one way: on create a required field must be there,
 * on update an absent field means "leave it alone". Writing the two separately
 * is how they drift, and a rule that holds on create but not on update is worth
 * very little — the update route is the one an attacker reaches for.
 *
 * These chains mirror the Mongoose schemas, and disagree with them in one
 * direction on purpose: the schema says what the database will hold, this says
 * what a person may send. Schemas here carry `required` and `min` but almost no
 * `maxlength`, so a name could arrive as a megabyte of text and an amount as
 * `1e308` — both accepted, stored, and later rendered into a report.
 *
 * Optional fields use `optional({ values: 'falsy' })` throughout: a form that
 * clears a field sends `''`, and that must mean "no value", not "a value that
 * fails minimum length".
 */

type Mode = 'create' | 'update';

/** Required on create, optional on update, same shape either way. */
const text = (
  mode: Mode,
  field: string,
  label: string,
  { min = 2, max = 200 }: { min?: number; max?: number } = {}
): ValidationChain =>
  mode === 'create' ? requiredText(field, label, { min, max }) : optionalText(field, label, max);

const ref = (mode: Mode, field: string, label: string): ValidationChain =>
  mode === 'create' ? requiredRef(field, label) : optionalRef(field, label);

const enumOf = (
  mode: Mode,
  field: string,
  allowed: readonly string[],
  label: string
): ValidationChain => enumField(field, allowed, label, { required: mode === 'create' });

const money = (
  mode: Mode,
  field: string,
  label: string,
  { min = 0 }: { min?: number } = {}
): ValidationChain => amountField(field, label, { required: mode === 'create', min });

const whole = (
  mode: Mode,
  field: string,
  label: string,
  { min = 0, max = 1_000_000 }: { min?: number; max?: number } = {}
): ValidationChain => intField(field, label, { required: mode === 'create', min, max });

const date = (
  mode: Mode,
  field: string,
  label: string,
  { allowFuture = true }: { allowFuture?: boolean } = {}
): ValidationChain => dateField(field, label, { required: mode === 'create', allowFuture });

/** A list of short strings — subjects, skills, mediators, party names. */
const stringList = (field: string, label: string, max: number, itemMax = 100): ValidationChain =>
  body(field)
    .optional()
    .isArray({ max })
    .withMessage(`Please add ${max} ${label} or fewer.`)
    .bail()
    .custom((values: unknown[]) => {
      if (values.some((v) => typeof v !== 'string' || v.trim().length === 0 || v.length > itemMax)) {
        throw new Error(`Please keep each entry in ${label} to ${itemMax} characters or less.`);
      }
      return true;
    });

/** A list restricted to a known set of codes. */
const enumList = (
  field: string,
  allowed: readonly string[],
  label: string,
  { required = false }: { required?: boolean } = {}
): ValidationChain => {
  const chain = required
    ? body(field).isArray({ min: 1, max: allowed.length }).withMessage(`Please choose at least one ${label}.`)
    : body(field).optional().isArray({ max: allowed.length }).withMessage(`Please choose fewer ${label} values.`);
  return chain.bail().custom((values: unknown[]) => {
    if (values.some((v) => typeof v !== 'string' || !allowed.includes(v))) {
      throw new Error(`Please choose a valid ${label}.`);
    }
    return true;
  });
};

const link = (field: string, label: string): ValidationChain =>
  body(field)
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 2000 })
    .withMessage(`Please enter a shorter ${label}.`)
    .bail()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`Please enter a valid ${label} starting with http:// or https://`);

/** "2024" or "2024-25". Free text here is how a year ends up as "last year". */
const academicYear = (mode: Mode): ValidationChain => {
  const chain =
    mode === 'create'
      ? body('academicYear').trim().notEmpty().withMessage('Please enter the academic year.').bail()
      : body('academicYear').optional({ values: 'falsy' }).trim();
  return chain
    .matches(/^\d{4}(-\d{2,4})?$/)
    .withMessage('Please enter the academic year as 2024 or 2024-25.');
};

/* ── Locality, mosque, cluster ─────────────────────────────────────────── */

const clusterFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'name', 'cluster name', { max: 100 }),
  optionalText('nameMl', 'cluster name', 100),
  optionalText('code', 'code', 20),
  optionalRef('coordinatorMemberId', 'coordinator'),
  idArrayField('teamMemberIds', 'team members', 3),
  optionalText('notes', 'notes', 1000),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createClusterValidation = clusterFields('create');
export const updateClusterValidation = [idParam('id', 'cluster'), ...clusterFields('update')];

const clusterVisitFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'clusterId', 'cluster'),
  optionalRef('familyId', 'family'),
  dateField('visitDate', 'visit date', { allowFuture: false }),
  optionalText('visitedBy', 'visitor’s name', 100),
  optionalText('notes', 'notes', 2000),
  optionalText('issuesFound', 'issues found', 2000),
  boolField('followUpNeeded', 'follow-up'),
];

export const createClusterVisitValidation = clusterVisitFields('create');
export const updateClusterVisitValidation = [idParam('id', 'visit'), ...clusterVisitFields('update')];

const FACILITY_TYPES = [
  'school', 'college', 'hospital', 'religious_institution', 'public_institution',
  'library', 'organization', 'public_space', 'business', 'other',
] as const;

const facilityFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'name', 'name', { max: 150 }),
  optionalText('nameMl', 'name', 150),
  enumField('type', FACILITY_TYPES, 'facility type'),
  optionalText('address', 'address', 300),
  phoneField('contactNo', 'contact number'),
  optionalText('notes', 'notes', 1000),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createFacilityValidation = facilityFields('create');
export const updateFacilityValidation = [idParam('id', 'facility'), ...facilityFields('update')];

const mosqueFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'name', 'mosque name', { max: 150 }),
  optionalText('nameMl', 'mosque name', 150),
  intField('capacity', 'capacity', { min: 0, max: 100000 }),
  body('facilities').optional().isArray({ max: 50 }).withMessage('Please choose fewer facilities.'),
  optionalText('prayerFacilityNotes', 'notes', 1000),
  optionalText('imamName', 'imam’s name', 100),
  optionalRef('imamMemberId', 'imam'),
  optionalText('muazzinName', 'muazzin’s name', 100),
  optionalText('khateebName', 'khateeb’s name', 100),
  optionalText('staffNotes', 'notes', 1000),
];

export const createMosqueValidation = mosqueFields('create');
export const updateMosqueValidation = [idParam('id', 'mosque'), ...mosqueFields('update')];

/* ── Communication ─────────────────────────────────────────────────────── */

const announcementFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'title', 'title', { max: 200 }),
  optionalText('titleMl', 'title', 200),
  mode === 'create'
    ? requiredText('body', 'message', { min: 1, max: 5000 })
    : optionalText('body', 'message', 5000),
  enumField('category', ANNOUNCEMENT_CATEGORIES, 'category'),
  enumField('audience', ['all', 'families', 'committee', 'cluster', 'custom'], 'audience'),
  idArrayField('audienceRefIds', 'recipients', 500),
  enumList('channels', ANNOUNCEMENT_CHANNELS, 'channel'),
];

export const createAnnouncementValidation = announcementFields('create');
export const updateAnnouncementValidation = [idParam('id', 'announcement'), ...announcementFields('update')];

/* ── Counselling, disputes, inheritance ────────────────────────────────── */

const counsellingFields = (mode: Mode): ValidationChain[] => [
  enumOf(mode, 'category', COUNSELLING_CATEGORIES, 'category'),
  optionalRef('clientMemberId', 'member'),
  optionalText('clientName', 'client’s name', 100),
  text(mode, 'counsellorName', 'counsellor’s name', { max: 100 }),
  date(mode, 'appointmentDate', 'appointment date'),
  enumField('status', COUNSELLING_STATUSES, 'status'),
  optionalLongText('closureNotes', 'closure notes', 2000),
];

export const createCounsellingCaseValidation = counsellingFields('create');
export const updateCounsellingCaseValidation = [idParam('id', 'case'), ...counsellingFields('update')];

const disputeFields = (mode: Mode): ValidationChain[] => [
  enumOf(mode, 'type', DISPUTE_TYPES, 'dispute type'),
  mode === 'create'
    ? body('parties')
        .isArray({ min: 1, max: 20 })
        .withMessage('Please add between 1 and 20 parties.')
        .bail()
        .custom((values: unknown[]) => {
          if (values.some((v) => typeof v !== 'string' || v.trim().length === 0 || v.length > 100)) {
            throw new Error('Please keep each party’s name to 100 characters or less.');
          }
          return true;
        })
    : stringList('parties', 'parties', 20),
  mode === 'create'
    ? requiredText('description', 'description', { min: 1, max: 3000 })
    : optionalText('description', 'description', 3000),
  stringList('mediators', 'mediators', 20),
  enumField('status', DISPUTE_STATUSES, 'status'),
  optionalLongText('resolutionNotes', 'resolution notes', 2000),
  optionalText('referredTo', 'referral', 150),
];

export const createDisputeCaseValidation = disputeFields('create');
export const updateDisputeCaseValidation = [idParam('id', 'case'), ...disputeFields('update')];

const inheritanceFields = (_mode: Mode): ValidationChain[] => [
  optionalRef('deceasedMemberId', 'member'),
  optionalText('deceasedName', 'deceased person’s name', 100),
  optionalRef('deathRegistrationId', 'death registration'),
  body('heirs')
    .optional()
    .isArray({ max: 50 })
    .withMessage('Please add 50 heirs or fewer.')
    .bail()
    .custom((values: unknown[]) => {
      const bad = values.some((h) => {
        const heir = h as { name?: unknown; relation?: unknown };
        return (
          typeof heir?.name !== 'string' || heir.name.trim().length === 0 || heir.name.length > 100 ||
          typeof heir?.relation !== 'string' || heir.relation.trim().length === 0 || heir.relation.length > 100
        );
      });
      if (bad) throw new Error('Please enter a name and a relationship for each heir.');
      return true;
    }),
  enumField('status', INHERITANCE_STATUSES, 'status'),
  optionalText('referredScholar', 'scholar’s name', 100),
  optionalLongText('notes', 'notes', 2000),
];

export const createInheritanceCaseValidation = inheritanceFields('create');
export const updateInheritanceCaseValidation = [idParam('id', 'case'), ...inheritanceFields('update')];

/* ── Development ───────────────────────────────────────────────────────── */

const projectFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'name', 'project name', { max: 150 }),
  optionalText('nameMl', 'project name', 150),
  enumOf(mode, 'area', PROJECT_AREAS, 'project area'),
  optionalLongText('proposal', 'proposal', 5000),
  money(mode, 'estimatedCost', 'estimated cost'),
  optionalText('fundingSource', 'funding source', 150),
  optionalText('responsibleTeam', 'responsible team', 150),
  optionalRef('committeeId', 'committee'),
  dateField('startDate', 'start date'),
  dateField('targetDate', 'target date'),
  dateOrder('startDate', 'targetDate', 'The target date cannot be before the start date.'),
  intField('progressPercent', 'progress', { min: 0, max: 100 }),
  enumField('status', PROJECT_STATUSES, 'status'),
  optionalLongText('completionReport', 'completion report', 5000),
];

export const createProjectValidation = projectFields('create');
export const updateProjectValidation = [idParam('id', 'project'), ...projectFields('update')];

/* ── Health ────────────────────────────────────────────────────────────── */

const healthResourceFields = (mode: Mode): ValidationChain[] => [
  enumOf(mode, 'type', HEALTH_RESOURCE_TYPES, 'type'),
  optionalRef('memberId', 'member'),
  text(mode, 'name', 'name', { max: 100 }),
  optionalText('specialty', 'specialty', 150),
  optionalText('bloodGroup', 'blood group', 10),
  phoneField('contactNo', 'contact number', { required: mode === 'create' }),
  optionalText('availability', 'availability', 200),
  optionalLongText('notes', 'notes', 2000),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createHealthResourceValidation = healthResourceFields('create');
export const updateHealthResourceValidation = [idParam('id', 'record'), ...healthResourceFields('update')];

const medicalCampFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'name', 'camp name', { max: 150 }),
  date(mode, 'campDate', 'camp date'),
  mode === 'create'
    ? requiredText('location', 'location', { min: 1, max: 200 })
    : optionalText('location', 'location', 200),
  optionalText('organizer', 'organiser', 150),
  intField('attendeeCount', 'attendee count', { min: 0, max: 1_000_000 }),
  optionalLongText('notes', 'notes', 2000),
  enumField('status', ['planned', 'completed', 'cancelled'], 'status'),
];

export const createMedicalCampValidation = medicalCampFields('create');
export const updateMedicalCampValidation = [idParam('id', 'camp'), ...medicalCampFields('update')];

/* ── Religious ─────────────────────────────────────────────────────────── */

const khateebFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'name', 'khateeb’s name', { max: 100 }),
  optionalText('nameMl', 'khateeb’s name', 100),
  optionalRef('memberId', 'member'),
  optionalText('qualifications', 'qualifications', 500),
  phoneField('contactNo', 'contact number'),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createKhateebValidation = khateebFields('create');
export const updateKhateebValidation = [idParam('id', 'khateeb'), ...khateebFields('update')];

const khutbahFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'khateebId', 'khateeb'),
  date(mode, 'date', 'khutbah date'),
  text(mode, 'topic', 'topic', { max: 200 }),
  optionalText('topicMl', 'topic', 200),
  optionalLongText('notes', 'notes', 5000),
  link('resourceUrl', 'link'),
  enumField('status', KHUTBAH_STATUSES, 'status'),
];

export const createKhutbahValidation = khutbahFields('create');
export const updateKhutbahValidation = [idParam('id', 'record'), ...khutbahFields('update')];

/* ── Library ───────────────────────────────────────────────────────────── */

const bookFields = (mode: Mode): ValidationChain[] => [
  mode === 'create'
    ? requiredText('title', 'title', { min: 1, max: 300 })
    : optionalText('title', 'title', 300),
  optionalText('titleMl', 'title', 300),
  mode === 'create'
    ? requiredText('author', 'author', { min: 1, max: 150 })
    : optionalText('author', 'author', 150),
  enumOf(mode, 'category', BOOK_CATEGORIES, 'category'),
  enumField('resourceType', RESOURCE_TYPES, 'resource type'),
  link('resourceUrl', 'link'),
  optionalText('isbn', 'ISBN', 20),
  intField('copies', 'number of copies', { min: 0, max: 100000 }),
  intField('availableCopies', 'available copies', { min: 0, max: 100000 }),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createBookValidation = bookFields('create');
export const updateBookValidation = [idParam('id', 'book'), ...bookFields('update')];

export const createBookIssueValidation = [
  requiredRef('bookId', 'book'),
  requiredRef('memberId', 'member'),
  dateField('issueDate', 'issue date'),
  dateField('dueDate', 'due date', { required: true }),
  dateOrder('issueDate', 'dueDate', 'The due date cannot be before the issue date.'),
];

/* ── Madrasa ───────────────────────────────────────────────────────────── */

const classFields = (mode: Mode): ValidationChain[] => [
  optionalRef('instituteId', 'institute'),
  mode === 'create'
    ? requiredText('name', 'class name', { min: 1, max: 100 })
    : optionalText('name', 'class name', 100),
  optionalText('nameMl', 'class name', 100),
  academicYear(mode),
  enumField('classType', CLASS_TYPES, 'class type'),
  optionalRef('teacherEmployeeId', 'teacher'),
  stringList('subjects', 'subjects', 50),
  optionalText('schedule', 'schedule', 500),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createClassValidation = classFields('create');
export const updateClassValidation = [idParam('id', 'class'), ...classFields('update')];

const enrollmentFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'classId', 'class'),
  ref(mode, 'memberId', 'student'),
  optionalText('rollNo', 'roll number', 20),
  dateField('enrollDate', 'enrolment date'),
  enumField('status', ENROLLMENT_STATUSES, 'status'),
];

export const createEnrollmentValidation = enrollmentFields('create');
export const updateEnrollmentValidation = [idParam('id', 'enrollment'), ...enrollmentFields('update')];

export const upsertAttendanceValidation = [
  requiredRef('classId', 'class'),
  dateField('date', 'date', { required: true, allowFuture: false }),
  body('records')
    .isArray({ max: 500 })
    .withMessage('Please mark 500 students or fewer at a time.')
    .bail()
    .custom((values: unknown[]) => {
      const bad = values.some((r) => {
        const record = r as { enrollmentId?: unknown; present?: unknown };
        return (
          typeof record?.enrollmentId !== 'string' ||
          !/^[a-fA-F0-9]{24}$/.test(record.enrollmentId) ||
          typeof record?.present !== 'boolean'
        );
      });
      if (bad) throw new Error('Please mark each student present or absent.');
      return true;
    }),
];

/** Marks are checked against `maxMarks` from the same body when it is present. */
const examResults = body('results')
  .optional()
  .isArray({ max: 500 })
  .withMessage('Please enter results for 500 students or fewer at a time.')
  .bail()
  .custom((values: unknown[], { req }) => {
    const max = Number(req.body?.maxMarks);
    const bad = values.some((r) => {
      const result = r as { enrollmentId?: unknown; marks?: unknown };
      const marks = Number(result?.marks);
      return (
        typeof result?.enrollmentId !== 'string' ||
        !/^[a-fA-F0-9]{24}$/.test(result.enrollmentId) ||
        !Number.isFinite(marks) ||
        marks < 0 ||
        (Number.isFinite(max) && marks > max)
      );
    });
    if (bad) throw new Error('Please enter marks between 0 and the maximum for each student.');
    return true;
  });

const examFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'classId', 'class'),
  mode === 'create'
    ? requiredText('name', 'exam name', { min: 1, max: 150 })
    : optionalText('name', 'exam name', 150),
  date(mode, 'examDate', 'exam date'),
  whole(mode, 'maxMarks', 'maximum marks', { min: 1, max: 10000 }),
  enumField('status', ['scheduled', 'completed', 'cancelled'], 'status'),
  examResults,
];

export const createExamValidation = examFields('create');
export const updateExamValidation = [idParam('id', 'exam'), ...examFields('update')];

/* ── Welfare, relief, loans, zakat ─────────────────────────────────────── */

const marriageAssistanceFields = (mode: Mode): ValidationChain[] => [
  optionalRef('memberId', 'member'),
  optionalRef('familyId', 'family'),
  enumOf(mode, 'type', MARRIAGE_ASSISTANCE_TYPES, 'assistance type'),
  amountField('amount', 'amount'),
  enumField('status', MARRIAGE_ASSISTANCE_STATUSES, 'status'),
  optionalLongText('notes', 'notes', 2000),
];

export const createMarriageAssistanceValidation = marriageAssistanceFields('create');
export const updateMarriageAssistanceValidation = [
  idParam('id', 'application'),
  ...marriageAssistanceFields('update'),
];

const reliefFields = (mode: Mode): ValidationChain[] => [
  optionalRef('familyId', 'family'),
  optionalRef('memberId', 'member'),
  text(mode, 'title', 'title', { max: 200 }),
  optionalText('titleMl', 'title', 200),
  optionalLongText('description', 'description', 3000),
  enumField('urgency', RELIEF_URGENCIES, 'urgency'),
  optionalText('assistanceGiven', 'assistance given', 500),
  amountField('amount', 'amount'),
  dateField('followUpDate', 'follow-up date'),
  optionalLongText('notes', 'notes', 2000),
];

export const createReliefCaseValidation = reliefFields('create');
export const updateReliefCaseValidation = [idParam('id', 'relief case'), ...reliefFields('update')];

const qardLoanFields = (mode: Mode): ValidationChain[] => [
  optionalRef('applicantMemberId', 'member'),
  optionalRef('familyId', 'family'),
  optionalText('applicantName', 'applicant’s name', 100),
  money(mode, 'amount', 'amount', { min: 1 }),
  enumField('purpose', QARD_PURPOSES, 'purpose'),
  optionalText('purposeDetails', 'purpose details', 1000),
  dateField('appliedDate', 'application date'),
  intField('repaymentMonths', 'repayment period in months', { min: 1, max: 600 }),
  amountField('approvedAmount', 'approved amount'),
  optionalLongText('notes', 'notes', 2000),
];

export const createQardLoanValidation = qardLoanFields('create');
export const updateQardLoanValidation = [idParam('id', 'loan'), ...qardLoanFields('update')];

export const createQardRepaymentValidation = [
  requiredRef('loanId', 'loan'),
  amountField('amount', 'amount', { required: true, min: 1 }),
  dateField('paymentDate', 'payment date', { allowFuture: false }),
  optionalText('receiptNo', 'receipt number', 50),
  optionalText('remarks', 'remarks', 500),
];

const welfareApplicationFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'schemeId', 'scheme'),
  optionalRef('familyId', 'family'),
  optionalRef('memberId', 'member'),
  money(mode, 'requestedAmount', 'requested amount', { min: 1 }),
  optionalLongText('reason', 'reason', 2000),
  enumField('priority', ['low', 'medium', 'high', 'urgent'], 'priority'),
  amountField('approvedAmount', 'approved amount'),
  optionalLongText('verificationNotes', 'verification notes', 2000),
];

export const createWelfareApplicationValidation = welfareApplicationFields('create');
export const updateWelfareApplicationValidation = [
  idParam('id', 'application'),
  ...welfareApplicationFields('update'),
];

const zakatDistributionFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'beneficiaryId', 'beneficiary'),
  money(mode, 'amount', 'amount', { min: 1 }),
  dateField('distributionDate', 'distribution date'),
  enumField('type', ['regular', 'monthly', 'fitr', 'qurbani'], 'distribution type'),
  optionalText('paymentMethod', 'payment method', 50),
  optionalText('receiptNo', 'receipt number', 50),
  optionalText('remarks', 'remarks', 500),
  boolField('postToLedger', 'ledger posting'),
];

export const createZakatDistributionValidation = zakatDistributionFields('create');
export const updateZakatDistributionValidation = [
  idParam('id', 'record'),
  ...zakatDistributionFields('update'),
];

/* ── Education, employment, volunteering ───────────────────────────────── */

const scholarshipFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'name', 'scholarship name', { max: 150 }),
  optionalText('nameMl', 'scholarship name', 150),
  money(mode, 'amount', 'amount', { min: 1 }),
  academicYear(mode),
  optionalLongText('criteria', 'criteria', 3000),
  enumField('status', ['active', 'closed'], 'status'),
];

export const createScholarshipValidation = scholarshipFields('create');
export const updateScholarshipValidation = [idParam('id', 'scholarship'), ...scholarshipFields('update')];

const awardFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'scholarshipId', 'scholarship'),
  ref(mode, 'memberId', 'student'),
  dateField('awardedDate', 'award date'),
  money(mode, 'amount', 'amount', { min: 1 }),
  enumField('status', ['applied', 'approved', 'paid'], 'status'),
  optionalText('remarks', 'remarks', 500),
];

export const createAwardValidation = awardFields('create');
export const updateAwardValidation = [idParam('id', 'award'), ...awardFields('update')];

const supportCaseFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'memberId', 'member'),
  enumOf(mode, 'type', SUPPORT_CASE_TYPES, 'support type'),
  mode === 'create'
    ? requiredText('description', 'description', { min: 1, max: 3000 })
    : optionalText('description', 'description', 3000),
  optionalText('mentorName', 'mentor’s name', 100),
  dateField('startDate', 'start date'),
  enumField('status', SUPPORT_CASE_STATUSES, 'status'),
  optionalText('outcome', 'outcome', 500),
  optionalLongText('notes', 'notes', 2000),
];

export const createSupportCaseValidation = supportCaseFields('create');
export const updateSupportCaseValidation = [idParam('id', 'case'), ...supportCaseFields('update')];

const employerFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'name', 'employer name', { max: 150 }),
  optionalText('businessType', 'business type', 100),
  optionalText('contactPerson', 'contact person', 100),
  phoneField('contactNo', 'contact number'),
  optionalText('location', 'location', 200),
  optionalRef('memberId', 'member'),
  optionalLongText('notes', 'notes', 2000),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createEmployerValidation = employerFields('create');
export const updateEmployerValidation = [idParam('id', 'employer'), ...employerFields('update')];

const vacancyFields = (mode: Mode): ValidationChain[] => [
  optionalRef('employerId', 'employer'),
  optionalText('employerName', 'employer name', 150),
  text(mode, 'title', 'job title', { max: 150 }),
  optionalText('location', 'location', 200),
  stringList('skillsRequired', 'skills', 50),
  optionalText('salaryRange', 'salary range', 100),
  enumField('status', ['open', 'filled', 'closed'], 'status'),
  dateField('postedDate', 'posting date'),
  optionalLongText('description', 'description', 5000),
];

export const createVacancyValidation = vacancyFields('create');
export const updateVacancyValidation = [idParam('id', 'vacancy'), ...vacancyFields('update')];

const trainingFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'name', 'training name', { max: 150 }),
  optionalText('trainerName', 'trainer’s name', 100),
  date(mode, 'startDate', 'start date'),
  date(mode, 'endDate', 'end date'),
  dateOrder('startDate', 'endDate', 'The end date cannot be before the start date.'),
  enumField('status', ['planned', 'ongoing', 'completed', 'cancelled'], 'status'),
];

export const createTrainingValidation = trainingFields('create');
export const updateTrainingValidation = [idParam('id', 'training'), ...trainingFields('update')];

const volunteerFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'memberId', 'member'),
  enumList('wings', VOLUNTEER_WINGS, 'wing', { required: mode === 'create' }),
  enumList('serviceTypes', SERVICE_TYPES, 'service type', { required: mode === 'create' }),
  optionalLongText('notes', 'notes', 2000),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createVolunteerValidation = volunteerFields('create');
export const updateVolunteerValidation = [idParam('id', 'volunteer'), ...volunteerFields('update')];

const assignmentFields = (mode: Mode): ValidationChain[] => [
  idArrayField('volunteerIds', 'volunteers', 200),
  ...(mode === 'create'
    ? [body('volunteerIds').isArray({ min: 1 }).withMessage('Please choose at least one volunteer.')]
    : []),
  enumOf(mode, 'serviceType', SERVICE_TYPES, 'service type'),
  date(mode, 'date', 'assignment date'),
  mode === 'create'
    ? requiredText('description', 'description', { min: 1, max: 2000 })
    : optionalText('description', 'description', 2000),
  enumField('status', ['assigned', 'completed', 'cancelled'], 'status'),
  optionalLongText('completionNotes', 'completion notes', 2000),
];

export const createAssignmentValidation = assignmentFields('create');
export const updateAssignmentValidation = [idParam('id', 'assignment'), ...assignmentFields('update')];

/* ── Cemetery ──────────────────────────────────────────────────────────── */

const cemeteryFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'name', 'cemetery name', { max: 150 }),
  optionalText('location', 'location', 200),
  whole(mode, 'capacity', 'capacity', { min: 1, max: 1_000_000 }),
  optionalLongText('notes', 'notes', 2000),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createCemeteryValidation = cemeteryFields('create');
export const updateCemeteryValidation = [idParam('id', 'cemetery'), ...cemeteryFields('update')];

const graveRecordFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'cemeteryId', 'cemetery'),
  mode === 'create'
    ? requiredText('graveNo', 'grave number', { min: 1, max: 50 })
    : optionalText('graveNo', 'grave number', 50),
  optionalRef('deceasedMemberId', 'member'),
  text(mode, 'deceasedName', 'deceased person’s name', { max: 100 }),
  dateField('dateOfDeath', 'date of death', { allowFuture: false }),
  dateField('burialDate', 'burial date'),
  optionalLongText('notes', 'notes', 2000),
];

export const createGraveRecordValidation = graveRecordFields('create');
export const updateGraveRecordValidation = [idParam('id', 'grave record'), ...graveRecordFields('update')];

/* ── Petty cash ────────────────────────────────────────────────────────── */

const pettyCashFields = (mode: Mode): ValidationChain[] => [
  ref(mode, 'instituteId', 'institute'),
  text(mode, 'custodianName', 'custodian’s name', { max: 100 }),
  money(mode, 'floatAmount', 'float amount'),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createPettyCashValidation = pettyCashFields('create');
export const updatePettyCashValidation = [idParam('id', 'entry'), ...pettyCashFields('update')];

/* ── Change requests (member portal) ───────────────────────────────────── */

export const createChangeRequestValidation = [
  enumField('targetType', ['member', 'family'], 'record type', { required: true }),
  requiredRef('targetId', 'record'),
  body('changes')
    .isArray({ min: 1, max: 50 })
    .withMessage('Please request between 1 and 50 changes at a time.')
    .bail()
    .custom((values: unknown[]) => {
      const bad = values.some((c) => {
        const change = c as { field?: unknown; newValue?: unknown };
        return (
          typeof change?.field !== 'string' || change.field.trim().length === 0 || change.field.length > 100 ||
          typeof change?.newValue !== 'string' || change.newValue.length > 1000
        );
      });
      if (bad) throw new Error('Please choose a field and enter a new value for each change.');
      return true;
    }),
  optionalText('remarks', 'remarks', 500),
];

/* ── Certificates ──────────────────────────────────────────────────────── */

export const issueCertificateValidation = [
  enumField('type', ['nikah', 'death', 'noc'], 'certificate type', { required: true }),
  requiredRef('registrationId', 'registration'),
];

/* -- the last few endpoints that carried no body rules ------------------ */

const mahalluAccountFields = (mode: Mode): ValidationChain[] => [
  text(mode, 'accountName', 'account name', { max: 150 }),
  // An account number keeps its leading zeros, so it is text, not a number.
  optionalText('accountNumber', 'account number', 34),
  optionalText('bankName', 'bank name', 150),
  optionalText('ifscCode', 'IFSC code', 11),
  amountField('balance', 'balance'),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const createMahalluAccountValidation = mahalluAccountFields('create');
export const updateMahalluAccountValidation = [
  idParam('id', 'account'),
  ...mahalluAccountFields('update'),
];

/**
 * A survey snapshot. `new Date(undefined)` is Invalid Date, which reached
 * Mongoose as a cast failure and answered 404 for what is a bad request.
 */
export const generateSurveyValidation = [
  enumField('type', ['annual', 'comprehensive'], 'survey type'),
  dateField('surveyDate', 'survey date'),
];

/**
 * A bulk import.
 *
 * The controllers already cap the row count and check the one required column
 * per row; this refuses the shapes that are not a spreadsheet at all - a string
 * where an array belongs, a row that is not an object - before any of that
 * runs, and keeps a single cell from carrying a whole document.
 */
const importRows = (field: string, label: string, requiredColumn: string) =>
  body(field)
    .isArray({ min: 1, max: 500 })
    .withMessage(`Please import between 1 and 500 ${label} at a time.`)
    .bail()
    .custom((rows: unknown[]) => {
      for (const row of rows) {
        if (typeof row !== 'object' || row === null || Array.isArray(row)) {
          throw new Error('We couldn’t read that file. Please check the columns and try again.');
        }
        const value = (row as Record<string, unknown>)[requiredColumn];
        if (typeof value !== 'string' || value.trim().length === 0) {
          throw new Error(`Please fill in the ${requiredColumn} column for every row.`);
        }
        for (const cell of Object.values(row as Record<string, unknown>)) {
          if (typeof cell === 'string' && cell.length > 1000) {
            throw new Error('One of the cells is too long. Please shorten it and try again.');
          }
        }
      }
      return true;
    });

export const bulkImportFamiliesValidation = [importRows('families', 'families', 'houseName')];

export const bulkImportMembersValidation = [
  requiredRef('familyId', 'family'),
  importRows('members', 'members', 'name'),
];

export const bulkImportBooksValidation = [importRows('books', 'books', 'title')];
