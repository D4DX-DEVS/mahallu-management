import { body, param } from 'express-validator';

// Nikah Registration Validations
export const createNikahRegistrationValidation = [
  body('groomName')
    .trim()
    .notEmpty()
    .withMessage('Please enter the groom name.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the groom name between 2 and 100 characters.'),
  body('groomNameMl').optional().trim(),
  body('groomAge')
    .optional()
    .isInt({ min: 0, max: 150 })
    .withMessage('Please enter a groom age between 0 and 150.'),
  body('groomId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid groom member.'),
  body('brideName')
    .trim()
    .notEmpty()
    .withMessage('Please enter the bride name.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the bride name between 2 and 100 characters.'),
  body('brideNameMl').optional().trim(),
  body('brideAge')
    .optional()
    .isInt({ min: 0, max: 150 })
    .withMessage('Please enter a bride age between 0 and 150.'),
  body('brideId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid bride member.'),
  body('mahallMemberType')
    .optional()
    .isIn(['groom', 'bride'])
    .withMessage('Please choose a valid mahall member type.'),
  body('nikahDate')
    .notEmpty()
    .withMessage('Please select the nikah date.')
    .isISO8601()
    .withMessage('Please choose a valid nikah date.'),
  body('mahallId').optional().trim(),
  body('waliName').optional().trim(),
  body('witness1').optional().trim(),
  body('witness2').optional().trim(),
  body('mahrAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter a mahr amount greater than zero.'),
  body('mahrDescription').optional().trim(),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Please choose a valid status.'),
  body('remarks').optional().trim(),
];

export const getNikahRegistrationValidation = [
  param('id').isMongoId().withMessage('Please select a valid nikah registration.'),
];

export const updateNikahRegistrationValidation = [
  param('id').isMongoId().withMessage('Please select a valid nikah registration.'),
  body('groomName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the groom name between 2 and 100 characters.'),
  body('groomNameMl').optional().trim(),
  body('groomAge')
    .optional()
    .isInt({ min: 0, max: 150 })
    .withMessage('Please enter a groom age between 0 and 150.'),
  body('groomId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid groom member.'),
  body('brideName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the bride name between 2 and 100 characters.'),
  body('brideNameMl').optional().trim(),
  body('brideAge')
    .optional()
    .isInt({ min: 0, max: 150 })
    .withMessage('Please enter a bride age between 0 and 150.'),
  body('brideId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid bride member.'),
  body('mahallMemberType')
    .optional()
    .isIn(['groom', 'bride'])
    .withMessage('Please choose a valid mahall member type.'),
  body('nikahDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid nikah date.'),
  body('mahallId').optional().trim(),
  body('waliName').optional().trim(),
  body('witness1').optional().trim(),
  body('witness2').optional().trim(),
  body('mahrAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter a mahr amount greater than zero.'),
  body('mahrDescription').optional().trim(),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Please choose a valid status.'),
  body('remarks').optional().trim(),
];

// Death Registration Validations
export const createDeathRegistrationValidation = [
  body('deceasedName')
    .trim()
    .notEmpty()
    .withMessage('Please enter the deceased name.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the deceased name between 2 and 100 characters.'),
  body('deceasedNameMl').optional().trim(),
  body('deceasedId')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('Please select a valid deceased member.'),
  body('deathDate')
    .notEmpty()
    .withMessage('Please select the death date.')
    .isISO8601()
    .withMessage('Please choose a valid death date.'),
  body('placeOfDeath').optional().trim(),
  body('causeOfDeath').optional().trim(),
  body('mahallId').optional().trim(),
  body('familyId')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('Please select a valid family.'),
  body('informantName').optional().trim(),
  body('informantRelation').optional().trim(),
  body('informantPhone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit informant phone.'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Please choose a valid status.'),
  body('remarks').optional().trim(),
];

export const getDeathRegistrationValidation = [
  param('id').isMongoId().withMessage('Please select a valid death registration.'),
];

export const updateDeathRegistrationValidation = [
  param('id').isMongoId().withMessage('Please select a valid death registration.'),
  body('deceasedName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the deceased name between 2 and 100 characters.'),
  body('deceasedId')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('Please select a valid deceased member.'),
  body('deathDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid death date.'),
  body('placeOfDeath').optional().trim(),
  body('causeOfDeath').optional().trim(),
  body('mahallId').optional().trim(),
  body('familyId')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('Please select a valid family.'),
  body('informantName').optional().trim(),
  body('informantRelation').optional().trim(),
  body('informantPhone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit informant phone.'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Please choose a valid status.'),
  body('remarks').optional().trim(),
];

// NOC Validations
export const createNOCValidation = [
  body('applicantName')
    .trim()
    .notEmpty()
    .withMessage('Please enter the applicant name.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the applicant name between 2 and 100 characters.'),
  body('applicantNameMl').optional().trim(),
  body('applicantId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid applicant member.'),
  body('applicantPhone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit applicant phone.'),
  body('purposeTitle')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the purpose title between 2 and 200 characters.'),
  body('purposeTitleMl').optional().trim(),
  body('purposeDescription')
    .optional()
    .isLength({ min: 2 })
    .withMessage('Please use at least 2 characters for the purpose description.'),
  body('purpose')
    .optional()
    .trim()
    .isLength({ min: 2, max: 500 })
    .withMessage('Please keep the purpose between 2 and 500 characters.'),
  body('type')
    .isIn(['common', 'nikah'])
    .withMessage('Please choose a valid NOC type.'),
  body('nikahRegistrationId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid nikah registration.'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Please choose a valid status.'),
  body('issuedDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid issued date.'),
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid expiry date.'),
  body('remarks').optional().trim(),
];

export const updateNOCValidation = [
  param('id').isMongoId().withMessage('Please select a valid NOC.'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Please choose a valid status.'),
  body('issuedDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid issued date.'),
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid expiry date.'),
  body('purposeTitle')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the purpose title between 2 and 200 characters.'),
  body('purposeTitleMl').optional().trim(),
  body('purposeDescription')
    .optional()
    .isLength({ min: 2 })
    .withMessage('Please use at least 2 characters for the purpose description.'),
  body('purpose')
    .optional()
    .trim()
    .isLength({ min: 2, max: 500 })
    .withMessage('Please keep the purpose between 2 and 500 characters.'),
  body('remarks').optional().trim(),
];

export const getNOCValidation = [
  param('id').isMongoId().withMessage('Please select a valid NOC.'),
];

