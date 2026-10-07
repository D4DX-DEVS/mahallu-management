import {
  amountField,
  enumField,
  idParam,
  optionalRef,
  optionalText,
  requiredText,
  dateField,
} from './common';

/**
 * Petty cash rules.
 *
 * A fund's balance is never client-writable: `currentBalance` starts at the
 * float and then moves only through recorded expenses and replenishments, so it
 * is not a field here (and the controller ignores it if one is sent). The float
 * is set once, at creation, and must be greater than zero. An expense must be
 * greater than zero, up to two decimals, and no larger than the maximum amount;
 * "enough money left" is decided by the database, not by this validator.
 *
 * Wire these in routes/pettyCashRoutes.ts in place of the petty cash chains from
 * moduleValidation.ts:
 *   POST /          createPettyCashValidation
 *   PUT  /:id       updatePettyCashValidation
 *   POST /:id/expense  recordExpenseValidation
 *   POST /:id/replenish idParam('id', 'entry') only: it takes no body
 */

export const createPettyCashValidation = [
  // Required for a Mahallu admin; an institute admin's own institute is forced by the controller.
  optionalRef('instituteId', 'institute'),
  requiredText('custodianName', 'custodian’s name', { min: 2, max: 100 }),
  amountField('floatAmount', 'float amount', { required: true, min: 0.01 }),
];

export const updatePettyCashValidation = [
  idParam('id', 'entry'),
  optionalText('custodianName', 'custodian’s name', 100),
  enumField('status', ['active', 'inactive'], 'status'),
];

export const recordExpenseValidation = [
  idParam('id', 'entry'),
  amountField('amount', 'expense amount', { required: true, min: 0.01 }),
  requiredText('description', 'description', { min: 2, max: 300 }),
  optionalRef('categoryId', 'category'),
  optionalText('receiptNo', 'receipt number', 100),
  dateField('date', 'expense date', { allowFuture: false }),
];

