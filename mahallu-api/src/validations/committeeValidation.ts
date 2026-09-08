import { body, param } from 'express-validator';

export const createCommitteeValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please select the committee name.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the committee name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('description').optional().trim(),
  body('descriptionMl').optional().trim(),
  body('members')
    .optional()
    .isArray()
    .withMessage('Please add at least one member.'),
  body('members.*')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid member.'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

export const updateCommitteeValidation = [
  param('id').isMongoId().withMessage('Please select a valid committee.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the committee name between 2 and 200 characters.'),
  body('nameMl').optional().trim(),
  body('description').optional().trim(),
  body('descriptionMl').optional().trim(),
  body('members')
    .optional()
    .isArray()
    .withMessage('Please add at least one member.'),
  body('members.*')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid member.'),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
];

export const getCommitteeValidation = [
  param('id').isMongoId().withMessage('Please select a valid committee.'),
];

export const deleteCommitteeValidation = [
  param('id').isMongoId().withMessage('Please select a valid committee.'),
];

