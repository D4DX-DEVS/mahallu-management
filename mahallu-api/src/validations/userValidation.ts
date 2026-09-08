import { body, param, query } from 'express-validator';

export const createUserValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please enter the name.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the name between 2 and 100 characters.'),
  body('nameMl').optional().trim(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Please enter your phone number.')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit phone number.'),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['super_admin', 'mahall', 'survey', 'institute', 'member'])
    .withMessage('Please choose a valid role.'),
  body('password')
    .optional()
    // bcrypt reads the first 72 bytes and ignores the rest, so a longer one is
    // hashing cost with no security value.
    .isLength({ min: 6, max: 128 })
    .withMessage('Please use between 6 and 128 characters for the password.'),
  body('tenantId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid Mahallu.'),
  body('memberId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid member.'),
  body('permissions.view').optional().isBoolean().withMessage('Please choose yes or no for the view permission.'),
  body('permissions.add').optional().isBoolean().withMessage('Please choose yes or no for the add permission.'),
  body('permissions.edit').optional().isBoolean().withMessage('Please choose yes or no for the edit permission.'),
  body('permissions.delete').optional().isBoolean().withMessage('Please choose yes or no for the delete permission.'),
];

export const updateUserValidation = [
  param('id').isMongoId().withMessage('Please select a valid user.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the name between 2 and 100 characters.'),
  body('nameMl').optional().trim(),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit phone number.'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

export const getUserValidation = [
  param('id').isMongoId().withMessage('Please select a valid user.'),
];

export const deleteUserValidation = [
  param('id').isMongoId().withMessage('Please select a valid user.'),
];

