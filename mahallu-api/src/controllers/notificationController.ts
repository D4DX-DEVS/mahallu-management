import { Response } from 'express';
import mongoose from 'mongoose';
import Notification, { notificationForViewer, readsPerUser } from '../models/Notification';
import User from '../models/User';
import Member from '../models/Member';
import Family from '../models/Family';
import Committee from '../models/Committee';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { sendPushToUsers } from '../services/oneSignalService';

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

/** Notifications in the viewer's own inbox: addressed to them, to a group they are in, or a broadcast. */
const inboxCondition = (viewer: ReturnType<typeof viewerOf>) => ({
  $or: [{ recipientId: { $in: viewer.ids } }, { recipientIds: { $in: viewer.ids } }, { recipientType: 'all' }],
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

type Audience = { userIds: mongoose.Types.ObjectId[]; memberIds: mongoose.Types.ObjectId[] };

const toIds = (values: unknown[]): mongoose.Types.ObjectId[] =>
  values.map((v: any) => v?._id ?? v).filter((v) => v && isValidId(String(v))).map((v) => new mongoose.Types.ObjectId(String(v)));

/**
 * Who a notification is for, inside ONE Mahallu. Answers null when a named target (user, member,
 * family, committee) is not in that Mahallu. `all` resolves to every active user of the Mahallu.
 */
const resolveAudience = async (
  tenantId: unknown,
  recipientType: string,
  recipientId: string | undefined,
  recipientIds: string[] | undefined
): Promise<Audience | 'all' | null> => {
  if (recipientType === 'all') return 'all';

  if (recipientType === 'user') {
    const wanted = recipientIds?.length ? recipientIds : recipientId ? [recipientId] : [];
    const users = await User.find({ _id: { $in: wanted }, tenantId }).select('_id memberId');
    if (wanted.length === 0 || users.length !== new Set(wanted.map(String)).size) return null;
    return { userIds: toIds(users), memberIds: toIds(users.map((u: any) => u.memberId).filter(Boolean)) };
  }

  if (recipientType === 'member') {
    const wanted = recipientIds?.length ? recipientIds : recipientId ? [recipientId] : [];
    const members = await Member.find({ _id: { $in: wanted }, tenantId }).select('_id');
    if (wanted.length === 0 || members.length !== new Set(wanted.map(String)).size) return null;
    return { userIds: [], memberIds: toIds(members) };
  }

  if (recipientType === 'family') {
    if (!recipientId || !(await Family.exists({ _id: recipientId, tenantId }))) return null;
    const members = await Member.find({ tenantId, familyId: recipientId, status: { $ne: 'deleted' }, isDead: { $ne: true } }).select('_id');
    return { userIds: [], memberIds: toIds(members) };
  }

  if (recipientType === 'committee') {
    const committee: any = recipientId ? await Committee.findOne({ _id: recipientId, tenantId }).select('members') : null;
    if (!committee) return null;
    return { userIds: [], memberIds: toIds(committee.members || []) };
  }

  return null;
};

/** Active users of the Mahallu to push to: everyone (`all`), or the audience's users and members' users. */
const pushTargets = (tenantId: unknown, audience: Audience | 'all') => {
  const base = { tenantId, status: 'active' };
  const query =
    audience === 'all'
      ? base
      : { ...base, $or: [{ _id: { $in: audience.userIds } }, { memberId: { $in: audience.memberIds } }] };
  return User.find(query).select('_id oneSignalPlayerId');
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

    // Read state, the resolved audience and the push outcome are server-owned.
    const {
      isRead: _isRead, readBy: _readBy, recipientIds: requestedIds,
      pushStatus: _ps, pushIds: _pi, pushRecipients: _pr, pushError: _pe, pushedAt: _pa,
      ...fields
    } = stripImmutable(req.body) as Record<string, any>;
    const notificationData: Record<string, any> = { ...fields, tenantId };

    // Every target must be in the same Mahallu (users, members, a family, a committee).
    const audience = await resolveAudience(tenantId, notificationData.recipientType, notificationData.recipientId, requestedIds);
    if (!audience) {
      return res.status(404).json({ success: false, message: "We couldn't find that recipient." });
    }
    // A group (several people, a family, a committee) is stored resolved, so each person's inbox finds it.
    const isGroup = audience !== 'all' && (Boolean(requestedIds?.length) || ['family', 'committee'].includes(notificationData.recipientType));
    if (isGroup) {
      notificationData.recipientIds = [...audience.userIds, ...audience.memberIds];
      if (requestedIds?.length) delete notificationData.recipientId;
    }
    notificationData.pushStatus = 'pending';

    const notification = new Notification(notificationData);
    await notification.save();

    // The record is kept whatever happens to the push; the outcome is stored on it.
    try {
      const users = await pushTargets(notification.tenantId, audience);
      const result = await sendPushToUsers(users as any[], {
        title: notification.title,
        message: notification.message,
        imageUrl: notification.imageUrl,
        data: {
          type: 'notification',
          notificationId: String(notification._id),
          notificationType: notification.type,
          ...(notification.link ? { link: notification.link } : {}),
        },
      });
      notification.pushStatus = result.status;
      notification.pushIds = result.ids;
      notification.pushRecipients = result.recipients;
      notification.pushError = result.error;
      notification.pushedAt = new Date();
      if (result.status === 'failed') console.error('[OneSignal] Push failed:', result.error);
    } catch (err: any) {
      notification.pushStatus = 'failed';
      notification.pushError = String(err?.message || 'error').slice(0, 200);
      console.error('[OneSignal] Push failed:', err?.message);
    }
    try {
      await Notification.updateOne(
        { _id: notification._id },
        {
          $set: {
            pushStatus: notification.pushStatus,
            pushIds: notification.pushIds,
            pushRecipients: notification.pushRecipients,
            pushError: notification.pushError,
            pushedAt: notification.pushedAt,
          },
        }
      );
    } catch (err: any) {
      console.error('[OneSignal] Could not store the push result:', err?.message);
    }

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

    const existing = await Notification.findOne(filter).select('recipientType +recipientIds');
    if (!existing) {
      return res.status(404).json({ success: false, message: NOT_FOUND });
    }

    // A broadcast or group notification is read per user; marking it must not mark it read for everyone else.
    const update =
      readsPerUser(existing)
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

    // Individual notifications addressed to this person: their own flag. (A family/committee
    // notification's recipientId is the group's id, never a viewer id.)
    if (viewer.ids.length > 0) {
      await Notification.updateMany(
        { tenantId: caller.tenantId, recipientType: { $ne: 'all' }, recipientId: { $in: viewer.ids }, isRead: { $ne: true } },
        { isRead: true }
      );
    }

    // Broadcasts and groups this person is in: only this person's read state changes.
    if (viewer.id) {
      const me = new mongoose.Types.ObjectId(viewer.id);
      await Notification.updateMany(
        { tenantId: caller.tenantId, recipientType: 'all', isRead: { $ne: true }, readBy: { $ne: me } },
        { $addToSet: { readBy: me } }
      );
      if (viewer.ids.length > 0) {
        await Notification.updateMany(
          { tenantId: caller.tenantId, recipientIds: { $in: viewer.ids }, isRead: { $ne: true }, readBy: { $ne: me } },
          { $addToSet: { readBy: me } }
        );
      }
    }

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t mark the notifications as read. Please try again.');
  }
};
