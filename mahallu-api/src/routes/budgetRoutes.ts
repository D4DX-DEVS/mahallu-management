import express from 'express';
import {
  listBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetVsActual,
  getPriorActuals,
} from '../controllers/budgetController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

router.get('/', allowRoles(['mahall']), listBudgets);
router.post('/', allowRoles(['mahall']), createBudget);
// must come before '/:id'
router.get('/prior-actuals', allowRoles(['mahall']), getPriorActuals);
router.get('/:id', allowRoles(['mahall']), getBudget);
router.put('/:id', allowRoles(['mahall']), updateBudget);
router.delete('/:id', allowRoles(['mahall']), deleteBudget);
router.get('/:id/vs-actual', allowRoles(['mahall']), getBudgetVsActual);

export default router;
