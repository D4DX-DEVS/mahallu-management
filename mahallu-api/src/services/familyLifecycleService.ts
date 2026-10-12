import mongoose, { ClientSession } from 'mongoose';
import Family from '../models/Family';
import Member from '../models/Member';
import User from '../models/User';
import '../models/Collectible';
import '../models/Zakat';
import '../models/Welfare';
import '../models/ReliefCase';
import '../models/QardLoan';
import '../models/MarriageAssistance';
import '../models/ClusterVisit';
import '../models/Cemetery';
import '../models/Registration';
import { nextFamilyMahallId, nextMemberMahallId } from './idService';
import { computeFamilyDues } from './duesService';
import { withOptionalTransaction, HttpError } from '../utils/transaction';
import { ACTIVE_FAMILY_FILTER } from '../utils/archiveFilters';

export interface LifecycleActor {
  tenantId?: string;
  userId?: string;
  userName?: string;
  isSuperAdmin?: boolean;
}

/** Models carrying a `familyId` that must follow a family when it is merged away. Ledger items carry no familyId. */
const REPOINT_MODELS = [
  'Varisangya',
  'Zakat',
  'ZakatBeneficiary',
  'ZakatDistribution',
  'WelfareApplication',
  'ReliefCase',
  'QardLoan',
  'MarriageAssistance',
  'ClusterVisit',
  'GraveRecord',
  'DeathRegistration',
];
// Wallet is handled separately: there must stay one wallet per family, so balances are combined.

/** A member that still counts as part of the household. */
const LIVING_MEMBER = { status: { $ne: 'deleted' }, isDead: { $ne: true } } as const;
const ACTIVE_MEMBER = { status: 'active', isDead: { $ne: true } } as const;

const withSession = <Q extends { session: (s: any) => any }>(q: Q, session?: ClientSession): Q => (session ? q.session(session) : q);

const logEntry = (action: string, actor: LifecycleActor, details: Record<string, any> = {}) => ({
  action,
  at: new Date(),
  by: actor.userId && mongoose.Types.ObjectId.isValid(actor.userId) ? new mongoose.Types.ObjectId(actor.userId) : undefined,
  byName: actor.userName,
  details,
});

async function loadFamily(id: string, actor: LifecycleActor, session?: ClientSession) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new HttpError(400, 'That family ID is not valid.', 'INVALID_ID');
  const family = await withSession(Family.findById(id), session);
  if (!family) throw new HttpError(404, 'We could not find that family.', 'FAMILY_NOT_FOUND');
  if (!actor.isSuperAdmin && actor.tenantId && String(family.tenantId) !== String(actor.tenantId)) {
    throw new HttpError(403, 'That family belongs to a different mahallu.', 'WRONG_TENANT');
  }
  return family;
}

async function deactivateUsers(memberIds: any[], session?: ClientSession) {
  if (!memberIds.length) return;
  await User.updateMany({ memberId: { $in: memberIds }, role: 'member' }, { $set: { status: 'inactive' } }, { session });
}
async function activateUsers(memberIds: any[], session?: ClientSession) {
  if (!memberIds.length) return;
  await User.updateMany({ memberId: { $in: memberIds }, role: 'member' }, { $set: { status: 'active' } }, { session });
}

/* ------------------------------------------------------------------ heads */

/** The living (not deleted, not deceased) head(s) of a family. More than one is a data error. */
export async function livingHeads(familyId: any, session?: ClientSession, excludeMemberId?: any) {
  const q: any = { familyId, isFamilyHead: true, ...LIVING_MEMBER };
  if (excludeMemberId) q._id = { $ne: excludeMemberId };
  return withSession(Member.find(q).select('name isFamilyHead'), session);
}

/**
 * Make `memberId` the single head of the family: demote any other head, mirror the name on the
 * family document and clear the "needs a new head" flag.
 */
