import { Request, Response } from 'express';
import { Banner, Feed, ActivityLog, Support } from '../models/Social';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

// Banners
export const getAllBanners = async (req: AuthRequest, res: Response) => {
  try {
    const { status, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (status) query.status = status;

    const [banners, total] = await Promise.all([
      Banner.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Banner.countDocuments(query),
    ]);

    res.json(createPaginationResponse(banners, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
        message: 'Tenant ID is required. Super admins must pass x-tenant-id header or tenantId in the request body.',
      });
    }

    const banner = new Banner(bannerData);
    await banner.save();
    res.status(201).json({ success: true, data: banner });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    res.json({ success: true, data: banner });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    res.json({ success: true, data: banner });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
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
        message: 'Tenant ID is required',
      });
    }

    const feed = new Feed(feedData);
    await feed.save();
    const populated = await Feed.findById(feed._id).populate('authorId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
          message: 'Invalid tenant ID format' 
        });
      }
    } else if (tenantId && req.isSuperAdmin) {
      try {
        query.tenantId = new mongoose.Types.ObjectId(tenantId as string);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid tenant ID format' 
        });
      }
    }

    if (entityType) query.entityType = entityType;
    // Task C5 — access history: who did what, filtered to one user.
    if (userId) {
      try {
        query.userId = new mongoose.Types.ObjectId(userId as string);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid user ID format' });
      }
    }
    if (entityId) {
      try {
        query.entityId = new mongoose.Types.ObjectId(entityId as string);
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid entity ID format' 
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
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch activity logs' 
    });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSupport = async (req: AuthRequest, res: Response) => {
  try {
    const supportData = {
      ...req.body,
      userId: req.user?._id,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!supportData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    const support = new Support(supportData);
    await support.save();
    const populated = await Support.findById(support._id).populate('userId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSupport = async (req: Request, res: Response) => {
  try {
    const support = await Support.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('userId', 'name');

    if (!support) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    res.json({ success: true, data: support });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

