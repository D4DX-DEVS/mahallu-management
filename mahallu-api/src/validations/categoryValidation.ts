import { body, param } from 'express-validator';

export const createCategoryValidation = [
  body('key')
    .trim()
    .notEmpty()
    .withMessage('Please enter the key.')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('Please use only lowercase letters, numbers and underscores for the key.'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please enter the name.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the name between 2 and 100 characters.'),
  body('description').optional().trim(),
];

export const updateCategoryValidation = [
  param('id').isMongoId().withMessage('Please select a valid category.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the name between 2 and 100 characters.'),
  body('description').optional().trim(),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Please choose a valid status.'),
];

export const getCategoryValidation = [
  param('id').isMongoId().withMessage('Please select a valid category.'),
];

export const deleteCategoryValidation = [
  param('id').isMongoId().withMessage('Please select a valid category.'),
];

export const getCategoryByKeyValidation = [
  param('key')
    .trim()
    .notEmpty()
    .withMessage('Please enter the key.'),
];

export const createCategoryValueValidation = [
  param('id').isMongoId().withMessage('Please select a valid category.'),
  body('code').trim().notEmpty().withMessage('Please enter the code.'),
  body('label').trim().notEmpty().withMessage('Please enter the label.'),
  body('labelMl').optional().trim(),
  body('description').optional().trim(),
  body('amount').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Please enter an amount greater than zero.'),
  body('sortOrder').optional().isInt().withMessage('Please enter a whole number for the sort order.'),
];

export const createCategoryValueByKeyValidation = [
  param('key')
    .trim()
    .notEmpty()
    .withMessage('Please enter the key.'),
  body('code').trim().notEmpty().withMessage('Please enter the code.'),
  body('label').trim().notEmpty().withMessage('Please enter the label.'),
  body('labelMl').optional().trim(),
  body('amount').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Please enter an amount greater than zero.'),
];

export const updateCategoryValueValidation = [
  param('id').isMongoId().withMessage('Please select a valid category.'),
  param('valueId').isMongoId().withMessage('Please select a valid value.'),
  body('label').optional().trim().notEmpty().withMessage('Label cannot be empty'),
  body('labelMl').optional().trim(),
  body('description').optional().trim(),
  body('amount').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Please enter an amount greater than zero.'),
  body('sortOrder').optional().isInt().withMessage('Please enter a whole number for the sort order.'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Please choose a valid status.'),
];

export const deleteCategoryValueValidation = [
  param('id').isMongoId().withMessage('Please select a valid category.'),
  param('valueId').isMongoId().withMessage('Please select a valid value.'),
];
