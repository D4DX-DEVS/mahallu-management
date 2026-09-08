import express from 'express';
import {
  getAllCategories,
  createCategory,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryValues,
  getCategoryValuesByKey,
  createCategoryValue,
  createCategoryValueByKey,
  updateCategoryValue,
  deleteCategoryValue,
} from '../controllers/categoryController';
import { authMiddleware, superAdminOnly } from '../middleware/authMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createCategoryValidation,
  updateCategoryValidation,
  getCategoryValidation,
  deleteCategoryValidation,
  getCategoryByKeyValidation,
  createCategoryValueValidation,
  createCategoryValueByKeyValidation,
  updateCategoryValueValidation,
  deleteCategoryValueValidation,
} from '../validations/categoryValidation';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

// Categories are global master data, not tenant-scoped — every authenticated
// user (any role) can read the active values behind a dropdown; only Super
// Admin can manage categories/values.
router.use(authMiddleware);

// Dropdown-consumption endpoint — any authenticated role.
router.get('/by-key/:key/values', getCategoryByKeyValidation, validationHandler, getCategoryValuesByKey);
router.post(
  '/by-key/:key/values',
  superAdminOnly,
  createCategoryValueByKeyValidation,
  validationHandler,
  createCategoryValueByKey
);

router.get('/', listQuery(), validationHandler, superAdminOnly, getAllCategories);
router.post('/', superAdminOnly, createCategoryValidation, validationHandler, createCategory);
router.get('/:id', superAdminOnly, getCategoryValidation, validationHandler, getCategoryById);
router.put('/:id', superAdminOnly, updateCategoryValidation, validationHandler, updateCategory);
router.delete('/:id', superAdminOnly, deleteCategoryValidation, validationHandler, deleteCategory);

router.get('/:id/values', superAdminOnly, getCategoryValidation, validationHandler, getCategoryValues);
router.post(
  '/:id/values', idParam('id', 'category'),
  superAdminOnly,
  createCategoryValueValidation,
  validationHandler,
  createCategoryValue
);
router.put(
  '/:id/values/:valueId', idParam('id', 'category'), idParam('valueId', 'record'),
  superAdminOnly,
  updateCategoryValueValidation,
  validationHandler,
  updateCategoryValue
);
router.delete(
  '/:id/values/:valueId', idParam('id', 'category'), idParam('valueId', 'record'),
  superAdminOnly,
  deleteCategoryValueValidation,
  validationHandler,
  deleteCategoryValue
);

export default router;
