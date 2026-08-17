import express from 'express';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import {
  issueCertificateHandler,
  listCertificates,
  downloadCertificate,
  revokeCertificate,
} from '../controllers/certificateController';

const router = express.Router();

router.use(authMiddleware);

router.post('/issue', allowRoles(['super_admin', 'mahall']), issueCertificateHandler);
router.get('/', listCertificates);
router.get('/:id/download', downloadCertificate);
router.put('/:id/revoke', allowRoles(['super_admin', 'mahall']), revokeCertificate);

export default router;
