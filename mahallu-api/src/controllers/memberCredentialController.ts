import { Response } from 'express';
import Member from '../models/Member';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';
import { verifyTenantOwnership } from '../utils/tenantCheck';
import { sendFailure } from '../utils/userMessages';
import { recordSecurityEvent } from '../utils/securityAudit';
import { issueHeadPassword, mayMemberSignIn, openPassword, syncHeadLogin } from '../services/familyHeadLogin';

/*
 * The Mahallu admin's view of a family head's sign-in: the phone number they sign in with and the
 * password the Mahallu issued. Both handlers are for `mahall` and super admin only (see memberRoutes)
 * and both are written to the security log, because they hand out a password.
 */

/** The member, if it is the caller's to manage and is an active family head with a phone number. */
const loadHead = async (req: AuthRequest, res: Response) => {
  const member = await Member.findById(req.params.id);
  if (!member) {
    res.status(404).json({ success: false, message: "We couldn't find that member. It may have been removed." });
    return null;
  }
  if (!verifyTenantOwnership(req, res, member.tenantId, 'Member')) return null;
  if (!mayMemberSignIn(member)) {
    res.status(400).json({
      success: false,
      message: member.isFamilyHead
        ? 'This family head cannot sign in yet. Make sure the member is active and has a phone number.'
        : 'Only a family head has sign-in details.',
    });
    return null;
  }
  return member;
};

/** GET /members/:id/credentials — the sign-in name and, when one is on record, the issued password. */
export const getMemberCredentials = async (req: AuthRequest, res: Response) => {
  try {
    const member = await loadHead(req, res);
    if (!member) return;

    const account = await User.findOne({ memberId: member._id, role: 'member' }).select('+issuedPassword');
    const password = openPassword(account?.issuedPassword);

    await recordSecurityEvent(req, {
      action: 'family head password viewed',
      target: { id: account?._id ?? member._id, role: 'member', tenantId: member.tenantId },
      details: { memberId: String(member._id), onRecord: Boolean(password) },
    });

    res.json({ success: true, data: { username: member.phone, password } });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't load the sign-in details. Please try again.");
  }
};

/** POST /members/:id/credentials/reset — issues a new password; the old one and every session end. */
export const resetMemberPassword = async (req: AuthRequest, res: Response) => {
  try {
    const member = await loadHead(req, res);
    if (!member) return;

    // A head from before sign-ins were created with the member gets an account here.
    const { created } = await syncHeadLogin(member);
    const account = await User.findOne({ memberId: member._id, role: 'member' });
    if (!account) {
      return res.status(404).json({ success: false, message: "We couldn't find this family head's sign-in. Please try again." });
    }
    const password = await issueHeadPassword(account._id);

    await recordSecurityEvent(req, {
      action: 'family head password reset',
      target: { id: account._id, role: 'member', tenantId: member.tenantId },
      details: { memberId: String(member._id), accountCreated: created },
    });

    res.json({ success: true, data: { username: member.phone, password } });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't reset the password. Please try again.");
  }
};
