import { body, param, query } from 'express-validator';

/**
 * Rules for `/api/member-user/*` — the twenty endpoints the member portal and
 * the mobile app talk to.
 *
 * The controllers already scope every read and write to the caller's own member
 * record and allowlist which fields a member may set, so identity and ownership
 * were never the hole. What was missing is the *shape* of what they send: an
 * amount could be `1e308`, a payment could be dated in year 9999, a name could
 * be a megabyte of text, and a bad `:id` in the path reached Mongoose as a cast
 * failure. Everything below is field-level; nothing here re-decides ownership.
 */

/** No money value in this product is larger than this. Keeps `1e308` out of a Number field. */
const MAX_AMOUNT = 10_000_000;

/** Dates outside this window are a typo or a probe, never a real record. */
const EARLIEST_DATE = '1900-01-01';

const isNotFuture = (value: string, label: string) => {
  const date = new Date(value);
  // End of today, so a submission made today is never rejected for being "future".
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (date.getTime() > endOfToday.getTime()) {
    throw new Error(label);
  }
  return true;
};

/** A required person's name — the field a form marks with an asterisk. */
const requiredName = (field: string, label: string) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`Please enter the ${label}.`)
    .isLength({ min: 2, max: 100 })
    .withMessage(`Please keep the ${label} between 2 and 100 characters.`);

const optionalName = (field: string, label: string) =>
  body(field)
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage(`Please keep the ${label} between 2 and 100 characters.`);

const optionalText = (field: string, label: string, max = 500) =>
  body(field)
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max })
    .withMessage(`Please keep the ${label} to ${max} characters or less.`);

const optionalAge = (field: string, label: string) =>
  body(field)
    .optional({ values: 'falsy' })
    .isInt({ min: 0, max: 120 })
    .withMessage(`Please enter a valid ${label}.`);

const optionalPhone = (field: string, label: string) =>
  body(field)
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage(`Please enter a 10-digit ${label}.`);

const optionalMemberRef = (field: string, label: string) =>
  body(field)
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage(`Please select a valid ${label}.`);

/** Attached document ids: a short list of real ids, never an arbitrary payload. */
const documentIds = body('documents')
  .optional()
  .isArray({ max: 20 })
  .withMessage('Please attach 20 documents or fewer.')
  .bail()
  .custom((values: unknown[]) => {
    if (values.some((v) => typeof v !== 'string' || !/^[a-fA-F0-9]{24}$/.test(v))) {
      throw new Error('One of the attached files is no longer available. Please attach it again.');
    }
    return true;
  });

/** Page and limit, on every list endpoint the portal calls. */
export const listQueryValidation = [
  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 100000 })
    .withMessage('Please choose a valid page.'),
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 100 })
    .withMessage('Please request between 1 and 100 items at a time.'),
];

export const paymentsQueryValidation = [
  ...listQueryValidation,
  query('type')
    .optional({ values: 'falsy' })
    .isIn(['varisangya', 'zakat'])
    .withMessage('Please choose a valid payment type.'),
];

export const registrationsQueryValidation = [
  ...listQueryValidation,
  query('type')
    .optional({ values: 'falsy' })
    .isIn(['nikah', 'death', 'noc'])
    .withMessage('Please choose a valid registration type.'),
];

/**
 * The two fields a member may change on their own record. The controller
 * allowlists them; these decide whether the values are usable.
 */
export const updateOwnProfileValidation = [
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit phone number.'),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 254 })
    .withMessage('Please enter a shorter email address.')
    .bail()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false }),
];

const paymentBase = [
  body('amount')
    .notEmpty()
    .withMessage('Please enter the amount.')
    .bail()
    .isFloat({ min: 1, max: MAX_AMOUNT })
    .withMessage(`Please enter an amount between 1 and ${MAX_AMOUNT.toLocaleString('en-IN')}.`),
  body('paymentDate')
    .notEmpty()
    .withMessage('Please choose the payment date.')
    .bail()
    .isISO8601()
    .withMessage('Please choose a valid payment date.')
    .bail()
    .isAfter(EARLIEST_DATE)
    .withMessage('Please choose a valid payment date.')
    .custom((value) => isNotFuture(value, 'The payment date cannot be in the future.')),
  body('paymentMethod')
    .optional({ values: 'falsy' })
    .trim()
    .isIn(['cash', 'upi', 'bank', 'cheque', 'card', 'other'])
    .withMessage('Please choose a valid payment method.'),
  optionalText('remarks', 'remarks', 300),
];

export const varisangyaPaymentValidation = [...paymentBase];

export const zakatPaymentValidation = [
  ...paymentBase,
  optionalText('category', 'category', 100),
];

