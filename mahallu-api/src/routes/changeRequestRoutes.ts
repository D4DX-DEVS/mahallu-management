import express from 'express';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import {
  createChangeRequest,
  listChangeRequests,
  reviewChangeRequest,
  updateChangeRequest,
  deleteChangeRequest,
} from '../controllers/changeRequestController';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createChangeRequestValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);

router.post('/', createChangeRequestValidation, validationHandler, createChangeRequest);
router.get('/', listQuery(), validationHandler, listChangeRequests);
router.put('/:id/review', idParam('id', 'request'), validationHandler, allowRoles(['super_admin', 'mahall']), reviewChangeRequest);
router.put('/:id', idParam('id', 'request'), validationHandler, updateChangeRequest);
router.delete('/:id', idParam('id', 'request'), validationHandler, deleteChangeRequest);

export default router;
