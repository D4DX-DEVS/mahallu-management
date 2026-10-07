import { Request, Response } from 'express';
import { Banner, Feed, ActivityLog, Support } from '../models/Social';
import { AuthRequest } from '../middleware/authMiddleware';
import { verifyTenantOwnership } from '../utils/tenantCheck';
import mongoose from 'mongoose';
import { activeBannerFilter } from '../utils/bannerWindow';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

import { sendFailure } from '../utils/userMessages';

// Banners
export const getAllBanners = async (req: AuthRequest, res: Response) => {
  try {
    const { status, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const isAdmin = req.isSuperAdmin === true || req.user?.role === 'mahall';
    const query: any = {};

    if (!isAdmin) {
      // Members (and the other non-admin roles) see only live banners of their OWN Mahallu. The
      // Mahallu comes from the signed-in account (tenantMiddleware ignores x-tenant-id for them),
      // and `status` / `tenantId` in the query string are never honoured.
      if (!req.tenantId) {
        return res.json(createPaginationResponse([], 0, page, limit));
      }
      Object.assign(query, { tenantId: req.tenantId }, activeBannerFilter());
    } else {
      // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
      if (req.tenantId) {
        query.tenantId = req.tenantId;
      } else if (tenantId && req.isSuperAdmin) {
        query.tenantId = tenantId;
      }

      if (status) query.status = status;
    }

    const [banners, total] = await Promise.all([
      Banner.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Banner.countDocuments(query),
    ]);

    res.json(createPaginationResponse(banners, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, "We couldn't load the banners right now. Please try again.");
  }
};

export const createBanner = async (req: AuthRequest, res: Response) => {
  try {
    const bannerData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!bannerData.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const banner = new Banner(bannerData);
    await banner.save();
    res.status(201).json({ success: true, data: banner });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the banner. Please try again.');
  }
};

export const getBannerById = async (req: AuthRequest, res: Response) => {
  try {
    const query: any = { _id: req.params.id };

    if (req.tenantId) {
      query.tenantId = req.tenantId;
    }

    const banner = await Banner.findOne(query);
    if (!banner) {
      return res.status(404).json({ success: false, message: "We couldn't find that banner. It may have been removed." });
    }

    res.json({ success: true, data: banner });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the banner right now. Please try again.');
  }
};

export const updateBanner = async (req: AuthRequest, res: Response) => {
  try {
    const allowedFields = ['title', 'image', 'link', 'status', 'startDate', 'endDate'];
    const updateData = Object.keys(req.body)
      .filter((key) => allowedFields.includes(key))
      .reduce((acc: Record<string, unknown>, key) => {
        acc[key] = req.body[key];
        return acc;
      }, {});

    const query: any = { _id: req.params.id };

    if (req.tenantId) {
      query.tenantId = req.tenantId;
    }

    const banner = await Banner.findOneAndUpdate(query, updateData, {
      new: true,
      runValidators: true,
    });

    if (!banner) {
      return res.status(404).json({ success: false, message: "We couldn't find that banner. It may have been removed." });
    }

    res.json({ success: true, data: banner });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the banner. Please try again.');
  }
};

export const deleteBanner = async (req: AuthRequest, res: Response) => {
  try {
    const query: any = { _id: req.params.id };

    if (req.tenantId) {
      query.tenantId = req.tenantId;
    }

    const banner = await Banner.findOneAndDelete(query);

    if (!banner) {
      return res.status(404).json({ success: false, message: "We couldn't find that banner. It may have been removed." });
    }

    res.json({ success: true, message: 'Banner deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the banner. Please try again.');
  }
};

// Feeds
export const getAllFeeds = async (req: AuthRequest, res: Response) => {
  try {
    const { status, isSuperFeed, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (status) query.status = status;
    if (isSuperFeed !== undefined) query.isSuperFeed = isSuperFeed === 'true';

    const [feeds, total] = await Promise.all([
      Feed.find(query)
        .populate('authorId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Feed.countDocuments(query),
    ]);

    res.json(createPaginationResponse(feeds, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the feeds right now. Please try again.');
  }
};

export const createFeed = async (req: AuthRequest, res: Response) => {
  try {
    const feedData = {
      ...req.body,
      authorId: req.user?._id,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!feedData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const feed = new Feed(feedData);
    await feed.save();
    const populated = await Feed.findById(feed._id).populate('authorId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the feed. Please try again.');
  }
};

// DELETE /api/social/feeds/:id — super admin or Mahallu admin (the route enforces the role).
// A hard delete, so every list and count (Gallery, super feeds, Home, web admin) stops showing the
// post with no extra filter. A Mahallu admin can only reach their own Mahallu's posts; anything else
// is a plain 404, exactly like a post that doesn't exist.
export const deleteFeed = async (req: AuthRequest, res: Response) => {
  try {
    const query: any = { _id: req.params.id };

    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (!req.isSuperAdmin) {
      // A non-super account with no Mahallu has no posts to delete; never fall back to an unscoped query.
      return res.status(404).json({ success: false, message: "We couldn't find that post. It may have been removed." });
    }

    const feed = await Feed.findOneAndDelete(query);
    if (!feed) {
      return res.status(404).json({ success: false, message: "We couldn't find that post. It may have been removed." });
    }

    res.json({ success: true, message: 'Feed deleted' });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't delete the post. Please try again.");
  }
};

// Activity Logs
export const getActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId, tenantId, userId } = req.query;
    const query: any = {};

    // Convert tenantId string to ObjectId for query
    if (!req.isSuperAdmin && req.tenantId) {
      try {
        query.tenantId = new mongoose.Types.ObjectId(req.tenantId);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          message: 'That Mahallu link looks incorrect. Please go back and try again.' 
        });
      }
    } else if (tenantId && req.isSuperAdmin) {
      try {
        query.tenantId = new mongoose.Types.ObjectId(tenantId as string);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          message: 'That Mahallu link looks incorrect. Please go back and try again.' 
        });
      }
    }

    if (entityType) query.entityType = entityType;
    // Task C5 — access history: who did what, filtered to one user.
    if (userId) {
      try {
        query.userId = new mongoose.Types.ObjectId(userId as string);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'That user link looks incorrect. Please go back and try again.' });
      }
    }
    if (entityId) {
      try {
        query.entityId = new mongoose.Types.ObjectId(entityId as string);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          message: 'That link looks incorrect. Please go back and try again.' 
        });
      }
    }

    const { page, limit, skip } = getPaginationParams(req);
    
    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .populate('userId', 'name')
        .populate('tenantId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(query),
    ]);
    
    res.json(createPaginationResponse(logs, total, page, limit));
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    sendFailure(res, error, 'We couldn\'t load the activity logs right now. Please try again.');
  }
};

