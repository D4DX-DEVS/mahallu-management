import { body, param } from 'express-validator';

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
  body('month')
    .notEmpty()
    .withMessage('Please enter the month.')
    .isInt({ min: 1, max: 12 })
    .withMessage('Please enter a month between 1 and 12.'),
  body('year')
    .notEmpty()
    .withMessage('Please enter the year.')
    .isInt({ min: 2000 })
    .withMessage('Please choose either 2000 or later.'),
  body('baseSalary')
    .notEmpty()
    .withMessage('Please enter the base salary.')
    .isFloat({ min: 0 })
    .withMessage('Please enter a base salary greater than zero.'),
  body('allowances')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter an allowances greater than zero.'),
  body('deductions')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter a deductions greater than zero.'),
  body('netAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter a net amount greater than zero.'),
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
  body('referenceNo').optional().trim(),
  body('status')
    .optional()
    .isIn(['paid', 'pending', 'cancelled'])
    .withMessage('Please choose a valid status.'),
  body('remarks').optional().trim(),
];

export const updateSalaryPaymentValidation = [
  param('id').isMongoId().withMessage('Please select a valid salary payment.'),
  body('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Please enter a month between 1 and 12.'),
  body('year')
    .optional()
    .isInt({ min: 2000 })
    .withMessage('Please choose either 2000 or later.'),
  body('baseSalary')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter a base salary greater than zero.'),
  body('allowances')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter an allowances greater than zero.'),
  body('deductions')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter a deductions greater than zero.'),
  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid payment date.'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'bank', 'upi', 'cheque'])
    .withMessage('Please choose a valid payment method.'),
  body('status')
    .optional()
    .isIn(['paid', 'pending', 'cancelled'])
    .withMessage('Please choose a valid status.'),
  body('remarks').optional().trim(),
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