export async function setFamilyHead(familyId: any, memberId: any, session?: ClientSession) {
  await Member.updateMany({ familyId, _id: { $ne: memberId }, isFamilyHead: true }, { $set: { isFamilyHead: false } }, { session });
  const m: any = await withSession(Member.findByIdAndUpdate(memberId, { $set: { isFamilyHead: true } }, { new: true }), session);
  await Family.updateOne(
    { _id: familyId },
    {
      $set: { familyHead: m?.name, ...(m?.nameMl ? { familyHeadMl: m.nameMl } : {}) },
      $unset: { needsHeadReassignment: '', needsHeadReason: '', needsHeadSince: '' },
    },
    { session }
  );
  return m;
}

/** Flag a family that has other living members but no living head. */
export async function flagHeadlessIfNeeded(familyId: any, reason: string, session?: ClientSession): Promise<boolean> {
  const [heads, others] = await Promise.all([
    livingHeads(familyId, session),
    withSession(Member.countDocuments({ familyId, ...LIVING_MEMBER }), session),
  ]);
  if (heads.length === 0 && others > 0) {
    await Family.updateOne(
      { _id: familyId },
      { $set: { needsHeadReassignment: true, needsHeadReason: reason, needsHeadSince: new Date() } },
      { session }
    );
    return true;
  }
  return false;
}

export async function appointFamilyHead(familyId: string, memberId: string, actor: LifecycleActor) {
  return withOptionalTransaction(async (session) => {
    const family = await loadFamily(familyId, actor, session);
    if (family.isArchived) throw new HttpError(409, 'This family is archived. Restore it before changing its head.', 'FAMILY_ARCHIVED');
    const member: any = await withSession(Member.findOne({ _id: memberId, familyId: family._id }), session);
    if (!member) throw new HttpError(404, 'That person is not a member of this family.', 'MEMBER_NOT_IN_FAMILY');
    if (member.isDead || member.status === 'deleted') {
      throw new HttpError(400, 'A deceased or removed member cannot be the family head.', 'INVALID_HEAD');
    }
    const previous = (await livingHeads(family._id, session)).map((h: any) => h.name);
    await setFamilyHead(family._id, member._id, session);
    await Family.updateOne(
      { _id: family._id },
      { $push: { lifecycleLog: logEntry('head_changed', actor, { newHead: member.name, previousHeads: previous }) } },
      { session }
    );
    return Family.findById(family._id).session(session || null);
  });
}

/* ------------------------------------------------------------ archive etc. */

export async function archiveInfo(familyId: string, actor: LifecycleActor) {
  const family = await loadFamily(familyId, actor);
  const [activeMembers, totalMembers] = await Promise.all([
    Member.find({ familyId: family._id, ...ACTIVE_MEMBER }).select('name mahallId').lean(),
    Member.countDocuments({ familyId: family._id, status: { $ne: 'deleted' } }),
  ]);
  let dueAmount = 0;
  try {
    const dues = await computeFamilyDues(String(family.tenantId));
    dueAmount = dues.find((d) => d.familyId === String(family._id))?.dueAmount || 0;
  } catch {
    // dues are advisory here; never block the lifecycle view on a dues failure
  }
  return { family, activeMembers, totalMembers, dueAmount };
}

