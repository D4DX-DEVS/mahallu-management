import { body, param } from 'express-validator';

export const loginValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Please enter your phone number.')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a 10-digit phone number.'),
  body('password')
    .isString()
    .withMessage('Please enter the password.')
    .bail()
    .notEmpty()
    .withMessage('Please enter the password.')
    .bail()
    // bcrypt reads the first 72 bytes and ignores the rest, so anything longer
    // is hashing cost with no security value - and a megabyte of it is a way to
    // keep the CPU busy without ever signing in.
    .isLength({ max: 128 })
    .withMessage('Please enter a shorter password.'),
];

export const sendOTPValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Please enter your phone number.')
    .matches(/^(\+?91)?[0-9]{10}$/)
    .withMessage('Please enter a 10-digit mobile number.'),
];

export const verifyOTPValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Please enter your phone number.')
    .matches(/^(\+?91)?[0-9]{10}$/)
    .withMessage('Please enter a 10-digit mobile number.'),
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('Please enter the OTP.')
    .matches(/^[0-9]{6}$/)
    .withMessage('Please enter a 6-digit OTP.'),
];

export const changePasswordValidation = [
  body('currentPassword')
    .isString()
    .withMessage('Please enter the current password.')
    .bail()
    .notEmpty()
    .withMessage('Please enter the current password.')
    .bail()
    .isLength({ max: 128 })
    .withMessage('Please enter a shorter password.'),
  body('newPassword')
    .isString()
    .withMessage('Please enter the new password.')
    .bail()
    .isLength({ min: 6, max: 128 })
    .withMessage('Please use between 6 and 128 characters for the new password.')
    .bail()
    .custom((value, { req }) => {
      if (value === req.body?.currentPassword) {
        throw new Error('Please choose a new password that is different from the current one.');
      }
      return true;
    }),
  body('confirmPassword')
    .optional()
    .custom((value, { req }) => {
      if (value !== req.body?.newPassword) {
        throw new Error('The passwords do not match. Please enter the same password twice.');
      }
      return true;
    }),
];

/**
 * The push token this device was given. It is stored and later handed to
 * OneSignal, so it has to be a plain identifier rather than whatever the caller
 * feels like writing into the user record.
 */
export const registerDeviceValidation = [
  body('oneSignalPlayerId')
    .trim()
    .notEmpty()
    .withMessage("We couldn't set up notifications on this device. Please try again.")
    .bail()
    .isLength({ max: 128 })
    .withMessage("We couldn't set up notifications on this device. Please try again.")
    .bail()
    .matches(/^[A-Za-z0-9_:-]+$/)
    .withMessage("We couldn't set up notifications on this device. Please try again."),
];

export const twoFactorValidation = [
  body('enabled').isBoolean().withMessage('Please turn this setting on or off.'),
];

/** The second step of a multi-account sign-in. */
export const selectAccountValidation = [
  body('preAuthToken')
    .isString()
    .withMessage('That sign-in step has expired. Please sign in again.')
    .bail()
    .notEmpty()
    .withMessage('That sign-in step has expired. Please sign in again.')
    .bail()
    .isLength({ max: 4096 })
    .withMessage('That sign-in step has expired. Please sign in again.'),
  body('userId')
    .isMongoId()
    .withMessage("We couldn't find that user account. It may have been removed."),
];

