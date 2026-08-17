import express from 'express';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import {
  documentUploadMiddleware,
  uploadDocument,
  listDocuments,
  getDocumentUrl,
  updateDocumentStatus,
} from '../controllers/documentController';

const router = express.Router();

router.use(authMiddleware);

router.post('/upload', documentUploadMiddleware, uploadDocument);
router.get('/', listDocuments);
router.get('/:id/url', getDocumentUrl);
router.put('/:id/status', allowRoles(['super_admin', 'mahall']), updateDocumentStatus);

export default router;
