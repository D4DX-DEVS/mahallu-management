import { body, param } from 'express-validator';

export const createNotificationValidation = [
  body('recipientId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid recipient.'),
  body('recipientType')
    .isIn(['user', 'member', 'all'])
    .withMessage('Please choose a valid recipient type.'),
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

