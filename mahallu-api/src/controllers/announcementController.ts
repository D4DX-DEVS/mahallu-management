import { Response } from 'express';
import Announcement from '../models/Announcement';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable } from '../utils/sanitizeUpdate';
import AnnouncementDelivery from '../models/AnnouncementDelivery';
import { deliverAnnouncement, getChannelAvailability, isDryRun } from '../services/notificationChannels';

const tenantScope = (req: AuthRequest) => {
  if (req.tenantId) return req.tenantId;
  if (req.isSuperAdmin && req.query.tenantId) return req.query.tenantId as string;
  return undefined;
};

const scopedQuery = (req: AuthRequest): Record<string, any> => {
  const tenantId = tenantScope(req);
  return tenantId ? { tenantId } : {};
};

export const getAllAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, category, search } = req.query;
    const query: any = scopedQuery(req);
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      Announcement.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Announcement.countDocuments(query),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAnnouncementById = async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement || (req.tenantId && announcement.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    res.json({ success: true, data: announcement });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });

    const announcement = await Announcement.create({
      ...req.body,
      tenantId,
      status: 'draft',
      createdBy: req.user?._id,
    });
    res.status(201).json({ success: true, data: announcement });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Announcement.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    if (existing.status === 'sent') {
      return res.status(400).json({ success: false, message: 'A sent announcement cannot be edited' });
    }
    const { status, sentAt, ...rest } = req.body;
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, stripImmutable(rest), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: announcement });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Announcement.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    await existing.deleteOne();
    await AnnouncementDelivery.deleteMany({ announcementId: existing._id });
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fan out on the selected channels through the channel layer. Every recipient gets a delivery
 * row (queued/sent/failed/skipped) and the announcement is only marked sent when at least one
 * message really went out. Channels that are not set up are reported as skipped, never as sent.
 */
export const sendAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement || (req.tenantId && announcement.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    if (announcement.status === 'sent') {
      return res.status(400).json({ success: false, message: 'Announcement already sent' });
    }

    const outcome = await deliverAnnouncement(announcement);

    // A retry replaces the previous attempt's rows.
    await AnnouncementDelivery.deleteMany({ announcementId: announcement._id });
    if (outcome.deliveries.length) {
      await AnnouncementDelivery.insertMany(
        outcome.deliveries.map((d) => ({ ...d, tenantId: announcement.tenantId, announcementId: announcement._id }))
      );
    }

    // Back-compat string per channel for older clients.
    const results: Record<string, string> = {};
    for (const [channel, s] of Object.entries(outcome.summary)) {
      results[channel] =
        s.sent > 0 ? (s.total > 1 ? `sent to ${s.sent}/${s.total}` : 'sent')
        : s.failed > 0 ? `failed: ${s.failed} of ${s.total}`
        : `skipped: ${s.note || 'nothing to send'}`;
    }
    announcement.deliveryResults = results;
    announcement.deliverySummary = outcome.summary;
    announcement.deliveryMessage = outcome.message;
    if (outcome.anySent) {
      announcement.status = 'sent';
      announcement.sentAt = new Date();
    }
    await announcement.save();

    if (!outcome.anySent) {
      return res.status(422).json({ success: false, message: outcome.message, data: announcement });
    }
    res.json({ success: true, message: outcome.message, data: announcement });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getChannels = async (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: getChannelAvailability(), testMode: isDryRun() });
};

export const getAnnouncementDeliveries = async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement || (req.tenantId && announcement.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    const { page, limit, skip } = getPaginationParams(req);
    const q: any = { announcementId: announcement._id };
    if (req.query.channel) q.channel = req.query.channel;
    if (req.query.status) q.status = req.query.status;
    const [rows, total] = await Promise.all([
      AnnouncementDelivery.find(q).sort({ channel: 1, status: 1, createdAt: 1 }).skip(skip).limit(Math.min(limit, 100)),
      AnnouncementDelivery.countDocuments(q),
    ]);
    const body: any = createPaginationResponse(rows, total, page, limit);
    body.summary = announcement.deliverySummary || {};
    body.message = announcement.deliveryMessage || '';
    res.json(body);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
