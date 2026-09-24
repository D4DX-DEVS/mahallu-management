import { Request, Response } from 'express';
import multer from 'multer';
import { uploadFileToSpaces } from '../services/uploadService';

import { sendFailure, UserFacingError } from '../utils/userMessages';
import { detectContentType } from '../utils/fileGuard';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * The `Content-Type` on a multipart part is written by the client, so the MIME
 * allowlist in `fileFilter` only screens honest callers. These images are
 * uploaded with `public-read` and served from a CDN, so a file that says
 * `image/png` and is actually HTML is a script hosted on the product's own
 * domain. The bytes decide.
 */
const verifyImageBytes = (file: Express.Multer.File): void => {
  const detected = detectContentType(file.buffer);
  if (!detected || !ALLOWED_TYPES.includes(detected)) {
    throw new UserFacingError(
      'That file doesn’t look like an image. Please choose a JPEG, PNG, WebP or GIF image.',
      400
    );
  }
  // Store and serve it as what it is, not as what the upload claimed.
  file.mimetype = detected;
};

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // A plain Error here reached the handler unclassified and answered 500 —
      // a server fault, for a file the person simply needs to swap.
      cb(new UserFacingError('That file type isn’t supported. Please choose a JPEG, PNG, WebP or GIF image.', 400));
    }
  },
}).single('image');

export const uploadNotificationImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please choose an image to upload.' });
    }

    verifyImageBytes(req.file);

    const url = await uploadFileToSpaces(req.file, 'notifications');
    res.json({ success: true, url });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t upload the notification image. Please try again.');
  }
};

export const uploadBannerImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please choose an image to upload.' });
    }

    verifyImageBytes(req.file);

    const url = await uploadFileToSpaces(req.file, 'banners');
    res.json({ success: true, url });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t upload the banner image. Please try again.');
  }
};
