import { Response } from 'express';
import mongoose from 'mongoose';
import Notification, { notificationForViewer } from '../models/Notification';
import User from '../models/User';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { sendPushSilent } from '../services/oneSignalService';

import { sendFailure } from '../utils/userMessages';
import { isValidId, requireScope, requireWriteScope, tenantFilterFor } from '../utils/scope';
import { stripImmutable } from '../utils/sanitizeUpdate';

const NOT_FOUND = "We couldn't find that notification. It may have been removed.";

/**
 * Who is asking, from the server-derived identity:
 *   id       the signed-in user (read state of broadcasts is tracked per user id)
 *   ids      every id a notification may be addressed to this person by (user id, member id)
 *   isAdmin  super admin / Mahallu admin: the only roles that may list tenant-wide notifications
 */
const viewerOf = (req: AuthRequest) => {
  const id = req.user?._id ? String(req.user._id) : undefined;
  const ids = [id, req.user?.memberId ? String(req.user.memberId) : undefined]
    .filter((v): v is string => !!v && isValidId(v))
    .map((v) => new mongoose.Types.ObjectId(v));
  const role = req.user?.role as string | undefined;
  return { id, ids, isAdmin: req.isSuperAdmin === true || role === 'super_admin' || role === 'mahall' };
};

/** Notifications in the viewer's own inbox: addressed to them, or a broadcast to the whole Mahallu. */
const inboxCondition = (viewer: ReturnType<typeof viewerOf>) => ({
  $or: [{ recipientId: { $in: viewer.ids } }, { recipientType: 'all' }],
});

/** Read / unread for ONE viewer: the notification's own flag, or the viewer being in a broadcast's readBy. */
const readCondition = (read: boolean, viewer: ReturnType<typeof viewerOf>) => {
  if (read) {
    return { $or: [{ isRead: true }, ...(viewer.id ? [{ readBy: new mongoose.Types.ObjectId(viewer.id) }] : [])] };
  }
  return { isRead: { $ne: true }, ...(viewer.id ? { readBy: { $ne: new mongoose.Types.ObjectId(viewer.id) } } : {}) };
};

export const getAllNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const { recipientType, isRead } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const scope = tenantFilterFor(req, res);
    if (!scope) return;
    const viewer = viewerOf(req);

    const conditions: Record<string, any>[] = [scope];

    // Only an admin may see the whole Mahallu's notifications (and only when not asking for their own
    // inbox with recipientType=individual, which the bell badge does). Everyone else (survey,
    // institute, member) sees their own individual notifications plus broadcasts, whatever the query says.
    if (!viewer.isAdmin || recipientType === 'individual') {
      conditions.push(inboxCondition(viewer));
    }

    if (isRead === 'true' || isRead === 'false') {
      conditions.push(readCondition(isRead === 'true', viewer));
    }

    const query = conditions.length > 1 ? { $and: conditions } : conditions[0];

    const [notifications, total] = await Promise.all([
      Notification.find(query).select('+readBy').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query),
    ]);

    // `isRead` is THIS viewer's state, so the contract the CMS and apps read is unchanged.
    const data = notifications.map((n) => notificationForViewer(n, viewer.id));
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the notifications right now. Please try again.');
  }
};

export const createNotification = async (req: AuthRequest, res: Response) => {
  try {
    // The Mahallu is the caller's own; only a super admin may name one in the body.
    const caller = requireScope(req, res);
    if (!caller) return;
    const tenantId = caller.tenantId || (caller.isSuperAdmin && isValidId(req.body?.tenantId) ? req.body.tenantId : undefined);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    // Read state is server-owned.
    const { isRead: _isRead, readBy: _readBy, ...fields } = stripImmutable(req.body) as Record<string, any>;
    const notificationData: Record<string, any> = { ...fields, tenantId };

    // A targeted notification must target someone in the same Mahallu (a user, or a member).
    if (notificationData.recipientId) {
      const recipient =
        (await User.findOne({ _id: notificationData.recipientId, tenantId }).select('_id')) ||
        (await Member.findOne({ _id: notificationData.recipientId, tenantId }).select('_id'));
      if (!recipient) {
        return res.status(404).json({ success: false, message: "We couldn't find that recipient." });
      }
    }

    const notification = new Notification(notificationData);
    await notification.save();

    // Fire-and-forget OneSignal push
    (async () => {
      try {
        // Always inside this Mahallu, whether it goes to one person or to everyone.
        const userQuery: any = { oneSignalPlayerId: { $exists: true, $ne: null }, tenantId: notification.tenantId };
        if (notification.recipientId) {
          userQuery._id = notification.recipientId;
        }
        const users = await User.find(userQuery).select('oneSignalPlayerId');
        const playerIds = users
          .map((u: any) => u.oneSignalPlayerId)
          .filter((id: any): id is string => Boolean(id));

        sendPushSilent({
          title: notification.title,
          message: notification.message,
          imageUrl: notification.imageUrl,
          playerIds,
        });
      } catch (err: any) {
        console.error('[OneSignal] Player ID lookup failed:', err.message);
      }
    })();

    res.status(201).json({ success: true, data: notificationForViewer(notification, req.user?._id) });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the notification. Please try again.');
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const viewer = viewerOf(req);

    // Marking is limited to the caller's own inbox (addressed to them, or a broadcast) in their own
    // Mahallu: an id from anywhere else answers "not found", it never changes someone else's state.
    const filter: Record<string, any> = {
      $and: [
        { _id: req.params.id, ...(caller.tenantId ? { tenantId: caller.tenantId } : {}) },
        inboxCondition(viewer),
      ],
    };

    const existing = await Notification.findOne(filter).select('recipientType');
    if (!existing) {
      return res.status(404).json({ success: false, message: NOT_FOUND });
    }

    // A broadcast is read per user; marking it must not mark it read for everyone else.
    const update =
      existing.recipientType === 'all'
        ? viewer.id
          ? { $addToSet: { readBy: new mongoose.Types.ObjectId(viewer.id) } }
          : null
        : { isRead: true };
    if (!update) {
      return res.status(404).json({ success: false, message: NOT_FOUND });
    }

    const notification = await Notification.findOneAndUpdate(filter, update, { new: true }).select('+readBy');
    if (!notification) {
      return res.status(404).json({ success: false, message: NOT_FOUND });
    }

    res.json({ success: true, data: notificationForViewer(notification, viewer.id) });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t mark the notification as read. Please try again.');
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    // The Mahallu comes from the server-derived identity (a super admin must have picked one).
    const caller = requireWriteScope(req, res);
    if (!caller) return;
    const viewer = viewerOf(req);

    // Individual notifications addressed to this person: their own flag.
    if (viewer.ids.length > 0) {
      await Notification.updateMany(
        { tenantId: caller.tenantId, recipientType: { $ne: 'all' }, recipientId: { $in: viewer.ids }, isRead: { $ne: true } },
        { isRead: true }
      );
    }

    // Broadcasts: only this person's read state changes.
    if (viewer.id) {
      const me = new mongoose.Types.ObjectId(viewer.id);
      await Notification.updateMany(
        { tenantId: caller.tenantId, recipientType: 'all', isRead: { $ne: true }, readBy: { $ne: me } },
        { $addToSet: { readBy: me } }
      );
    }

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t mark the notifications as read. Please try again.');
  }
};
