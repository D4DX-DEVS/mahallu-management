import express from 'express';
import { authMiddleware, superAdminOnly } from '../middleware/authMiddleware';
import { demoRequestRateLimiter } from '../middleware/rateLimit';
import { validationHandler } from '../middleware/validationHandler';
import { listQuery } from '../validations/common';
import {
  createDemoRequestValidation,
  demoRequestIdValidation,
  listDemoRequestsValidation,
  rejectDemoRequestValidation,
} from '../validations/demoRequestValidation';
import {
  acceptDemoRequest,
  createDemoRequest,
  getDemoRequest,
  listDemoRequests,
  rejectDemoRequest,
} from '../controllers/demoRequestController';

const router = express.Router();

// Public: the landing page's "Request a demo" form. Rate limited per address.
router.post('/', demoRequestRateLimiter, createDemoRequestValidation, validationHandler, createDemoRequest);

// Platform staff read the inbox and decide each request.
router.get('/', authMiddleware, superAdminOnly, listQuery(), listDemoRequestsValidation, validationHandler, listDemoRequests);
router.get('/:id', authMiddleware, superAdminOnly, demoRequestIdValidation, validationHandler, getDemoRequest);
router.post('/:id/accept', authMiddleware, superAdminOnly, demoRequestIdValidation, validationHandler, acceptDemoRequest);
router.post('/:id/reject', authMiddleware, superAdminOnly, rejectDemoRequestValidation, validationHandler, rejectDemoRequest);

export default router;
