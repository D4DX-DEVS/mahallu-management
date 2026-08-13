import { Request, Response } from 'express';
import User from '../models/User';
import Member from '../models/Member';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/authMiddleware';

const getPhoneVariants = (input: string): string[] => {
  const variants = new Set<string>();
  const raw = (input || '').trim();

  if (raw) {
    variants.add(raw);
  }

  const digits = raw.replace(/\D/g, '');
  if (digits) {
    variants.add(digits);
  }

  let local = digits;
  if (local.startsWith('91') && local.length === 12) {
    local = local.slice(2);
  }

  if (local.length === 10) {
    variants.add(local);
    variants.add(`91${local}`);
    variants.add(`+91${local}`);
  }

  return Array.from(variants);
};

export const login = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone and password are required',
      });
    }

    const phoneVariants = getPhoneVariants(phone);

    // Try to find user by phone
    let user = await User.findOne({ phone: { $in: phoneVariants } }).select('+password');
    
    // If no user found, check if it's a member trying to login
    if (!user) {
      const member = await Member.findOne({ phone: { $in: phoneVariants } });
      if (member) {
        // Find member user account
        user = await User.findOne({ memberId: member._id, role: 'member' }).select('+password');
        
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Invalid credentials. Member account not found.',
          });
        }
      } else {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive',
      });
    }

    if (user.role === 'member') {
      return res.status(403).json({
        success: false,
        message: 'Member login is OTP-only. Please use send OTP and verify OTP.',
      });
    }

    // Task C5 — optional 2FA. The password checked out, but the token is
    // withheld until the caller completes the existing send-otp/verify-otp pair.
    if (user.twoFactorEnabled) {
      return res.json({
        success: true,
        data: { requiresOtp: true, phone: user.phone },
        message: 'Two-factor authentication is enabled. Verify the OTP sent to your phone.',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, isSuperAdmin: user.isSuperAdmin },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Fetch user without populating to keep tenantId as string
    const userResponse = await User.findById(user._id).select('-password');

    res.json({
      success: true,
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    // Fetch user without populating to keep tenantId/memberId as strings
    const user = await User.findById(req.user?._id).select('-password');
    
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const registerDevice = async (req: AuthRequest, res: Response) => {
  try {
    const { oneSignalPlayerId } = req.body;
    if (!oneSignalPlayerId) {
      return res.status(400).json({ success: false, message: 'oneSignalPlayerId is required' });
    }
    await User.findByIdAndUpdate(req.user?._id, { oneSignalPlayerId });
    res.json({ success: true, message: 'Device registered successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Task C5 — turn 2FA on or off for the calling user only.
 * ponytail: self-service only; no admin override until someone gets locked out.
 */
/**
 * Task C5 — turn 2FA on or off for the calling user only.
 * ponytail: self-service only; no admin override until someone gets locked out.
 */
export const setTwoFactor = async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled must be true or false' });
    }

    const user = await User.findByIdAndUpdate(
      req.user?._id,
      { twoFactorEnabled: enabled },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: { twoFactorEnabled: user.twoFactorEnabled } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const selectAccount = async (req: Request, res: Response) => {
  try {
    const { preAuthToken, userId } = req.body;

    if (!preAuthToken || !userId) {
      return res.status(400).json({ success: false, message: 'preAuthToken and userId are required' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Missing JWT secret' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired selection token. Please log in again.' });
    }

    if (decoded.purpose !== 'role_selection') {
      return res.status(401).json({ success: false, message: 'Invalid token purpose' });
    }

    const tokenPhone: string = decoded.phone;
    const phoneVariants = Array.from(
      new Set([...getPhoneVariants(tokenPhone), tokenPhone])
    );

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found' });
    }

    // Verify user's phone matches the token's phone (prevents cross-account hijacking)
    if (!phoneVariants.includes(user.phone)) {
      return res.status(401).json({ success: false, message: 'Account mismatch. Please log in again.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, isSuperAdmin: user.isSuperAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: { user, token },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};


