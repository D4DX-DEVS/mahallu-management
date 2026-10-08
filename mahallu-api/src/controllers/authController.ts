import { Request, Response } from 'express';
import User from '../models/User';
import Member from '../models/Member';
import Tenant from '../models/Tenant';
import Institute from '../models/Institute';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/authMiddleware';

import { sendFailure } from '../utils/userMessages';
import { getPhoneVariants, samePhone } from '../utils/phone';
import { signSessionToken, signImpersonationToken, toPublicUser } from '../utils/sessionToken';
import { isTenantActive, TENANT_SUSPENDED_MESSAGE } from '../services/tenantStatusService';

export const login = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your phone number and password.',
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
            message: "We couldn't find a member account for this phone number. Please check the number or contact your Mahallu admin.",
          });
        }
      } else {
        return res.status(401).json({
          success: false,
          message: 'That phone number or password is incorrect. Please try again.',
        });
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'That phone number or password is incorrect. Please try again.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please contact your Mahallu admin.',
      });
    }

    if (user.role === 'member') {
      return res.status(403).json({
        success: false,
        message: 'Members sign in with an OTP. Please request an OTP to continue.',
      });
    }

    // A suspended Mahallu cannot start new sessions either (super admins are platform staff).
    if (!user.isSuperAdmin && !(await isTenantActive(user.tenantId))) {
      return res.status(403).json({ success: false, code: 'TENANT_SUSPENDED', message: TENANT_SUSPENDED_MESSAGE });
    }

    // Task C5 — optional 2FA. The password checked out, but the token is
    // withheld until the caller completes the existing send-otp/verify-otp pair.
    if (user.twoFactorEnabled) {
      return res.json({
        success: true,
        data: { requiresOtp: true, phone: user.phone },
        message: 'Please enter the OTP we sent to your phone.',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Password sign-in proves knowledge of the password only. It carries no "proven phone" claim, so
    // this session cannot be used to enumerate or switch into other accounts (those need an OTP).
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Something went wrong on our side. Please try again in a moment.' });
    }
    const token = signSessionToken(user);

    // Fetch user without populating to keep tenantId as string
    const userResponse = await User.findById(user._id).select('-password');

    res.json({
      success: true,
      data: {
        user: toPublicUser(userResponse),
        token,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t sign you in. Please check your details and try again.');
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    // Fetch user without populating to keep tenantId/memberId as strings
    const user = await User.findById(req.user?._id).select('-password');
    
    res.json({ success: true, data: toPublicUser(user) });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the current user right now. Please try again.');
  }
};

export const registerDevice = async (req: AuthRequest, res: Response) => {
  try {
    const { oneSignalPlayerId } = req.body;
    if (!oneSignalPlayerId) {
      return res.status(400).json({ success: false, message: "We couldn't set up notifications on this device. Please try again." });
    }
    // Saved on the account the session token belongs to. A device belongs to one signed-in account at a
    // time, so any other account still holding this id (an earlier sign-in or role on the same phone)
    // lets go of it and stops receiving this device's pushes.
    const saved = await User.findByIdAndUpdate(req.user?._id, { oneSignalPlayerId }, { new: true });
    if (!saved) {
      return res.status(404).json({ success: false, message: "We couldn't find your account. Please sign in again." });
    }
    await User.updateMany({ oneSignalPlayerId, _id: { $ne: saved._id } }, { $set: { oneSignalPlayerId: null } });
    res.json({ success: true, message: 'Notifications are on for this device' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the device. Please try again.');
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
      return res.status(400).json({ success: false, message: 'Please turn this setting on or off.' });
    }

    // A security setting changed: end every other session of this account. The caller keeps working
    // on a fresh token returned below.
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      { twoFactorEnabled: enabled, $inc: { tokenVersion: 1 } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: "We couldn't find that user. It may have been removed." });
    }

    res.json({
      success: true,
      data: {
        twoFactorEnabled: user.twoFactorEnabled,
        token: signSessionToken(user, { provenPhone: req.provenPhone }),
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the two factor. Please try again.');
  }
};

export const selectAccount = async (req: Request, res: Response) => {
  try {
    const { preAuthToken, userId } = req.body;

    if (!preAuthToken || !userId) {
      return res.status(400).json({ success: false, message: 'That sign-in step has expired. Please sign in again.' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Something went wrong on our side. Please try again in a moment.' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ success: false, message: 'That sign-in step has expired. Please sign in again.' });
    }

    if (decoded.purpose !== 'role_selection') {
      return res.status(401).json({ success: false, message: 'Your session has ended. Please sign in again to continue.' });
    }

    const tokenPhone: string = decoded.phone;
    if (typeof tokenPhone !== 'string' || !tokenPhone) {
      return res.status(401).json({ success: false, message: 'Your session has ended. Please sign in again to continue.' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: "We couldn't find that user account. It may have been removed." });
    }

    // Verify user's phone matches the OTP-proven phone in the token (prevents cross-account hijacking)
    if (!samePhone(user.phone, tokenPhone)) {
      return res.status(401).json({ success: false, message: "We couldn't match your account. Please sign in again." });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact your Mahallu admin.' });
    }

    if (!user.isSuperAdmin && !(await isTenantActive(user.tenantId))) {
      return res.status(403).json({ success: false, code: 'TENANT_SUSPENDED', message: TENANT_SUSPENDED_MESSAGE });
    }

    user.lastLogin = new Date();
    await user.save();

    // The phone was proven by OTP in the step before this one: carry it so this session may switch
    // between the person's own accounts.
    const token = signSessionToken(user, { provenPhone: tokenPhone });

    res.json({
      success: true,
      data: { user: toPublicUser(user), token },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t switch to that account. Please try again.');
  }
};

/**
 * The already-authenticated version of verifyOTP's multi-account discovery.
 *
 * Identity comes entirely from `req.user` — the User document authMiddleware
 * already loaded fresh from this request's own JWT. Nothing here reads a
 * phone number, role, tenantId or instituteId from the client; the sibling
 * lookup uses the same getPhoneVariants matching login/verifyOTP/selectAccount
 * already use, applied to the caller's own record.
 */
export const getAvailableAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
    }

    // Only a session that proved its phone with an OTP may list sibling accounts. The phone stored on
    // the CURRENT account is not evidence: an admin can type any number onto a user they control.
    // Super Admin accounts are never offered here, and neither are accounts of a suspended Mahallu.
    if (!req.provenPhone) {
      return res.json({ success: true, data: { accounts: [] } });
    }

    const phoneVariants = Array.from(new Set(getPhoneVariants(req.provenPhone)));
    const candidates = await User.find({
      phone: { $in: phoneVariants },
      status: 'active',
      isSuperAdmin: { $ne: true },
      role: { $ne: 'super_admin' },
    });
    const siblings: typeof candidates = [];
    for (const candidate of candidates) {
      if (samePhone(candidate.phone, req.provenPhone) && (await isTenantActive(candidate.tenantId))) {
        siblings.push(candidate);
      }
    }

    const tenantMap = new Map<string, string>();
    const instituteMap = new Map<string, string>();

    for (const u of siblings) {
      if (u.tenantId && !tenantMap.has(u.tenantId.toString())) {
        const tenant = await Tenant.findById(u.tenantId).select('name');
        if (tenant) tenantMap.set(u.tenantId.toString(), (tenant as any).name);
      }
      if (u.instituteId && !instituteMap.has(u.instituteId.toString())) {
        const institute = await Institute.findById(u.instituteId).select('name');
        if (institute) instituteMap.set(u.instituteId.toString(), (institute as any).name);
      }
    }

    const accounts = siblings.map((u) => ({
      userId: (u._id as any).toString(),
      role: u.role,
      name: u.name,
      tenantId: u.tenantId ? (u.tenantId as any).toString() : null,
      tenantName: u.tenantId ? tenantMap.get(u.tenantId.toString()) || null : null,
      ...(u.instituteId && {
        instituteId: (u.instituteId as any).toString(),
        instituteName: instituteMap.get(u.instituteId.toString()) || null,
      }),
      isCurrent: (u._id as any).toString() === (currentUser._id as any).toString(),
    }));

    res.json({ success: true, data: { accounts } });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't load your accounts right now. Please try again.");
  }
};

/**
 * Switches the current session to another of the signed-in person's own
 * accounts. The request may only name WHICH account (`targetUserId`) — role,
 * tenantId and instituteId are never read from the body, and the switch is
 * authorized purely by the target sharing the CURRENT authenticated user's
 * own phone number, via the same phone-variant check selectAccount already
 * uses. This is deliberately not a general "become any role" endpoint: a
 * Super Admin can only switch into an account that already exists for their
 * own phone, never into an arbitrary Mahallu's admin context.
 */
export const switchAccount = async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'Please sign in to continue.' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Something went wrong on our side. Please try again in a moment.' });
    }

    // Switching needs an OTP-proven phone on THIS session. "The target has the same phone as my
    // account" is not proof: phone numbers on accounts are editable by tenant admins, so an attacker
    // could put a victim's number on an account they control and switch into the victim's.
    if (!req.provenPhone) {
      return res.status(403).json({
        success: false,
        code: 'OTP_REQUIRED',
        message: 'For your security, please sign in with an OTP to switch accounts.',
      });
    }

    const { targetUserId } = req.body;

    const targetUser = await User.findById(targetUserId).select('-password');
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "We couldn't find that account. It may have been removed." });
    }

    // Never a Super Admin account: those are reached only by signing in to them directly.
    if (targetUser.isSuperAdmin || targetUser.role === 'super_admin') {
      return res.status(403).json({ success: false, message: "You're not authorized to switch to that account." });
    }

    if (targetUser.status !== 'active') {
      return res.status(403).json({ success: false, message: 'That account is inactive. Please contact your Mahallu admin.' });
    }

    if (!samePhone(targetUser.phone, req.provenPhone)) {
      return res.status(403).json({ success: false, message: "You're not authorized to switch to that account." });
    }

    if (!(await isTenantActive(targetUser.tenantId))) {
      return res.status(403).json({ success: false, code: 'TENANT_SUSPENDED', message: TENANT_SUSPENDED_MESSAGE });
    }

    targetUser.lastLogin = new Date();
    await targetUser.save();

    // The proven phone stays on the new session, so the person can keep switching between their accounts.
    const token = signSessionToken(targetUser, { provenPhone: req.provenPhone });

    res.json({
      success: true,
      data: { user: toPublicUser(targetUser), token },
    });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't switch accounts. Please try again.");
  }
};

