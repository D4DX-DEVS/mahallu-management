import { body, param } from 'express-validator';

export const createAssetValidation = [
  body('mosqueId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Invalid mosque ID'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Asset name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Asset name must be between 2 and 200 characters'),
  body('nameMl').optional().trim(),
  body('description').optional().trim(),
  body('purchaseDate')
    .notEmpty()
    .withMessage('Purchase date is required')
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Purchase date must be a valid date');
      }
      return true;
    }),
  body('estimatedValue')
    .notEmpty()
    .withMessage('Estimated value is required')
    .custom((value) => {
      const num = Number(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Estimated value must be a positive number');
      }
      return true;
    }),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['furniture', 'electronics', 'vehicle', 'building', 'land', 'equipment', 'other'])
    .withMessage('Invalid category'),
  body('status')
    .optional()
    .isIn(['active', 'in_use', 'under_maintenance', 'disposed', 'damaged'])
    .withMessage('Invalid status'),
  body('location').optional().trim(),
  body('locationMl').optional().trim(),
];

export const updateAssetValidation = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  body('mosqueId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Invalid mosque ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Asset name must be between 2 and 200 characters'),
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
  body('estimatedValue')
    .optional()
    .custom((value) => {
      const num = Number(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Estimated value must be a positive number');
      }
      return true;
    }),
  body('category')
    .optional()
    .isIn(['furniture', 'electronics', 'vehicle', 'building', 'land', 'equipment', 'other'])
    .withMessage('Invalid category'),
  body('status')
    .optional()
    .isIn(['active', 'in_use', 'under_maintenance', 'disposed', 'damaged'])
    .withMessage('Invalid status'),
  body('location').optional().trim(),
  body('locationMl').optional().trim(),
];

export const getAssetValidation = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
];

export const deleteAssetValidation = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
];

export const createMaintenanceValidation = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  body('maintenanceDate')
    .notEmpty()
    .withMessage('Maintenance date is required')
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
    .withMessage('Description is required')
    .isLength({ min: 2, max: 500 })
    .withMessage('Description must be between 2 and 500 characters'),
  body('cost')
    .optional()
    .custom((value) => {
      const num = Number(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Cost must be a positive number');
      }
      return true;
    }),
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
    .withMessage('Invalid maintenance status'),
];

export const updateMaintenanceValidation = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  param('maintenanceId').isMongoId().withMessage('Invalid maintenance record ID'),
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
    .withMessage('Description must be between 2 and 500 characters'),
  body('cost')
    .optional()
    .custom((value) => {
      const num = Number(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Cost must be a positive number');
      }
      return true;
    }),
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
    .withMessage('Invalid maintenance status'),
];

export const deleteMaintenanceValidation = [
  param('id').isMongoId().withMessage('Invalid asset ID'),
  param('maintenanceId').isMongoId().withMessage('Invalid maintenance record ID'),
];
