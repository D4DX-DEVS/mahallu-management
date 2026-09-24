import { Request, Response } from 'express';
import Meeting from '../models/Meeting';
import Committee from '../models/Committee';
import { sendWhatsAppMessage } from '../services/dxingService';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

import { sendFailure } from '../utils/userMessages';

export const getAllMeetings = async (req: AuthRequest, res: Response) => {
  try {
    const { committeeId, status, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (committeeId) query.committeeId = committeeId;
    if (status) query.status = status;

    const [meetings, total] = await Promise.all([
      Meeting.find(query)
        .populate('committeeId', 'name')
        .populate('attendance', 'name')
        .sort({ meetingDate: -1 })
        .skip(skip)
        .limit(limit),
      Meeting.countDocuments(query),
    ]);

    res.json(createPaginationResponse(meetings, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the meetings right now. Please try again.');
  }
};

export const getMeetingById = async (req: Request, res: Response) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('committeeId', 'name')
      .populate('attendance', 'name familyName');
    if (!meeting) {
      return res.status(404).json({ success: false, message: "We couldn't find that meeting. It may have been removed." });
    }
    res.json({ success: true, data: meeting });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the meeting right now. Please try again.');
  }
};

export const createMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const { committeeId, attendance, ...meetingData } = req.body;

    // Get committee to calculate attendance
    const committee = await Committee.findById(committeeId).populate('members', 'name phone familyName');
    if (!committee) {
      return res.status(404).json({ success: false, message: "We couldn't find that committee. It may have been removed." });
    }

    const totalMembers = committee.members.length;
    const attendanceCount = attendance?.length || 0;
    const attendancePercent = totalMembers > 0 ? Math.round((attendanceCount / totalMembers) * 100) : 0;

    const meeting = new Meeting({
      ...meetingData,
      committeeId,
      attendance: attendance || [],
      tenantId: req.tenantId || req.body.tenantId,
      totalMembers,
      attendancePercent,
    });

    if (!meeting.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    await meeting.save();
    const populated = await Meeting.findById(meeting._id)
      .populate('committeeId', 'name')
      .populate('attendance', 'name');

    const memberList = (committee.members as any[])
      .map((member) => `${member.name}${member.familyName ? ` (${member.familyName})` : ''}`)
      .join(', ');

    const meetingMessage = [
      '📅 Committee Meeting اطلاع',
      '',
      `Committee: ${committee.name}`,
      `Subject: ${meeting.title}`,
      `Date & Time: ${new Date(meeting.meetingDate).toLocaleString()}`,
      meeting.agenda ? `Agenda: ${meeting.agenda}` : null,
      memberList ? `Members: ${memberList}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const memberPhones = (committee.members as any[])
      .map((member) => member.phone)
      .filter((phone) => typeof phone === 'string' && phone.length >= 10);

    await Promise.allSettled(
      memberPhones.map((phone) => sendWhatsAppMessage(phone, meetingMessage))
    );
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the meeting. Please try again.');
  }
};

export const updateMeeting = async (req: Request, res: Response) => {
  try {
    const { attendance, ...updateData } = req.body;
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ success: false, message: "We couldn't find that meeting. It may have been removed." });
    }

    // Recalculate attendance if updated
    if (attendance) {
      const committee = await Committee.findById(meeting.committeeId);
      const totalMembers = committee?.members.length || 0;
      const attendanceCount = attendance.length;
      const attendancePercent = totalMembers > 0 ? Math.round((attendanceCount / totalMembers) * 100) : 0;
      updateData.attendance = attendance;
      updateData.totalMembers = totalMembers;
      updateData.attendancePercent = attendancePercent;
    }

    const updatedMeeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('committeeId', 'name')
      .populate('attendance', 'name');

    res.json({ success: true, data: updatedMeeting });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the meeting. Please try again.');
  }
};

export const deleteMeeting = async (req: Request, res: Response) => {
  try {
    const meeting = await Meeting.findByIdAndDelete(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, message: "We couldn't find that meeting. It may have been removed." });
    }
    res.json({ success: true, message: 'Meeting deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the meeting. Please try again.');
  }
};

