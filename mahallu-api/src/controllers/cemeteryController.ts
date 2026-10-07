import { Response } from 'express';
import { Cemetery, GraveRecord } from '../models/Cemetery';
import { DeathRegistration } from '../models/Registration';
import Member from '../models/Member';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';
import { verifyTenantOwnership } from '../utils/tenantCheck';
import { stripImmutable } from '../utils/sanitizeUpdate';

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
      query.name = { $regex: regexLiteral(search), $options: 'i' };
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
    sendFailure(res, error, 'We couldn\'t load the cemeteries right now. Please try again.');
  }
};

export const getCemeteryById = async (req: AuthRequest, res: Response) => {
  try {
    const cemetery = await Cemetery.findById(req.params.id);
    if (!cemetery) {
      return res.status(404).json({ success: false, message: "We couldn't find that cemetery. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, cemetery.tenantId, 'Cemetery')) {
      return;
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
    sendFailure(res, error, 'We couldn\'t load the cemetery right now. Please try again.');
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
        message: 'Please select a Mahallu before continuing.',
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
    sendFailure(res, error, 'We couldn\'t save the cemetery. Please try again.', statusCode);
  }
};

export const updateCemetery = async (req: AuthRequest, res: Response) => {
  try {
    const existingCemetery = await Cemetery.findById(req.params.id);
    if (!existingCemetery) {
      return res.status(404).json({ success: false, message: "We couldn't find that cemetery. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, existingCemetery.tenantId, 'Cemetery')) {
      return;
    }

    const cemetery = await Cemetery.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    });
    if (!cemetery) {
      return res.status(404).json({ success: false, message: "We couldn't find that cemetery. It may have been removed." });
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
    sendFailure(res, error, 'We couldn\'t update the cemetery. Please try again.');
  }
};

export const deleteCemetery = async (req: AuthRequest, res: Response) => {
  try {
    const cemetery = await Cemetery.findById(req.params.id);
    if (!cemetery) {
      return res.status(404).json({ success: false, message: "We couldn't find that cemetery. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, cemetery.tenantId, 'Cemetery')) {
      return;
    }

    // Check if cemetery has graves
    const graveCount = await GraveRecord.countDocuments({
      cemeteryId: cemetery._id,
    });

    if (graveCount > 0) {
      return res.status(400).json({
        success: false,
        message: `This cemetery has ${graveCount} grave record(s), so it can't be deleted. Please remove the graves first.`,
      });
    }

    await Cemetery.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Cemetery deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the cemetery. Please try again.');
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
        { deceasedName: { $regex: regexLiteral(search), $options: 'i' } },
        { graveNo: { $regex: regexLiteral(search), $options: 'i' } },
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
    sendFailure(res, error, 'We couldn\'t load the grave records right now. Please try again.');
  }
};

export const getGraveRecordById = async (req: AuthRequest, res: Response) => {
  try {
    const record = await GraveRecord.findById(req.params.id)
      .populate('cemeteryId', 'name capacity')
      .populate('deceasedMemberId', 'name')
      .populate('familyId', 'houseName');
    if (!record) {
      return res.status(404).json({ success: false, message: "We couldn't find that grave record. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, record.tenantId, 'Grave record')) {
      return;
    }

    res.json({ success: true, data: record });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the grave record right now. Please try again.');
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
        message: 'Please select a Mahallu before continuing.',
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
        message: "We couldn't find that cemetery in this Mahallu.",
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
        message: `Grave number "${graveData.graveNo}" is already used in this cemetery. Please choose a different number.`,
      });
    }

    // If deceasedMemberId is provided, validate it exists
    // (These were `require('../models/Member').Member` - a named export that does not exist,
    // so `Member` was undefined, the lookup threw, and the empty catch skipped the whole
    // check: a member or family id from another Mahallu was accepted.)
    if (graveData.deceasedMemberId) {
      const member = await Member.findOne({
        _id: graveData.deceasedMemberId,
        tenantId: graveData.tenantId,
      });
      if (!member) {
        return res.status(400).json({
          success: false,
          message: "We couldn't find that member in this Mahallu.",
        });
      }
      // If member exists, use their name if deceasedName not provided
      if (!graveData.deceasedName && member.name) {
        graveData.deceasedName = member.name;
      }
    }

    // If familyId is provided, validate it exists
    if (graveData.familyId) {
      const family = await Family.findOne({
        _id: graveData.familyId,
        tenantId: graveData.tenantId,
      });
      if (!family) {
        return res.status(400).json({
          success: false,
          message: "We couldn't find that family in this Mahallu.",
        });
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
    sendFailure(res, error, 'We couldn\'t save the grave record. Please try again.', statusCode);
  }
};

export const updateGraveRecord = async (req: AuthRequest, res: Response) => {
  try {
    const existingRecord = await GraveRecord.findById(req.params.id);
    if (!existingRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that grave record. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, existingRecord.tenantId, 'Grave record')) {
      return;
    }

    // Prevent changing cemeteryId or graveNo (would break uniqueness)
    // tenantId / _id are stripped too so an update can never move the record to another Mahallu.
    const { cemeteryId, graveNo, ...safeData } = stripImmutable(req.body);

    const record = await GraveRecord.findByIdAndUpdate(req.params.id, safeData, {
      new: true,
      runValidators: true,
    })
      .populate('cemeteryId', 'name capacity')
      .populate('deceasedMemberId', 'name')
      .populate('familyId', 'houseName');

    if (!record) {
      return res.status(404).json({ success: false, message: "We couldn't find that grave record. It may have been removed." });
    }
    res.json({ success: true, data: record });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the grave record. Please try again.');
  }
};

export const deleteGraveRecord = async (req: AuthRequest, res: Response) => {
  try {
    const existingRecord = await GraveRecord.findById(req.params.id);
    if (!existingRecord) {
      return res.status(404).json({ success: false, message: "We couldn't find that grave record. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, existingRecord.tenantId, 'Grave record')) {
      return;
    }

    const record = await GraveRecord.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: "We couldn't find that grave record. It may have been removed." });
    }

    // Remove graveRecordId from linked DeathRegistration if any
    await DeathRegistration.updateMany(
      { graveRecordId: req.params.id },
      { $unset: { graveRecordId: 1 } }
    );

    res.json({ success: true, message: 'Grave record deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the grave record. Please try again.');
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
        { deceasedName: { $regex: regexLiteral(search), $options: 'i' } },
        { graveNo: { $regex: regexLiteral(search), $options: 'i' } },
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
    sendFailure(res, error, 'We couldn\'t load the cemetery graves right now. Please try again.');
  }
};
