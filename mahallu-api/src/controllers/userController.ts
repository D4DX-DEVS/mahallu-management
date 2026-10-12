import { Request, Response } from 'express';
import User from '../models/User';
import Member from '../models/Member';
import Institute from '../models/Institute';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/authMiddleware';
import { getInitialPassword } from '../utils/passwords';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

/**
 * Load a user the caller is allowed to manage: super admin can reach anyone; everyone else
 * only non-super-admin users of their own tenant. Responds 404 (not 403) to avoid leaking
 * the existence of users in other tenants.
 */
const loadManageableUser = async (req: AuthRequest, res: Response, select?: string) => {
  const q = User.findById(req.params.id);
  const user = await (select ? q.select(select) : q);
  if (
    !user ||
    (!req.isSuperAdmin &&
      (user.isSuperAdmin || !req.tenantId || user.tenantId?.toString() !== req.tenantId.toString()))
  ) {
    res.status(404).json({ success: false, message: 'User not found' });
    return null;
  }
  return user;
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
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

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const user = await loadManageableUser(req, res, '-password');
    if (!user) return;
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
      const hashedPassword = await bcrypt.hash(password || getInitialPassword(), 10);

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

    if (finalRole === 'institute') {
      const inst = await Institute.findById(instituteId).select('tenantId');
      if (!inst || inst.tenantId?.toString() !== finalTenantId?.toString()) {
        return res.status(403).json({ success: false, message: 'Institute does not belong to this tenant' });
      }
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
    const hashedPassword = await bcrypt.hash(password || getInitialPassword(), 10);

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

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, status, permissions, photoUrl } = req.body;
    // the tenant / super-admin checks inside loadManageableUser need these fields (a bare '_id' select made them undefined -> 404)
    const target = await loadManageableUser(req, res, '_id tenantId isSuperAdmin role');
    if (!target) return;

    const update: Record<string, any> = {};
    const unset: Record<string, ''> = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (email !== undefined) update.email = email;
    if (photoUrl !== undefined) {
      // null / '' clears the photo
      if (photoUrl === null || photoUrl === '') unset.photoUrl = '';
      else update.photoUrl = photoUrl;
    }
    if (status !== undefined) update.status = status;
    if (permissions !== undefined) {
      if (permissions === null || typeof permissions !== 'object' || Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: 'permissions must be an object of flags' });
      }
      // Merge flag by flag (never replace the whole object); only known keys, booleans only.
      // financeAdmin and canDeleteReceipts can only be granted by a super admin.
      const boolKeys = ['view', 'add', 'edit', 'delete', 'canCancelReceipts', 'canApprovePayments', 'canCloseCashDay', 'canVerifyCashDay', 'canManageCampaigns', 'canManagePeriods'];
      const superOnly = ['financeAdmin', 'canDeleteReceipts'];
      for (const key of [...boolKeys, ...superOnly]) {
        if (permissions[key] === undefined) continue;
        if (superOnly.includes(key) && !req.isSuperAdmin) {
          return res.status(403).json({ success: false, message: `Only a super admin can change ${key}` });
        }
        if (permissions[key] !== null && typeof permissions[key] !== 'boolean') {
          return res.status(400).json({ success: false, message: `${key} must be true or false` });
        }
        // null clears the override so the role default applies again
        if (permissions[key] === null) unset[`permissions.${key}`] = '';
        else update[`permissions.${key}`] = permissions[key];
      }
    }

    const user = await User.findByIdAndUpdate(
      target._id,
      { ...(Object.keys(update).length ? { $set: update } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
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

export const updateUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (active or inactive)',
      });
    }

    const user = await loadManageableUser(req, res);
    if (!user) return;

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

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await loadManageableUser(req, res);
    if (!user) return;

    if (req.user?._id && user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
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

