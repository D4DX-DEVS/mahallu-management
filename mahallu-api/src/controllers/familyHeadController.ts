import { Response } from 'express';
import Member from '../models/Member';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { memberKey, memberSeed } from './memberController';
import { createWithSequence } from '../utils/idCounter';
import { runAtomic } from '../utils/transaction';
import { calculateAge } from '../utils/age';
import { recordSecurityEvent } from '../utils/securityAudit';
import { regexLiteral } from '../utils/queryGuard';
import { sendFailure } from '../utils/userMessages';

const NOT_HEAD = 'Only the head of a family can add family members.';

/**
 * POST /api/member-user/family-members
 *
 * A Family Head adds a person to their OWN family. Everything that decides where the person lands
 * comes from the head's own record on the server (their family, their Mahallu); the body can only
 * describe the person. A body that names a family, a Mahallu, a status or `isFamilyHead` has those
 * fields ignored, so a head can neither reach another family nor make someone else a head.
 *
 * Rules it keeps from the admin flow (memberController.createMember):
 *  - the member id is the next FID-n of the family, from the same atomic counter;
 *  - a person with a phone number gets a linked member account that signs in with an OTP to that
 *    number. No password is created or shown: members have no password sign-in.
 * Rules it adds:
 *  - the family must be approved (a family still waiting for approval cannot grow);
 *  - the same person is not added twice (retried or double-submitted requests answer 409);
 *  - the member and their account are created together or not at all.
 */
export const createFamilyMember = async (req: AuthRequest, res: Response) => {
  try {
    if (req.impersonation?.isImpersonating) {
      return res.status(403).json({ success: false, message: "This isn't available while viewing as another account." });
    }
    if (!req.user?.memberId) {
      return res.status(403).json({ success: false, message: NOT_HEAD });
    }

    const head = await Member.findById(req.user.memberId);
    if (
      !head ||
      head.isFamilyHead !== true ||
      head.status !== 'active' ||
      head.isDead === true ||
      !head.familyId ||
      String(head.tenantId) !== String(req.user.tenantId)
    ) {
      return res.status(403).json({ success: false, message: NOT_HEAD });
    }

    const family = await Family.findOne({ _id: head.familyId, tenantId: head.tenantId });
    if (!family) {
      return res.status(404).json({ success: false, message: "We couldn't find your family. Please contact your Mahallu admin." });
    }
    if (family.status !== 'approved') {
      return res.status(409).json({
        success: false,
        message: "Your family is still waiting for approval, so members can't be added yet. Please contact your Mahallu admin.",
      });
    }

    const { name, nameMl, gender, dateOfBirth, bloodGroup, relationship, relationshipOther, maritalStatus, phone } = req.body;
    const personName = String(name).trim();

    // The same person twice in one family: same name (any case) and the same date of birth, or both without one.
    const duplicate = await Member.findOne({
      tenantId: head.tenantId,
      familyId: family._id,
      status: { $ne: 'deleted' },
      name: { $regex: `^${regexLiteral(personName)}$`, $options: 'i' },
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : { $exists: false },
    }).select('_id');
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `${personName} is already in your family${dateOfBirth ? ' with that date of birth' : ''}.`,
      });
    }

    const tenantId = String(head.tenantId);

    const created = await runAtomic(
      async (session, comp) => {
        const member = await createWithSequence(
          memberKey(tenantId, family._id),
          { seed: memberSeed(tenantId, family), field: 'mahallId' },
          async (n) => {
            const doc = new Member({
              tenantId: head.tenantId,
              familyId: family._id,
              familyName: family.houseName,
              mahallId: family.mahallId ? `${family.mahallId}-${n}` : undefined,
              name: personName,
              ...(nameMl ? { nameMl } : {}),
              ...(gender ? { gender } : {}),
              ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth), age: calculateAge(dateOfBirth) } : {}),
              ...(bloodGroup ? { bloodGroup } : {}),
              ...(relationship ? { relationship, relationshipOther: relationship === 'other' ? relationshipOther || '' : '' } : {}),
              ...(maritalStatus ? { maritalStatus } : {}),
              ...(phone ? { phone } : {}),
              isFamilyHead: false,
              status: 'active',
            });
            await doc.save({ session });
            return doc;
          }
        );
        comp.push('delete new family member', () => Member.deleteOne({ _id: member._id }));
        // No sign-in is created: among a family's members only the head signs in.
        return { member };
      },
      {
        description: 'family head adds a family member',
        reconcile: { flow: 'family head adds a family member', entity: 'family', entityId: family._id, tenantId: head.tenantId },
      }
    );

    await recordSecurityEvent(req, {
      action: 'family member created',
      target: { id: created.member._id, role: 'member', tenantId: head.tenantId },
      details: { familyId: String(family._id), memberId: String(created.member._id), loginAccount: false },
    });

    const memberResponse = await Member.findById(created.member._id).populate('familyId', 'houseName mahallId');
    return res.status(201).json({
      success: true,
      data: memberResponse,
      loginAccountCreated: false,
      message: `${personName} was added.`,
    });
  } catch (error: any) {
    return sendFailure(res, error, "We couldn't add the family member. Please try again.");
  }
};
