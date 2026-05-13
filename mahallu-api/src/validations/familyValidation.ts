import { body, param, query } from 'express-validator';

export const createFamilyValidation = [
  body('houseName')
    .trim()
    .notEmpty()
    .withMessage('House Name is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('House Name must be between 1 and 200 characters'),
  body('houseNameMl').optional().trim(),
  body('mahallId').optional().trim(),
  body('varisangyaGrade')
    .optional({ values: 'falsy' })
    .isIn(['Grade A', 'Grade B', 'Grade C', 'Grade D'])
    .withMessage('Invalid varisangya grade'),
  body('familyHead').optional().trim(),
  body('familyHeadMl').optional().trim(),
  body('contactNo').optional().trim(),
  body('wardNumber').optional().trim(),
  body('houseNo').optional().trim(),
  body('area')
    .optional({ values: 'falsy' })
    .isIn(['Area A', 'Area B', 'Area C', 'Area D'])
    .withMessage('Invalid area'),
  body('areaMl').optional().trim(),
  body('place').optional().trim(),
  body('placeMl').optional().trim(),
  body('status')
    .optional()
    .isIn(['approved', 'unapproved', 'pending'])
    .withMessage('Invalid status'),
];

export const updateFamilyValidation = [
  param('id').isMongoId().withMessage('Invalid family ID'),
  body('houseName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('House Name must be between 1 and 200 characters'),
  body('houseNameMl').optional().trim(),
  body('varisangyaGrade')
    .optional()
    .isIn(['Grade A', 'Grade B', 'Grade C', 'Grade D'])
    .withMessage('Invalid varisangya grade'),
  body('status')
    .optional()
    .isIn(['approved', 'unapproved', 'pending'])
    .withMessage('Invalid status'),
];

export const getFamilyValidation = [
  param('id').isMongoId().withMessage('Invalid family ID'),
];

export const deleteFamilyValidation = [
  param('id').isMongoId().withMessage('Invalid family ID'),
];

