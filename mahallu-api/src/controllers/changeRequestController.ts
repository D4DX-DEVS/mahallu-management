import { Response } from 'express';
import ChangeRequest from '../models/ChangeRequest';
import Member from '../models/Member';
import Family from '../models/Family';
import OTP from '../models/OTP';
import { normalizeIndianPhone } from '../services/dxingService';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

// Only these fields may be changed through self-service.
// Eligibility / financial / workflow fields stay admin-only.
const MEMBER_EDITABLE_FIELDS = [
  'name', 'phone', 'education', 'occupation', 'maritalStatus', 'bloodGroup', 'age', 'relationship',
];
const FAMILY_EDITABLE_FIELDS = [
  'contactNo', 'wardNumber', 'houseNo', 'area', 'place', 'houseName',
];

const isAdmin = (req: AuthRequest): boolean =>
  req.isSuperAdmin === true || req.user?.role === 'mahall';

// POST /api/change-requests — member requests changes to own record / own family (head)
export const createChangeRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(403).json({ success: false, message: 'Member account required' });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const { targetType, targetId, changes } = req.body;
    if (!['member', 'family'].includes(targetType) || !targetId || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ success: false, message: 'targetType, targetId and changes are required' });
    }

    // Authorization: self, or family head over own family and its members
    let target: any = null;
    if (targetType === 'member') {
      target = await Member.findOne({ _id: targetId, tenantId: member.tenantId });
      if (!target) {
        return res.status(404).json({ success: false, message: 'Target member not found' });
      }
      const isSelf = String(target._id) === String(member._id);
      const isHeadOfFamily = member.isFamilyHead === true && String(target.familyId) === String(member.familyId);
      if (!isSelf && !isHeadOfFamily) {
        return res.status(403).json({ success: false, message: 'You can only request changes for yourself or your own family members' });
      }
    } else {
      if (member.isFamilyHead !== true || String(targetId) !== String(member.familyId)) {
        return res.status(403).json({ success: false, message: 'Only the family head can request family detail changes' });
      }
      target = await Family.findOne({ _id: targetId, tenantId: member.tenantId });
      if (!target) {
        return res.status(404).json({ success: false, message: 'Family not found' });
      }
    }

    const editable = targetType === 'member' ? MEMBER_EDITABLE_FIELDS : FAMILY_EDITABLE_FIELDS;
    const invalid = changes.filter((c: any) => !c?.field || !editable.includes(c.field) || c.newValue === undefined);
    if (invalid.length > 0) {
      return res.status(400).json({
        success: false,
        message: `These fields cannot be changed via self-service: ${invalid.map((c: any) => c?.field).join(', ')}`,
      });
    }

    // Phone is an account-access field: prove ownership of the NEW number via OTP before queueing
    const phoneChange = changes.find((c: any) => c.field === 'phone');
    if (phoneChange) {
      const { phoneOtp } = req.body;
      if (!phoneOtp) {
        return res.status(400).json({
          success: false,
          message: 'phoneOtp is required: request an OTP on the new phone number first',
          code: 'PHONE_OTP_REQUIRED',
        });
      }
      const { normalized } = normalizeIndianPhone(String(phoneChange.newValue));
      const otpRecord = await OTP.findOne({
        phone: normalized,
        code: String(phoneOtp),
        isUsed: false,
        expiresAt: { $gt: new Date() },
      });
      if (!otpRecord) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP for the new phone number' });
      }
      otpRecord.isUsed = true;
      await otpRecord.save();
    }

    const changeRequest = await ChangeRequest.create({
      tenantId: member.tenantId,
      targetType,
      targetId,
      requestedByMemberId: member._id,
      changes: changes.map((c: any) => ({
        field: c.field,
        oldValue: target[c.field] !== undefined && target[c.field] !== null ? String(target[c.field]) : undefined,
        newValue: String(c.newValue),
      })),
      status: 'pending',
    });

    res.status(201).json({ success: true, data: changeRequest, message: 'Change request submitted for verification' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/change-requests — admin: queue (filter by status); member: own requests
export const listChangeRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { tenantId: req.tenantId };

    if (isAdmin(req)) {
      if (req.query.status) query.status = req.query.status;
      if (req.query.targetType) query.targetType = req.query.targetType;
    } else if (req.user?.memberId) {
      query.requestedByMemberId = req.user.memberId;
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [requests, total] = await Promise.all([
      ChangeRequest.find(query)
        .populate('requestedByMemberId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ChangeRequest.countDocuments(query),
    ]);

    res.json(createPaginationResponse(requests, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/change-requests/:id/review — admin approves (applies changes) or rejects
export const reviewChangeRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { status, remarks } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be approved or rejected' });
    }

    const changeRequest = await ChangeRequest.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      status: 'pending',
    });
    if (!changeRequest) {
      return res.status(404).json({ success: false, message: 'Pending change request not found' });
    }

    if (status === 'approved') {
      const Model: any = changeRequest.targetType === 'member' ? Member : Family;
      const target = await Model.findOne({ _id: changeRequest.targetId, tenantId: changeRequest.tenantId });
      if (!target) {
        return res.status(404).json({ success: false, message: 'Target record no longer exists' });
      }
      changeRequest.changes.forEach((c) => {
        (target as any)[c.field] = c.newValue;
      });
      await target.save();
    }

    changeRequest.status = status;
    changeRequest.reviewedBy = req.user?.name;
    changeRequest.reviewedAt = new Date();
    if (remarks) changeRequest.remarks = remarks;
    await changeRequest.save();

    res.json({ success: true, data: changeRequest, message: `Change request ${status}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
