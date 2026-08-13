import { Response } from 'express';
import mongoose from 'mongoose';
import {
  MarriageAssistance,
  MARRIAGE_ASSISTANCE_STATUSES,
  MarriageAssistanceStatus,
} from '../models/MarriageAssistance';
import Member from '../models/Member';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

const tenantScope = (req: AuthRequest) => {
  if (req.tenantId) return req.tenantId;
  if (req.isSuperAdmin && req.query.tenantId) return req.query.tenantId as string;
  return undefined;
};

const scopedQuery = (req: AuthRequest): Record<string, any> => {
  const tenantId = tenantScope(req);
  return tenantId ? { tenantId } : {};
};

// Valid status transitions: requested -> approved -> completed
const VALID_TRANSITIONS: Record<MarriageAssistanceStatus, MarriageAssistanceStatus[]> = {
  requested: ['approved'],
  approved: ['completed'],
  completed: [],
};

export const getAllAssistances = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, type, search, memberId, familyId } = req.query;
    const query: any = scopedQuery(req);

    if (status) query.status = status;
    if (type) query.type = type;
    if (memberId) query.memberId = memberId;
    if (familyId) query.familyId = familyId;
    if (search) query.notes = { $regex: search, $options: 'i' };

    const [data, total] = await Promise.all([
      MarriageAssistance.find(query)
        .populate('memberId', 'name phone')
        .populate('familyId', 'houseName familyHead contactNo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MarriageAssistance.countDocuments(query),
    ]);

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAssistanceById = async (req: AuthRequest, res: Response) => {
  try {
    const assistance = await MarriageAssistance.findById(req.params.id)
      .populate('memberId', 'name phone gender')
      .populate('familyId', 'houseName familyHead contactNo area');

    if (
      !assistance ||
      (req.tenantId && assistance.tenantId.toString() !== req.tenantId)
    ) {
      return res
        .status(404)
        .json({ success: false, message: 'Assistance record not found' });
    }

    res.json({ success: true, data: assistance });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAssistance = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId)
      return res
        .status(400)
        .json({ success: false, message: 'Tenant ID is required' });

    const { memberId, familyId } = req.body;
    if (!memberId && !familyId) {
      return res.status(400).json({
        success: false,
        message: 'Either memberId or familyId is required',
      });
    }

    // Validate tenant scope if IDs provided
    if (memberId) {
      const member = await Member.findById(memberId);
      if (!member || member.tenantId.toString() !== tenantId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Member belongs to another tenant',
        });
      }
    }

    if (familyId) {
      const family = await Family.findById(familyId);
      if (!family || family.tenantId.toString() !== tenantId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Family belongs to another tenant',
        });
      }
    }

    const assistance = await MarriageAssistance.create({
      ...req.body,
      tenantId,
      status: 'requested',
    });

    await assistance.populate('memberId', 'name phone');
    await assistance.populate('familyId', 'houseName familyHead contactNo');

    res.status(201).json({ success: true, data: assistance });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAssistance = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await MarriageAssistance.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res
        .status(404)
        .json({ success: false, message: 'Assistance record not found' });
    }

    // Validate referenced records if updating member/family
    if (req.body.memberId && req.body.memberId !== existing.memberId?.toString()) {
      const member = await Member.findById(req.body.memberId);
      if (!member || member.tenantId.toString() !== existing.tenantId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Member belongs to another tenant',
        });
      }
    }

    if (req.body.familyId && req.body.familyId !== existing.familyId?.toString()) {
      const family = await Family.findById(req.body.familyId);
      if (!family || family.tenantId.toString() !== existing.tenantId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Family belongs to another tenant',
        });
      }
    }

    const assistance = await MarriageAssistance.findByIdAndUpdate(
      req.params.id,
      stripImmutable(req.body),
      { new: true, runValidators: true }
    )
      .populate('memberId', 'name phone')
      .populate('familyId', 'houseName familyHead contactNo');

    res.json({ success: true, data: assistance });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAssistanceStatus = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await MarriageAssistance.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res
        .status(404)
        .json({ success: false, message: 'Assistance record not found' });
    }

    const newStatus = req.body.status as MarriageAssistanceStatus;
    if (!MARRIAGE_ASSISTANCE_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status: ${newStatus}`,
      });
    }

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[existing.status];
    if (!allowedTransitions.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move from ${existing.status} to ${newStatus}`,
      });
    }

    existing.status = newStatus;
    if (req.body.notes) {
      existing.notes = req.body.notes;
    }

    await existing.save();
    await existing.populate('memberId', 'name phone');
    await existing.populate('familyId', 'houseName familyHead contactNo');

    res.json({ success: true, data: existing });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAssistance = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await MarriageAssistance.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res
        .status(404)
        .json({ success: false, message: 'Assistance record not found' });
    }

    await existing.deleteOne();
    res.json({ success: true, message: 'Assistance record deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
