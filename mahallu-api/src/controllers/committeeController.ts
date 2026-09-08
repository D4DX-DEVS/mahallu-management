import { Request, Response } from 'express';
import Committee from '../models/Committee';
import Meeting from '../models/Meeting';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { termWarningCutoff } from '../services/committeeTermService';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

export const getAllCommittees = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, tenantId, expiring } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (status) query.status = status;
    if (search) {
      query.name = { $regex: regexLiteral(search), $options: 'i' };
    }
    // Committees whose term ends within the warning window (spec 29)
    if (expiring === 'true') {
      query.termEndDate = { $ne: null, $lte: termWarningCutoff() };
    }

    const [committees, total] = await Promise.all([
      Committee.find(query)
        .populate('members', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Committee.countDocuments(query),
    ]);

    res.json(createPaginationResponse(committees, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the committees right now. Please try again.');
  }
};

export const getCommitteeById = async (req: Request, res: Response) => {
  try {
    const committee = await Committee.findById(req.params.id)
      .populate('members', 'name familyName');
    if (!committee) {
      return res.status(404).json({ success: false, message: "We couldn't find that committee. It may have been removed." });
    }
    res.json({ success: true, data: committee });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the committee right now. Please try again.');
  }
};

export const createCommittee = async (req: AuthRequest, res: Response) => {
  try {
    const committeeData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!committeeData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const committee = new Committee(committeeData);
    await committee.save();
    const populated = await Committee.findById(committee._id).populate('members', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the committee. Please try again.');
  }
};

export const updateCommittee = async (req: Request, res: Response) => {
  try {
    const committee = await Committee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('members', 'name');
    if (!committee) {
      return res.status(404).json({ success: false, message: "We couldn't find that committee. It may have been removed." });
    }
    res.json({ success: true, data: committee });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the committee. Please try again.');
  }
};

export const deleteCommittee = async (req: Request, res: Response) => {
  try {
    const committee = await Committee.findByIdAndDelete(req.params.id);
    if (!committee) {
      return res.status(404).json({ success: false, message: "We couldn't find that committee. It may have been removed." });
    }
    // Delete associated meetings
    await Meeting.deleteMany({ committeeId: committee._id });
    res.json({ success: true, message: 'Committee deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the committee. Please try again.');
  }
};

export const getCommitteeMeetings = async (req: Request, res: Response) => {
  try {
    const meetings = await Meeting.find({ committeeId: req.params.id })
      .populate('attendance', 'name')
      .sort({ meetingDate: -1 });
    res.json({ success: true, data: meetings });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the committee meetings right now. Please try again.');
  }
};