export async function archiveFamily(
  familyId: string,
  actor: LifecycleActor,
  opts: { cascade?: boolean; force?: boolean; reason?: string }
) {
  const { family, activeMembers, dueAmount } = await archiveInfo(familyId, actor);
  if (family.isArchived) throw new HttpError(409, 'This family is already archived.', 'ALREADY_ARCHIVED');

  const blockers: string[] = [];
  if (activeMembers.length > 0 && !opts.cascade) blockers.push('FAMILY_HAS_ACTIVE_MEMBERS');
  if (dueAmount > 0 && !opts.force) blockers.push('FAMILY_HAS_DUES');
  if (blockers.length) {
    const parts: string[] = [];
    if (blockers.includes('FAMILY_HAS_ACTIVE_MEMBERS')) {
      parts.push(`${activeMembers.length} active member${activeMembers.length === 1 ? '' : 's'} (add cascade=true to archive them too)`);
    }
    if (blockers.includes('FAMILY_HAS_DUES')) parts.push(`unpaid dues of ${dueAmount} (add force=true to archive anyway)`);
    throw new HttpError(409, `This family can't be archived yet: it has ${parts.join(' and ')}.`, blockers[0], {
      blockers,
      activeMembers: activeMembers.length,
      members: activeMembers.slice(0, 20).map((m: any) => ({ id: String(m._id), name: m.name })),
      dueAmount,
    });
  }

  return withOptionalTransaction(async (session) => {
    let archivedMembers = 0;
    if (opts.cascade) {
      const toArchive: any[] = await withSession(Member.find({ familyId: family._id, status: { $ne: 'deleted' } }).select('_id status'), session);
      for (const m of toArchive) {
        await Member.updateOne({ _id: m._id }, { $set: { previousStatus: m.status, status: 'deleted', archivedWithFamilyId: family._id } }, { session });
      }
      await deactivateUsers(toArchive.map((m) => m._id), session);
      archivedMembers = toArchive.length;
    }
    const updated = await Family.findByIdAndUpdate(
      family._id,
      {
        $set: { isArchived: true, archivedAt: new Date(), archivedBy: actor.userId, archivedReason: opts.reason || undefined },
        $push: { lifecycleLog: logEntry('archived', actor, { reason: opts.reason, cascade: !!opts.cascade, forced: !!opts.force, archivedMembers, dueAmount }) },
      },
      { new: true, session }
    );
    return { family: updated, archivedMembers, dueAmount };
  });
}

export async function restoreFamily(familyId: string, actor: LifecycleActor) {
  const family = await loadFamily(familyId, actor);
  if (!family.isArchived) throw new HttpError(409, 'This family is not archived.', 'NOT_ARCHIVED');
  if (family.mergedIntoFamilyId) {
    throw new HttpError(409, 'This family was merged into another one. Use "split" on the other family to separate members again.', 'FAMILY_MERGED');
  }
  return withOptionalTransaction(async (session) => {
    const members: any[] = await withSession(Member.find({ archivedWithFamilyId: family._id }).select('_id previousStatus'), session);
    for (const m of members) {
      await Member.updateOne(
        { _id: m._id },
        { $set: { status: m.previousStatus || 'active' }, $unset: { archivedWithFamilyId: '', previousStatus: '' } },
        { session }
      );
    }
    await activateUsers(members.filter((m) => (m.previousStatus || 'active') === 'active').map((m) => m._id), session);
    const restored = await Family.findByIdAndUpdate(
      family._id,
      {
        $unset: { isArchived: '', archivedAt: '', archivedBy: '', archivedReason: '' },
        $push: { lifecycleLog: logEntry('restored', actor, { restoredMembers: members.length }) },
      },
      { new: true, session }
    );
    return { family: restored, restoredMembers: members.length };
  });
}

/** Permanent delete: super_admin only, and only for a family that is already archived. */
export async function hardDeleteFamily(familyId: string, actor: LifecycleActor) {
  if (!actor.isSuperAdmin) throw new HttpError(403, 'Only a platform administrator can permanently delete a family.', 'SUPER_ADMIN_ONLY');
  const family = await loadFamily(familyId, actor);
  if (!family.isArchived) throw new HttpError(409, 'Archive this family first; only archived families can be permanently deleted.', 'NOT_ARCHIVED');
  await Family.deleteOne({ _id: family._id });
  return family;
}

/* ------------------------------------------------------------ transfer */

