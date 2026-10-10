import { ValidationChain } from 'express-validator';
import { phoneField, requiredText } from './common';

/** The landing page's demo form: a name and two Indian mobile numbers. */
export const createDemoRequestValidation: ValidationChain[] = [
  requiredText('mahalluName', 'Mahallu name', { min: 2, max: 150 }),
  phoneField('contactNumber', 'contact number', { required: true }),
  phoneField('whatsappNumber', 'WhatsApp number', { required: true }),
];