// Support
export const getAllSupport = async (req: AuthRequest, res: Response) => {
  try {
    const { status, priority, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    // Tickets can contain anything a member typed: only an admin reads the whole queue, everyone
    // else sees the tickets they raised themselves.
    if (!req.isSuperAdmin && !['mahall'].includes(String(req.user?.role))) {
      query.userId = req.user?._id;
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;

    const [support, total] = await Promise.all([
      Support.find(query)
        .populate('userId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Support.countDocuments(query),
    ]);

    res.json(createPaginationResponse(support, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the support right now. Please try again.');
  }
};

export const createSupport = async (req: AuthRequest, res: Response) => {
  try {
    // The ticket's owner and Mahallu come from the session, never the body; a non-super user cannot
    // choose another tenant, and the workflow fields (status, response) are not theirs to set.
    const { status: _status, response: _response, userId: _userId, tenantId: bodyTenantId, ...fields } = req.body || {};
    const supportData = {
      ...fields,
      userId: req.user?._id,
      tenantId: req.tenantId || (req.isSuperAdmin ? bodyTenantId : undefined),
    };

    if (!supportData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const support = new Support(supportData);
    await support.save();
    const populated = await Support.findById(support._id).populate('userId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the support. Please try again.');
  }
};

export const updateSupport = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Support.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that support ticket. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'Support ticket')) return;
    const { tenantId: _tenantId, ...changes } = req.body || {};

    const support = await Support.findByIdAndUpdate(
      req.params.id,
      changes,
      { new: true, runValidators: true }
    ).populate('userId', 'name');

    if (!support) {
      return res.status(404).json({ success: false, message: "We couldn't find that support ticket. It may have been removed." });
    }

    res.json({ success: true, data: support });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the support. Please try again.');
  }
};

