import { Request, Response } from 'express';
import DemoRequest from '../models/DemoRequest';
import { AuthRequest } from '../middleware/authMiddleware';
import { sendWhatsAppMessage } from '../services/dxingService';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { asFilterValue, searchRegex } from '../utils/queryGuard';
import { sendFailure } from '../utils/userMessages';

/**
 * Requests saved before review existed have no `status`; they are pending. Every read and every
 * transition goes through this so such a request is never invisible to the "pending" filter or
 * refused as "already reviewed".
 */
const PENDING = { $or: [{ status: 'pending' }, { status: { $exists: false } }] };

const NOT_FOUND = "We couldn't find that demo request. It may have been removed.";

/** Strip empty values so an untouched optional field is never stored as ''. */
const compact = <T extends Record<string, unknown>>(values: T): Partial<T> =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== '')) as Partial<T>;

// POST /api/demo-requests — public, sent from the landing page's "Request a demo" form
export const createDemoRequest = async (req: Request, res: Response) => {
  try {
    const { mahalluName, contactNumber, whatsappNumber, type, location, address } = req.body;
    const addressFields = compact({
      state: address?.state,
      district: address?.district,
      pinCode: address?.pinCode,
      postOffice: address?.postOffice,
      village: address?.village,
    });

    // `status` is never read from the body: every request starts pending.
    await DemoRequest.create({
      mahalluName,
      contactNumber,
      whatsappNumber,
      ...compact({ type, location }),
      ...(Object.keys(addressFields).length > 0 ? { address: addressFields } : {}),
      status: 'pending',
    });
    return res.status(201).json({
      success: true,
      message: 'Thank you! We have received your request and will contact you soon.',
    });
  } catch (error) {
    return sendFailure(res, error, "We couldn't send your request right now. Please try again in a moment.");
  }
};

// GET /api/demo-requests — super admin inbox, newest first
export const listDemoRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);

    const clauses: Record<string, unknown>[] = [];
    const pattern = searchRegex(req.query.search);
    if (pattern) {
      clauses.push({ $or: [{ mahalluName: pattern }, { contactNumber: pattern }, { whatsappNumber: pattern }] });
    }
    const status = asFilterValue(req.query.status);
    if (status === 'pending') clauses.push(PENDING);
    else if (status === 'accepted' || status === 'rejected') clauses.push({ status });

    const filter = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };

    const [data, total] = await Promise.all([
      DemoRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DemoRequest.countDocuments(filter),
    ]);

    return res.json(createPaginationResponse(data, total, page, limit));
  } catch (error) {
    return sendFailure(res, error, "We couldn't load demo requests right now. Please try again in a moment.");
  }
};

// GET /api/demo-requests/:id — one request, to prefill the tenant form
export const getDemoRequest = async (req: AuthRequest, res: Response) => {
  try {
    const request = await DemoRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: NOT_FOUND });
    return res.json({ success: true, data: request });
  } catch (error) {
    return sendFailure(res, error, "We couldn't load that demo request right now. Please try again in a moment.");
  }
};

/** Why a request could not move: it is gone, or someone already decided it. */
const refuseTransition = async (req: AuthRequest, res: Response, action: 'accept' | 'reject') => {
  const current = await DemoRequest.findById(req.params.id);
  if (!current) return res.status(404).json({ success: false, message: NOT_FOUND });
  const decided = current.status === 'accepted' ? 'accepted' : 'rejected';
  return res.status(409).json({
    success: false,
    message: `This request has already been ${decided}, so it can't be ${action === 'accept' ? 'accepted' : 'rejected'} again.`,
  });
};

// POST /api/demo-requests/:id/accept — records the decision; the Mahallu is created separately,
// from the tenant form, when the administrator submits it.
export const acceptDemoRequest = async (req: AuthRequest, res: Response) => {
  try {
    const accepted = await DemoRequest.findOneAndUpdate(
      { _id: req.params.id, ...PENDING },
      { $set: { status: 'accepted', reviewedAt: new Date(), reviewedBy: req.user?._id } },
      { new: true }
    );
    if (!accepted) return await refuseTransition(req, res, 'accept');

    return res.json({ success: true, message: 'Request accepted.', data: accepted });
  } catch (error) {
    return sendFailure(res, error, "We couldn't accept this request right now. Please try again in a moment.");
  }
};

const rejectionText = (mahalluName: string, reason: string) =>
  `Assalamu Alaikum. Thank you for your interest in ZAAD. We are unable to go ahead with the demo request for ${mahalluName}.\n\nReason: ${reason}`;

// POST /api/demo-requests/:id/reject — the reason is stored, then the requester is messaged on WhatsApp.
// The rejection stands whether or not the message goes; the response says which happened.
export const rejectDemoRequest = async (req: AuthRequest, res: Response) => {
  try {
    const reason = String(req.body.reason).trim();
    const rejected = await DemoRequest.findOneAndUpdate(
      { _id: req.params.id, ...PENDING },
      { $set: { status: 'rejected', rejectionReason: reason, reviewedAt: new Date(), reviewedBy: req.user?._id } },
      { new: true }
    );
    if (!rejected) return await refuseTransition(req, res, 'reject');

    let notification: 'sent' | 'failed' = 'failed';
    try {
      await sendWhatsAppMessage(rejected.whatsappNumber, rejectionText(rejected.mahalluName, reason));
      notification = 'sent';
    } catch (error: any) {
      console.error('[demo-request] rejection message not delivered:', error?.message);
    }

    const attempt = { channel: 'whatsapp', status: notification, attemptedAt: new Date() };
    let saved = rejected;
    try {
      saved = (await DemoRequest.findOneAndUpdate(
        { _id: req.params.id },
        { $set: { rejectionNotification: attempt } },
        { new: true }
      )) ?? rejected;
    } catch (error: any) {
      console.error('[demo-request] could not record the rejection message result:', error?.message);
    }

    return res.json({
      success: true,
      message:
        notification === 'sent'
          ? 'Request rejected and the requester was notified on WhatsApp.'
          : 'Request rejected, but the requester could not be notified on WhatsApp. Please contact them directly.',
      notification,
      data: saved,
    });
  } catch (error) {
    return sendFailure(res, error, "We couldn't reject this request right now. Please try again in a moment.");
  }
};
