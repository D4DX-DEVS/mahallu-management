import { body, param } from 'express-validator';

export const createInstituteValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please select the institute name.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the institute name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('place')
    .trim()
    .notEmpty()
    .withMessage('Please enter the place.')
    .isLength({ min: 1, max: 200 })
    .withMessage('Please keep the place between 1 and 200 characters.'),
  body('placeMl').optional().trim(),
  body('type')
    .isIn(['institute', 'madrasa', 'orphanage', 'hospital', 'other'])
    .withMessage('Please choose a valid institute type.'),
  body('joinDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid join date.'),
  body('description').optional().trim(),
  body('contactNo')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit contact number.'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

export const updateInstituteValidation = [
  param('id').isMongoId().withMessage('Please select a valid institute.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the institute name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('place')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Please keep the place between 1 and 200 characters.'),
  body('placeMl').optional().trim(),
  body('type')
    .optional()
    .isIn(['institute', 'madrasa', 'orphanage', 'hospital', 'other'])
    .withMessage('Please choose a valid institute type.'),
  body('joinDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid join date.'),
  body('description').optional().trim(),
  body('contactNo')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit contact number.'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

export const getInstituteValidation = [
  param('id').isMongoId().withMessage('Please select a valid institute.'),
];

export const deleteInstituteValidation = [
  param('id').isMongoId().withMessage('Please select a valid institute.'),
];

