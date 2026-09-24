import { Response } from 'express';
import mongoose from 'mongoose';
import { VolunteerProfile, VolunteerAssignment } from '../models/VolunteerProfile';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

import { sendFailure } from '../utils/userMessages';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

/** Confirm volunteer belongs to this tenant. */
const validateVolunteerRefs = async (req: AuthRequest): Promise<string | null> => {
  const { memberId } = req.body;
  if (memberId && !(await refBelongsToTenant(Member, memberId, req.tenantId))) {
    return 'This member belongs to another Mahallu.';
  }
  return null;
};

/** Confirm all volunteers and service assignments belong to this tenant. */
const validateAssignmentRefs = async (req: AuthRequest): Promise<string | null> => {
  const { volunteerIds } = req.body;
  if (!Array.isArray(volunteerIds) || volunteerIds.length === 0) {
    return 'Please assign at least one volunteer.';
  }

  // Check all volunteers belong to this tenant
  const volunteers = await VolunteerProfile.find({
    _id: { $in: volunteerIds },
    tenantId: req.tenantId,
  });

  if (volunteers.length !== volunteerIds.length) {
    return 'One or more volunteers do not belong to this Mahallu';
  }

  return null;
};

export const getAllVolunteers = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.wing) query.wings = req.query.wing;
    if (req.query.serviceType) query.serviceTypes = req.query.serviceType;
    if (req.query.availability) query.availability = req.query.availability;
    if (req.query.status) query.status = req.query.status;
    if (req.query.memberId) query.memberId = req.query.memberId;

    const [volunteers, total] = await Promise.all([
      VolunteerProfile.find(query)
        .populate('memberId', 'name contactNo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      VolunteerProfile.countDocuments(query),
    ]);

    res.json(createPaginationResponse(volunteers, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the volunteers right now. Please try again.');
  }
};

export const getVolunteerById = async (req: AuthRequest, res: Response) => {
  try {
    const volunteer = await VolunteerProfile.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    }).populate('memberId', 'name contactNo');

    if (!volunteer) {
      return res.status(404).json({ success: false, message: "We couldn't find that volunteer. It may have been removed." });
    }

    res.json({ success: true, data: volunteer });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the volunteer right now. Please try again.');
  }
};

export const createVolunteer = async (req: AuthRequest, res: Response) => {
  try {
    const refError = await validateVolunteerRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    const volunteer = await VolunteerProfile.create({
      ...stripImmutable(req.body),
      tenantId: req.tenantId,
    });

    // Set isVolunteer flag on the member
    await Member.updateOne({ _id: volunteer.memberId }, { isVolunteer: true });

    const populated = await VolunteerProfile.findById(volunteer._id).populate(
      'memberId',
      'name contactNo'
    );

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the volunteer. Please try again.');
  }
};

export const updateVolunteer = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await VolunteerProfile.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that volunteer. It may have been removed." });
    }

    const refError = await validateVolunteerRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    const volunteer = await VolunteerProfile.findByIdAndUpdate(
      req.params.id,
      stripImmutable(req.body),
      { new: true, runValidators: true }
    ).populate('memberId', 'name contactNo');

    res.json({ success: true, data: volunteer });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the volunteer. Please try again.');
  }
};

export const deleteVolunteer = async (req: AuthRequest, res: Response) => {
  try {
    const volunteer = await VolunteerProfile.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    });

    if (!volunteer) {
      return res.status(404).json({ success: false, message: "We couldn't find that volunteer. It may have been removed." });
    }

    await VolunteerProfile.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Volunteer deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the volunteer. Please try again.');
  }
};

