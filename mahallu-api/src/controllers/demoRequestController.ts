import { Request, Response } from 'express';
import DemoRequest from '../models/DemoRequest';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { searchRegex } from '../utils/queryGuard';
import { sendFailure } from '../utils/userMessages';

// POST /api/demo-requests — public, sent from the landing page's "Request a demo" form
export const createDemoRequest = async (req: Request, res: Response) => {
  try {
    const { mahalluName, contactNumber, whatsappNumber } = req.body;
    await DemoRequest.create({ mahalluName, contactNumber, whatsappNumber });
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

    const pattern = searchRegex(req.query.search);
    const filter: Record<string, unknown> = pattern
      ? { $or: [{ mahalluName: pattern }, { contactNumber: pattern }, { whatsappNumber: pattern }] }
      : {};

    const [data, total] = await Promise.all([
      DemoRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DemoRequest.countDocuments(filter),
    ]);

    return res.json(createPaginationResponse(data, total, page, limit));
  } catch (error) {
    return sendFailure(res, error, "We couldn't load demo requests right now. Please try again in a moment.");
  }
};