async function moveMember(
  member: any,
  toFamily: any,
  opts: { makeHead?: boolean },
  session?: ClientSession
): Promise<{ oldMahallId?: string; newMahallId?: string; wasHead: boolean }> {
  const wasHead = !!member.isFamilyHead;
  const oldMahallId = member.mahallId;
  const newMahallId = await nextMemberMahallId(toFamily, session);
  await Member.updateOne(
    { _id: member._id },
    { $set: { familyId: toFamily._id, familyName: toFamily.houseName, isFamilyHead: false, ...(newMahallId ? { mahallId: newMahallId } : {}) } },
    { session }
  );
  if (opts.makeHead) await setFamilyHead(toFamily._id, member._id, session);
  return { oldMahallId, newMahallId, wasHead };
}

export async function transferMember(memberId: string, toFamilyId: string, actor: LifecycleActor, opts: { makeHead?: boolean } = {}) {
  if (!mongoose.Types.ObjectId.isValid(memberId)) throw new HttpError(400, 'That member ID is not valid.', 'INVALID_ID');
  return withOptionalTransaction(async (session) => {
    const member: any = await withSession(Member.findById(memberId), session);
    if (!member) throw new HttpError(404, 'We could not find that member.', 'MEMBER_NOT_FOUND');
    if (!actor.isSuperAdmin && actor.tenantId && String(member.tenantId) !== String(actor.tenantId)) {
      throw new HttpError(403, 'That member belongs to a different mahallu.', 'WRONG_TENANT');
    }
    const toFamily: any = await loadFamily(toFamilyId, actor, session);
    if (String(toFamily.tenantId) !== String(member.tenantId)) {
      throw new HttpError(400, 'Members can only move between families of the same mahallu.', 'CROSS_TENANT');
    }
    if (toFamily.isArchived) throw new HttpError(409, 'The destination family is archived. Restore it first.', 'FAMILY_ARCHIVED');
    if (String(member.familyId) === String(toFamily._id)) throw new HttpError(400, 'This member already belongs to that family.', 'SAME_FAMILY');
    if (member.status === 'deleted') throw new HttpError(400, 'A removed member cannot be moved. Restore the member first.', 'MEMBER_DELETED');
    if (opts.makeHead && (member.isDead || member.status !== 'active')) {
      throw new HttpError(400, 'Only an active, living member can become the family head.', 'INVALID_HEAD');
    }

    const fromFamilyId = member.familyId;
    const moved = await moveMember(member, toFamily, opts, session);

    let sourceNeedsHead = false;
    if (moved.wasHead) {
      sourceNeedsHead = await flagHeadlessIfNeeded(fromFamilyId, `${member.name} (the family head) moved to ${toFamily.houseName}`, session);
    }
    const detail = { memberId: String(member._id), memberName: member.name, oldMahallId: moved.oldMahallId, newMahallId: moved.newMahallId };
    await Family.updateOne({ _id: fromFamilyId }, { $push: { lifecycleLog: logEntry('member_left', actor, { ...detail, toFamilyId: String(toFamily._id), toHouseName: toFamily.houseName }) } }, { session });
    await Family.updateOne({ _id: toFamily._id }, { $push: { lifecycleLog: logEntry('member_joined', actor, { ...detail, fromFamilyId: String(fromFamilyId), madeHead: !!opts.makeHead }) } }, { session });

    const updated = await Member.findById(member._id).populate('familyId', 'houseName mahallId').session(session || null);
    return { member: updated, sourceFamilyId: String(fromFamilyId), sourceNeedsHead, newMahallId: moved.newMahallId };
  });
}

/* ------------------------------------------------------------ merge */

