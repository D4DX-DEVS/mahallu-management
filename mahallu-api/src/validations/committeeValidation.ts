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


export const saveMahalluCommitteeValidation = [
  body('name').optional().trim().isLength({ max: 200 }).withMessage('Please keep the committee name to 200 characters or less.'),
  body('nameMl').optional().trim(),
  body('description').optional().trim(),
  body('termStartDate').optional({ values: 'falsy' }).isISO8601().withMessage('Please enter a valid term start date.'),
  body('termEndDate').optional({ values: 'falsy' }).isISO8601().withMessage('Please enter a valid term end date.'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Please choose a valid status.'),
  body('officeBearers').isArray({ max: 50 }).withMessage('Please add up to 50 office bearers.'),
  body('officeBearers.*.member').isMongoId().withMessage('Please select a member for every role.'),
  body('officeBearers.*.role')
    .trim()
    .notEmpty()
    .withMessage('Please choose a role for every office bearer.')
    .isLength({ max: 60 })
    .withMessage('Please keep each role to 60 characters or less.'),
];
