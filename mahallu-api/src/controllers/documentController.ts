import { Response } from 'express';
import multer from 'multer';
import DocumentFile from '../models/DocumentFile';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  DOCUMENT_ALLOWED_MIME_TYPES,
  uploadPrivateDocument,
  getSignedDownloadUrl,
} from '../services/uploadService';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

export const documentUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!DOCUMENT_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPEG, PNG or WebP files are allowed'));
    }
    cb(null, true);
  },
}).single('file');

const isAdmin = (req: AuthRequest): boolean =>
  req.isSuperAdmin === true || req.user?.role === 'mahall';

// POST /api/documents/upload — private object, DB record with status 'pending'
export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'file is required' });
    }
    if (!req.tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant context missing' });
    }

    const { documentType } = req.body;
    if (!documentType) {
      return res.status(400).json({ success: false, message: 'documentType is required' });
    }

    const fileKey = await uploadPrivateDocument(req.file, req.tenantId);

    const doc = await DocumentFile.create({
      tenantId: req.tenantId,
      ownerType: req.body.ownerType || 'member',
      documentType,
      fileKey,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedByUserId: req.user._id,
      uploadedByMemberId: req.user.memberId || undefined,
      status: 'pending',
    });

    res.status(201).json({ success: true, data: doc, message: 'Document uploaded successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/documents — admin: filter by ownerType/ownerId; member: own uploads only
export const listDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { tenantId: req.tenantId };

    if (isAdmin(req)) {
      if (req.query.ownerType) query.ownerType = req.query.ownerType;
      if (req.query.ownerId) query.ownerId = req.query.ownerId;
      if (req.query.status) query.status = req.query.status;
    } else if (req.user?.memberId) {
      query.uploadedByMemberId = req.user.memberId;
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [docs, total] = await Promise.all([
      DocumentFile.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DocumentFile.countDocuments(query),
    ]);

    res.json(createPaginationResponse(docs, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/documents/:id/url — short-lived signed download URL
export const getDocumentUrl = async (req: AuthRequest, res: Response) => {
  try {
    const doc = await DocumentFile.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const isOwner =
      req.user?.memberId && doc.uploadedByMemberId &&
      String(doc.uploadedByMemberId) === String(req.user.memberId);

    if (!isAdmin(req) && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const url = await getSignedDownloadUrl(doc.fileKey);
    res.json({ success: true, data: { url, fileName: doc.fileName, mimeType: doc.mimeType, expiresIn: 300 } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/documents/:id/status — admin verify/reject
export const updateDocumentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be verified or rejected' });
    }
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ success: false, message: 'rejectionReason is required when rejecting' });
    }

    const doc = await DocumentFile.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        status,
        rejectionReason: status === 'rejected' ? rejectionReason : undefined,
        verifiedBy: req.user?.name,
        verifiedAt: new Date(),
      },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.json({ success: true, data: doc, message: `Document ${status}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
