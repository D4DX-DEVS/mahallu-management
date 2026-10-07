import { body, param } from 'express-validator';
import { amountField } from './common';

export const createAssetValidation = [
  body('mosqueId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Please select a valid mosque.'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please enter the asset name.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the asset name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('description').optional().trim(),
  body('purchaseDate')
    .notEmpty()
    .withMessage('Please select the purchase date.')
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Purchase date must be a valid date');
      }
      return true;
    }),
  amountField('estimatedValue', 'estimated value', { required: true }),
  body('category')
    .notEmpty()
    .withMessage('Please select the category.')
    .isIn(['furniture', 'electronics', 'vehicle', 'building', 'land', 'equipment', 'other'])
    .withMessage('Please choose a valid category.'),
  body('status')
    .optional()
    .isIn(['active', 'in_use', 'under_maintenance', 'disposed', 'damaged'])
    .withMessage('Please choose a valid status.'),
  body('location').optional().trim(),
  body('locationMl').optional().trim(),
];

export const updateAssetValidation = [
  param('id').isMongoId().withMessage('Please select a valid asset.'),
  body('mosqueId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Please select a valid mosque.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the asset name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('description').optional().trim(),
  body('purchaseDate')
    .optional()
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Purchase date must be a valid date');
      }
      return true;
    }),
  amountField('estimatedValue', 'estimated value'),
  body('category')
    .optional()
    .isIn(['furniture', 'electronics', 'vehicle', 'building', 'land', 'equipment', 'other'])
    .withMessage('Please choose a valid category.'),
  body('status')
    .optional()
    .isIn(['active', 'in_use', 'under_maintenance', 'disposed', 'damaged'])
    .withMessage('Please choose a valid status.'),
  body('location').optional().trim(),
  body('locationMl').optional().trim(),
];

export const getAssetValidation = [
  param('id').isMongoId().withMessage('Please select a valid asset.'),
];

export const deleteAssetValidation = [
  param('id').isMongoId().withMessage('Please select a valid asset.'),
];

export const createMaintenanceValidation = [
  param('id').isMongoId().withMessage('Please select a valid asset.'),
  body('maintenanceDate')
    .notEmpty()
    .withMessage('Please select the maintenance date.')
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Maintenance date must be a valid date');
      }
      return true;
    }),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Please enter the description.')
    .isLength({ min: 2, max: 500 })
    .withMessage('Please keep the description between 2 and 500 characters.'),
  amountField('cost', 'cost'),
  body('performedBy').optional().trim(),
  body('nextMaintenanceDate')
    .optional()
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Next maintenance date must be a valid date');
      }
      return true;
    }),
  body('status')
    .optional()
    .isIn(['scheduled', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Please choose a valid maintenance status.'),
];

export const updateMaintenanceValidation = [
  param('id').isMongoId().withMessage('Please select a valid asset.'),
  param('maintenanceId').isMongoId().withMessage('Please select a valid maintenance record.'),
  body('maintenanceDate')
    .optional()
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Maintenance date must be a valid date');
      }
      return true;
    }),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 2, max: 500 })
    .withMessage('Please keep the description between 2 and 500 characters.'),
  amountField('cost', 'cost'),
  body('performedBy').optional().trim(),
  body('nextMaintenanceDate')
    .optional()
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Next maintenance date must be a valid date');
      }
      return true;
    }),
  body('status')
    .optional()
    .isIn(['scheduled', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Please choose a valid maintenance status.'),
];

export const deleteMaintenanceValidation = [
  param('id').isMongoId().withMessage('Please select a valid asset.'),
  param('maintenanceId').isMongoId().withMessage('Please select a valid maintenance record.'),
];