export const getVolunteerAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);

    // Verify volunteer exists and belongs to tenant
    const volunteer = await VolunteerProfile.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    });

    if (!volunteer) {
      return res.status(404).json({ success: false, message: "We couldn't find that volunteer. It may have been removed." });
    }

    const query: any = { ...tenantScope(req), volunteerIds: volunteer._id };

    const [assignments, total] = await Promise.all([
      VolunteerAssignment.find(query)
        .populate('volunteerIds', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      VolunteerAssignment.countDocuments(query),
    ]);

    res.json(createPaginationResponse(assignments, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the volunteer assignments right now. Please try again.');
  }
};

export const getAllAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.serviceType) query.serviceType = req.query.serviceType;
    if (req.query.status) query.status = req.query.status;

    if (req.query.startDate || req.query.endDate) {
      query.date = {};
      if (req.query.startDate) {
        query.date.$gte = new Date(String(req.query.startDate));
      }
      if (req.query.endDate) {
        const endDate = new Date(String(req.query.endDate));
        endDate.setHours(23, 59, 59, 999);
        query.date.$lte = endDate;
      }
    }

    const [assignments, total] = await Promise.all([
      VolunteerAssignment.find(query)
        .populate('volunteerIds', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      VolunteerAssignment.countDocuments(query),
    ]);

    res.json(createPaginationResponse(assignments, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the assignments right now. Please try again.');
  }
};

export const getAssignmentById = async (req: AuthRequest, res: Response) => {
  try {
    const assignment = await VolunteerAssignment.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    }).populate('volunteerIds', 'name contactNo');

    if (!assignment) {
      return res.status(404).json({ success: false, message: "We couldn't find that assignment. It may have been removed." });
    }

    res.json({ success: true, data: assignment });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the assignment right now. Please try again.');
  }
};

export const createAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const refError = await validateAssignmentRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    const assignment = await VolunteerAssignment.create({
      ...stripImmutable(req.body),
      tenantId: req.tenantId,
    });

    const populated = await VolunteerAssignment.findById(assignment._id).populate(
      'volunteerIds',
      'name contactNo'
    );

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the assignment. Please try again.');
  }
};

export const updateAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await VolunteerAssignment.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that assignment. It may have been removed." });
    }

    const refError = await validateAssignmentRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    const assignment = await VolunteerAssignment.findByIdAndUpdate(
      req.params.id,
      stripImmutable(req.body),
      { new: true, runValidators: true }
    ).populate('volunteerIds', 'name contactNo');

    res.json({ success: true, data: assignment });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the assignment. Please try again.');
  }
};

export const deleteAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const assignment = await VolunteerAssignment.findOne({
      _id: req.params.id,
      ...tenantScope(req),
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: "We couldn't find that assignment. It may have been removed." });
    }

    await VolunteerAssignment.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Assignment deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the assignment. Please try again.');
  }
};

export const getVolunteerSummary = async (req: AuthRequest, res: Response) => {
  try {
    const query = tenantScope(req);

    const [totalActive, byWing, byServiceType, assignmentsByStatus] = await Promise.all([
      VolunteerProfile.countDocuments({ ...query, status: 'active' }),
      VolunteerProfile.aggregate([
        { $match: { ...query, status: 'active' } },
        { $unwind: '$wings' },
        { $group: { _id: '$wings', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      VolunteerProfile.aggregate([
        { $match: { ...query, status: 'active' } },
        { $unwind: '$serviceTypes' },
        { $group: { _id: '$serviceTypes', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      VolunteerAssignment.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const wingCounts: Record<string, number> = {};
    byWing.forEach((item: any) => {
      wingCounts[item._id] = item.count;
    });

    const serviceTypeCounts: Record<string, number> = {};
    byServiceType.forEach((item: any) => {
      serviceTypeCounts[item._id] = item.count;
    });

    const statusCounts: Record<string, number> = {};
    assignmentsByStatus.forEach((item: any) => {
      statusCounts[item._id] = item.count;
    });

    res.json({
      success: true,
      data: {
        totalActiveVolunteers: totalActive,
        byWing: wingCounts,
        byServiceType: serviceTypeCounts,
        assignmentsByStatus: statusCounts,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the volunteer summary right now. Please try again.');
  }
};
