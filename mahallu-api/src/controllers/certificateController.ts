import { Request, Response } from 'express';
import Certificate from '../models/Certificate';
import { AuthRequest } from '../middleware/authMiddleware';
import { issueCertificate } from '../services/certificateService';
import { getSignedDownloadUrl } from '../services/uploadService';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

import { sendFailure } from '../utils/userMessages';

const isAdmin = (req: AuthRequest): boolean =>
  req.isSuperAdmin === true || req.user?.role === 'mahall';

// POST /api/certificates/issue — admin issues certificate for an approved registration
export const issueCertificateHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { type, registrationId } = req.body;
    if (!['nikah', 'death', 'noc'].includes(type) || !registrationId) {
      return res.status(400).json({ success: false, message: 'Please choose a registration type and a registration.' });
    }
    if (!req.tenantId) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }

    const cert = await issueCertificate(type, registrationId, req.tenantId, req.user?.name || 'Mahall Admin');
    res.status(201).json({ success: true, data: cert, message: `Certificate ${cert.certificateNo} issued` });
  } catch (error: any) {
    const message = error?.message || 'Failed to issue certificate';
    const status = /not found|must be approved/.test(message) ? 400 : 500;
    res.status(status).json({ success: false, message });
  }
};

// GET /api/certificates — admin: all (filterable); member: own certificates
export const listCertificates = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { tenantId: req.tenantId };

    if (isAdmin(req)) {
      if (req.query.type) query.type = req.query.type;
      if (req.query.status) query.status = req.query.status;
    } else if (req.user?.memberId) {
      query.subjectMemberIds = req.user.memberId;
    } else {
      return res.status(403).json({ success: false, message: "You don't have permission to do this. Please contact your Mahallu admin." });
    }

    const [certs, total] = await Promise.all([
      Certificate.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Certificate.countDocuments(query),
    ]);

    res.json(createPaginationResponse(certs, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the certificates right now. Please try again.');
  }
};

// GET /api/certificates/:id/download — signed URL for the PDF
export const downloadCertificate = async (req: AuthRequest, res: Response) => {
  try {
    const cert = await Certificate.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!cert) {
      return res.status(404).json({ success: false, message: "We couldn't find that certificate. It may have been removed." });
    }

    const isSubject =
      req.user?.memberId &&
      cert.subjectMemberIds.some((id) => String(id) === String(req.user.memberId));

    if (!isAdmin(req) && !isSubject) {
      return res.status(403).json({ success: false, message: "You don't have permission to do this. Please contact your Mahallu admin." });
    }

    const url = await getSignedDownloadUrl(cert.pdfKey);
    res.json({
      success: true,
      data: { url, fileName: `${cert.certificateNo}.pdf`, expiresIn: 300 },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t prepare the certificate for download. Please try again.');
  }
};

// PUT /api/certificates/:id/revoke — admin
export const revokeCertificate = async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Please enter a reason.' });
    }

    const cert = await Certificate.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, status: 'valid' },
      { status: 'revoked', revokedReason: reason },
      { new: true }
    );

    if (!cert) {
      return res.status(404).json({ success: false, message: "We couldn't find a valid certificate for this." });
    }

    res.json({ success: true, data: cert, message: 'Certificate revoked' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t cancel the certificate. Please try again.');
  }
};

// GET /api/verify/:certificateNo — PUBLIC, minimal info only, never family data
export const verifyCertificate = async (req: Request, res: Response) => {
  try {
    const cert = await Certificate.findOne({ certificateNo: req.params.certificateNo })
      .populate('tenantId', 'name')
      .select('certificateNo type issueDate status tenantId');

    if (!cert) {
      return res.status(404).json({ success: false, message: "We couldn't find that certificate. It may have been removed." });
    }

    res.json({
      success: true,
      data: {
        certificateNo: cert.certificateNo,
        type: cert.type,
        issueDate: cert.issueDate,
        status: cert.status,
        issuedByMahallu: (cert.tenantId as any)?.name || null,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t verify the certificate. Please try again.');
  }
};
