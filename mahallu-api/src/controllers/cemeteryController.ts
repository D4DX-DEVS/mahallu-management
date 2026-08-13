import { Request, Response } from 'express';
import { Cemetery, GraveRecord } from '../models/Cemetery';
import { DeathRegistration } from '../models/Registration';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

// ==================== CEMETERY CRUD ====================

export const getAllCemeteries = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (status) query.status = status;
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const [cemeteries, total] = await Promise.all([
      Cemetery.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Cemetery.countDocuments(query),
    ]);

    // Enrich each cemetery with grave count (used capacity)
    const enriched = await Promise.all(
      cemeteries.map(async (cemetery) => {
        const graveCount = await GraveRecord.countDocuments({
          tenantId: cemetery.tenantId,
          cemeteryId: cemetery._id,
        });
        return {
          ...cemetery.toObject(),
          usedCount: graveCount,
        };
      })
    );

    res.json(createPaginationResponse(enriched, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCemeteryById = async (req: Request, res: Response) => {
  try {
    const cemetery = await Cemetery.findById(req.params.id);
    if (!cemetery) {
      return res.status(404).json({ success: false, message: 'Cemetery not found' });
    }

    // Count graves in this cemetery
    const graveCount = await GraveRecord.countDocuments({
      cemeteryId: cemetery._id,
    });

    res.json({
      success: true,
      data: {
        ...cemetery.toObject(),
        usedCount: graveCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCemetery = async (req: AuthRequest, res: Response) => {
  try {
    const cemeteryData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!cemeteryData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    const cemetery = new Cemetery(cemeteryData);
    await cemetery.save();
    res.status(201).json({
      success: true,
      data: {
        ...cemetery.toObject(),
        usedCount: 0,
      },
    });
  } catch (error: any) {
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const updateCemetery = async (req: Request, res: Response) => {
  try {
    const cemetery = await Cemetery.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!cemetery) {
      return res.status(404).json({ success: false, message: 'Cemetery not found' });
    }

    // Count graves in this cemetery
    const graveCount = await GraveRecord.countDocuments({
      cemeteryId: cemetery._id,
    });

    res.json({
      success: true,
      data: {
        ...cemetery.toObject(),
        usedCount: graveCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCemetery = async (req: Request, res: Response) => {
  try {
    const cemetery = await Cemetery.findById(req.params.id);
    if (!cemetery) {
      return res.status(404).json({ success: false, message: 'Cemetery not found' });
    }

    // Check if cemetery has graves
    const graveCount = await GraveRecord.countDocuments({
      cemeteryId: cemetery._id,
    });

    if (graveCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete cemetery with ${graveCount} grave record(s). Remove all graves first.`,
      });
    }

    await Cemetery.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Cemetery deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GRAVE RECORDS CRUD ====================

export const getAllGraveRecords = async (req: AuthRequest, res: Response) => {
  try {
    const { cemeteryId, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (cemeteryId) query.cemeteryId = cemeteryId;

    if (search) {
      query.$or = [
        { deceasedName: { $regex: search, $options: 'i' } },
        { graveNo: { $regex: search, $options: 'i' } },
      ];
    }

    const [records, total] = await Promise.all([
      GraveRecord.find(query)
        .populate('cemeteryId', 'name capacity')
        .populate('deceasedMemberId', 'name')
        .populate('familyId', 'houseName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      GraveRecord.countDocuments(query),
    ]);

    res.json(createPaginationResponse(records, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGraveRecordById = async (req: Request, res: Response) => {
  try {
    const record = await GraveRecord.findById(req.params.id)
      .populate('cemeteryId', 'name capacity')
      .populate('deceasedMemberId', 'name')
      .populate('familyId', 'houseName');
    if (!record) {
      return res.status(404).json({ success: false, message: 'Grave record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createGraveRecord = async (req: AuthRequest, res: Response) => {
  try {
    const graveData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!graveData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    // Validate cemetery exists and belongs to tenant
    const cemetery = await Cemetery.findOne({
      _id: graveData.cemeteryId,
      tenantId: graveData.tenantId,
    });
    if (!cemetery) {
      return res.status(400).json({
        success: false,
        message: 'Cemetery not found or does not belong to your tenant',
      });
    }

    // Check for duplicate graveNo in same cemetery
    const existing = await GraveRecord.findOne({
      tenantId: graveData.tenantId,
      cemeteryId: graveData.cemeteryId,
      graveNo: graveData.graveNo,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Grave number "${graveData.graveNo}" already exists in this cemetery`,
      });
    }

    // If deceasedMemberId is provided, validate it exists
    if (graveData.deceasedMemberId) {
      try {
        const { Member } = require('../models/Member');
        const member = await Member.findOne({
          _id: graveData.deceasedMemberId,
          tenantId: graveData.tenantId,
        });
        if (!member) {
          return res.status(400).json({
            success: false,
            message: 'Member not found or does not belong to your tenant',
          });
        }
        // If member exists, use their name if deceasedName not provided
        if (!graveData.deceasedName && member.name) {
          graveData.deceasedName = member.name;
        }
      } catch (e) {
        // Continue without strict validation
      }
    }

    // If familyId is provided, validate it exists
    if (graveData.familyId) {
      try {
        const { Family } = require('../models/Family');
        const family = await Family.findOne({
          _id: graveData.familyId,
          tenantId: graveData.tenantId,
        });
        if (!family) {
          return res.status(400).json({
            success: false,
            message: 'Family not found or does not belong to your tenant',
          });
        }
      } catch (e) {
        // Continue without strict validation
      }
    }

    const record = new GraveRecord(graveData);
    await record.save();
    const populated = await GraveRecord.findById(record._id)
      .populate('cemeteryId', 'name capacity')
      .populate('deceasedMemberId', 'name')
      .populate('familyId', 'houseName');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    const statusCode = error.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const updateGraveRecord = async (req: Request, res: Response) => {
  try {
    // Prevent changing cemeteryId or graveNo (would break uniqueness)
    const { cemeteryId, graveNo, ...safeData } = req.body;

    const record = await GraveRecord.findByIdAndUpdate(req.params.id, safeData, {
      new: true,
      runValidators: true,
    })
      .populate('cemeteryId', 'name capacity')
      .populate('deceasedMemberId', 'name')
      .populate('familyId', 'houseName');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Grave record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGraveRecord = async (req: Request, res: Response) => {
  try {
    const record = await GraveRecord.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Grave record not found' });
    }

    // Remove graveRecordId from linked DeathRegistration if any
    await DeathRegistration.updateMany(
      { graveRecordId: req.params.id },
      { $unset: { graveRecordId: 1 } }
    );

    res.json({ success: true, message: 'Grave record deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== CEMETERY-SPECIFIC GRAVES ====================

export const getCemeteryGraves = async (req: AuthRequest, res: Response) => {
  try {
    const { search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const cemeteryId = req.params.id;

    const query: any = { cemeteryId };

    // Apply tenant filter
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (search) {
      query.$or = [
        { deceasedName: { $regex: search, $options: 'i' } },
        { graveNo: { $regex: search, $options: 'i' } },
      ];
    }

    const [records, total] = await Promise.all([
      GraveRecord.find(query)
        .populate('deceasedMemberId', 'name')
        .populate('familyId', 'houseName')
        .sort({ graveNo: 1 })
        .skip(skip)
        .limit(limit),
      GraveRecord.countDocuments(query),
    ]);

    res.json(createPaginationResponse(records, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
