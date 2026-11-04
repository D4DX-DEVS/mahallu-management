import { body, ValidationChain } from 'express-validator';
import { TENANT_TYPES } from '../config/tenantTypes';
import { DEMO_REQUEST_STATUSES } from '../models/DemoRequest';
import { enumQuery, idParam, optionalText, phoneField, requiredText } from './common';

/**
 * The landing page's demo form: a name, two Indian mobile numbers, and the same details the
 * tenant form asks for so an administrator can create the Mahallu from the request.
 *
 * The tenant details are optional here so a submission from a page loaded before they existed
 * still goes through; the form itself asks for them.
 */
export const createDemoRequestValidation: ValidationChain[] = [
  requiredText('mahalluName', 'Mahallu name', { min: 2, max: 150 }),
  phoneField('contactNumber', 'contact number', { required: true }),
  phoneField('whatsappNumber', 'WhatsApp number', { required: true }),
  body('type')
    .optional({ values: 'falsy' })
    .isIn([...TENANT_TYPES])
    .withMessage('Please choose a valid type.'),
  optionalText('location', 'location', 300),
  optionalText('address.state', 'state'),
  optionalText('address.district', 'district'),
  optionalText('address.pinCode', 'pin code', 20),
  optionalText('address.postOffice', 'post office'),
  optionalText('address.village', 'village'),
];

export const listDemoRequestsValidation: ValidationChain[] = [
  enumQuery('status', DEMO_REQUEST_STATUSES, 'status'),
];

export const demoRequestIdValidation: ValidationChain[] = [idParam('id', 'demo request')];

/** A rejection must say why: the requester is told this reason. */
export const rejectDemoRequestValidation: ValidationChain[] = [
  idParam('id', 'demo request'),
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
