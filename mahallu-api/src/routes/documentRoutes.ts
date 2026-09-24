import express from 'express';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import {
  documentUploadMiddleware,
  uploadDocument,
  listDocuments,
  getDocumentUrl,
  updateDocumentStatus,
} from '../controllers/documentController';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';

const router = express.Router();

router.use(authMiddleware);

router.post('/upload', documentUploadMiddleware, uploadDocument);
router.get('/', listQuery(), validationHandler, listDocuments);
router.get('/:id/url', idParam('id', 'document'), validationHandler, getDocumentUrl);
router.put('/:id/status', idParam('id', 'document'), validationHandler, allowRoles(['super_admin', 'mahall']), updateDocumentStatus);

export default router;