export async function mergePreview(sourceId: string, targetId: string, actor: LifecycleActor) {
  const source = await loadFamily(sourceId, actor);
  const target = await loadFamily(targetId, actor);
  if (String(source._id) === String(target._id)) throw new HttpError(400, 'Pick a different family to merge into.', 'SAME_FAMILY');
  if (String(source.tenantId) !== String(target.tenantId)) throw new HttpError(400, 'Families can only be merged within one mahallu.', 'CROSS_TENANT');
  const [members, tHeads] = await Promise.all([
    Member.find({ familyId: source._id, status: { $ne: 'deleted' } }).select('name isFamilyHead isDead status').lean(),
    livingHeads(target._id),
  ]);
  const references: Record<string, number> = {};
  for (const name of REPOINT_MODELS) {
    const model = mongoose.models[name];
    if (model && model.schema.path('familyId')) references[name] = await model.countDocuments({ familyId: source._id });
  }
  const sourceHeads = members.filter((m: any) => m.isFamilyHead && !m.isDead);
  return {
    source: { id: String(source._id), houseName: source.houseName, mahallId: source.mahallId, familyHead: source.familyHead },
    target: { id: String(target._id), houseName: target.houseName, mahallId: target.mahallId, familyHead: target.familyHead },
    members: members.map((m: any) => ({ id: String(m._id), name: m.name, isFamilyHead: !!m.isFamilyHead, isDead: !!m.isDead, status: m.status })),
    references: Object.fromEntries(Object.entries(references).filter(([, n]) => n > 0)),
    headOutcome:
      tHeads.length > 0
        ? { keep: tHeads[0].name, demoted: sourceHeads.map((m: any) => m.name) }
        : sourceHeads.length > 0
          ? { keep: sourceHeads[0].name, demoted: [] }
          : { keep: null, demoted: [], note: 'Neither family has a living head; the merged family will be flagged to pick one.' },
    willBeArchived: true,
  };
}

export async function mergeFamilies(sourceId: string, intoFamilyId: string, actor: LifecycleActor) {
  return withOptionalTransaction(async (session) => {
    const source: any = await loadFamily(sourceId, actor, session);
    const target: any = await loadFamily(intoFamilyId, actor, session);
    if (String(source._id) === String(target._id)) throw new HttpError(400, 'Pick a different family to merge into.', 'SAME_FAMILY');
    if (String(source.tenantId) !== String(target.tenantId)) throw new HttpError(400, 'Families can only be merged within one mahallu.', 'CROSS_TENANT');
    if (source.isArchived) throw new HttpError(409, 'The family you are merging is already archived.', 'FAMILY_ARCHIVED');
    if (target.isArchived) throw new HttpError(409, 'The family you are merging into is archived. Restore it first.', 'FAMILY_ARCHIVED');

    const targetHeads = await livingHeads(target._id, session);
    const members: any[] = await withSession(Member.find({ familyId: source._id }).select('_id name isFamilyHead isDead status mahallId').sort({ createdAt: 1 }), session);

    // 1) members, in order, each with a fresh id in the target family
    let promoted: any = null;
    for (const m of members) {
      const newMahallId = await nextMemberMahallId(target, session);
      await Member.updateOne(
        { _id: m._id },
        { $set: { familyId: target._id, familyName: target.houseName, ...(newMahallId ? { mahallId: newMahallId } : {}) } },
        { session }
      );
    }
    // 2) exactly one head: keep the target's; otherwise take the source's living head
    const movedHeads = members.filter((m) => m.isFamilyHead && !m.isDead && m.status !== 'deleted');
    if (targetHeads.length > 0) {
      await Member.updateMany({ _id: { $in: movedHeads.map((m) => m._id) } }, { $set: { isFamilyHead: false } }, { session });
    } else if (movedHeads.length > 0) {
      promoted = movedHeads[0];
      await setFamilyHead(target._id, promoted._id, session);
    } else {
      await flagHeadlessIfNeeded(target._id, `Merged ${source.houseName} into ${target.houseName}; no living head`, session);
    }
    // deceased heads keep no head flag
    await Member.updateMany({ familyId: target._id, isDead: true, isFamilyHead: true }, { $set: { isFamilyHead: false } }, { session });

    // 3) payments / welfare / ... that carry a familyId follow the members
    const repointed: Record<string, number> = {};
    for (const name of REPOINT_MODELS) {
      const model = mongoose.models[name];
      if (!model || !model.schema.path('familyId')) continue;
      const r = await model.updateMany({ familyId: source._id }, { $set: { familyId: target._id } }, { session });
      if (r.modifiedCount) repointed[name] = r.modifiedCount;
    }

    const Wallet = mongoose.models.Wallet;
    if (Wallet) {
      const srcWallets: any[] = await withSession(Wallet.find({ familyId: source._id, memberId: { $in: [null, undefined] } }), session);
      for (const sw of srcWallets) {
        const tw: any = await withSession(Wallet.findOne({ familyId: target._id, memberId: { $in: [null, undefined] } }), session);
        if (tw) {
          await Wallet.updateOne({ _id: tw._id }, { $inc: { balance: sw.balance || 0 } }, { session });
          await Wallet.deleteOne({ _id: sw._id }, { session });
        } else {
          await Wallet.updateOne({ _id: sw._id }, { $set: { familyId: target._id } }, { session });
        }
        repointed.Wallet = (repointed.Wallet || 0) + 1;
      }
    }

    // 4) archive the source and write the audit trail on both
    const summary = {
      members: members.length,
      repointed,
      sourceMahallId: source.mahallId,
      targetMahallId: target.mahallId,
    };
    await Family.updateOne(
      { _id: source._id },
      {
        $set: {
          isArchived: true,
          archivedAt: new Date(),
          archivedBy: actor.userId,
          archivedReason: `Merged into ${target.houseName} (${target.mahallId || target._id})`,
          mergedIntoFamilyId: target._id,
        },
        $unset: { needsHeadReassignment: '', needsHeadReason: '', needsHeadSince: '' },
        $push: { lifecycleLog: logEntry('merged_into', actor, { ...summary, intoFamilyId: String(target._id), intoHouseName: target.houseName }) },
      },
      { session }
    );
    await Family.updateOne(
      { _id: target._id },
      { $push: { lifecycleLog: logEntry('merged_from', actor, { ...summary, fromFamilyId: String(source._id), fromHouseName: source.houseName }) } },
      { session }
    );
    return { target: await Family.findById(target._id).session(session || null), movedMembers: members.length, repointed, newHead: promoted?.name || null };
  });
}

