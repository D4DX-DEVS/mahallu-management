import { body, param } from 'express-validator';

export const createEmployeeValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please enter the employee name.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the employee name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('instituteId')
    .notEmpty()
    .withMessage('Please select an institute before continuing.')
    .isMongoId()
    .withMessage('Please select a valid institute.'),
  body('designation')
    .trim()
    .notEmpty()
    .withMessage('Please enter the designation.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the designation between 2 and 100 characters.'),
  body('designationMl').optional().trim(),
  body('salary')
    .notEmpty()
    .withMessage('Please enter the salary.')
    .isFloat({ min: 0 })
    .withMessage('Please enter a salary greater than zero.'),
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
  body('department').optional().trim(),
  body('joinDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid join date.'),
  body('address').optional().trim(),
  body('qualifications').optional().trim(),
  body('bankAccount.accountNumber').optional().trim(),
  body('bankAccount.bankName').optional().trim(),
  body('bankAccount.ifscCode').optional().trim(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

export const updateEmployeeValidation = [
  param('id').isMongoId().withMessage('Please select a valid employee.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the employee name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('designation')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the designation between 2 and 100 characters.'),
  body('designationMl').optional().trim(),
  body('salary')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter a salary greater than zero.'),
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
  body('department').optional().trim(),
  body('joinDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid join date.'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

export const getEmployeeValidation = [
  param('id').isMongoId().withMessage('Please select a valid employee.'),
];

export const deleteEmployeeValidation = [
  param('id').isMongoId().withMessage('Please select a valid employee.'),
];
