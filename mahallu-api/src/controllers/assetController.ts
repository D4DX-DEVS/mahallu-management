import { Request, Response } from 'express';
import { Asset, AssetMaintenance } from '../models/Asset';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

// ==================== ASSET CRUD ====================

export const getAllAssets = async (req: AuthRequest, res: Response) => {
  try {
    const { status, category, search, tenantId, mosqueId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (status) query.status = status;
    if (category) query.category = category;
    if (mosqueId) query.mosqueId = mosqueId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const [assets, total] = await Promise.all([
      Asset.find(query).populate('mosqueId', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Asset.countDocuments(query),
    ]);

    res.json(createPaginationResponse(assets, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAssetById = async (req: Request, res: Response) => {
  try {
    const asset = await Asset.findById(req.params.id).populate('mosqueId', 'name');
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    res.json({ success: true, data: asset });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAsset = async (req: AuthRequest, res: Response) => {
  try {
    const assetData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!assetData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    const asset = new Asset(assetData);
    await asset.save();
    res.status(201).json({ success: true, data: asset });
  } catch (error: any) {
    console.error('Create asset error:', error);
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Failed to create asset' });
  }
};

export const updateAsset = async (req: Request, res: Response) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    res.json({ success: true, data: asset });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAsset = async (req: Request, res: Response) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    // Also delete all maintenance records for this asset
    await AssetMaintenance.deleteMany({ assetId: req.params.id });
    res.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ASSET MAINTENANCE ====================

export const getAssetMaintenanceRecords = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { assetId: req.params.id };

    // Apply tenant filter
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    }

    const [records, total] = await Promise.all([
      AssetMaintenance.find(query).sort({ maintenanceDate: -1 }).skip(skip).limit(limit),
      AssetMaintenance.countDocuments(query),
    ]);

    res.json(createPaginationResponse(records, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createMaintenanceRecord = async (req: AuthRequest, res: Response) => {
  try {
    // Verify asset exists
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const maintenanceData = {
      ...req.body,
      assetId: req.params.id,
      tenantId: req.tenantId || req.body.tenantId || asset.tenantId,
    };

    const record = new AssetMaintenance(maintenanceData);
    await record.save();
    res.status(201).json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMaintenanceRecord = async (req: Request, res: Response) => {
  try {
    const record = await AssetMaintenance.findOneAndUpdate(
      { _id: req.params.maintenanceId, assetId: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!record) {
      return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMaintenanceRecord = async (req: Request, res: Response) => {
  try {
    const record = await AssetMaintenance.findOneAndDelete({
      _id: req.params.maintenanceId,
      assetId: req.params.id,
    });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    }
    res.json({ success: true, message: 'Maintenance record deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
