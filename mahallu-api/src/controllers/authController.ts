import { Request, Response } from 'express';
import User from '../models/User';
import Member from '../models/Member';
import Family from '../models/Family';
import OTP from '../models/OTP';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/authMiddleware';
import { normalizeIndianPhone, sendWhatsAppMessage } from '../services/dxingService';
import Tenant from '../models/Tenant';
import Institute from '../models/Institute';

// App Store Review test account — OTP is always 123456 for this number
const APP_STORE_TEST_PHONE = '918877665544';

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

// Generate and send OTP
export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    let normalizedPhone: string;
    let localPhone: string;
    try {
      const normalized = normalizeIndianPhone(phone);
      normalizedPhone = normalized.normalized;
      localPhone = normalized.local;
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'Invalid phone number' });
    }

    console.info(`[OTP] send-otp requested for phone=${phone} normalized=${normalizedPhone} env=${process.env.NODE_ENV}`);

    // ─── App Store Review test account ──────────────────────────────────────────
    // Phone 8877665544 always gets OTP 123456. Test accounts are auto-created on
    // first use so the seed script is not required.
    if (normalizedPhone === APP_STORE_TEST_PHONE) {
      const testLocalPhone = '8877665544';
      const testVariants = [testLocalPhone, normalizedPhone, `+${normalizedPhone}`];
      const existingCount = await User.countDocuments({ phone: { $in: testVariants } });

      if (existingCount === 0) {
        // Find or create a tenant
        let tenant = await Tenant.findOne({ status: 'active' });
        if (!tenant) {
          tenant = await Tenant.create({
            name: 'App Store Test Mahallu', code: 'TEST001', type: 'standard',
            location: 'Kerala',
            address: { state: 'Kerala', district: 'Kozhikode', lsgName: 'Kozhikode Corporation', village: 'Kozhikode' },
            status: 'active',
            subscription: { plan: 'standard', startDate: new Date(), isActive: true },
            settings: { varisangyaAmount: 100, varisangyaGrades: [], educationOptions: [], areaOptions: [], features: {} },
          });
        }
        const tenantId = (tenant as any)._id;
        const hashedPw = await bcrypt.hash('123456', 10);
        const fullPerms = { view: true, add: true, edit: true, delete: true };

        // super_admin user
        await User.create({ name: 'Test User (Super Admin)', phone: testLocalPhone, role: 'super_admin', status: 'active', isSuperAdmin: true, permissions: fullPerms, password: hashedPw });

        // mahall user
        await User.create({ name: 'Test User (Mahall)', phone: testLocalPhone, role: 'mahall', tenantId, status: 'active', isSuperAdmin: false, permissions: fullPerms, password: hashedPw });

        // institute + institute user
        let institute = await Institute.findOne({ tenantId, name: 'App Store Test Institute' });
        if (!institute) institute = await Institute.create({ tenantId, name: 'App Store Test Institute', place: 'Kozhikode', type: 'institute', status: 'active' });
        await User.create({ name: 'Test User (Institute)', phone: testLocalPhone, role: 'institute', tenantId, instituteId: (institute as any)._id, status: 'active', isSuperAdmin: false, permissions: fullPerms, password: hashedPw });

        // family + member + member user
        let family = await Family.findOne({ tenantId, houseName: 'App Store Test House' });
        if (!family) family = await Family.create({ tenantId, houseName: 'App Store Test House', familyHead: 'Test User', status: 'approved' });
        let member = await Member.findOne({ phone: { $in: testVariants } });
        if (!member) member = await Member.create({ tenantId, name: 'Test User (Member)', familyId: (family as any)._id, familyName: 'App Store Test House', phone: testLocalPhone, status: 'active' });
        await User.create({ name: 'Test User (Member)', phone: testLocalPhone, role: 'member', tenantId, memberId: (member as any)._id, status: 'active', isSuperAdmin: false, permissions: fullPerms, password: hashedPw });

        console.info('[OTP] App Store test accounts auto-created');
      } else {
        // Ensure super_admin exists for existing test accounts
        const hasSuperAdmin = await User.findOne({ phone: { $in: testVariants }, role: 'super_admin' });
        if (!hasSuperAdmin) {
          const hashedPw = await bcrypt.hash('123456', 10);
          const fullPerms = { view: true, add: true, edit: true, delete: true };
          await User.create({ name: 'Test User (Super Admin)', phone: testLocalPhone, role: 'super_admin', status: 'active', isSuperAdmin: true, permissions: fullPerms, password: hashedPw });
          console.info('[OTP] App Store super_admin account auto-created for existing test user');
        }
      }

      await OTP.updateMany({ phone: normalizedPhone, isUsed: false }, { isUsed: true });
      await new OTP({ phone: normalizedPhone, code: '123456', expiresAt: new Date(Date.now() + 60 * 60 * 1000) }).save();
      console.info(`[OTP] App Store test account: fixed OTP issued for ${normalizedPhone}`);
      return res.json({ success: true, message: 'OTP sent successfully', otp: '123456' });
    }
    // ────────────────────────────────────────────────────────────────────────────

    const phoneVariants = Array.from(
      new Set([...getPhoneVariants(phone), localPhone, normalizedPhone, `+${normalizedPhone}`])
    );

    // Check if any user account exists with this phone
    let users = await User.find({ phone: { $in: phoneVariants } });
    let user: (typeof users)[0] | null = users.find(u => u.status === 'active') || users[0] || null;

    // If no user found, check if it's a member trying to login
    if (!user) {
      const member = await Member.findOne({ phone: { $in: phoneVariants } });
      if (member) {
        // Check if member user account exists
        let memberUser = await User.findOne({ memberId: member._id, role: 'member' });

        if (!memberUser) {
          const defaultMemberPassword = process.env.DEFAULT_MEMBER_PASSWORD || '123456';
          const hashedPassword = await bcrypt.hash(defaultMemberPassword, 10);

          try {
            memberUser = await User.create({
              name: member.name,
              phone: localPhone,
              role: 'member',
              tenantId: member.tenantId,
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
          } catch (createError: any) {
            if (createError?.code === 11000) {
              memberUser = await User.findOne({ memberId: member._id, role: 'member' });
            }

            if (!memberUser) {
              throw createError;
            }
          }
        }
        user = memberUser;
        users = [memberUser!];
      } else {
        return res.status(404).json({
          success: false,
          message: 'User not found with this phone number',
        });
      }
    }

    if (!users.some(u => u.status === 'active')) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive',
      });
    }

    // Check for recent OTP requests (rate limiting - max 1 per minute)
    const recentOTP = await OTP.findOne({
      phone: normalizedPhone,
      createdAt: { $gte: new Date(Date.now() - 60000) }, // Last 1 minute
    });

    if (recentOTP) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another OTP',
      });
    }

    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Invalidate previous unused OTPs for this phone
    await OTP.updateMany(
      { phone: normalizedPhone, isUsed: false },
      { isUsed: true }
    );

    let otpCode: string;
    let otp: any;

    if (!isDevelopment) {
      console.info(`[OTP] Production mode: Sending via DXING to ${normalizedPhone}`);
      
      // Use DXING's OTP template - DXING will generate and send the OTP
      const message = `🔐 Mahallu Login OTP\n\nYour OTP is {{otp}}. It will expire in 5 minutes.\n\nIf you did not request this OTP, please ignore this message.`;
      
      try {
        const deliveryResult = await sendWhatsAppMessage(normalizedPhone, message);
        
        // Strict validation of DXING response
        if (!deliveryResult) {
          throw new Error('DXING returned empty response');
        }

        if (typeof deliveryResult !== 'object') {
          throw new Error('DXING returned non-object response: ' + typeof deliveryResult);
        }

        // Check for explicit delivery confirmation
        const confirmed = 
          deliveryResult.status === 200 || 
          deliveryResult.status === true ||
          deliveryResult.success === true;

        if (!confirmed) {
          console.error('[OTP] DXING did not confirm delivery:', {
            response: deliveryResult,
            phone: normalizedPhone,
          });
          throw new Error(`DXING delivery not confirmed: ${JSON.stringify(deliveryResult)}`);
        }

        // Extract OTP from DXING response
        // Response format: { status: 200, message: "...", data: { otp: 123456, messageId: "..." } }
        if (!deliveryResult.data || !deliveryResult.data.otp) {
          throw new Error('DXING response missing OTP code');
        }

        otpCode = String(deliveryResult.data.otp);

        console.info(`[OTP] ✅ DXING confirmed delivery to ${normalizedPhone}`, {
          messageId: deliveryResult.data.messageId,
          status: deliveryResult.status,
          otpLength: otpCode.length,
          timestamp: new Date().toISOString(),
        });

        // Save the DXING-generated OTP to database for verification
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes (matching DXING)
        otp = new OTP({
          phone: normalizedPhone,
          code: otpCode,
          expiresAt,
        });
        await otp.save();

      } catch (err: any) {
        console.error(`[OTP] ❌ DXING delivery failed for ${normalizedPhone}:`, {
          error: err?.message,
          code: err?.code,
          httpStatus: err?.response?.status,
          dxingResponse: err?.response?.data,
          timestamp: new Date().toISOString(),
        });

        // Return user-friendly error
        return res.status(500).json({
          success: false,
          message: 'Failed to send OTP via WhatsApp. Please try again or contact support if the problem persists.',
        });
      }
    } else {
      // Development mode: Generate OTP locally
      otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      otp = new OTP({
        phone: normalizedPhone,
        code: otpCode,
        expiresAt,
      });
      await otp.save();
      
      console.info(`[OTP] Dev mode: Generated OTP for ${normalizedPhone}, OTP=${otpCode}`);
    }

    res.json({
      success: true,
      message: 'OTP sent successfully',
      ...(isDevelopment && { otp: otpCode }),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify OTP and login
export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone and OTP are required',
      });
    }

    let normalizedPhone: string;
    let localPhone: string;
    try {
      const normalized = normalizeIndianPhone(phone);
      normalizedPhone = normalized.normalized;
      localPhone = normalized.local;
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'Invalid phone number' });
    }

    // Find the latest valid OTP for this phone
    const otpRecord = await OTP.findOne({
      phone: normalizedPhone,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP',
      });
    }

    if (otpRecord.code !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      if (otpRecord.attempts >= 5) {
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. Please request a new OTP',
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    const phoneVariants = Array.from(
      new Set([...getPhoneVariants(phone), localPhone, normalizedPhone, `+${normalizedPhone}`])
    );

    // Find all users with this phone (multiple roles possible in same mahallu)
    let users = await User.find({ phone: { $in: phoneVariants } });

    // If no users found, check if it's a member trying to login
    if (users.length === 0) {
      const member = await Member.findOne({ phone: { $in: phoneVariants } });
      if (member) {
        const memberUser = await User.findOne({ memberId: member._id, role: 'member' });
        if (!memberUser) {
          return res.status(404).json({
            success: false,
            message: 'Member account not found. Please contact admin to create your account.',
          });
        }
        users = [memberUser];
      } else {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
    }

    const activeUsers = users.filter(u => u.status === 'active');
    if (activeUsers.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive',
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Multiple active accounts — prompt the user to choose which role to log in as
    if (activeUsers.length > 1) {
      if (!process.env.JWT_SECRET) {
        return res.status(500).json({ success: false, message: 'Missing JWT secret' });
      }

      const tenantMap = new Map<string, string>();
      const instituteMap = new Map<string, string>();

      for (const u of activeUsers) {
        if (u.tenantId && !tenantMap.has(u.tenantId.toString())) {
          const tenant = await Tenant.findById(u.tenantId).select('name');
          if (tenant) tenantMap.set(u.tenantId.toString(), (tenant as any).name);
        }
        if (u.instituteId && !instituteMap.has(u.instituteId.toString())) {
          const institute = await Institute.findById(u.instituteId).select('name');
          if (institute) instituteMap.set(u.instituteId.toString(), (institute as any).name);
        }
      }

      const accounts = activeUsers.map((u) => ({
        userId: (u._id as any).toString(),
        role: u.role,
        name: u.name,
        tenantId: u.tenantId ? (u.tenantId as any).toString() : null,
        tenantName: u.tenantId ? (tenantMap.get(u.tenantId.toString()) || null) : null,
        ...(u.instituteId && {
          instituteId: (u.instituteId as any).toString(),
          instituteName: instituteMap.get(u.instituteId.toString()) || null,
        }),
      }));

      const preAuthToken = jwt.sign(
        { phone: normalizedPhone, purpose: 'role_selection' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      return res.json({
        success: true,
        data: { requiresRoleSelection: true, preAuthToken, accounts },
      });
    }

    // Single active user — proceed with normal login
    const user = activeUsers[0];

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Missing JWT secret' });
    }

    const token = jwt.sign(
      { userId: user._id, isSuperAdmin: user.isSuperAdmin },
      process.env.JWT_SECRET,
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

