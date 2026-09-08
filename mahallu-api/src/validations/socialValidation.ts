import { body, param } from 'express-validator';

// Banner Validations
export const createBannerValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Please enter the banner title.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the banner title between 2 and 200 characters.'),
  body('image')
    .trim()
    .notEmpty()
    .withMessage('Please enter the banner image.'),
  body('link').optional().trim(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid start date.'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid end date.'),
];

export const updateBannerValidation = [
  param('id').isMongoId().withMessage('Please select a valid banner.'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the banner title between 2 and 200 characters.'),
  body('image')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Banner image cannot be empty'),
  body('link').optional().trim(),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid start date.'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid end date.'),
];

export const bannerIdParamValidation = [
  param('id').isMongoId().withMessage('Please select a valid banner.'),
];

// Feed Validations
export const createFeedValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Please enter the feed title.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the feed title between 2 and 200 characters.'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Please enter the feed content.')
    .isLength({ min: 1 })
    .withMessage('Please enter the feed content.'),
  body('image').optional().trim(),
  body('authorId')
    .notEmpty()
    .withMessage('Please enter the author ID.')
    .isMongoId()
    .withMessage('Please select a valid author.'),
  body('isSuperFeed')
    .optional()
    .isBoolean()
    .withMessage('Please choose yes or no for issuperfeed.'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Please choose a valid status.'),
];

// Support Validations
export const createSupportValidation = [
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Please enter the support subject.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the support subject between 2 and 200 characters.'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Please enter the support message.')
    .isLength({ min: 10 })
    .withMessage('Please use at least 10 characters for the support message.'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Please choose a valid priority.'),
];

export const updateSupportValidation = [
  param('id').isMongoId().withMessage('Please select a valid support.'),
  body('status')
    .optional()
    .isIn(['open', 'in_progress', 'resolved', 'closed'])
    .withMessage('Please choose a valid status.'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Please choose a valid priority.'),
  body('response').optional().trim(),
];

