import express from 'express';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import {
  issueCertificateHandler,
  listCertificates,
  downloadCertificate,
  revokeCertificate,
} from '../controllers/certificateController';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  issueCertificateValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);

router.post('/issue', issueCertificateValidation, validationHandler, allowRoles(['super_admin', 'mahall']), issueCertificateHandler);
router.get('/', listQuery(), validationHandler, listCertificates);
router.get('/:id/download', idParam('id', 'certificate'), validationHandler, downloadCertificate);
router.put('/:id/revoke', idParam('id', 'certificate'), validationHandler, allowRoles(['super_admin', 'mahall']), revokeCertificate);

export default router;
