import { getInitialPassword } from '../utils/passwords';
import { Request, Response } from 'express';
import Member from '../models/Member';
import Family from '../models/Family';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { verifyTenantOwnership } from '../utils/tenantCheck';
import { refBelongsToTenant, stripImmutable } from '../utils/sanitizeUpdate';
import { nextMemberMahallId } from '../services/idService';
import { findMemberDuplicates } from '../services/duplicateService';
import { transferMember, livingHeads, setFamilyHead, flagHeadlessIfNeeded, archivedFamilyIds } from '../services/familyLifecycleService';
import { sendError } from '../utils/transaction';

const actorOf = (req: AuthRequest) => ({
  tenantId: req.tenantId,
  userId: req.user?._id ? String(req.user._id) : undefined,
  userName: req.user?.name,
  isSuperAdmin: req.isSuperAdmin,
});
const flag = (v: unknown) => v === true || v === 'true' || v === '1';
// Server-managed lifecycle fields: never taken from a generic create/update body
const MEMBER_SERVER_FIELDS = ['archivedWithFamilyId', 'previousStatus', 'confirmDuplicate'];
const stripMemberServer = <T extends Record<string, any>>(body: T): T => {
  const clean: any = { ...body };
  MEMBER_SERVER_FIELDS.forEach((f) => delete clean[f]);
  return clean;
};

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
    else if (status !== 'deleted' && req.query.includeArchived !== 'true') {
      // members of archived families stay out of the default lists
      const archived = await archivedFamilyIds(query.tenantId);
      if (archived.length) query.familyId = { $nin: archived };
    }
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
    const { familyId, familyName, ...memberData } = stripMemberServer(req.body);

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

      if (family.isArchived) {
        return res.status(409).json({
          success: false,
          code: 'FAMILY_ARCHIVED',
          message: 'This family is archived. Restore it before adding members.',
        });
      }

      // Use family's houseName if familyName not provided
      if (!familyName) {
        memberData.familyName = family.houseName;
      }

      // Restrict: a family can only have one (living) family head
      if (memberData.isFamilyHead) {
        const [existingHead] = await livingHeads(family._id);
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

    // Possible duplicate? (same name + age + phone, or same name + age in this family). Overridable.
    if (!flag(req.query.confirmDuplicate) && !flag(req.body?.confirmDuplicate)) {
      const matches = await findMemberDuplicates(finalTenantId, { name: memberData.name, age: memberData.age, phone: memberData.phone, familyId });
      if (matches.length) {
        return res.status(409).json({
          success: false,
          code: 'POSSIBLE_DUPLICATE',
          message: 'This looks like a member who is already on the list. Check before adding them again.',
          matches: matches.map((m) => ({ id: m.id, name: m.name, houseName: m.houseName, familyHead: m.familyHead, familyId: m.familyId, reason: m.reasonText, reasonCode: m.reason })),
        });
      }
    }

    // Auto-generate mahallId (Member ID) from an atomic per-family counter: FID123-1, FID123-2, ...
    if (family && family.mahallId) {
      memberData.mahallId = await nextMemberMahallId(family);
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
      // Two simultaneous "add head" requests can both pass the check above: the earliest wins, the later is undone.
      const heads = await livingHeads(family._id);
      if (heads.length > 1) {
        const first = [...heads].sort((a: any, b: any) => String(a._id).localeCompare(String(b._id)))[0];
        if (String((first as any)._id) !== String(member._id)) {
          await Member.deleteOne({ _id: member._id });
          return res.status(400).json({
            success: false,
            message: `This family already has a family head (${(first as any).name}). A family can only have one head.`,
          });
        }
      }
      await setFamilyHead(family._id, member._id);
    }

    let memberUserCreated = false;
    let memberUserMessage = 'Member user not created because phone number is missing.';

    if (member.phone) {
      const defaultMemberPassword = getInitialPassword();
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

    const { familyId, familyName, ...updateData } = stripMemberServer(stripImmutable(req.body) as Record<string, any>);

    // Moving to another family goes through the transfer service (fresh member ID, one head per family, audit trail)
    if (familyId && String(familyId) !== String(existingMember.familyId)) {
      await transferMember(String(existingMember._id), String(familyId), actorOf(req), { makeHead: false });
      delete updateData.mahallId;
    }

    // A family can only have one living head
    if (updateData.isFamilyHead === true || updateData.isFamilyHead === 'true') {
      const current: any = await Member.findById(existingMember._id).select('familyId');
      const [other] = await livingHeads(current.familyId, undefined, existingMember._id);
      if (other) {
        return res.status(400).json({
          success: false,
          message: `This family already has a family head (${(other as any).name}). Use "Change family head" to hand over the role.`,
        });
      }
    }

    // If familyId is being updated, verify the family exists and belongs to same tenant
    if (familyId && String(familyId) === String(existingMember.familyId)) {
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

    // Keep the family's head name and "needs a head" flag in step with the head toggle
    const famId = (member.familyId as any)?._id || member.familyId;
    if (updateData.isFamilyHead === true || updateData.isFamilyHead === 'true') {
      await setFamilyHead(famId, member._id);
    } else if ((updateData.isFamilyHead === false || updateData.isFamilyHead === 'false') && existingMember.isFamilyHead) {
      await flagHeadlessIfNeeded(famId, `${member.name} is no longer the family head`);
    }

    res.json({ success: true, data: member });
  } catch (error: any) {
    sendError(res, error);
  }
};

/** POST /members/:id/transfer { toFamilyId, makeHead? } */
export const transferMemberHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { toFamilyId, makeHead } = req.body || {};
    if (!toFamilyId) return res.status(400).json({ success: false, message: 'Choose the family to move this member to (toFamilyId).' });
    const r = await transferMember(req.params.id, String(toFamilyId), actorOf(req), { makeHead: flag(makeHead) });
    res.json({
      success: true,
      message: r.sourceNeedsHead ? 'Member moved. Their old family now needs a new head.' : 'Member moved.',
      data: r,
    });
  } catch (error: any) {
    sendError(res, error);
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
    if (member.isFamilyHead && (status === 'deleted' || status === 'inactive')) {
      await flagHeadlessIfNeeded(member.familyId, `${member.name}, the family head, is no longer active`);
    }

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
    if (member.isFamilyHead) {
      await flagHeadlessIfNeeded(member.familyId, `${member.name}, the family head, was removed`);
    }

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

export const getMembersByFamily = async (req: AuthRequest, res: Response) => {
  try {
    const { familyId } = req.params;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const query: any = { familyId };
    if (req.tenantId) query.tenantId = req.tenantId;

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

/** Bulk import members to a family (CSV parsed client-side into a JSON array). Max 500 rows. */
export const bulkImportMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { familyId, members } = req.body;

    if (!familyId) {
      return res.status(400).json({ success: false, message: 'familyId is required' });
    }

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ success: false, message: 'members array is required' });
    }

    if (members.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 members per import' });
    }

    // Verify family exists and belongs to tenant
    const familyBelongs = await refBelongsToTenant(Family, familyId, req.tenantId);
    if (!familyBelongs) {
      return res.status(403).json({ success: false, message: 'Family does not belong to this tenant or does not exist' });
    }

    const family = await Family.findById(familyId).select('houseName mahallId').lean();
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    const errors: { row: number; message: string }[] = [];
    const docs: any[] = [];

    members.forEach((m: any, i: number) => {
      if (!m.name || typeof m.name !== 'string' || !m.name.trim()) {
        errors.push({ row: i + 1, message: 'name is required' });
        return;
      }

      docs.push({
        name: m.name.trim(),
        nameMl: m.nameMl || m.name_ml || undefined,
        familyId,
        familyName: family.houseName,
        gender: ['male', 'female'].includes(m.gender) ? m.gender : undefined,
        age: m.age && Number(m.age) > 0 ? Number(m.age) : undefined,
        maritalStatus: ['single', 'married', 'divorced', 'widowed'].includes(m.maritalStatus)
          ? m.maritalStatus
          : undefined,
        education: m.education || undefined,
        occupation: m.occupation || undefined,
        tenantId: req.tenantId,
        status: 'active',
      });
    });

    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    // Possible duplicates: same name + age inside this family, or repeated within the file
    if (!flag(req.query.confirmDuplicate) && !flag(req.body?.confirmDuplicate)) {
      const found: any[] = [];
      const seen = new Map<string, number>();
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        const key = `${String(d.name).toLowerCase().replace(/\s+/g, ' ')}|${d.age ?? ''}`;
        if (seen.has(key) && d.age) found.push({ row: i + 1, id: `row-${seen.get(key)}`, name: d.name, houseName: family.houseName, reason: 'Appears twice in this file', reasonCode: 'same_name_age_in_file' });
        seen.set(key, i + 1);
        const m = await findMemberDuplicates(req.tenantId, { name: d.name, age: d.age, familyId });
        m.forEach((x) => found.push({ row: i + 1, id: x.id, name: x.name, houseName: x.houseName, reason: x.reasonText, reasonCode: x.reason }));
      }
      if (found.length) {
        return res.status(409).json({
          success: false,
          code: 'POSSIBLE_DUPLICATE',
          message: `${found.length} row${found.length === 1 ? '' : 's'} look like members who are already on the list. Review them, or import anyway.`,
          matches: found,
        });
      }
    }
    for (const d of docs) d.mahallId = await nextMemberMahallId({ _id: familyId, mahallId: family.mahallId });

    const created = await Member.insertMany(docs);
    res.status(201).json({ success: true, data: { imported: created.length } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

