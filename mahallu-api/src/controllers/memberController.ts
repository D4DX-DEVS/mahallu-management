import { Request, Response } from 'express';
import Member from '../models/Member';
import Family from '../models/Family';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { verifyTenantOwnership } from '../utils/tenantCheck';

export const getAllMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { familyId, search, gender, sortBy, tenantId, status } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter
    // req.tenantId is set by authMiddleware and includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }
    // If neither, super admin sees all members

    // Filter by status - default to active only, unless explicitly requested
    if (status) {
      query.status = status;
    } else {
      // By default, exclude deleted members
      query.status = { $ne: 'deleted' };
    }

    // Exclude deceased members by default
    query.isDead = { $ne: true };

    if (familyId) query.familyId = familyId;
    if (gender) query.gender = gender;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mahallId: { $regex: search, $options: 'i' } },
        { familyName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const sort: any = {};
    if (sortBy === 'mahallId') sort.mahallId = 1;
    else if (sortBy === 'name') sort.name = 1;
    else sort.createdAt = -1;

    const [members, total] = await Promise.all([
      Member.find(query)
        .populate('familyId', 'houseName mahallId')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Member.countDocuments(query),
    ]);

    res.json(createPaginationResponse(members, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMemberById = async (req: AuthRequest, res: Response) => {
  try {
    const member = await Member.findById(req.params.id).populate('familyId', 'houseName mahallId');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    
    // Verify tenant ownership
    if (!verifyTenantOwnership(req, res, member.tenantId, 'Member')) {
      return;
    }
    
    res.json({ success: true, data: member });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createMember = async (req: AuthRequest, res: Response) => {
  try {
    const { familyId, familyName, ...memberData } = req.body;

    // Ensure tenantId is set
    const finalTenantId = req.tenantId || req.body.tenantId;

    if (!finalTenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    // Verify family exists and belongs to the same tenant
    let family;
    if (familyId) {
      family = await Family.findById(familyId);
      if (!family) {
        return res.status(404).json({
          success: false,
          message: 'Family not found',
        });
      }

      // Ensure family belongs to the same tenant
      if (family.tenantId.toString() !== finalTenantId) {
        return res.status(403).json({
          success: false,
          message: 'Family does not belong to this tenant',
        });
      }

      // Use family's houseName if familyName not provided
      if (!familyName) {
        memberData.familyName = family.houseName;
      }

      // Restrict: a family can only have one family head
      if (memberData.isFamilyHead) {
        const existingHead = await Member.findOne({
          familyId: family._id,
          isFamilyHead: true,
          status: { $ne: 'deleted' },
        });
        if (existingHead) {
          return res.status(400).json({
            success: false,
            message: `This family already has a family head (${existingHead.name}). A family can only have one head.`,
          });
        }
      }
    }

    if (!familyName) {
      return res.status(400).json({
        success: false,
        message: 'Family name is required',
      });
    }

    // Auto-generate mahallId (Member ID) based on Family ID
    // Format: FID123-1, FID123-2, etc.
    if (family && family.mahallId) {
      // Count existing members in this family to get next number
      const memberCount = await Member.countDocuments({ familyId: family._id });
      memberData.mahallId = `${family.mahallId}-${memberCount + 1}`;
    }

    if (memberData.phone) {
      const existingMemberUser = await User.findOne({
        phone: memberData.phone,
        tenantId: finalTenantId,
        role: 'member',
      });

      if (existingMemberUser) {
        return res.status(400).json({
          success: false,
          message: 'A member with this phone number already exists for this tenant. Use a different phone number.',
        });
      }
    }

    const member = new Member({
      ...memberData,
      familyId: familyId || memberData.familyId,
      familyName,
      tenantId: finalTenantId,
    });

    await member.save();

    // If this member is the family head, update the family's familyHead field
    if (memberData.isFamilyHead && family) {
      await Family.findByIdAndUpdate(family._id, { familyHead: member.name });
    }

    let memberUserCreated = false;
    let memberUserMessage = 'Member user not created because phone number is missing.';

    if (member.phone) {
      const defaultMemberPassword = process.env.DEFAULT_MEMBER_PASSWORD || '123456';
      const hashedPassword = await bcrypt.hash(defaultMemberPassword, 10);

      const memberUser = new User({
        name: member.name,
        phone: member.phone,
        role: 'member',
        tenantId: finalTenantId,
        memberId: member._id,
        status: member.status === 'active' ? 'active' : 'inactive',
        isSuperAdmin: false,
        permissions: {
          view: true,
          add: false,
          edit: false,
          delete: false,
        },
        password: hashedPassword,
      });

      await memberUser.save();
      memberUserCreated = true;
      memberUserMessage = 'Linked member user account created successfully.';
    }

    const memberResponse = await Member.findById(member._id).populate('familyId', 'houseName mahallId');
    res.status(201).json({
      success: true,
      data: memberResponse,
      memberUserCreated,
      memberUserMessage,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMember = async (req: AuthRequest, res: Response) => {
  try {
    // First check if member exists and belongs to tenant
    const existingMember = await Member.findById(req.params.id);
    if (!existingMember) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    
    // Verify tenant ownership
    if (!verifyTenantOwnership(req, res, existingMember.tenantId, 'Member')) {
      return;
    }

    const { familyId, familyName, ...updateData } = req.body;

    // If familyId is being updated, verify the family exists and belongs to same tenant
    if (familyId) {
      const family = await Family.findById(familyId);
      if (!family) {
        return res.status(404).json({
          success: false,
          message: 'Family not found',
        });
      }

      // Ensure family belongs to the same tenant
      if (!verifyTenantOwnership(req, res, family.tenantId, 'Family')) {
        return;
      }

      // Update familyName if not provided
      if (!familyName) {
        updateData.familyName = family.houseName;
      }
    }

    const member = await Member.findByIdAndUpdate(
      req.params.id,
      { ...updateData, ...(familyId && { familyId }), ...(familyName && { familyName }) },
      { new: true, runValidators: true }
    ).populate('familyId', 'houseName mahallId');

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    res.json({ success: true, data: member });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMemberStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    
    if (!status || !['active', 'inactive', 'deleted'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (active, inactive, or deleted)',
      });
    }

    // First check if member exists and belongs to tenant
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    
    // Verify tenant ownership
    if (!verifyTenantOwnership(req, res, member.tenantId, 'Member')) {
      return;
    }

    // Update member status
    member.status = status as 'active' | 'inactive' | 'deleted';
    await member.save();

    // If status is set to deleted or inactive, also update linked user account status
    if (status === 'deleted' || status === 'inactive') {
      
      const memberUser = await User.findOne({ memberId: member._id, role: 'member' });
      if (memberUser) {
        memberUser.status = 'inactive';
        await memberUser.save();
      }
    } else if (status === 'active') {
      // If activating member, also activate linked user account
      
      const memberUser = await User.findOne({ memberId: member._id, role: 'member' });
      if (memberUser) {
        memberUser.status = 'active';
        await memberUser.save();
      }
    }
    
    const updatedMember = await Member.findById(member._id)
      .populate('familyId', 'houseName mahallId');
    
    res.json({ 
      success: true, 
      message: `Member status updated to ${status} successfully`,
      data: updatedMember,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMember = async (req: AuthRequest, res: Response) => {
  try {
    // First check if member exists and belongs to tenant
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    
    // Verify tenant ownership
    if (!verifyTenantOwnership(req, res, member.tenantId, 'Member')) {
      return;
    }

    // Update status to deleted instead of actually deleting
    member.status = 'deleted';
    await member.save();

    // Also deactivate linked user account
    
    const memberUser = await User.findOne({ memberId: member._id, role: 'member' });
    if (memberUser) {
      memberUser.status = 'inactive';
      await memberUser.save();
    }
    
    res.json({ 
      success: true, 
      message: 'Member status updated to deleted successfully' 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMembersByFamily = async (req: Request, res: Response) => {
  try {
    const { familyId } = req.params;
    const { status } = req.query;
    
    const query: any = { familyId };
    
    // Filter by status - default to active only, unless explicitly requested
    if (status) {
      query.status = status;
    } else {
      // By default, exclude deleted members
      query.status = { $ne: 'deleted' };
    }

    // Exclude deceased members by default
    query.isDead = { $ne: true };
    
    const members = await Member.find(query)
      .populate('familyId', 'houseName mahallId')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: members });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

