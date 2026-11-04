import { body, param } from 'express-validator';

const TARGETED = ['user', 'member', 'family', 'committee'];

export const createNotificationValidation = [
  body('recipientId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid recipient.'),
  // Several users or members at once (recipientType 'user' or 'member').
  body('recipientIds')
    .optional()
    .isArray({ min: 1, max: 1000 })
    .withMessage('Please select between 1 and 1000 recipients.')
    .bail()
    .custom((ids: unknown[], { req }) => ['user', 'member'].includes(req.body?.recipientType) && ids.every((id) => typeof id === 'string'))
    .withMessage('Several recipients can only be chosen for users or members.'),
  body('recipientIds.*').optional().isMongoId().withMessage('Please select a valid recipient.'),
  body('recipientType')
    .isIn(['user', 'member', 'all', 'family', 'committee'])
    .withMessage('Please choose a valid recipient type.')
    .bail()
    .custom((type: string, { req }) => !TARGETED.includes(type) || !!req.body?.recipientId || (Array.isArray(req.body?.recipientIds) && req.body.recipientIds.length > 0))
    .withMessage('Please select who should receive this notification.'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Please enter the notification title.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the notification title between 2 and 200 characters.'),
  body('titleMl').optional().trim(),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Please enter the notification message.')
    .isLength({ min: 1 })
    .withMessage('Please enter the notification message.'),
  body('messageMl').optional().trim(),
  body('type')
    .optional()
    .isIn(['info', 'warning', 'success', 'error'])
    .withMessage('Please choose a valid notification type.'),
  body('link').optional().trim(),
];

export const markAsReadValidation = [
  param('id').isMongoId().withMessage('Please select a valid notification.'),
];