/* ------------------------------------------------------------ split */

export async function splitFamily(
  sourceId: string,
  actor: LifecycleActor,
  input: { memberIds: string[]; newHouseName: string; newFamilyHeadId?: string; contactNo?: string }
) {
  const { memberIds, newHouseName, newFamilyHeadId } = input;
  if (!Array.isArray(memberIds) || memberIds.length === 0) throw new HttpError(400, 'Choose at least one member to move to the new family.', 'NO_MEMBERS');
  if (!newHouseName || !String(newHouseName).trim()) throw new HttpError(400, 'Give the new family a house name.', 'NO_HOUSE_NAME');
  const ids = Array.from(new Set(memberIds.map(String)));
  if (ids.some((i) => !mongoose.Types.ObjectId.isValid(i))) throw new HttpError(400, 'One of the member IDs is not valid.', 'INVALID_ID');
  if (newFamilyHeadId && !ids.includes(String(newFamilyHeadId))) {
    throw new HttpError(400, 'The new family head must be one of the members you are moving.', 'HEAD_NOT_MOVING');
  }

  return withOptionalTransaction(async (session) => {
    const source: any = await loadFamily(sourceId, actor, session);
    if (source.isArchived) throw new HttpError(409, 'This family is archived. Restore it before splitting.', 'FAMILY_ARCHIVED');
    const moving: any[] = await withSession(Member.find({ _id: { $in: ids }, familyId: source._id, status: { $ne: 'deleted' } }), session);
    if (moving.length !== ids.length) {
      throw new HttpError(400, 'Some of the chosen members do not belong to this family (or were removed).', 'MEMBER_NOT_IN_FAMILY');
    }
    const staying = await withSession(Member.countDocuments({ familyId: source._id, _id: { $nin: ids }, status: { $ne: 'deleted' } }), session);
    if (staying === 0) {
      throw new HttpError(400, 'Leave at least one member in the original family. To move everyone, use "merge" instead.', 'NOTHING_LEFT');
    }
    if (newFamilyHeadId) {
      const h = moving.find((m) => String(m._id) === String(newFamilyHeadId));
      if (h.isDead || h.status !== 'active') throw new HttpError(400, 'The new family head must be an active, living member.', 'INVALID_HEAD');
    }

    const mahallId = await nextFamilyMahallId(source.tenantId, session);
    const headMember = newFamilyHeadId ? moving.find((m) => String(m._id) === String(newFamilyHeadId)) : undefined;
    const [created] = await Family.create(
      [
        {
          tenantId: source.tenantId,
          mahallId,
          houseName: String(newHouseName).trim(),
          familyHead: headMember?.name,
          familyHeadMl: headMember?.nameMl,
          contactNo: input.contactNo || headMember?.phone || undefined,
          wardNumber: source.wardNumber,
          area: source.area,
          areaMl: source.areaMl,
          place: source.place,
          placeMl: source.placeMl,
          varisangyaGrade: source.varisangyaGrade,
          clusterId: source.clusterId,
          status: source.status,
          lifecycleLog: [logEntry('created_by_split', actor, { fromFamilyId: String(source._id), fromHouseName: source.houseName, members: moving.length })],
        },
      ],
      { session }
    );

    const sourceHeadMoved = moving.some((m) => m.isFamilyHead && !m.isDead);
    for (const m of moving) {
      const newMahallId = await nextMemberMahallId(created, session);
      await Member.updateOne(
        { _id: m._id },
        { $set: { familyId: created._id, familyName: created.houseName, isFamilyHead: false, ...(newMahallId ? { mahallId: newMahallId } : {}) } },
        { session }
      );
    }
    if (headMember) await setFamilyHead(created._id, headMember._id, session);
    else await flagHeadlessIfNeeded(created._id, 'This family was split from another family and needs a head', session);
    if (sourceHeadMoved) await flagHeadlessIfNeeded(source._id, `The family head moved to ${created.houseName}`, session);

    await Family.updateOne(
      { _id: source._id },
      { $push: { lifecycleLog: logEntry('split', actor, { newFamilyId: String(created._id), newHouseName: created.houseName, members: moving.map((m) => ({ id: String(m._id), name: m.name })) }) } },
      { session }
    );
    return {
      newFamily: await Family.findById(created._id).session(session || null),
      movedMembers: moving.length,
      sourceNeedsHead: sourceHeadMoved && (await withSession(Family.findById(source._id).select('needsHeadReassignment'), session) as any)?.needsHeadReassignment === true,
    };
  });
}

/* ------------------------------------------------------------ attention */

/** Lightweight "needs attention" feed for families. Dashboards can call this or read the same field. */
export async function familiesNeedingAttention(tenantId: any) {
  const flagged = await Family.find({ tenantId, ...ACTIVE_FAMILY_FILTER, needsHeadReassignment: true })
    .select('houseName mahallId familyHead needsHeadReason needsHeadSince')
    .sort({ needsHeadSince: -1 })
    .lean();
  return {
    needsNewHead: flagged.map((f: any) => ({
      id: String(f._id),
      houseName: f.houseName,
      mahallId: f.mahallId,
      formerHead: f.familyHead,
      reason: f.needsHeadReason,
      since: f.needsHeadSince,
    })),
    counts: { needsNewHead: flagged.length },
  };
}

/** Ids of archived families for a tenant (used to hide their members from member lists). */
export async function archivedFamilyIds(tenantId: any): Promise<any[]> {
  const rows = await Family.find({ ...(tenantId ? { tenantId } : {}), isArchived: true }).select('_id').lean();
  return rows.map((r: any) => r._id);
}
