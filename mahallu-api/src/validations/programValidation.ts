import { body, param } from 'express-validator';

// Programs use the Institute model with type='program'
export const createProgramValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Program name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Program name must be between 2 and 200 characters'),
  body('nameMl').optional().trim(),
  body('place')
    .trim()
    .notEmpty()
    .withMessage('Place is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Place must be between 1 and 200 characters'),
  body('placeMl').optional().trim(),
  body('joinDate')
    .optional()
    .isISO8601()
    .withMessage('Join date must be a valid date'),
  body('description').optional().trim(),
  body('contactNo')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{10,11}$/)
    .withMessage('Contact number must be 10 or 11 digits'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),
  body('address.state').optional().trim(),
  body('address.district').optional().trim(),
  body('address.pinCode').optional().trim(),
  body('address.postOffice').optional().trim(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Invalid status'),
];

export const updateProgramValidation = [
  param('id').isMongoId().withMessage('Invalid program ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Program name must be between 2 and 200 characters'),
  body('nameMl').optional().trim(),
  body('place')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Place must be between 1 and 200 characters'),
  body('placeMl').optional().trim(),
  body('joinDate')
    .optional()
    .isISO8601()
    .withMessage('Join date must be a valid date'),
  body('description').optional().trim(),
  body('contactNo')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{10,11}$/)
    .withMessage('Contact number must be 10 or 11 digits'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Invalid status'),
];

export const getProgramValidation = [
  param('id').isMongoId().withMessage('Invalid program ID'),
];

export const deleteProgramValidation = [
  param('id').isMongoId().withMessage('Invalid program ID'),
];

