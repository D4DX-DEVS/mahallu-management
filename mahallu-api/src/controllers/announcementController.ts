import { Response } from 'express';
import Announcement from '../models/Announcement';
import Notification from '../models/Notification';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable } from '../utils/sanitizeUpdate';
import { sendPushNotification, getTenantPlayerIds } from '../services/oneSignalService';
import { sendWhatsAppMessage } from '../services/dxingService';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';
import { isValidId, requireScope, tenantFilterFor } from '../utils/scope';

const NOT_FOUND = "We couldn't find that announcement. It may have been removed.";

/** A claim ("sending") older than this is treated as abandoned (crashed process) and may be taken over. */
export const SEND_CLAIM_STALE_MS = 15 * 60 * 1000;
const DEFAULT_MAX_RECIPIENTS = 500;
const WHATSAPP_CONCURRENCY = 5;

/** Recipients one send may message: ANNOUNCEMENT_MAX_RECIPIENTS, default 500. */
export const maxRecipients = (env: NodeJS.ProcessEnv = process.env): number => {
  const n = Number(env.ANNOUNCEMENT_MAX_RECIPIENTS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_MAX_RECIPIENTS;
};

/** The id filter for a by-id lookup: the caller's Mahallu (a super admin may act on any). Null after a 403. */
const scopedIdFilter = (req: AuthRequest, res: Response): Record<string, any> | null => {
  const caller = requireScope(req, res);
  if (!caller) return null;
  return { _id: req.params.id, ...(caller.tenantId ? { tenantId: caller.tenantId } : {}) };
};

export const getAllAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, category, search } = req.query;
    const scope = tenantFilterFor(req, res);
    if (!scope) return;
    const query: any = { ...scope };
    // A send in progress is still a draft as far as the lists are concerned.
    if (status === 'draft') query.status = { $in: ['draft', 'sending'] };
    else if (status) query.status = status;
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
    const filter = scopedIdFilter(req, res);
    if (!filter) return;
    const announcement = await Announcement.findOne(filter);
    if (!announcement) {
      return res.status(404).json({ success: false, message: NOT_FOUND });
    }
    res.json({ success: true, data: announcement });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the announcement right now. Please try again.');
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    // Own Mahallu only; a body tenantId is honoured for a super admin who has not picked one.
    const caller = requireScope(req, res);
    if (!caller) return;
    const tenantId = caller.tenantId || (caller.isSuperAdmin && isValidId(req.body?.tenantId) ? req.body.tenantId : undefined);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });

    // Delivery state is server-owned: a client cannot create an announcement that already "was sent".
    const { status: _status, sentAt: _sentAt, deliveryResults: _results, sendingStartedAt: _claim, ...fields } =
      stripImmutable(req.body) as Record<string, any>;
    const announcement = await Announcement.create({
      ...fields,
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
    const filter = scopedIdFilter(req, res);
    if (!filter) return;
    const existing = await Announcement.findOne(filter);
    if (!existing) {
      return res.status(404).json({ success: false, message: NOT_FOUND });
    }
    if (existing.status === 'sent') {
      return res.status(400).json({ success: false, message: 'An announcement that has been sent can no longer be edited.' });
    }
    if (existing.status === 'sending') {
      return res.status(409).json({ success: false, message: 'This announcement is being sent right now, so it can\'t be edited.' });
    }
    const { status, sentAt, deliveryResults, sendingStartedAt, ...rest } = req.body;
    // Only a draft may change: if a send claimed it in the meantime, the update finds nothing.
    const announcement = await Announcement.findOneAndUpdate({ ...filter, status: 'draft' }, stripImmutable(rest), {
      new: true,
      runValidators: true,
    });
    if (!announcement) {
      return res.status(409).json({ success: false, message: 'This announcement is being sent right now, so it can\'t be edited.' });
    }
    res.json({ success: true, data: announcement });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the announcement. Please try again.');
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const filter = scopedIdFilter(req, res);
    if (!filter) return;
    const existing = await Announcement.findOne(filter);
    if (!existing) {
      return res.status(404).json({ success: false, message: NOT_FOUND });
    }
    if (existing.status === 'sending') {
      return res.status(409).json({ success: false, message: 'This announcement is being sent right now, so it can\'t be deleted.' });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the announcement. Please try again.');
  }
};

type Audience = { supported: false } | { supported: true; phones: string[]; limited: boolean };

/**
 * Phone numbers for the WhatsApp fan-out, for exactly the audience that was chosen.
 * An audience that cannot be honoured returns `supported: false`: it never falls back to a wider one.
 *   all / families  every family of this Mahallu with a contact number
 *   cluster         only families of the chosen clusters; no cluster chosen = not supported
 *   committee / custom  target member records, not households: not supported (yet)
 * Numbers are de-duplicated and capped (ANNOUNCEMENT_MAX_RECIPIENTS).
 */
const resolveAudience = async (announcement: any): Promise<Audience> => {
  const query: any = { tenantId: announcement.tenantId, contactNo: { $exists: true, $ne: '' } };

  if (announcement.audience === 'cluster') {
    const clusterIds = (announcement.audienceRefIds || []).map(String).filter(isValidId);
    if (clusterIds.length === 0) return { supported: false };
    query.clusterId = { $in: clusterIds };
  } else if (announcement.audience !== 'all' && announcement.audience !== 'families') {
    return { supported: false };
  }

  const cap = maxRecipients();
  // Read a bounded number of rows: enough to fill the cap even with shared numbers.
  const fetchLimit = cap * 10;
  const families: any[] = await Family.find(query).select('contactNo').sort({ _id: 1 }).limit(fetchLimit).lean();
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const family of families) {
    const phone = typeof family?.contactNo === 'string' ? family.contactNo.trim() : '';
    const key = phone.replace(/\D/g, '').slice(-10);
    if (!phone || seen.has(key)) continue;
    seen.add(key);
    phones.push(phone);
  }
  return { supported: true, phones: phones.slice(0, cap), limited: phones.length > cap || families.length >= fetchLimit };
};

