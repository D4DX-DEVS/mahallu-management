import express from 'express';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import {
  createChangeRequest,
  listChangeRequests,
  reviewChangeRequest,
} from '../controllers/changeRequestController';

const router = express.Router();

router.use(authMiddleware);

router.post('/', createChangeRequest);
router.get('/', listChangeRequests);
router.put('/:id/review', allowRoles(['super_admin', 'mahall']), reviewChangeRequest);

export default router;
