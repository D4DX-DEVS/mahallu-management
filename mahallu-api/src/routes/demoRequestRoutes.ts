import express from 'express';
import { authMiddleware, superAdminOnly } from '../middleware/authMiddleware';
import { demoRequestRateLimiter } from '../middleware/rateLimit';
import { validationHandler } from '../middleware/validationHandler';
import { listQuery } from '../validations/common';
import { createDemoRequestValidation } from '../validations/demoRequestValidation';
import { createDemoRequest, listDemoRequests } from '../controllers/demoRequestController';

const router = express.Router();

// Public: the landing page's "Request a demo" form. Rate limited per address.
router.post('/', demoRequestRateLimiter, createDemoRequestValidation, validationHandler, createDemoRequest);

// Platform staff read the inbox.
router.get('/', authMiddleware, superAdminOnly, listQuery(), validationHandler, listDemoRequests);

export default router;
