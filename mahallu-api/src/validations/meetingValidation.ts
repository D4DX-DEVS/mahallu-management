import { body, param } from 'express-validator';

export const createMeetingValidation = [
  body('committeeId')
    .notEmpty()
    .withMessage('Please select the committee ID.')
    .isMongoId()
    .withMessage('Please select a valid committee.'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Please enter the meeting title.')
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the meeting title between 2 and 200 characters.'),
  body('titleMl').optional().trim(),
  body('meetingDate')
    .notEmpty()
    .withMessage('Please select the meeting date.')
    .isISO8601()
    .withMessage('Please choose a valid meeting date.'),
  body('attendance')
    .optional()
    .isArray()
    .withMessage('Please add at least one attendance.'),
  body('attendance.*')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid member for attendance.'),
  body('totalMembers')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Please enter a whole total members of zero or more.'),
  body('attendancePercent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Please enter an attendance percent between 0 and 100.'),
  body('agenda').optional().trim(),
  body('agendaMl').optional().trim(),
  body('minutes').optional().trim(),
  body('status')
    .optional()
    .isIn(['scheduled', 'completed', 'cancelled'])
    .withMessage('Please choose a valid status.'),
];

export const updateMeetingValidation = [
  param('id').isMongoId().withMessage('Please select a valid meeting.'),
  body('committeeId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid committee.'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Please keep the meeting title between 2 and 200 characters.'),
  body('titleMl').optional().trim(),
  body('meetingDate')
    .optional()
    .isISO8601()
    .withMessage('Please choose a valid meeting date.'),
  body('attendance')
    .optional()
    .isArray()
    .withMessage('Please add at least one attendance.'),
  body('attendance.*')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid member for attendance.'),
  body('totalMembers')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Please enter a whole total members of zero or more.'),
  body('attendancePercent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Please enter an attendance percent between 0 and 100.'),
  body('agenda').optional().trim(),
  body('agendaMl').optional().trim(),
  body('minutes').optional().trim(),
  body('status')
    .optional()
    .isIn(['scheduled', 'completed', 'cancelled'])
    .withMessage('Please choose a valid status.'),
];

export const getMeetingValidation = [
  param('id').isMongoId().withMessage('Please select a valid meeting.'),
];

export const deleteMeetingValidation = [
  param('id').isMongoId().withMessage('Please select a valid meeting.'),
];