/**
 * Sign out of every session of this account (all devices): the account's tokenVersion moves on, so
 * every token issued before this call stops working. A Super Admin "View As" session just ends on the
 * client — bumping the version would sign the real super admin out everywhere — and that token
 * expires on its own within hours.
 */
export const logout = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.impersonation?.isImpersonating) {
      await User.findByIdAndUpdate(req.user?._id, { $inc: { tokenVersion: 1 } });
    }
    res.json({ success: true, message: 'Signed out' });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't sign you out cleanly. Please try again.");
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user?._id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: "We couldn't find that user. It may have been removed." });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Your current password is incorrect. Please try again.',
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    // Every other session of this account ends; the caller gets a fresh token so they are not signed out.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed',
      data: { token: signSessionToken(user, { provenPhone: req.provenPhone }) },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t change your password. Please try again.');
  }
};

// ─── Super Admin "View As" — role/context impersonation for testing ─────────
//
// Deliberately separate from selectAccount/switchAccount above, which prove
// ownership of an existing sibling User document. There is usually no such
// document for the role being impersonated here — the whole point is letting
// Super Admin exercise a role/tenant/institute/member combination without one
// existing. Authorization instead rests entirely on the caller genuinely
// being Super Admin right now (enforced by the superAdminOnly route
// middleware, which reads req.isSuperAdmin — false during an existing
// impersonation, so this can never chain a second one on top of the first).

