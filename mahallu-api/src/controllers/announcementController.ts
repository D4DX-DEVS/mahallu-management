import { Response } from 'express';
import Announcement from '../models/Announcement';
import Notification from '../models/Notification';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable } from '../utils/sanitizeUpdate';
import { sendPushNotification } from '../services/oneSignalService';
import { sendWhatsAppMessage } from '../services/dxingService';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

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
        { title: { $regex: regexLiteral(search), $options: 'i' } },
        { body: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      Announcement.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Announcement.countDocuments(query),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the announcements right now. Please try again.');
  }
};

export const getAnnouncementById = async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement || (req.tenantId && announcement.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that announcement. It may have been removed." });
    }
    res.json({ success: true, data: announcement });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the announcement right now. Please try again.');
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });

    const announcement = await Announcement.create({
      ...req.body,
      tenantId,
      status: 'draft',
      createdBy: req.user?._id,
    });
    res.status(201).json({ success: true, data: announcement });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the announcement. Please try again.');
  }
};

export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Announcement.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that announcement. It may have been removed." });
    }
    if (existing.status === 'sent') {
      return res.status(400).json({ success: false, message: 'An announcement that has been sent can no longer be edited.' });
    }
    const { status, sentAt, ...rest } = req.body;
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, stripImmutable(rest), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: announcement });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the announcement. Please try again.');
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Announcement.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that announcement. It may have been removed." });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the announcement. Please try again.');
  }
};

/** Recipient phone numbers for the WhatsApp fan-out, honouring the audience. */
const resolveRecipients = async (announcement: any): Promise<string[]> => {
  const query: any = { tenantId: announcement.tenantId, contactNo: { $exists: true, $ne: '' } };

  if (announcement.audience === 'cluster' && announcement.audienceRefIds?.length) {
    query.clusterId = { $in: announcement.audienceRefIds };
  }
  // 'committee' and 'custom' target member records rather than households; those
  // channels stay push-only until a per-member contact list is wired up.
  if (announcement.audience === 'committee' || announcement.audience === 'custom') {
    return [];
  }

  const families = await Family.find(query).select('contactNo').lean();
  return families.map((f: any) => f.contactNo).filter(Boolean);
};

/**
 * Fan out on the selected channels. push + whatsapp actually deliver;
 * sms and email are stored and reported as not_configured (spec 30).
 */
export const sendAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement || (req.tenantId && announcement.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that announcement. It may have been removed." });
    }
    if (announcement.status === 'sent') {
      return res.status(400).json({ success: false, message: 'This announcement has already been sent.' });
    }

    const results: Record<string, string> = {};

    for (const channel of announcement.channels) {
      if (channel === 'push') {
        try {
          await sendPushNotification({ title: announcement.title, message: announcement.body });
          await Notification.create({
            tenantId: announcement.tenantId,
            recipientType: 'all',
            title: announcement.title,
            titleMl: announcement.titleMl,
            message: announcement.body,
            type: announcement.category === 'emergency' ? 'warning' : 'info',
            link: `/announcements/${announcement._id}`,
          });
          results.push = 'sent';
        } catch (err: any) {
          results.push = `failed: ${err?.message || 'unknown error'}`;
        }
      } else if (channel === 'whatsapp') {
        const recipients = await resolveRecipients(announcement);
        let sent = 0;
        for (const phone of recipients) {
          try {
            await sendWhatsAppMessage(phone, `*${announcement.title}*\n\n${announcement.body}`);
            sent += 1;
          } catch {
            // one bad number must not abort the broadcast
          }
        }
        results.whatsapp = `sent to ${sent}/${recipients.length}`;
      } else {
        results[channel] = 'not_configured';
      }
    }

    announcement.status = 'sent';
    announcement.sentAt = new Date();
    announcement.deliveryResults = results;
    await announcement.save();

    res.json({ success: true, data: announcement });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t send the announcement. Please try again.');
  }
};
