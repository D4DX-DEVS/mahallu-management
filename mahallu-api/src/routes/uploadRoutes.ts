import express from 'express';
import { uploadBannerImage, uploadNotificationImage, uploadMiddleware } from '../controllers/uploadController';
import { authMiddleware, requireAdmin } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authMiddleware);
// These push images to a public CDN for banners and notifications, which only the Mahallu admin publishes.
router.use(requireAdmin);

router.post('/notification-image', uploadMiddleware, uploadNotificationImage);
router.post('/banner-image', uploadMiddleware, uploadBannerImage);

export default router;