/** Run `task` over `items`, at most `size` at a time. */
const runPool = async <T>(items: T[], size: number, task: (item: T) => Promise<void>): Promise<void> => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
};

const sendFailureCopy = (results: Record<string, string>): string => {
  const values = Object.values(results);
  if (values.length > 0 && values.every((v) => v === 'not_supported')) {
    return "The selected channels can't reach this audience yet, so nothing was sent and the announcement is still a draft. Choose Everyone, All Families or a cluster, then try again.";
  }
  return "We couldn't deliver this announcement to anyone, so it is still a draft. Please check the channels and try again.";
};

/**
 * Fan out on the selected channels. push + whatsapp actually deliver; sms and email are stored and
 * reported as not_configured (spec 30).
 *
 * One send at a time: the announcement is claimed atomically (draft -> sending), so a double click
 * or a second admin gets 409. It is marked 'sent' only if something was really delivered; if every
 * channel failed or reached nobody it goes back to 'draft' with the per-channel results stored, and
 * the answer is 422. Channels whose audience cannot be honoured report 'not_supported' and send
 * nothing (never a wider audience).
 */
export const sendAnnouncement = async (req: AuthRequest, res: Response) => {
  let claimedId: unknown;
  let finalised = false;
  let delivered = false;
  try {
    const filter = scopedIdFilter(req, res);
    if (!filter) return;

    const claimed = await Announcement.findOneAndUpdate(
      {
        ...filter,
        $or: [
          { status: 'draft' },
          { status: 'sending', sendingStartedAt: { $lt: new Date(Date.now() - SEND_CLAIM_STALE_MS) } },
        ],
      },
      { status: 'sending', sendingStartedAt: new Date() },
      { new: true }
    );

    if (!claimed) {
      const current: any = await Announcement.findOne(filter).select('status');
      if (!current) {
        return res.status(404).json({ success: false, message: NOT_FOUND });
      }
      return res.status(409).json({
        success: false,
        message:
          current.status === 'sent'
            ? 'This announcement has already been sent.'
            : 'This announcement is already being sent. Please wait a moment.',
      });
    }

    const announcement: any = claimed;
    claimedId = announcement._id;
    const results: Record<string, string> = {};

    for (const channel of announcement.channels || []) {
      if (channel === 'push') {
        // The push goes to every device of this Mahallu, so only an audience that is the whole Mahallu is honest.
        if (announcement.audience !== 'all' && announcement.audience !== 'families') {
          results.push = 'not_supported';
          continue;
        }
        try {
          // Only this Mahallu's devices - an empty list sends nothing rather than everything.
          const playerIds = await getTenantPlayerIds(announcement.tenantId);
          const accepted = await sendPushNotification({ title: announcement.title, message: announcement.body, playerIds });
          if (!accepted) {
            results.push = 'no_recipients';
            continue;
          }
          results.push = 'sent';
          delivered = true;
          try {
            await Notification.create({
              tenantId: announcement.tenantId,
              recipientType: 'all',
              title: announcement.title,
              titleMl: announcement.titleMl,
              message: announcement.body,
              type: announcement.category === 'emergency' ? 'warning' : 'info',
              link: `/announcements/${announcement._id}`,
            });
          } catch (err: any) {
            console.error('[announcement] in-app notification failed:', err?.message);
          }
        } catch (err: any) {
          // The provider's error text stays in the server log; the client only learns it failed.
          console.error('[announcement] push failed:', err?.message);
          results.push = 'failed';
        }
      } else if (channel === 'whatsapp') {
        try {
          const audience = await resolveAudience(announcement);
          if (!audience.supported) {
            results.whatsapp = 'not_supported';
            continue;
          }
          if (audience.phones.length === 0) {
            results.whatsapp = 'no_recipients';
            continue;
          }
          let sent = 0;
          const text = `*${announcement.title}*\n\n${announcement.body}`;
          await runPool(audience.phones, WHATSAPP_CONCURRENCY, async (phone) => {
            try {
              await sendWhatsAppMessage(phone, text);
              sent += 1;
            } catch {
              // one bad number must not abort the broadcast
            }
          });
          if (sent === 0) {
            results.whatsapp = 'failed';
          } else {
            results.whatsapp =
              `sent to ${sent}/${audience.phones.length}` +
              (audience.limited ? ` (limited to ${audience.phones.length} recipients per send)` : '');
            delivered = true;
          }
        } catch (err: any) {
          console.error('[announcement] whatsapp failed:', err?.message);
          results.whatsapp = 'failed';
        }
      } else {
        results[channel] = 'not_configured';
      }
    }

    const update: Record<string, any> = delivered
      ? { $set: { status: 'sent', sentAt: new Date(), deliveryResults: results }, $unset: { sendingStartedAt: 1 } }
      : { $set: { status: 'draft', deliveryResults: results }, $unset: { sendingStartedAt: 1 } };
    const finished = await Announcement.findOneAndUpdate({ _id: announcement._id, status: 'sending' }, update, { new: true });
    finalised = true;
    const data = finished || announcement;

    if (!delivered) {
      return res.status(422).json({ success: false, message: sendFailureCopy(results), data });
    }
    res.json({ success: true, data });
  } catch (error: any) {
    // Never leave the claim behind: give it back (or record the delivery that did happen).
    if (claimedId && !finalised) {
      try {
        await Announcement.findOneAndUpdate(
          { _id: claimedId, status: 'sending' },
          delivered
            ? { status: 'sent', sentAt: new Date(), $unset: { sendingStartedAt: 1 } }
            : { status: 'draft', $unset: { sendingStartedAt: 1 } }
        );
      } catch (releaseError: any) {
        console.error('[announcement] could not release the send claim:', releaseError?.message);
      }
    }
    sendFailure(res, error, 'We couldn\'t send the announcement. Please try again.');
  }
};
