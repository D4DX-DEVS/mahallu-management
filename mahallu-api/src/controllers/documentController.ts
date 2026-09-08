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

import { sendFailure, UserFacingError } from '../utils/userMessages';
import { detectContentType, safeFileName } from '../utils/fileGuard';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

/** Mirrors the DocumentFile schema enums, so an unknown value is a 400, not a 500. */
const DOCUMENT_TYPES = ['id_proof', 'age_proof', 'photo', 'address_proof', 'divorce_doc', 'death_proof', 'other'];
const OWNER_TYPES = ['member', 'family', 'nikah', 'death', 'noc'];

export const documentUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!DOCUMENT_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      // See uploadController: an unclassified Error answered 500 for a bad file.
      return cb(
        new UserFacingError('That file type isn’t supported. Please choose a PDF, JPEG, PNG or WebP file.', 400)
      );
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
      return res.status(400).json({ success: false, message: 'Please choose a file to upload.' });
    }
    if (!req.tenantId) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }

    const { documentType } = req.body;
    if (!DOCUMENT_TYPES.includes(documentType)) {
      return res.status(400).json({ success: false, message: 'Please choose a document type.' });
    }

    const ownerType = req.body.ownerType ?? 'member';
    if (!OWNER_TYPES.includes(ownerType)) {
      return res.status(400).json({ success: false, message: 'Please choose what this document belongs to.' });
    }

    // The Content-Type on the multipart part is written by the caller, so the
    // MIME allowlist above only screens honest ones. These files are read back
    // by reviewers through a signed URL; the bytes decide what they are.
    const detected = detectContentType(req.file.buffer);
    if (!detected || !DOCUMENT_ALLOWED_MIME_TYPES.includes(detected)) {
      return res.status(400).json({
        success: false,
        message: 'That file doesn’t look like a PDF or an image. Please choose a PDF, JPEG, PNG or WebP file.',
      });
    }
    req.file.mimetype = detected;

    const fileKey = await uploadPrivateDocument(req.file, req.tenantId);

    const doc = await DocumentFile.create({
      tenantId: req.tenantId,
      ownerType,
      documentType,
      fileKey,
      // originalname is attacker-controlled text that is stored and later shown
      // in the CMS and the app: no path, no control characters, no markup.
      fileName: safeFileName(req.file.originalname),
      mimeType: detected,
      size: req.file.size,
      uploadedByUserId: req.user._id,
      uploadedByMemberId: req.user.memberId || undefined,
      status: 'pending',
    });

    res.status(201).json({ success: true, data: doc, message: 'Document uploaded' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t upload the document. Please try again.');
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
      return res.status(403).json({ success: false, message: "You don't have permission to do this. Please contact your Mahallu admin." });
    }

    const [docs, total] = await Promise.all([
      DocumentFile.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DocumentFile.countDocuments(query),
    ]);

    res.json(createPaginationResponse(docs, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the documents right now. Please try again.');
  }
};

// GET /api/documents/:id/url — short-lived signed download URL
export const getDocumentUrl = async (req: AuthRequest, res: Response) => {
  try {
    const doc = await DocumentFile.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!doc) {
      return res.status(404).json({ success: false, message: "We couldn't find that document. It may have been removed." });
    }

    const isOwner =
      req.user?.memberId && doc.uploadedByMemberId &&
      String(doc.uploadedByMemberId) === String(req.user.memberId);

    if (!isAdmin(req) && !isOwner) {
      return res.status(403).json({ success: false, message: "You don't have permission to do this. Please contact your Mahallu admin." });
    }

    const url = await getSignedDownloadUrl(doc.fileKey);
    res.json({ success: true, data: { url, fileName: doc.fileName, mimeType: doc.mimeType, expiresIn: 300 } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the document url right now. Please try again.');
  }
};

// PUT /api/documents/:id/status — admin verify/reject
export const updateDocumentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please choose either verify or reject.' });
    }
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ success: false, message: 'Please enter a reason for rejecting this.' });
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
      return res.status(404).json({ success: false, message: "We couldn't find that document. It may have been removed." });
    }

    res.json({ success: true, data: doc, message: `Document ${status}` });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the document status. Please try again.');
  }
};
