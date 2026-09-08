import { Request, Response } from 'express';
import User from '../models/User';
import Member from '../models/Member';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Determine which tenant to filter by
    // Priority: 1. req.tenantId (from middleware - includes x-tenant-id header)
    //          2. tenantId query param (for super admin)
    //          3. No filter (super admin seeing all)
    
    if (req.tenantId) {
      // Non-super admin user or super admin viewing as tenant (from x-tenant-id header)
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      // Super admin explicitly filtering by tenant via query param
      query.tenantId = tenantId;
    }
    // If none of above, super admin sees all users (no tenant filter)

    if (role) query.role = role;
    // Filter by status - if not specified, show active users only
    if (status) {
      query.status = status;
    } else {
      query.status = 'active'; // Default to active users only
    }
    if (search) {
      query.$or = [
        { name: { $regex: regexLiteral(search), $options: 'i' } },
        { phone: { $regex: regexLiteral(search), $options: 'i' } },
        { email: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('tenantId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    res.json(createPaginationResponse(users, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the users right now. Please try again.');
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: "We couldn't find that user. It may have been removed." });
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the user right now. Please try again.');
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, role, permissions, password, tenantId, memberId, instituteId } = req.body;

    // Determine the final role (default to 'mahall' if not provided)
    const finalRole = role || 'mahall';

    // Determine tenant ID
    let finalTenantId = tenantId;
    
    // Super admin creating a user
    if (req.isSuperAdmin) {
      // If creating a super_admin user, no tenant needed
      if (finalRole === 'super_admin') {
        finalTenantId = null;
      } else {
        // For other roles, super admin must provide tenantId
        if (!tenantId) {
          return res.status(400).json({
            success: false,
            message: 'Please select a Mahallu for this user.',
          });
        }
        finalTenantId = tenantId;
      }
    } else {
      // Regular users can only create users in their own tenant
      finalTenantId = req.tenantId;
      
      // Regular users cannot create super_admin users
      if (finalRole === 'super_admin') {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to create this type of user.",
        });
      }
    }

    // For member users, validate memberId and ensure phone matches
    if (finalRole === 'member') {
      if (!memberId) {
        return res.status(400).json({
          success: false,
          message: 'Please select a member for this account.',
        });
      }

      
      const member = await Member.findById(memberId);
      
      if (!member) {
        return res.status(404).json({
          success: false,
          message: "We couldn't find that member. It may have been removed.",
        });
      }

      // Ensure member belongs to the same tenant
      if (member.tenantId.toString() !== finalTenantId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'This member belongs to another Mahallu.',
        });
      }

      // Use member's phone if phone not provided or ensure it matches
      const finalPhone = phone || member.phone;
      if (!finalPhone) {
        return res.status(400).json({
          success: false,
          message: "Please enter the member's phone number.",
        });
      }

      // Check if member user already exists
      const existingMemberUser = await User.findOne({ memberId, role: 'member' });
      if (existingMemberUser) {
        return res.status(400).json({
          success: false,
          message: 'This member already has a login account.',
        });
      }

      // Check if phone is already used by another user
      const existingUser = await User.findOne({ phone: finalPhone, tenantId: finalTenantId });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'An account with this phone number already exists in this Mahallu.',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password || '123456', 10);

      const user = new User({
        name: name || member.name,
        phone: finalPhone,
        email,
        role: 'member',
        tenantId: finalTenantId,
        memberId: member._id,
        isSuperAdmin: false,
        permissions: permissions || {
          view: true,
          add: false,
          edit: false,
          delete: false,
        },
        password: hashedPassword,
      });

      await user.save();
      const userResponse = await User.findById(user._id)
        .select('-password')
        .populate('tenantId', 'name code')
        .populate('memberId', 'name phone familyName');
      return res.status(201).json({ success: true, data: userResponse });
    }

    // For non-member users, use existing logic
    // For institute role, validate instituteId
    if (finalRole === 'institute' && !instituteId) {
      return res.status(400).json({
        success: false,
        message: 'Please select an institute for this user.',
      });
    }

    // Check if user already exists (phone + tenantId combination)
    const existingUser = await User.findOne({ phone, tenantId: finalTenantId });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this phone number already exists in this Mahallu.',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password || '123456', 10);

    const user = new User({
      name,
      phone,
      email,
      role: finalRole,
      tenantId: finalTenantId,
      instituteId: finalRole === 'institute' ? instituteId : undefined,
      isSuperAdmin: finalRole === 'super_admin',
      permissions: permissions || {
        view: false,
        add: false,
        edit: false,
        delete: false,
      },
      password: hashedPassword,
    });

    await user.save();
    const userResponse = await User.findById(user._id)
      .select('-password')
      .populate('tenantId', 'name code')
      .populate('instituteId', 'name type');
    res.status(201).json({ success: true, data: userResponse });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the user. Please try again.');
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { name, phone, email, status, permissions } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone, email, status, permissions },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: "We couldn't find that user. It may have been removed." });
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the user. Please try again.');
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Please choose either active or inactive.',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "We couldn't find that user. It may have been removed." });
    }

    // Update user status
    user.status = status as 'active' | 'inactive';
    await user.save();

    // If it's a member user, also update the linked member status
    if (user.role === 'member' && user.memberId) {
      
      const member = await Member.findById(user.memberId);
      if (member) {
        if (status === 'inactive') {
          member.status = 'inactive';
        } else if (status === 'active' && member.status === 'inactive') {
          member.status = 'active';
        }
        await member.save();
      }
    }

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('tenantId', 'name code')
      .populate('memberId', 'name phone familyName');
    
    res.json({ 
      success: true, 
      message: 'User status updated',
      data: updatedUser,
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the user status. Please try again.');
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "We couldn't find that user. It may have been removed." });
    }

    // Update status to inactive instead of deleting
    user.status = 'inactive';
    await user.save();

    // If it's a member user, also update the linked member status to deleted
    if (user.role === 'member' && user.memberId) {
      
      const member = await Member.findById(user.memberId);
      if (member) {
        member.status = 'deleted';
        await member.save();
      }
    }
    
    res.json({ 
      success: true, 
      message: user.role === 'member' 
        ? 'Member user and linked member record status updated' 
        : 'User status updated to inactive successfully' 
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the user. Please try again.');
  }
};

