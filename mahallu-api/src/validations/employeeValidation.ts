import { body, param } from 'express-validator';
import { EMAIL_KEEP_AS_TYPED, accountNumberField, amountField, ifscField } from './common';

/** Bank details: digits-only account number, a real IFSC code. Shared by create and update. */
const bankAccountRules = () => [
  accountNumberField('bankAccount.accountNumber', 'account number', 34),
  body('bankAccount.bankName').optional().trim().isLength({ max: 150 }).withMessage('Please keep the bank name to 150 characters or less.'),
  ifscField('bankAccount.ifscCode', 'IFSC code'),
];

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
  // 0 is allowed (an honorary post); it is a rate, not a payment. Payments need a base salary above zero.
  amountField('salary', 'salary', { required: true }),
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
    .normalizeEmail(EMAIL_KEEP_AS_TYPED),
  body('department').optional().trim(),
  body('joinDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid join date.'),
  body('address').optional().trim(),
  body('qualifications').optional().trim(),
  ...bankAccountRules(),
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
  amountField('salary', 'salary'),
  body('instituteId').optional({ values: 'falsy' }).isMongoId().withMessage('Please select a valid institute.'),
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
    .normalizeEmail(EMAIL_KEEP_AS_TYPED),
  body('department').optional().trim(),
  body('joinDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid join date.'),
  body('address').optional().trim(),
  body('qualifications').optional().trim(),
  ...bankAccountRules(),
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
