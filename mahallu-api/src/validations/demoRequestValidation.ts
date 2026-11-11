import { body, ValidationChain } from 'express-validator';
import { DEMO_REQUEST_STATUSES } from '../models/DemoRequest';
import { enumQuery, idParam, optionalText, phoneField, requiredText } from './common';

/**
 * The landing page's "Request ZAAD" form: the Masjid/Mahallu's details, its president or
 * secretary with two Indian mobile numbers, and an optional person to follow up with.
 */
export const createDemoRequestValidation: ValidationChain[] = [
  requiredText('mahalluName', 'Masjid/Mahallu name', { min: 2, max: 150 }),
  optionalText('affiliationNumber', 'affiliation number', 100),
  requiredText('location', 'place', { max: 300 }),
  requiredText('localUnit', 'local unit'),
  requiredText('area', 'area'),
  requiredText('district', 'district'),
  requiredText('officeBearerName', 'president/secretary name', { max: 150 }),
  phoneField('contactNumber', 'phone number', { required: true }),
  phoneField('whatsappNumber', 'WhatsApp number', { required: true }),
  optionalText('contactPersonName', 'contact person name', 150),
  phoneField('contactPersonPhone', 'contact person phone number'),
  phoneField('contactPersonWhatsapp', 'contact person WhatsApp number'),
];

export const listDemoRequestsValidation: ValidationChain[] = [
  enumQuery('status', DEMO_REQUEST_STATUSES, 'status'),
];

export const demoRequestIdValidation: ValidationChain[] = [idParam('id', 'request')];

/** A rejection must say why: the requester is told this reason. */
export const rejectDemoRequestValidation: ValidationChain[] = [
  idParam('id', 'request'),
  body('reason')
    .isString()
    .withMessage('Please enter the reason for rejection.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Please enter the reason for rejection.')
    .bail()
    .isLength({ max: 500 })
    .withMessage('Please keep the reason to 500 characters or less.'),
];
