import { Request, Response } from 'express';
import Notification from '../models/Notification';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { sendPushSilent } from '../services/oneSignalService';

import { sendFailure } from '../utils/userMessages';

export const getAllNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const { recipientType, isRead, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    // For individual notifications, filter by user
    if (recipientType === 'individual') {
      query.$or = [
        { recipientId: req.user?._id },
        { recipientType: 'all' },
      ];
    }

    if (isRead !== undefined) query.isRead = isRead === 'true';

    const [notifications, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query),
    ]);

    res.json(createPaginationResponse(notifications, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the notifications right now. Please try again.');
  }
};

export const createNotification = async (req: AuthRequest, res: Response) => {
  try {
    const notificationData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!notificationData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const notification = new Notification(notificationData);
    await notification.save();

    // Fire-and-forget OneSignal push
    (async () => {
      try {
        const userQuery: any = { oneSignalPlayerId: { $exists: true, $ne: null } };
        if (notification.recipientId) {
          userQuery._id = notification.recipientId;
        } else if (notification.tenantId) {
          userQuery.tenantId = notification.tenantId;
        }
        const users = await User.find(userQuery).select('oneSignalPlayerId');
        const playerIds = users
          .map((u: any) => u.oneSignalPlayerId)
          .filter((id: any): id is string => Boolean(id));

        sendPushSilent({
          title: notification.title,
          message: notification.message,
          imageUrl: notification.imageUrl,
          playerIds: playerIds.length > 0 ? playerIds : undefined,
        });
      } catch (err: any) {
        console.error('[OneSignal] Player ID lookup failed:', err.message);
      }
    })();

    res.status(201).json({ success: true, data: notification });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the notification. Please try again.');
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "We couldn't find that notification. It may have been removed." });
    }

    res.json({ success: true, data: notification });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the as read. Please try again.');
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const query: any = {
      tenantId: req.tenantId || req.query.tenantId,
      isRead: false,
    };

    if (req.user?._id) {
      query.$or = [
        { recipientId: req.user._id },
        { recipientType: 'all' },
      ];
    }

    await Notification.updateMany(query, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the as read. Please try again.');
  }
};

