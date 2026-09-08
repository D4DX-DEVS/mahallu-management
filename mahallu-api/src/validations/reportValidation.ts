import { query } from 'express-validator';

export const getAreaReportValidation = [
  query('tenantId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid Mahallu.'),
  query('state').optional().trim(),
  query('district').optional().trim(),
  query('village').optional().trim(),
];

export const getBloodBankReportValidation = [
  query('tenantId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid Mahallu.'),
  query('bloodGroup')
    .optional()
    .isIn(['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'])
    .withMessage('Please choose a valid blood group.'),
];

export const getOrphansReportValidation = [
  query('tenantId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid Mahallu.'),
  query('age')
    .optional()
    .isInt({ min: 0, max: 18 })
    .withMessage('Please enter an age between 0 and 18.'),
];

