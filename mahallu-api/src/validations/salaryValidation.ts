import { body, param } from 'express-validator';
import { amountField } from './common';

/**
 * Salary payment rules.
 *
 * `netAmount` is deliberately not a field here: the server computes it from
 * base + allowances - deductions and ignores whatever a client sends. Amounts
 * are rupees with at most two decimals and never above the product maximum;
 * the base salary must be greater than zero, allowances and deductions may be 0.
 */

const MONTH_MSG = 'Please enter a month between 1 and 12.';
const YEAR_MSG = 'Please choose either 2000 or later.';

/** Net pay (base + allowances - deductions) can never be negative. */
const netNotNegative = body('deductions').custom((_value, { req }) => {
  const num = (v: unknown) => (v === undefined || v === null || v === '' ? 0 : Number(v));
  const data = req.body || {};
  if (data.baseSalary === undefined) return true; // an update that leaves the salary parts alone
  if (num(data.baseSalary) + num(data.allowances) - num(data.deductions) < 0) {
    throw new Error('Deductions cannot be more than the base salary plus allowances.');
  }
  return true;
});

export const createSalaryPaymentValidation = [
  body('instituteId')
    .notEmpty()
    .withMessage('Please select an institute before continuing.')
    .isMongoId()
    .withMessage('Please select a valid institute.'),
  body('employeeId')
    .notEmpty()
    .withMessage('Please enter the employee ID.')
    .isMongoId()
    .withMessage('Please select a valid employee.'),
  body('month').notEmpty().withMessage('Please enter the month.').isInt({ min: 1, max: 12 }).withMessage(MONTH_MSG),
  body('year').notEmpty().withMessage('Please enter the year.').isInt({ min: 2000, max: 2200 }).withMessage(YEAR_MSG),
  amountField('baseSalary', 'base salary', { required: true, min: 0.01 }),
  amountField('allowances', 'allowances'),
  amountField('deductions', 'deductions'),
  netNotNegative,
  body('paymentDate')
    .notEmpty()
    .withMessage('Please select the payment date.')
    .isISO8601()
    .withMessage('Please choose a valid payment date.'),
  body('paymentMethod')
    .notEmpty()
    .withMessage('Please select the payment method.')
    .isIn(['cash', 'bank', 'upi', 'cheque'])
    .withMessage('Please choose a valid payment method.'),
  body('referenceNo').optional().trim().isLength({ max: 100 }).withMessage('Please keep the reference number to 100 characters or less.'),
  // A new payment starts pending or is recorded as paid; it is never created already cancelled.
  body('status')
    .optional()
    .isIn(['paid', 'pending'])
    .withMessage('A new salary payment can only be pending or paid.'),
  body('remarks').optional().trim().isLength({ max: 2000 }).withMessage('Please keep the remarks to 2000 characters or less.'),
];

export const updateSalaryPaymentValidation = [
  param('id').isMongoId().withMessage('Please select a valid salary payment.'),
  body('month').optional().isInt({ min: 1, max: 12 }).withMessage(MONTH_MSG),
  body('year').optional().isInt({ min: 2000, max: 2200 }).withMessage(YEAR_MSG),
  amountField('baseSalary', 'base salary', { min: 0.01 }),
  amountField('allowances', 'allowances'),
  amountField('deductions', 'deductions'),
  body('paymentDate').optional().isISO8601().withMessage('Please choose a valid payment date.'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'bank', 'upi', 'cheque'])
    .withMessage('Please choose a valid payment method.'),
  body('referenceNo').optional().trim().isLength({ max: 100 }).withMessage('Please keep the reference number to 100 characters or less.'),
  // Which move is allowed (pending -> paid -> cancelled) depends on the stored status, so the controller decides.
  body('status').optional().isIn(['paid', 'pending', 'cancelled']).withMessage('Please choose a valid status.'),
  body('remarks').optional().trim().isLength({ max: 2000 }).withMessage('Please keep the remarks to 2000 characters or less.'),
];

export const getSalaryPaymentValidation = [
  param('id').isMongoId().withMessage('Please select a valid salary payment.'),
];

export const deleteSalaryPaymentValidation = [
  param('id').isMongoId().withMessage('Please select a valid salary payment.'),
];

export const getEmployeeSalaryHistoryValidation = [
  param('employeeId').isMongoId().withMessage('Please select a valid employee.'),
];