const IMPERSONATABLE_ROLES = ['mahall', 'survey', 'institute', 'member'] as const;
type ImpersonatableRole = (typeof IMPERSONATABLE_ROLES)[number];

export const startImpersonation = async (req: AuthRequest, res: Response) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Something went wrong on our side. Please try again in a moment.' });
    }

    const { targetRole, tenantId, instituteId, memberId } = req.body as {
      targetRole: ImpersonatableRole;
      tenantId: string;
      instituteId?: string;
      memberId?: string;
    };

    if (!IMPERSONATABLE_ROLES.includes(targetRole)) {
      return res.status(400).json({ success: false, message: 'Please choose a valid role to switch to.' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant || tenant.status !== 'active') {
      return res.status(400).json({ success: false, message: "We couldn't find an active Mahallu with that id." });
    }

    let resolvedInstituteId: string | null = null;
    let resolvedMemberId: string | null = null;

    if (targetRole === 'institute') {
      if (!instituteId) {
        return res.status(400).json({ success: false, message: 'Please choose an institute.' });
      }
      // Ownership check, not just existence — an institute id belonging to a
      // DIFFERENT tenant must be rejected exactly like tenantCheck.ts's
      // verifyInstituteOwnership rejects it everywhere else in the app.
      const institute = await Institute.findOne({ _id: instituteId, tenantId: tenant._id });
      if (!institute) {
        return res.status(400).json({ success: false, message: "That institute doesn't belong to this Mahallu." });
      }
      resolvedInstituteId = (institute._id as any).toString();
    }

    if (targetRole === 'member') {
      if (!memberId) {
        return res.status(400).json({ success: false, message: 'Please choose a member.' });
      }
      const member = await Member.findOne({ _id: memberId, tenantId: tenant._id });
      if (!member) {
        return res.status(400).json({ success: false, message: "That member doesn't belong to this Mahallu." });
      }
      resolvedMemberId = (member._id as any).toString();
    }

    const tenantIdStr = (tenant._id as any).toString();

    // Always the REAL Super Admin's own id — there is no target User document to point to, and
    // every future request re-resolves this id fresh from the database (see authMiddleware) before
    // trusting `imp`. Short-lived: a "View As" session does not need a week.
    const token = signImpersonationToken(req.user, {
      role: targetRole,
      tenantId: tenantIdStr,
      instituteId: resolvedInstituteId,
      memberId: resolvedMemberId,
    });

    // Smallest safe audit trail: who, what role/scope, when. No PII beyond
    // ids already visible to this Super Admin, no secrets, no request body
    // echoed wholesale.
    console.info('[impersonation] started', {
      by: (req.user._id as any).toString(),
      role: targetRole,
      tenantId: tenantIdStr,
      instituteId: resolvedInstituteId,
      memberId: resolvedMemberId,
      at: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: {
        user: {
          _id: req.user._id,
          name: req.user.name,
          phone: req.user.phone,
          role: targetRole,
          tenantId: tenantIdStr,
          instituteId: resolvedInstituteId,
          memberId: resolvedMemberId,
          status: 'active',
          isSuperAdmin: false,
          joiningDate: new Date(),
          tenant: { _id: tenantIdStr, name: tenant.name },
        },
        token,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't switch to that role. Please try again.");
  }
};

export const exitImpersonation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.impersonation?.isImpersonating) {
      return res.status(400).json({ success: false, message: "You're not currently viewing as another role." });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Something went wrong on our side. Please try again in a moment.' });
    }

    // Re-fetch the real account fresh — it must still genuinely be an active
    // super admin, the same defense-in-depth authMiddleware already applies
    // on every impersonated request.
    const realUser = await User.findById(req.impersonation.originalUserId).select('-password');
    if (!realUser || !realUser.isSuperAdmin || realUser.status !== 'active') {
      return res.status(403).json({ success: false, message: "We couldn't restore your Super Admin session. Please sign in again." });
    }

    console.info('[impersonation] exited', {
      by: req.impersonation.originalUserId,
      role: req.impersonation.role,
      tenantId: req.impersonation.tenantId,
      at: new Date().toISOString(),
    });

    // A normal, unmarked session token — identical in shape to a fresh login.
    const token = signSessionToken(realUser);

    res.json({
      success: true,
      data: { user: toPublicUser(realUser), token },
    });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't exit that role. Please try again.");
  }
};


