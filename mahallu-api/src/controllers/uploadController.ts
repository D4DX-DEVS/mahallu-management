import { Request, Response } from 'express';
import multer from 'multer';
import { uploadFileToSpaces } from '../services/uploadService';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  },
}).single('image');

// The mimetype header is client-controlled; verify the real file signature too.
const hasImageSignature = (file: Express.Multer.File): boolean => {
  const b = file.buffer;
  if (!b || b.length < 12) return false;
  switch (file.mimetype) {
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/gif':
      return b.subarray(0, 4).toString('ascii') === 'GIF8';
    case 'image/webp':
      return b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP';
    default:
      return false;
  }
};

export const uploadNotificationImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    if (!hasImageSignature(req.file)) {
      return res.status(400).json({ success: false, message: 'File content does not match an allowed image type' });
    }

    const url = await uploadFileToSpaces(req.file, 'notifications');
    res.json({ success: true, url });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadBannerImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    if (!hasImageSignature(req.file)) {
      return res.status(400).json({ success: false, message: 'File content does not match an allowed image type' });
    }

    const url = await uploadFileToSpaces(req.file, 'banners');
    res.json({ success: true, url });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadProfilePhoto = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Photo must be 2 MB or smaller' });
    }
    if (!hasImageSignature(req.file)) {
      return res.status(400).json({ success: false, message: 'File content does not match an allowed image type' });
    }

    const url = await uploadFileToSpaces(req.file, 'profiles');
    res.json({ success: true, url });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