export const nikahRequestValidation = [
  body('mahallMemberType')
    .optional({ values: 'falsy' })
    .isIn(['groom', 'bride'])
    .withMessage('Please choose whether the Mahallu member is the groom or the bride.'),
  optionalName('brideName', 'bride’s name'),
  optionalName('groomName', 'groom’s name'),
  optionalName('brideNameMl', 'bride’s name'),
  optionalName('groomNameMl', 'groom’s name'),
  optionalAge('brideAge', 'age for the bride'),
  optionalAge('groomAge', 'age for the groom'),
  body('nikahDate')
    .notEmpty()
    .withMessage('Please choose the nikah date.')
    .bail()
    .isISO8601()
    .withMessage('Please choose a valid nikah date.')
    .bail()
    .isAfter(EARLIEST_DATE)
    .withMessage('Please choose a valid nikah date.'),
  optionalText('venue', 'venue', 200),
  optionalName('waliName', 'wali’s name'),
  optionalName('witness1', 'first witness’s name'),
  optionalName('witness2', 'second witness’s name'),
  body('mahrAmount')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: MAX_AMOUNT })
    .withMessage('Please enter a valid mahr amount.'),
  optionalText('mahrDescription', 'mahr details', 300),
  optionalMemberRef('subjectMemberId', 'family member'),
  documentIds,
];

export const deathRequestValidation = [
  body('deathDate')
    .notEmpty()
    .withMessage('Please choose the date of death.')
    .bail()
    .isISO8601()
    .withMessage('Please choose a valid date of death.')
    .bail()
    .isAfter(EARLIEST_DATE)
    .withMessage('Please choose a valid date of death.')
    .custom((value) => isNotFuture(value, 'The date of death cannot be in the future.')),
  optionalText('placeOfDeath', 'place of death', 200),
  optionalText('causeOfDeath', 'cause of death', 300),
  optionalName('informantName', 'informant’s name'),
  optionalText('informantRelation', 'relationship to the informant', 100),
  optionalPhone('informantPhone', 'phone number for the informant'),
  optionalMemberRef('deceasedMemberId', 'family member'),
  documentIds,
];

export const nocRequestValidation = [
  body('type')
    .notEmpty()
    .withMessage('Please choose the certificate type.')
    .bail()
    .isIn(['common', 'nikah'])
    .withMessage('Please choose a valid certificate type.'),
  optionalText('purpose', 'purpose', 300),
  optionalText('purposeTitle', 'purpose', 150),
  optionalText('purposeTitleMl', 'purpose', 150),
  optionalText('purposeDescription', 'description', 1000),
  optionalText('remarks', 'remarks', 300),
  // Only read when type is 'nikah'; validated whenever present so a stray value
  // cannot be stored on a common NOC either.
  body('mahallMemberType')
    .optional({ values: 'falsy' })
    .isIn(['groom', 'bride'])
    .withMessage('Please choose whether the Mahallu member is the groom or the bride.'),
  optionalName('brideName', 'bride’s name'),
  optionalName('groomName', 'groom’s name'),
  optionalAge('brideAge', 'age for the bride'),
  optionalAge('groomAge', 'age for the groom'),
  body('nikahDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Please choose a valid nikah date.')
    .bail()
    .isAfter(EARLIEST_DATE)
    .withMessage('Please choose a valid nikah date.'),
  optionalText('venue', 'venue', 200),
  optionalName('waliName', 'wali’s name'),
  optionalName('witness1', 'first witness’s name'),
  optionalName('witness2', 'second witness’s name'),
  body('mahrAmount')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: MAX_AMOUNT })
    .withMessage('Please enter a valid mahr amount.'),
  optionalText('mahrDescription', 'mahr details', 300),
  optionalMemberRef('subjectMemberId', 'family member'),
  documentIds,
];

/** `:type` and `:id` on resubmit and cancel. */
export const ownRegistrationParamValidation = [
  param('type')
    .isIn(['nikah', 'death', 'noc'])
    .withMessage('Please choose a valid registration type.'),
  param('id').isMongoId().withMessage("We couldn't find that registration. It may have been removed."),
];

/**
 * Resubmit carries whichever editable fields changed. The controller decides
 * which of them apply to the type; these keep every one of them in shape.
 */
export const resubmitRegistrationValidation = [
  ...ownRegistrationParamValidation,
  optionalName('groomName', 'groom’s name'),
  optionalName('groomNameMl', 'groom’s name'),
  optionalName('brideName', 'bride’s name'),
  optionalName('brideNameMl', 'bride’s name'),
  optionalAge('groomAge', 'age for the groom'),
  optionalAge('brideAge', 'age for the bride'),
  body('nikahDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Please choose a valid nikah date.'),
  optionalText('venue', 'venue', 200),
  optionalName('waliName', 'wali’s name'),
  optionalName('witness1', 'first witness’s name'),
  optionalName('witness2', 'second witness’s name'),
  body('mahrAmount')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: MAX_AMOUNT })
    .withMessage('Please enter a valid mahr amount.'),
  optionalText('mahrDescription', 'mahr details', 300),
  body('deathDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Please choose a valid date of death.')
    .custom((value) => isNotFuture(value, 'The date of death cannot be in the future.')),
  optionalText('placeOfDeath', 'place of death', 200),
  optionalText('causeOfDeath', 'cause of death', 300),
  optionalName('informantName', 'informant’s name'),
  optionalText('informantRelation', 'relationship to the informant', 100),
  optionalPhone('informantPhone', 'phone number for the informant'),
  optionalText('purposeTitle', 'purpose', 150),
  optionalText('purposeTitleMl', 'purpose', 150),
  optionalText('purposeDescription', 'description', 1000),
  optionalText('purpose', 'purpose', 300),
  optionalPhone('applicantPhone', 'phone number'),
  documentIds,
];
