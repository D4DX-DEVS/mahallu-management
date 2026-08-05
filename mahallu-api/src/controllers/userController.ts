import { Request, Response } from 'express';
import User from '../models/User';
import Member from '../models/Member';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

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
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
            message: 'Tenant ID is required when creating non-super-admin users',
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
          message: 'Only super admin can create super admin users',
        });
      }
    }

    // For member users, validate memberId and ensure phone matches
    if (finalRole === 'member') {
      if (!memberId) {
        return res.status(400).json({
          success: false,
          message: 'Member ID is required for member users',
        });
      }

      
      const member = await Member.findById(memberId);
      
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found',
        });
      }

      // Ensure member belongs to the same tenant
      if (member.tenantId.toString() !== finalTenantId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Member does not belong to this tenant',
        });
      }

      // Use member's phone if phone not provided or ensure it matches
      const finalPhone = phone || member.phone;
      if (!finalPhone) {
        return res.status(400).json({
          success: false,
          message: 'Member phone number is required',
        });
      }

      // Check if member user already exists
      const existingMemberUser = await User.findOne({ memberId, role: 'member' });
      if (existingMemberUser) {
        return res.status(400).json({
          success: false,
          message: 'Member user account already exists for this member',
        });
      }

      // Check if phone is already used by another user
      const existingUser = await User.findOne({ phone: finalPhone, tenantId: finalTenantId });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists for this tenant',
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
        message: 'Institute ID is required for institute users',
      });
    }

    // Check if user already exists (phone + tenantId combination)
    const existingUser = await User.findOne({ phone, tenantId: finalTenantId });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists for this tenant',
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
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (active or inactive)',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
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
      message: `User status updated to ${status} successfully`,
      data: updatedUser,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
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
        ? 'Member user and linked member record status updated successfully' 
        : 'User status updated to inactive successfully' 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

