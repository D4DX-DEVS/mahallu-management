import { body, param, query } from 'express-validator';
import { EMAIL_KEEP_AS_TYPED } from './common';
import { isStrongPassword, isValidUsername, PASSWORD_MESSAGE, USERNAME_MESSAGE } from '../utils/credentials';

/** The restricted modules a grant can name. Mirrors the User.permissions.sensitiveModules enum. */
export const SENSITIVE_MODULE_NAMES = ['counselling', 'maslahat', 'inheritance', 'health', 'welfare'] as const;

/**
 * `permissions` as the user forms send it. The four flags were only checked on create, so an update
 * with `"permissions": {"view": "maybe"}` reached Mongoose as a cast error (a 500). `sensitiveModules`
 * is a list of the five known names, at most one of each: bad input is a 400 here rather than a
 * Mongoose enum failure. This only checks the shape; who may grant a module is a separate decision
 * (see docs/AUTHORIZATION_POLICY.md, D6).
 */
const permissionsValidation = [
  body('permissions').optional().isObject().withMessage('Please send the permissions as an object.'),
  body('permissions.view').optional().isBoolean().withMessage('Please choose yes or no for the view permission.'),
  body('permissions.add').optional().isBoolean().withMessage('Please choose yes or no for the add permission.'),
  body('permissions.edit').optional().isBoolean().withMessage('Please choose yes or no for the edit permission.'),
  body('permissions.delete').optional().isBoolean().withMessage('Please choose yes or no for the delete permission.'),
  body('permissions.sensitiveModules')
    .optional()
    .isArray({ max: SENSITIVE_MODULE_NAMES.length })
    .withMessage('Please send the restricted modules as a list of up to 5 names.')
    .bail()
    .custom((value: unknown[]) => new Set(value).size === value.length)
    .withMessage('Please list each restricted module only once.'),
  body('permissions.sensitiveModules.*')
    .isIn([...SENSITIVE_MODULE_NAMES])
    .withMessage('Please choose valid restricted modules.'),
];

export const createUserValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please enter the name.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the name between 2 and 100 characters.'),
  body('nameMl').optional().trim(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Please enter your phone number.')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit phone number.'),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(EMAIL_KEEP_AS_TYPED),
  body('role')
    .optional()
    .isIn(['super_admin', 'mahall', 'survey', 'institute', 'member'])
    .withMessage('Please choose a valid role.'),
  body('password')
    .optional()
    // bcrypt reads the first 72 bytes and ignores the rest, so a longer one is
    // hashing cost with no security value.
    .isLength({ min: 6, max: 128 })
    .withMessage('Please use between 6 and 128 characters for the password.'),
  // A username is a second way to sign in, so it needs a password that meets the stronger rule.
  body('username')
    .optional({ values: 'falsy' })
    .custom((value: unknown) => isValidUsername(value))
    .withMessage(USERNAME_MESSAGE),
  body('password')
    .if(body('username').exists({ values: 'falsy' }))
    .custom((value: unknown) => isStrongPassword(value))
    .withMessage(PASSWORD_MESSAGE),
  body('tenantId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid Mahallu.'),
  body('memberId')
    .optional()
    .isMongoId()
    .withMessage('Please select a valid member.'),
  ...permissionsValidation,
];

export const updateUserValidation = [
  param('id').isMongoId().withMessage('Please select a valid user.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Please keep the name between 2 and 100 characters.'),
  body('nameMl').optional().trim(),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit phone number.'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address.')
    .normalizeEmail(EMAIL_KEEP_AS_TYPED),
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Please choose a valid status.'),
  body('instituteId').optional().isMongoId().withMessage('Please select a valid institute.'),
  ...permissionsValidation,
];

/** PUT /users/:id/username - `null` or an empty value removes the username. */
export const setUsernameValidation = [
  param('id').isMongoId().withMessage('Please select a valid user.'),
  body('username')
    .optional({ values: 'null' })
    .custom((value: unknown) => value === '' || isValidUsername(value))
    .withMessage(USERNAME_MESSAGE),
];

/**
 * POST /users/:id/reset-password
 * `confirm` is the administrator's explicit yes. Leave `newPassword` out to have a one-time password
 * generated; send it (with a matching `confirmPassword`) to set a specific one.
 */
export const resetPasswordValidation = [
  param('id').isMongoId().withMessage('Please select a valid user.'),
  body('confirm').custom((value: unknown) => value === true).withMessage('Please confirm that you want to reset this password.'),
  body('newPassword')
    .optional({ values: 'falsy' })
    .custom((value: unknown) => isStrongPassword(value))
    .withMessage(PASSWORD_MESSAGE),
  body('confirmPassword')
    .if(body('newPassword').exists({ values: 'falsy' }))
    .custom((value: unknown, { req }: any) => value === req.body?.newPassword)
    .withMessage('The two passwords do not match.'),
];

export const getUserValidation = [
  param('id').isMongoId().withMessage('Please select a valid user.'),
];

export const deleteUserValidation = [
  param('id').isMongoId().withMessage('Please select a valid user.'),
];

