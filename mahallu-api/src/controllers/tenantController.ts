import { Request, Response } from 'express';
import Tenant from '../models/Tenant';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { defaultFeaturesFor } from '../config/moduleFeatures';

export const getAllTenants = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, type } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      Tenant.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Tenant.countDocuments(query),
    ]);

    // Get user counts per tenant
    const tenantIds = tenants.map((t) => t._id);
    const userCounts = await User.aggregate([
      { $match: { tenantId: { $in: tenantIds } } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ]);
    const userCountMap = new Map(userCounts.map((uc: any) => [uc._id.toString(), uc.count]));

    const tenantsWithCounts = tenants.map((t) => ({
      ...t.toObject(),
      userCount: userCountMap.get(t._id.toString()) || 0,
    }));

    res.json(createPaginationResponse(tenantsWithCounts, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTenantById = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    if (!req.isSuperAdmin && req.tenantId?.toString() !== tenant._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTenant = async (req: AuthRequest, res: Response) => {
  try {
    const tenantData = req.body;
    
    // Check if code already exists
    const existingTenant = await Tenant.findOne({ code: tenantData.code.toUpperCase() });
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'Tenant with this code already exists',
      });
    }

    // Classification seeds the default module feature set (spec 3); admins can toggle after.
    const settings = { ...(tenantData.settings || {}) };
    if (!settings.features || Object.keys(settings.features).length === 0) {
      settings.features = defaultFeaturesFor(tenantData.classification);
    }

    const tenant = new Tenant({
      ...tenantData,
      settings,
      code: tenantData.code.toUpperCase(),
    });
    await tenant.save();

    res.status(201).json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTenant = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.isSuperAdmin && req.tenantId?.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    // Handle nested settings update properly
    const updateData = { ...req.body };

    // Changing classification re-seeds the default feature set, unless the caller
    // sent an explicit features map in the same request.
    if (updateData.classification && !updateData.settings?.features) {
      const current = await Tenant.findById(req.params.id).select('classification settings');
      if (current && current.classification !== updateData.classification) {
        updateData.settings = {
          ...(updateData.settings || {}),
          features: defaultFeaturesFor(updateData.classification),
        };
      }
    }

    // If settings is being updated, ensure it's merged correctly
    if (updateData.settings) {
      const existingTenant = await Tenant.findById(req.params.id);
      if (existingTenant) {
        // Convert entire tenant to plain object to access nested settings
        const plainTenant = existingTenant.toObject();
        const existingSettings = plainTenant.settings || {};
        
        updateData.settings = {
          ...existingSettings,
          ...updateData.settings,
          // Ensure arrays are properly replaced, not merged
          varisangyaGrades: updateData.settings.varisangyaGrades || existingSettings.varisangyaGrades,
          educationOptions: updateData.settings.educationOptions || existingSettings.educationOptions,
        };
      }
    }
    
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTenant = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = await Tenant.findByIdAndDelete(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Optionally: Delete all related data or mark as deleted
    res.json({ success: true, message: 'Tenant deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTenantStats = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.params.id;
    if (!req.isSuperAdmin && req.tenantId?.toString() !== tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Get statistics for the tenant
    const [users, families, members] = await Promise.all([
      User.countDocuments({ tenantId }),
      require('../models/Family').default.countDocuments({ tenantId }),
      require('../models/Member').default.countDocuments({ tenantId }),
    ]);

    res.json({
      success: true,
      data: {
        users,
        families,
        members,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const suspendTenant = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { status: 'suspended' },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const activateTenant = async (req: AuthRequest, res: Response) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

