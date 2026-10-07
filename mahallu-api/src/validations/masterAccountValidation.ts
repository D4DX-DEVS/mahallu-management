import { body, param } from 'express-validator';
import { accountNumberField, amountField, ifscField } from './common';

// Common param validation for :id routes
export const idParamValidation = [
  param('id').isMongoId().withMessage('Please choose a valid ID.'),
];

// Institute Account Validations
export const createInstituteAccountValidation = [
  body('instituteId')
    .notEmpty()
    .withMessage('Please select an institute before continuing.')
    .isMongoId()
    .withMessage('Please select a valid institute.'),
  body('accountName')
    .trim()
    .notEmpty()
    .withMessage('Please enter the account name.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the account name between 2 and 200 characters.'),
  accountNumberField('accountNumber', 'account number'),
  body('bankName').optional().trim(),
  ifscField('ifscCode', 'IFSC code'),
  // An opening balance can be set once, here. Updates ignore `balance` (see updateInstituteAccount).
  amountField('balance', 'opening balance'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

// Category Validations
export const createCategoryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please select the category name.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the category name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('description').optional().trim(),
  body('type')
    .isIn(['income', 'expense'])
    .withMessage('Please choose a valid category type.'),
];

// Master Wallet Validations
export const createWalletValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please enter the wallet name.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the wallet name between 2 and 200 characters.'),
  amountField('balance', 'opening balance'),
  body('type')
    .isIn(['main', 'reserve', 'charity'])
    .withMessage('Please choose a valid wallet type.'),
];

// Ledger Validations
export const createLedgerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please select the ledger name.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the ledger name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('description').optional().trim(),
  body('type')
    .isIn(['income', 'expense'])
    .withMessage('Please choose a valid ledger type.'),
];

// Ledger Item Validations
export const createLedgerItemValidation = [
  body('ledgerId')
    .notEmpty()
    .withMessage('Please select the ledger ID.')
    .isMongoId()
    .withMessage('Please select a valid ledger.'),
  body('date')
    .notEmpty()
    .withMessage('Please select the date.')
    .isISO8601()
    .withMessage('Please choose a valid date.'),
  amountField('amount', 'amount', { required: true, min: 0.01 }),
  body('type')
    .notEmpty()
    .withMessage('Please select the type.')
    .isIn(['income', 'expense'])
    .withMessage('Please choose either income or expense.'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Please enter the description.')
    .isLength({ min: 1, max: 500 })
    .withMessage('Please keep the description between 1 and 500 characters.'),
  body('categoryId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid category.'),
  body('paymentMethod').optional().trim(),
  body('referenceNo').optional().trim(),
];

// Update Validations (all fields optional)
export const updateInstituteAccountValidation = [
  ...idParamValidation,
  body('accountName').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Please keep the account name between 2 and 200 characters.'),
  accountNumberField('accountNumber', 'account number'),
  body('bankName').optional().trim(),
  ifscField('ifscCode', 'IFSC code'),
  // `balance` is not editable: the books move it. Any value sent is dropped by the controller.
  body('status').optional().isIn(['active', 'inactive']).withMessage('Please choose a valid status.'),
];

export const updateCategoryValidation = [
  ...idParamValidation,
  body('name').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Please keep the category name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('description').optional().trim(),
  body('type').optional().isIn(['income', 'expense']).withMessage('Please choose a valid category type.'),
];

export const updateWalletValidation = [
  ...idParamValidation,
  body('name').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Please keep the wallet name between 2 and 200 characters.'),
  body('type').optional().isIn(['main', 'reserve', 'charity']).withMessage('Please choose a valid wallet type.'),
];

export const updateLedgerValidation = [
  ...idParamValidation,
  body('name').optional().trim().isLength({ min: 2, max: 200 }).withMessage('Please keep the ledger name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('description').optional().trim(),
  body('type').optional().isIn(['income', 'expense']).withMessage('Please choose a valid ledger type.'),
];

export const updateLedgerItemValidation = [
  ...idParamValidation,
  body('ledgerId').optional().isMongoId().withMessage('Please select a valid ledger.'),
  body('date').optional().isISO8601().withMessage('Please choose a valid date.'),
  amountField('amount', 'amount', { min: 0.01 }),
  body('type').optional().isIn(['income', 'expense']).withMessage('Please choose either income or expense.'),
  body('description').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Please keep the description between 1 and 500 characters.'),
  body('categoryId').optional().isMongoId().withMessage('Please select a valid category.'),
  body('paymentMethod').optional().trim(),
  body('referenceNo').optional().trim(),
];

