import { body, param, query, ValidationChain } from 'express-validator';
import { amountField, optionalText } from './common';
import { CLIENT_RECEIPT_PATTERN } from '../services/receiptNumberService';

/*
 * Request validation for the collections routes.
 *
 * Wire these in routes/collectibleRoutes.ts (the controller re-checks everything defensively, so a
 * route that is not wired yet stays safe, it just answers with the controller's own messages):
 *   router.post('/varisangya', createVarisangyaValidation, validationHandler, createVarisangya)
 *   router.put('/varisangya/:id', updateVarisangyaValidation, validationHandler, updateVarisangya)
 *   router.post('/zakat', createZakatValidation, validationHandler, createZakat)
 *   router.put('/zakat/:id', updateZakatValidation, validationHandler, updateZakat)       <- NEW (was idParam only)
 *   router.get('/summary', collectionsSummaryValidation, validationHandler, getCollectionsSummary)  <- NEW
 *   router.get('/wallet', walletQueryValidation, validationHandler, getWallet)
 */

/** Retried / double-submitted creates carry the same id and produce one payment. 8-64 characters. */
export const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9_\-:.]{8,64}$/;

const clientRequestId = (): ValidationChain =>
  body('clientRequestId')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('The request id must be text.')
    .bail()
    .matches(CLIENT_REQUEST_ID_PATTERN)
    .withMessage('The request id must be 8 to 64 letters, numbers, dashes or underscores.');

const receiptNo = (): ValidationChain =>
  body('receiptNo')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Please enter a valid receipt number.')
    .bail()
    .trim()
    .matches(CLIENT_RECEIPT_PATTERN)
    .withMessage('The receipt number may use letters, numbers, dashes, dots and slashes (up to 32 characters).');

const paymentDate = (required: boolean): ValidationChain => {
  const chain = body('paymentDate');
  return (required
    ? chain.notEmpty().withMessage('Please select the payment date.').bail()
    : chain.optional()
  )
    .isISO8601()
    .withMessage('Please choose a valid payment date.');
};

// Varisangya Validations
export const createVarisangyaValidation = [
  body('familyId').optional({ values: 'falsy' }).isMongoId().withMessage('Please select a valid family.'),
  body('memberId').optional({ values: 'falsy' }).isMongoId().withMessage('Please select a valid member.'),
  amountField('amount', 'amount', { required: true, min: 0.01 }),
  paymentDate(true),
  optionalText('paymentMethod', 'payment method', 100),
  receiptNo(),
  optionalText('remarks', 'remarks', 2000),
  optionalText('remarksMl', 'remarks', 2000),
  clientRequestId(),
];

export const updateVarisangyaValidation = [
  param('id').isMongoId().withMessage('Please select a valid varisangya.'),
  amountField('amount', 'amount', { min: 0.01 }),
  paymentDate(false),
  optionalText('paymentMethod', 'payment method', 100),
  optionalText('remarks', 'remarks', 2000),
  optionalText('remarksMl', 'remarks', 2000),
];

// Zakat Validations
export const createZakatValidation = [
  body('payerName')
    .trim()
    .notEmpty()
    .withMessage('Please enter the payer name.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the payer name between 2 and 100 characters.'),
  body('payerId').optional({ values: 'falsy' }).isMongoId().withMessage('Please select a valid payer member.'),
  amountField('amount', 'amount', { required: true, min: 0.01 }),
  paymentDate(true),
  optionalText('paymentMethod', 'payment method', 100),
  receiptNo(),
  optionalText('category', 'category', 100),
  optionalText('remarks', 'remarks', 2000),
  optionalText('remarksMl', 'remarks', 2000),
  clientRequestId(),
];

/**
 * Zakat update. Only payer name, amount, date, method, category and remarks can change; status,
 * receiptNo, source, payerId, verifiedBy and tenantId in the body are ignored by the controller.
 */
export const updateZakatValidation = [
  param('id').isMongoId().withMessage('Please select a valid zakat payment.'),
  body('payerName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the payer name between 2 and 100 characters.'),
  amountField('amount', 'amount', { min: 0.01 }),
  paymentDate(false),
  optionalText('paymentMethod', 'payment method', 100),
  optionalText('category', 'category', 100),
  optionalText('remarks', 'remarks', 2000),
  optionalText('remarksMl', 'remarks', 2000),
];

// Summary (Collections overview)
export const collectionsSummaryValidation = [
  query('dateFrom').optional({ values: 'falsy' }).isString().isLength({ max: 10 }).withMessage('Please choose a valid start date.'),
  query('dateTo').optional({ values: 'falsy' }).isString().isLength({ max: 10 }).withMessage('Please choose a valid end date.'),
];

// Wallet Validations
export const walletQueryValidation = [
  query('familyId').optional({ values: 'falsy' }).isMongoId().withMessage('Please select a valid family.'),
  query('memberId').optional({ values: 'falsy' }).isMongoId().withMessage('Please select a valid member.'),
];

/**
 * GET /collectibles/wallets: paginated balances for every family or member of the Mahallu.
 * `type` is required so a typo never silently answers with the other list.
 */
export const walletListValidation = [
  query('type')
    .exists({ values: 'falsy' })
    .withMessage('Please choose whether to list family or member wallets.')
    .bail()
    .isIn(['family', 'member'])
    .withMessage('Please choose family or member wallets.'),
  query('page').optional({ values: 'falsy' }).isInt({ min: 1, max: 100000 }).withMessage('Please choose a valid page.'),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 100 }).withMessage('Please request between 1 and 100 items at a time.'),
  query('search')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Please enter a search term.')
    .bail()
    .isLength({ max: 100 })
    .withMessage('Please use a shorter search term.'),
];

export const getWalletTransactionsValidation = [
  param('walletId').isMongoId().withMessage('Please select a valid wallet.'),
  query('page').optional().isInt({ min: 1 }).withMessage('Please enter a whole page greater than zero.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Please enter a limit between 1 and 100.'),
  query('type').optional({ values: 'falsy' }).isIn(['credit', 'debit']).withMessage('Please choose credit or debit.'),
];
