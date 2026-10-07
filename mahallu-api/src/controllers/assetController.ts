import { Request, Response } from 'express';
import { Asset, AssetMaintenance } from '../models/Asset';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';
import { verifyTenantOwnership } from '../utils/tenantCheck';

/**
 * Loads an asset only if it belongs to the caller's Mahallu (Super Admin: any).
 * Every by-id handler here used to look the id up bare, so any signed-in user could read,
 * rewrite - tenantFilter even re-parented the record into their own Mahallu - or delete
 * another Mahallu's asset by id. Sends the 404/403 itself and returns null in that case.
 */
const loadOwnedAsset = async (req: AuthRequest, res: Response) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    res.status(404).json({ success: false, message: "We couldn't find that asset. It may have been removed." });
    return null;
  }
  if (!verifyTenantOwnership(req, res, asset.tenantId, 'Asset')) return null;
  return asset;
};

/** A client may not move a record to another Mahallu through an update body. */
const withoutTenant = (body: any) => {
  const { tenantId: _tenantId, ...rest } = body || {};
  return rest;
};

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
        { name: { $regex: regexLiteral(search), $options: 'i' } },
        { description: { $regex: regexLiteral(search), $options: 'i' } },
        { location: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [assets, total] = await Promise.all([
      Asset.find(query).populate('mosqueId', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Asset.countDocuments(query),
    ]);

    res.json(createPaginationResponse(assets, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the assets right now. Please try again.');
  }
};

export const getAssetById = async (req: AuthRequest, res: Response) => {
  try {
    const owned = await loadOwnedAsset(req, res);
    if (!owned) return;
    const asset = await Asset.findById(owned._id).populate('mosqueId', 'name');
    res.json({ success: true, data: asset });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the asset right now. Please try again.');
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
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const asset = new Asset(assetData);
    await asset.save();
    res.status(201).json({ success: true, data: asset });
  } catch (error: any) {
    console.error('Create asset error:', error);
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    sendFailure(res, error, 'We couldn\'t save the asset. Please try again.', statusCode);
  }
};

export const updateAsset = async (req: AuthRequest, res: Response) => {
  try {
    const owned = await loadOwnedAsset(req, res);
    if (!owned) return;
    const asset = await Asset.findByIdAndUpdate(
      owned._id,
      withoutTenant(req.body),
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: asset });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the asset. Please try again.');
  }
};

export const deleteAsset = async (req: AuthRequest, res: Response) => {
  try {
    const owned = await loadOwnedAsset(req, res);
    if (!owned) return;
    await owned.deleteOne();
    // Also delete all maintenance records for this asset
    await AssetMaintenance.deleteMany({ assetId: req.params.id });
    res.json({ success: true, message: 'Asset deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the asset. Please try again.');
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
    sendFailure(res, error, 'We couldn\'t load the asset maintenance records right now. Please try again.');
  }
};

export const createMaintenanceRecord = async (req: AuthRequest, res: Response) => {
  try {
    // The asset must exist and belong to the caller's Mahallu.
    const asset = await loadOwnedAsset(req, res);
    if (!asset) return;

    const maintenanceData = {
      ...req.body,
      assetId: req.params.id,
      tenantId: asset.tenantId,
    };

    const record = new AssetMaintenance(maintenanceData);
    await record.save();
    res.status(201).json({ success: true, data: record });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the maintenance record. Please try again.');
  }
};

export const updateMaintenanceRecord = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await loadOwnedAsset(req, res))) return;
    const record = await AssetMaintenance.findOneAndUpdate(
      { _id: req.params.maintenanceId, assetId: req.params.id },
      withoutTenant(req.body),
      { new: true, runValidators: true }
    );
    if (!record) {
      return res.status(404).json({ success: false, message: "We couldn't find that maintenance record. It may have been removed." });
    }
    res.json({ success: true, data: record });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the maintenance record. Please try again.');
  }
};

export const deleteMaintenanceRecord = async (req: AuthRequest, res: Response) => {
  try {
    if (!(await loadOwnedAsset(req, res))) return;
    const record = await AssetMaintenance.findOneAndDelete({
      _id: req.params.maintenanceId,
      assetId: req.params.id,
    });
    if (!record) {
      return res.status(404).json({ success: false, message: "We couldn't find that maintenance record. It may have been removed." });
    }
    res.json({ success: true, message: 'Maintenance record deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the maintenance record. Please try again.');
  }
};
