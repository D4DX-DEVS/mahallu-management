import { Request, Response } from 'express';
import Meeting from '../models/Meeting';
import Committee from '../models/Committee';
import { sendWhatsAppMessage } from '../services/dxingService';
import { AuthRequest } from '../middleware/authMiddleware';
import { tenantScope } from '../utils/tenantScope';
import { stripImmutable } from '../utils/sanitizeUpdate';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMeetingById = async (req: AuthRequest, res: Response) => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate('committeeId', 'name')
      .populate('attendance', 'name familyName');
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    res.json({ success: true, data: meeting });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const { committeeId, attendance, ...meetingData } = stripImmutable(req.body) as Record<string, any>;

    // Get committee to calculate attendance
    const committee = await Committee.findOne({ _id: committeeId, ...tenantScope(req) }).populate('members', 'name phone familyName');
    if (!committee) {
      return res.status(404).json({ success: false, message: 'Committee not found' });
    }

    const totalMembers = committee.members.length;
    const attendanceCount = attendance?.length || 0;
    const attendancePercent = totalMembers > 0 ? Math.round((attendanceCount / totalMembers) * 100) : 0;

    const meeting = new Meeting({
      ...meetingData,
      committeeId,
      attendance: attendance || [],
      tenantId: req.tenantId || committee.tenantId,
      totalMembers,
      attendancePercent,
    });

    if (!meeting.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const { attendance, committeeId: _ignoredCommitteeId, ...updateData } = stripImmutable(req.body) as Record<string, any>;
    const meeting = await Meeting.findOne({ _id: req.params.id, ...tenantScope(req) });

    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    // Recalculate attendance if updated
    if (attendance) {
      const committee = await Committee.findOne({ _id: meeting.committeeId, tenantId: meeting.tenantId });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const meeting = await Meeting.findOneAndDelete({ _id: req.params.id, ...tenantScope(req) });
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

