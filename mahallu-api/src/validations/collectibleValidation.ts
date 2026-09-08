import { body, param, query } from 'express-validator';

// Varisangya Validations
export const createVarisangyaValidation = [
  body('familyId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid family.'),
  body('memberId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid member.'),
  body('amount')
    .notEmpty()
    .withMessage('Please enter the amount.')
    .isFloat({ min: 0 })
    .withMessage('Please enter an amount greater than zero.'),
  body('paymentDate')
    .notEmpty()
    .withMessage('Please select the payment date.')
    .isISO8601()
    .withMessage('Please choose a valid payment date.'),
  body('paymentMethod').optional().trim(),
  body('receiptNo').optional().trim(),
  body('remarks').optional().trim(),
  body('remarksMl').optional().trim(),
];

export const updateVarisangyaValidation = [
  param('id').isMongoId().withMessage('Please select a valid varisangya.'),
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter an amount greater than zero.'),
  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid payment date.'),
  body('paymentMethod').optional().trim(),
  body('remarks').optional().trim(),
  body('remarksMl').optional().trim(),
];

// Zakat Validations
export const createZakatValidation = [
  body('payerName')
    .trim()
    .notEmpty()
    .withMessage('Please enter the payer name.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the payer name between 2 and 100 characters.'),
  body('payerId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid payer member.'),
  body('amount')
    .notEmpty()
    .withMessage('Please enter the amount.')
    .isFloat({ min: 0 })
    .withMessage('Please enter an amount greater than zero.'),
  body('paymentDate')
    .notEmpty()
    .withMessage('Please select the payment date.')
    .isISO8601()
    .withMessage('Please choose a valid payment date.'),
  body('paymentMethod').optional().trim(),
  body('receiptNo').optional().trim(),
  body('category').optional().trim(),
  body('remarks').optional().trim(),
  body('remarksMl').optional().trim(),
];

// Wallet Validations
export const getWalletTransactionsValidation = [
  param('walletId').isMongoId().withMessage('Please select a valid wallet.'),
  query('page').optional().isInt({ min: 1 }).withMessage('Please enter a whole page greater than zero.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Please enter a limit between 1 and 100.'),
];

