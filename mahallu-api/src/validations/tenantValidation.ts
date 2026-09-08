import { body, param } from 'express-validator';

export const createTenantValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please enter the tenant name.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the tenant name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Please enter the tenant code.')
    .isLength({ min: 2, max: 50 })
    .withMessage('Please keep the tenant code between 2 and 50 characters.')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Tenant code must contain only uppercase letters and numbers'),
  body('type')
    .isIn(['standard', 'premium', 'enterprise'])
    .withMessage('Please choose a valid tenant type.'),
  body('location').optional().trim(),
  body('locationMl').optional().trim(),
  body('address.state')
    .trim()
    .notEmpty()
    .withMessage('Please enter the state.'),
  body('address.district')
    .trim()
    .notEmpty()
    .withMessage('Please enter the district.'),
  body('address.pinCode').optional().trim(),
  body('address.postOffice').optional().trim(),
  body('address.lsgName')
    .trim()
    .notEmpty()
    .withMessage('Please enter the LSG name.'),
  body('address.village')
    .trim()
    .notEmpty()
    .withMessage('Please enter the village.'),
  body('settings.varisangyaAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Please enter a varisangya amount greater than zero.'),
];

export const updateTenantValidation = [
  param('id').isMongoId().withMessage('Please select a valid Mahallu.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the tenant name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('locationMl').optional().trim(),
  body('status')
    .optional()
    .isIn(['active', 'suspended', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

export const getTenantValidation = [
  param('id').isMongoId().withMessage('Please select a valid Mahallu.'),
];

export const deleteTenantValidation = [
  param('id').isMongoId().withMessage('Please select a valid Mahallu.'),
];

