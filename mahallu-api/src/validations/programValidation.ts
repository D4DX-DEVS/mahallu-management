import { body, param } from 'express-validator';

// Programs use the Institute model with type='program'
export const createProgramValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please enter the program name.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the program name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('place')
    .trim()
    .notEmpty()
    .withMessage('Please enter the place.')
    .isLength({ min: 1, max: 200 })
    .withMessage('Please keep the place between 1 and 200 characters.'),
  body('placeMl').optional().trim(),
  body('joinDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid join date.'),
  body('description').optional().trim(),
  body('contactNo')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{10,11}$/)
    .withMessage('Please choose either 10 or 11 digits.'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('address.state').optional().trim(),
  body('address.district').optional().trim(),
  body('address.pinCode').optional().trim(),
  body('address.postOffice').optional().trim(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

export const updateProgramValidation = [
  param('id').isMongoId().withMessage('Please select a valid program.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the program name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('place')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Please keep the place between 1 and 200 characters.'),
  body('placeMl').optional().trim(),
  body('joinDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid join date.'),
  body('description').optional().trim(),
  body('contactNo')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{10,11}$/)
    .withMessage('Please choose either 10 or 11 digits.'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

export const getProgramValidation = [
  param('id').isMongoId().withMessage('Please select a valid program.'),
];

export const deleteProgramValidation = [
  param('id').isMongoId().withMessage('Please select a valid program.'),
];

