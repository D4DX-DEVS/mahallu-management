import { body, param } from 'express-validator';
import { validCategoryValue } from './categoryValueValidation';
import { isFutureDate } from '../utils/age';

export const createMemberValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please enter the name.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the name between 2 and 100 characters.'),
  body('nameMl').optional().trim(),
  body('familyId')
    .notEmpty()
    .withMessage('Please select the family ID.')
    .isMongoId()
    .withMessage('Please select a valid family.'),
  body('familyName')
    .trim()
    .notEmpty()
    .withMessage('Please select the family name.'),
  body('mahallId').optional().trim(),
  body('age')
    .optional()
    .isInt({ min: 0, max: 150 })
    .withMessage('Please enter an age between 0 and 150.'),
  body('dateOfBirth')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Please choose a valid date of birth.')
    .custom((value) => {
      if (isFutureDate(value)) throw new Error('Date of birth cannot be in the future');
      return true;
    }),
  validCategoryValue('gender', 'gender'),
  validCategoryValue('blood_group', 'bloodGroup'),
  body('healthStatus').optional().trim(),
  body('healthNotes')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Please keep the health details to 500 characters or less.'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit phone number.'),
  body('education').optional().trim().isLength({ max: 150 }).withMessage('Please keep the education to 150 characters or less.'),
  body('externalInstitution').optional().trim().isLength({ max: 150 }).withMessage('Please keep the institution name to 150 characters or less.'),
  validCategoryValue('marital_status', 'maritalStatus'),
  validCategoryValue('relationship', 'relationship'),
  body('relationshipOther')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Please keep the relationship to 100 characters or less.'),
  validCategoryValue('occupation_sector', 'occupationSector'),
  validCategoryValue('monthly_income_range', 'monthlyIncomeRange'),
  body('marriageCount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Please enter a whole number of marriages greater than zero.'),
  body('isOrphan').optional().isBoolean().withMessage('Please choose yes or no for isorphan.'),
  body('isDead').optional().isBoolean().withMessage('Please choose yes or no for isdead.'),
];

export const updateMemberValidation = [
  param('id').isMongoId().withMessage('Please select a valid member.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the name between 2 and 100 characters.'),
  body('nameMl').optional().trim(),
  body('familyId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid family.'),
  body('age')
    .optional()
    .isInt({ min: 0, max: 150 })
    .withMessage('Please enter an age between 0 and 150.'),
  body('dateOfBirth')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Please choose a valid date of birth.')
    .custom((value) => {
      if (isFutureDate(value)) throw new Error('Date of birth cannot be in the future');
      return true;
    }),
  validCategoryValue('gender', 'gender'),
  validCategoryValue('blood_group', 'bloodGroup'),
  body('healthStatus').optional().trim(),
  body('healthNotes')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Please keep the health details to 500 characters or less.'),
  body('education').optional().trim().isLength({ max: 150 }).withMessage('Please keep the education to 150 characters or less.'),
  body('externalInstitution').optional().trim().isLength({ max: 150 }).withMessage('Please keep the institution name to 150 characters or less.'),
  validCategoryValue('marital_status', 'maritalStatus'),
  validCategoryValue('relationship', 'relationship'),
  body('relationshipOther')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Please keep the relationship to 100 characters or less.'),
  validCategoryValue('occupation_sector', 'occupationSector'),
  validCategoryValue('monthly_income_range', 'monthlyIncomeRange'),
  body('marriageCount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Please enter a whole number of marriages greater than zero.'),
  body('isOrphan').optional().isBoolean().withMessage('Please choose yes or no for isorphan.'),
  body('isDead').optional().isBoolean().withMessage('Please choose yes or no for isdead.'),
];

export const getMemberValidation = [
  param('id').isMongoId().withMessage('Please select a valid member.'),
];

export const deleteMemberValidation = [
  param('id').isMongoId().withMessage('Please select a valid member.'),
];

