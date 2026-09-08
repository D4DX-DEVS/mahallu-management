import { Router } from 'express';
import {
  getAllCounsellingCases,
  getCounsellingCaseById,
  createCounsellingCase,
  updateCounsellingCase,
  deleteCounsellingCase,
  addCounsellingNote,
  getAllDisputeCases,
  getDisputeCaseById,
  createDisputeCase,
  updateDisputeCase,
  deleteDisputeCase,
  getAllInheritanceCases,
  getInheritanceCaseById,
  createInheritanceCase,
  updateInheritanceCase,
  deleteInheritanceCase,
} from '../controllers/counsellingController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { sensitiveAccess } from '../middleware/sensitiveAccess';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createCounsellingCaseValidation,
  createDisputeCaseValidation,
  createInheritanceCaseValidation,
  updateCounsellingCaseValidation,
  updateDisputeCaseValidation,
  updateInheritanceCaseValidation,
} from '../validations/moduleValidation';

/**
 * Counselling Routes — all behind sensitiveAccess middleware
 * Each module has its own router with its own sensitiveAccess check:
 * - Counselling: sensitiveAccess('counselling')
 * - Dispute (Maslahat): sensitiveAccess('maslahat')
 * - Inheritance: sensitiveAccess('inheritance')
 */

// ====== COUNSELLING CASES ======

const counsellingRouter = Router();
// Path-scoped: these routers are mounted at '/api', so an unscoped use() would run
// this module's sensitiveAccess gate for every /api/* request that falls through.
counsellingRouter.use(
  '/counselling-cases',
  authMiddleware,
  tenantMiddleware,
  tenantFilter,
  sensitiveAccess('counselling')
);

/**
 * @swagger
 * /api/counselling-cases:
 *   get:
 *     summary: Get all counselling cases (paginated)
 *     tags: [Counselling]
 *     parameters:
 *       - in: query
 *         name: page
 *         type: integer
 *       - in: query
 *         name: limit
 *         type: integer
 *       - in: query
 *         name: category
 *         type: string
 *       - in: query
 *         name: status
 *         type: string
 *       - in: query
 *         name: search
 *         type: string
 */
counsellingRouter.get('/counselling-cases', listQuery(), validationHandler, getAllCounsellingCases);

/**
 * @swagger
 * /api/counselling-cases:
 *   post:
 *     summary: Create a new counselling case
 *     tags: [Counselling]
 */
counsellingRouter.post('/counselling-cases', createCounsellingCaseValidation, validationHandler, allowRoles(['mahall', 'super_admin']), createCounsellingCase);

/**
 * @swagger
 * /api/counselling-cases/{id}:
 *   get:
 *     summary: Get a counselling case by ID
 *     tags: [Counselling]
 */
counsellingRouter.get('/counselling-cases/:id', idParam('id', 'case'), validationHandler, getCounsellingCaseById);

/**
 * @swagger
 * /api/counselling-cases/{id}:
 *   put:
 *     summary: Update a counselling case
 *     tags: [Counselling]
 */
counsellingRouter.put('/counselling-cases/:id', updateCounsellingCaseValidation, validationHandler, allowRoles(['mahall', 'super_admin']), updateCounsellingCase);

/**
 * @swagger
 * /api/counselling-cases/{id}:
 *   delete:
 *     summary: Delete a counselling case
 *     tags: [Counselling]
 */
counsellingRouter.delete('/counselling-cases/:id', idParam('id', 'case'), validationHandler, allowRoles(['mahall', 'super_admin']), deleteCounsellingCase);

/**
 * @swagger
 * /api/counselling-cases/{id}/notes:
 *   post:
 *     summary: Add a session note to a counselling case
 *     tags: [Counselling]
 */
counsellingRouter.post('/counselling-cases/:id/notes', idParam('id', 'case'), validationHandler, allowRoles(['mahall', 'super_admin']), addCounsellingNote);

// ====== DISPUTE CASES (MASLAHAT) ======

const disputeRouter = Router();
disputeRouter.use(
  '/dispute-cases',
  authMiddleware,
  tenantMiddleware,
  tenantFilter,
  sensitiveAccess('maslahat')
);

/**
 * @swagger
 * /api/dispute-cases:
 *   get:
 *     summary: Get all dispute cases (paginated)
 *     tags: [Maslahat]
 */
disputeRouter.get('/dispute-cases', listQuery(), validationHandler, getAllDisputeCases);

/**
 * @swagger
 * /api/dispute-cases:
 *   post:
 *     summary: Create a new dispute case
 *     tags: [Maslahat]
 */
disputeRouter.post('/dispute-cases', createDisputeCaseValidation, validationHandler, allowRoles(['mahall', 'super_admin']), createDisputeCase);

/**
 * @swagger
 * /api/dispute-cases/{id}:
 *   get:
 *     summary: Get a dispute case by ID
 *     tags: [Maslahat]
 */
disputeRouter.get('/dispute-cases/:id', idParam('id', 'case'), validationHandler, getDisputeCaseById);

/**
 * @swagger
 * /api/dispute-cases/{id}:
 *   put:
 *     summary: Update a dispute case
 *     tags: [Maslahat]
 */
disputeRouter.put('/dispute-cases/:id', updateDisputeCaseValidation, validationHandler, allowRoles(['mahall', 'super_admin']), updateDisputeCase);

/**
 * @swagger
 * /api/dispute-cases/{id}:
 *   delete:
 *     summary: Delete a dispute case
 *     tags: [Maslahat]
 */
disputeRouter.delete('/dispute-cases/:id', idParam('id', 'case'), validationHandler, allowRoles(['mahall', 'super_admin']), deleteDisputeCase);

// ====== INHERITANCE CASES ======

const inheritanceRouter = Router();
inheritanceRouter.use(
  '/inheritance-cases',
  authMiddleware,
  tenantMiddleware,
  tenantFilter,
  sensitiveAccess('inheritance')
);

/**
 * @swagger
 * /api/inheritance-cases:
 *   get:
 *     summary: Get all inheritance cases (paginated)
 *     tags: [Inheritance]
 */
inheritanceRouter.get('/inheritance-cases', listQuery(), validationHandler, getAllInheritanceCases);

/**
 * @swagger
 * /api/inheritance-cases:
 *   post:
 *     summary: Create a new inheritance case
 *     tags: [Inheritance]
 */
inheritanceRouter.post('/inheritance-cases', createInheritanceCaseValidation, validationHandler, allowRoles(['mahall', 'super_admin']), createInheritanceCase);

/**
 * @swagger
 * /api/inheritance-cases/{id}:
 *   get:
 *     summary: Get an inheritance case by ID
 *     tags: [Inheritance]
 */
inheritanceRouter.get('/inheritance-cases/:id', idParam('id', 'case'), validationHandler, getInheritanceCaseById);

/**
 * @swagger
 * /api/inheritance-cases/{id}:
 *   put:
 *     summary: Update an inheritance case
 *     tags: [Inheritance]
 */
inheritanceRouter.put('/inheritance-cases/:id', updateInheritanceCaseValidation, validationHandler, allowRoles(['mahall', 'super_admin']), updateInheritanceCase);

/**
 * @swagger
 * /api/inheritance-cases/{id}:
 *   delete:
 *     summary: Delete an inheritance case
 *     tags: [Inheritance]
 */
inheritanceRouter.delete('/inheritance-cases/:id', idParam('id', 'case'), validationHandler, allowRoles(['mahall', 'super_admin']), deleteInheritanceCase);

export { counsellingRouter, disputeRouter, inheritanceRouter };
export default Router();
