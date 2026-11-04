import { Request, Response } from 'express';
import Committee from '../models/Committee';
import Meeting from '../models/Meeting';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { termWarningCutoff } from '../services/committeeTermService';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';
import { verifyTenantOwnership } from '../utils/tenantCheck';

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

export const getCommitteeById = async (req: AuthRequest, res: Response) => {
  try {
    const committee = await Committee.findById(req.params.id)
      .populate('members', 'name familyName');
    if (!committee) {
      return res.status(404).json({ success: false, message: "We couldn't find that committee. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, committee.tenantId, 'Committee')) {
      return;
    }

    res.json({ success: true, data: committee });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the committee right now. Please try again.');
  }
};

export const createCommittee = async (req: AuthRequest, res: Response) => {
  try {
    // The Mahallu committee is managed only through /committees/mahallu.
    const { kind: _kind, officeBearers: _officeBearers, ...body } = req.body;
    const committeeData = {
      ...body,
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

export const updateCommittee = async (req: AuthRequest, res: Response) => {
  try {
    const existingCommittee = await Committee.findById(req.params.id);
    if (!existingCommittee) {
      return res.status(404).json({ success: false, message: "We couldn't find that committee. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, existingCommittee.tenantId, 'Committee')) {
      return;
    }

    const { kind: _kind, officeBearers: _officeBearers, ...body } = req.body;
    const committee = await Committee.findByIdAndUpdate(
      req.params.id,
      body,
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

export const deleteCommittee = async (req: AuthRequest, res: Response) => {
  try {
    const existingCommittee = await Committee.findById(req.params.id);
    if (!existingCommittee) {
      return res.status(404).json({ success: false, message: "We couldn't find that committee. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, existingCommittee.tenantId, 'Committee')) {
      return;
    }

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

export const getCommitteeMeetings = async (req: AuthRequest, res: Response) => {
  try {
    const committee = await Committee.findById(req.params.id).select('tenantId');
    if (!committee) {
      return res.status(404).json({ success: false, message: "We couldn't find that committee. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, committee.tenantId, 'Committee')) return;
    const meetings = await Meeting.find({ committeeId: req.params.id })
      .populate('attendance', 'name')
      .sort({ meetingDate: -1 });
    res.json({ success: true, data: meetings });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the committee meetings right now. Please try again.');
  }
};


/** Roles that only one person can hold at a time. */
const SINGLE_HOLDER_ROLES = ['president', 'secretary', 'treasurer'];

const populateBearers = (query: any) =>
  query.populate('officeBearers.member', 'name phone familyName').populate('members', 'name');

// GET /committees/mahallu — the tenant's governing committee, or null when not set up yet
export const getMahalluCommittee = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }
    const committee = await populateBearers(Committee.findOne({ tenantId: req.tenantId, kind: 'mahallu' }));
    res.json({ success: true, data: committee });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't load the Mahallu committee right now. Please try again.");
  }
};

// PUT /committees/mahallu — create or update the tenant's governing committee and its office bearers
export const saveMahalluCommittee = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }
    const { name, nameMl, description, termStartDate, termEndDate, status } = req.body;
    const officeBearers: Array<{ member: string; role: string }> = (req.body.officeBearers || []).map(
      (b: any) => ({ member: String(b.member), role: String(b.role).trim() })
    );

    for (const role of SINGLE_HOLDER_ROLES) {
      if (officeBearers.filter((b) => b.role.toLowerCase() === role).length > 1) {
        return res.status(400).json({
          success: false,
          message: `Only one person can be ${role.charAt(0).toUpperCase() + role.slice(1)}.`,
        });
      }
    }

    const memberIds = [...new Set(officeBearers.map((b) => b.member))];
    if (memberIds.length) {
      const owned = await Member.countDocuments({ _id: { $in: memberIds }, tenantId: req.tenantId });
      if (owned !== memberIds.length) {
        return res.status(400).json({ success: false, message: 'Please choose members of this Mahallu only.' });
      }
    }

    const update: any = {
      name: name?.trim() || 'Mahallu Committee',
      officeBearers,
      // Office bearers are the committee's members, so counts and meeting attendance stay in step.
      members: memberIds,
    };
    if (nameMl !== undefined) update.nameMl = nameMl;
    if (description !== undefined) update.description = description;
    if (status !== undefined) update.status = status;
    update.termStartDate = termStartDate || null;
    update.termEndDate = termEndDate || null;

    const committee = await populateBearers(
      Committee.findOneAndUpdate(
        { tenantId: req.tenantId, kind: 'mahallu' },
        { $set: update, $setOnInsert: { tenantId: req.tenantId, kind: 'mahallu' } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      )
    );
    res.json({ success: true, data: committee, message: 'Mahallu committee saved' });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't save the Mahallu committee. Please try again.");
  }
};
