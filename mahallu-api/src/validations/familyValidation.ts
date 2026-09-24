import { body, param, query } from 'express-validator';
import { validCategoryValue } from './categoryValueValidation';

export const createFamilyValidation = [
  body('houseName')
    .trim()
    .notEmpty()
    .withMessage('Please enter the house name.')
    .isLength({ min: 1, max: 200 })
    .withMessage('Please keep the house name between 1 and 200 characters.'),
  body('houseNameMl').optional().trim(),
  body('mahallId').optional().trim(),
  body('varisangyaGrade')
    .optional({ values: 'falsy' })
    .trim(),
  body('familyHead').optional().trim(),
  body('familyHeadMl').optional().trim(),
  body('contactNo').optional().trim(),
  body('wardNumber').optional().trim(),
  body('houseNo').optional().trim(),
  body('area')
    .optional({ values: 'falsy' })
    .trim(),
  body('areaMl').optional().trim(),
  body('place').optional().trim(),
  body('placeMl').optional().trim(),
  body('status')
    .optional()
    .isIn(['approved', 'unapproved', 'pending'])
    .withMessage('Please choose a valid status.'),
  validCategoryValue('economic_status', 'economicStatus'),
  validCategoryValue('housing_type', 'housingType'),
];

export const updateFamilyValidation = [
  param('id').isMongoId().withMessage('Please select a valid family.'),
  body('houseName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Please keep the house name between 1 and 200 characters.'),
  body('houseNameMl').optional().trim(),
  body('varisangyaGrade')
    .optional()
    .trim(),
  body('status')
    .optional()
    .isIn(['approved', 'unapproved', 'pending'])
    .withMessage('Please choose a valid status.'),
  validCategoryValue('economic_status', 'economicStatus'),
  validCategoryValue('housing_type', 'housingType'),
];

export const getFamilyValidation = [
  param('id').isMongoId().withMessage('Please select a valid family.'),
];

export const deleteFamilyValidation = [
  param('id').isMongoId().withMessage('Please select a valid family.'),
];

