import mongoose from 'mongoose';
import Member from '../models/Member';
import Family from '../models/Family';
import User from '../models/User';
import { NikahRegistration, DeathRegistration } from '../models/Registration';
import { GraveRecord } from '../models/Cemetery';
import { nextSequence } from './counterService';
import { nextFamilyMahallId } from './idService';
import { transferMember, flagHeadlessIfNeeded, setFamilyHead, livingHeads, LifecycleActor } from './familyLifecycleService';
import { normalizeName } from '../utils/text';
import { HttpError } from '../utils/transaction';

/**
 * Registration side effects. ONE implementation used by every path that can approve a registration:
 *   - admin create (POST /registrations/death|nikah with status 'approved', or no status for death)
 *   - admin approval of a member-portal request (PUT /registrations/death|nikah/:id)
 *   - delete of a registration (rolls back)
 *
 * Rules:
 *   - effects run only for status === 'approved'
 *   - idempotent: `effectsApplied` is claimed atomically, so approving twice changes nothing twice
 *   - reversible: a snapshot of every value we changed is stored in `effects`; rollback restores a value
 *     only if the registration was the cause (the member was alive before, the spouse had not been
 *     marked by someone else, ...) and only if nobody has changed it since
 */

export interface PreviewEffect {
  kind: string;
  memberId?: string;
  memberName?: string;
  message: string;
}
export interface Preview {
  effects: PreviewEffect[];
  warnings: string[];
  suggestions?: Record<string, any>;
}

const oid = (v: any) => (v && mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : undefined);
const same = (a: any, b: any) => String(a ?? '') === String(b ?? '');
const oppositeGender = (g?: string) => (g === 'male' ? 'female' : g === 'female' ? 'male' : undefined);

/* =========================================================== DEATH */

interface DeathContext {
  member: any | null;
  family: any | null;
  wasHead: boolean;
  spouses: any[];
  spouseSource?: 'explicit' | 'linked' | 'guessed';
  spouseCandidates: any[]; // ambiguous: not applied automatically
  grave: any | null;
  graveSuggestions: any[];
}

async function resolveDeathMember(tenantId: any, reg: any) {
  if (reg.deceasedId && mongoose.Types.ObjectId.isValid(String(reg.deceasedId))) {
    const m = await Member.findOne({ _id: reg.deceasedId, tenantId });
    if (m) return m;
  }
  // No id: only accept an unambiguous match inside the named family
  if (reg.familyId && reg.deceasedName) {
    const rows = await Member.find({ tenantId, familyId: reg.familyId, status: { $ne: 'deleted' }, isDead: { $ne: true } });
    const n = normalizeName(reg.deceasedName);
    const hits = rows.filter((r: any) => normalizeName(r.name) === n);
    if (hits.length === 1) return hits[0];
  }
  return null;
}

async function resolveDeathContext(tenantId: any, reg: any): Promise<DeathContext> {
  const member = await resolveDeathMember(tenantId, reg);
  const ctx: DeathContext = { member, family: null, wasHead: false, spouses: [], spouseCandidates: [], grave: null, graveSuggestions: [] };
  if (!member) return ctx;
  ctx.family = await Family.findById(member.familyId);
  ctx.wasHead = !!member.isFamilyHead;

  const explicit = reg.spouseMemberId ? await Member.findOne({ _id: reg.spouseMemberId, tenantId }) : null;
  const linked = !explicit && member.spouseId ? await Member.findOne({ _id: member.spouseId, tenantId }) : null;
  if (explicit) {
    ctx.spouses = [explicit];
    ctx.spouseSource = 'explicit';
  } else if (linked) {
    ctx.spouses = [linked];
    ctx.spouseSource = 'linked';
  } else {
    // Heuristic: married, same family, opposite gender, alive. Exactly one => use; several => ask.
    // (A married son's wife in the same house is also "married + opposite gender", so never guess among several.)
    const opp = oppositeGender(member.gender);
    const cand = await Member.find({
      tenantId,
      familyId: member.familyId,
      _id: { $ne: member._id },
      maritalStatus: 'married',
      status: { $ne: 'deleted' },
      isDead: { $ne: true },
      ...(opp ? { gender: opp } : {}),
    });
    if (cand.length === 1) {
      ctx.spouses = cand;
      ctx.spouseSource = 'guessed';
    } else if (cand.length > 1) {
      ctx.spouseCandidates = cand;
    }
  }

  const graveId = reg.graveId || reg.graveRecordId;
  if (graveId) ctx.grave = await GraveRecord.findOne({ _id: graveId, tenantId });
  else {
    ctx.graveSuggestions = await GraveRecord.find({
      tenantId,
      $or: [{ deceasedMemberId: member._id }, { deceasedName: new RegExp(`^\\s*${normalizeName(member.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}\\s*$`, 'i') }],
    })
      .populate('cemeteryId', 'name')
      .limit(5);
  }
  return ctx;
}

export async function previewDeath(tenantId: any, reg: any): Promise<Preview> {
  const ctx = await resolveDeathContext(tenantId, reg);
  const effects: PreviewEffect[] = [];
  const warnings: string[] = [];
  if (!ctx.member) {
    warnings.push('No member is linked to this registration, so no member record will change. Pick the member to link it.');
    return { effects, warnings };
  }
  const m = ctx.member;
  if (m.isDead) {
    warnings.push(`${m.name} is already marked as deceased, so nothing about the member will change.`);
  } else {
    effects.push({ kind: 'member_deceased', memberId: String(m._id), memberName: m.name, message: `${m.name} will be marked as deceased and made inactive (the record is kept).` });
    if (ctx.wasHead) {
      effects.push({ kind: 'head_vacant', memberId: String(m._id), memberName: m.name, message: `${m.name} is the head of ${ctx.family?.houseName || 'the family'}. The family will be flagged so you can choose a new head.` });
    }
    for (const s of ctx.spouses) {
      if (s.maritalStatus === 'widowed') continue;
      const word = s.gender === 'male' ? 'widower' : 'widow';
      effects.push({ kind: 'spouse_widowed', memberId: String(s._id), memberName: s.name, message: `${s.name} will be marked as a ${word}${ctx.spouseSource === 'guessed' ? ' (we matched them as the only married member of the opposite gender in this family)' : ''}.` });
    }
    if (ctx.spouseCandidates.length) {
      warnings.push(`We could not tell who ${m.name}'s spouse is (${ctx.spouseCandidates.map((c: any) => c.name).join(', ')}). Choose the spouse to mark them as widowed.`);
    }
  }
  if (ctx.grave) effects.push({ kind: 'grave_link', message: `Grave record ${ctx.grave.graveNo} will be linked to ${m.name}.` });
  const suggestions: Record<string, any> = {};
  if (!ctx.grave && ctx.graveSuggestions.length) {
    suggestions.graves = ctx.graveSuggestions.map((g: any) => ({ id: String(g._id), graveNo: g.graveNo, cemetery: g.cemeteryId?.name, deceasedName: g.deceasedName }));
  }
  if (ctx.spouseCandidates.length) {
    suggestions.spouseCandidates = ctx.spouseCandidates.map((c: any) => ({ id: String(c._id), name: c.name, gender: c.gender }));
  }
  return { effects, warnings, suggestions };
}

const deathKey = (reg: any) => JSON.stringify([String(reg.deceasedId || ''), String(reg.deathDate || ''), String(reg.graveId || reg.graveRecordId || ''), String(reg.spouseMemberId || '')]);

async function applyDeath(reg: any, actor: LifecycleActor) {
  const ctx = await resolveDeathContext(reg.tenantId, reg);
  const effects: Record<string, any> = { inputsKey: deathKey(reg), appliedAt: new Date(), appliedBy: actor.userName };
  const m = ctx.member;
  if (!m) {
    effects.note = 'No member linked; nothing changed';
    return { effects, previousStatus: undefined as string | undefined };
  }
  effects.memberId = String(m._id);
  if (!m.isDead) {
    const user: any = await User.findOne({ memberId: m._id, role: 'member' }).select('status');
    effects.member = {
      changed: true,
      prev: { isDead: !!m.isDead, status: m.status, isFamilyHead: !!m.isFamilyHead, deathDate: m.deathDate || null },
      userPrevStatus: user?.status ?? null,
    };
    await Member.updateOne(
      { _id: m._id },
      { $set: { isDead: true, status: m.status === 'deleted' ? 'deleted' : 'inactive', deathDate: reg.deathDate, ...(ctx.wasHead ? { isFamilyHead: false } : {}) } }
    );
    if (user && user.status !== 'inactive') await User.updateOne({ _id: user._id }, { $set: { status: 'inactive' } });

    if (ctx.wasHead && ctx.family) {
      effects.family = { id: String(ctx.family._id), flagged: true, prevFlag: !!ctx.family.needsHeadReassignment };
      await Family.updateOne(
        { _id: ctx.family._id },
        { $set: { needsHeadReassignment: true, needsHeadReason: `${m.name}, the family head, passed away`, needsHeadSince: new Date() } }
      );
    }
    effects.spouses = [];
    for (const s of ctx.spouses) {
      if (s.maritalStatus === 'widowed') continue;
      effects.spouses.push({ id: String(s._id), prev: { maritalStatus: s.maritalStatus ?? null, isWidow: !!s.isWidow } });
      // A woman whose husband died is a widow (isWidow drives welfare lists); a man whose wife died is a widower:
      // we set maritalStatus 'widowed' and leave isWidow, which is widow-specific, untouched.
      await Member.updateOne({ _id: s._id }, { $set: { maritalStatus: 'widowed', ...(s.gender === 'female' ? { isWidow: true } : {}) } });
    }
  } else {
    effects.member = { changed: false };
  }
  if (ctx.grave) {
    effects.grave = {
      id: String(ctx.grave._id),
      prev: { deceasedMemberId: ctx.grave.deceasedMemberId || null, familyId: ctx.grave.familyId || null, dateOfDeath: ctx.grave.dateOfDeath || null },
    };
    await GraveRecord.updateOne(
      { _id: ctx.grave._id },
      { $set: { deceasedMemberId: m._id, familyId: ctx.grave.familyId || m.familyId, dateOfDeath: ctx.grave.dateOfDeath || reg.deathDate } }
    );
  }
  return { effects, previousStatus: effects.member?.prev?.status as string | undefined };
}

async function rollbackDeath(reg: any) {
  const e = reg.effects || {};
  const notes: string[] = [];
  if (e.member?.changed && e.memberId) {
    const m: any = await Member.findById(e.memberId);
    if (m && m.isDead) {
      const prev = e.member.prev;
      const set: any = { isDead: prev.isDead, status: prev.status };
      const unset: any = {};
      if (prev.deathDate) set.deathDate = prev.deathDate;
      else unset.deathDate = '';
      // restore the head flag only if nobody else has become head in the meantime
      if (prev.isFamilyHead) {
        const others = await livingHeads(m.familyId, undefined, m._id);
        if (others.length === 0) set.isFamilyHead = true;
        else notes.push(`${m.name} is no longer the family head because ${others[0].name} was appointed.`);
      }
      await Member.updateOne({ _id: m._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
      if (prev.isFamilyHead && set.isFamilyHead) await setFamilyHead(m.familyId, m._id);
      if (e.member.userPrevStatus === 'active') await User.updateOne({ memberId: m._id, role: 'member' }, { $set: { status: 'active' } });
    }
  }
  if (e.family?.flagged && !e.family.prevFlag) {
    const heads = await livingHeads(e.family.id);
    if (heads.length > 0) {
      await Family.updateOne({ _id: e.family.id }, { $unset: { needsHeadReassignment: '', needsHeadReason: '', needsHeadSince: '' } });
    }
  }
  for (const s of e.spouses || []) {
    const sp: any = await Member.findById(s.id);
    if (sp && sp.maritalStatus === 'widowed') {
      await Member.updateOne({ _id: s.id }, { $set: { maritalStatus: s.prev.maritalStatus || undefined, isWidow: s.prev.isWidow } });
      if (!s.prev.maritalStatus) await Member.updateOne({ _id: s.id }, { $unset: { maritalStatus: '' } });
    }
  }
  if (e.grave?.id) {
    const g: any = await GraveRecord.findById(e.grave.id);
    if (g && same(g.deceasedMemberId, e.memberId)) {
      await GraveRecord.updateOne(
        { _id: g._id },
        e.grave.prev.deceasedMemberId
          ? { $set: { deceasedMemberId: e.grave.prev.deceasedMemberId } }
          : { $unset: { deceasedMemberId: '' } }
      );
    }
  }
  return notes;
}

/* =========================================================== NIKAH */

interface NikahContext {
  groom: any | null;
  bride: any | null;
  groomFamily: any | null;
  brideFamily: any | null;
  action: 'stay' | 'move' | 'newFamily';
  notes: string[];
}

async function resolveNikahMember(tenantId: any, id: any, name: string | undefined, gender: 'male' | 'female') {
  if (id && mongoose.Types.ObjectId.isValid(String(id))) {
    const m = await Member.findOne({ _id: id, tenantId, status: { $ne: 'deleted' } });
    if (m) return m;
  }
  if (!id && name) {
    const n = normalizeName(name);
    const rows = await Member.find({ tenantId, status: 'active', isDead: { $ne: true }, $or: [{ gender }, { gender: { $exists: false } }] }).select('name gender familyId maritalStatus');
    const hits = rows.filter((r: any) => normalizeName(r.name) === n);
    if (hits.length === 1) return Member.findById(hits[0]._id);
  }
  return null;
}

async function resolveNikahContext(tenantId: any, reg: any): Promise<NikahContext> {
  const groom = await resolveNikahMember(tenantId, reg.groomId, reg.groomName, 'male');
  const bride = await resolveNikahMember(tenantId, reg.brideId, reg.brideName, 'female');
  const notes: string[] = [];
  const action = (reg.brideFamilyAction as any) || 'stay';
  if ((action === 'move' || action === 'newFamily') && !bride) notes.push('The bride is not a member of this mahallu, so no one can be moved.');
  if (action === 'move' && bride && !groom) notes.push('The groom is not a member of this mahallu, so there is no family to move the bride into.');
  return {
    groom,
    bride,
    groomFamily: groom ? await Family.findById(groom.familyId) : null,
    brideFamily: bride ? await Family.findById(bride.familyId) : null,
    action,
    notes,
  };
}

const alreadyMarriedTo = (m: any, other: any) => m && other && m.maritalStatus === 'married' && same(m.spouseId, other._id);

export async function previewNikah(tenantId: any, reg: any): Promise<Preview> {
  const ctx = await resolveNikahContext(tenantId, reg);
  const effects: PreviewEffect[] = [];
  const warnings: string[] = [...ctx.notes];
  if (!ctx.groom && !ctx.bride) {
    warnings.push('Neither the groom nor the bride is a member of this mahallu, so no member records will change.');
    return { effects, warnings };
  }
  for (const [role, m, other] of [['groom', ctx.groom, ctx.bride], ['bride', ctx.bride, ctx.groom]] as const) {
    if (!m) continue;
    if (alreadyMarriedTo(m, other)) {
      warnings.push(`${m.name} is already recorded as married to ${other.name}.`);
      continue;
    }
    effects.push({
      kind: 'member_married',
      memberId: String(m._id),
      memberName: m.name,
      message: `${m.name} (${role}) will be marked as married${other ? ` and linked to ${other.name}` : ''}, and removed from the marriageable list.`,
    });
  }
  if (ctx.bride && ctx.action === 'move' && ctx.groom) {
    if (same(ctx.bride.familyId, ctx.groom.familyId)) warnings.push('The bride and groom are already in the same family.');
    else effects.push({ kind: 'bride_move', memberId: String(ctx.bride._id), memberName: ctx.bride.name, message: `${ctx.bride.name} will move from ${ctx.brideFamily?.houseName} to ${ctx.groomFamily?.houseName}.` });
  }
  if (ctx.bride && ctx.action === 'newFamily') {
    effects.push({
      kind: 'new_family',
      message: `A new family "${reg.newFamilyHouseName || (ctx.groom ? `${ctx.groom.name}'s family` : `${ctx.bride.name}'s family`)}" will be created for ${ctx.groom ? `${ctx.groom.name} and ${ctx.bride.name}` : ctx.bride.name}.`,
    });
  }
  if (ctx.action === 'stay') effects.push({ kind: 'no_move', message: 'Nobody will change family (the default). You can choose to move the bride on the nikah form.' });
  return { effects, warnings };
}

const nikahKey = (reg: any) => JSON.stringify([String(reg.groomId || ''), String(reg.brideId || ''), reg.brideFamilyAction || 'stay', reg.newFamilyHouseName || '']);

async function applyNikah(reg: any, actor: LifecycleActor) {
  const partial: Record<string, any> = { moves: [] as any[], members: [] as any[] };
  try {
    return await applyNikahInner(reg, actor, partial);
  } catch (err) {
    // undo whatever was already done so a failed approval leaves nothing half-applied
    try { await rollbackNikah({ effects: partial }, actor); } catch { /* best effort */ }
    throw err;
  }
}

async function applyNikahInner(reg: any, actor: LifecycleActor, partial: Record<string, any>) {
  const ctx = await resolveNikahContext(reg.tenantId, reg);
  const effects: Record<string, any> = partial;
  Object.assign(effects, { inputsKey: nikahKey(reg), appliedAt: new Date(), appliedBy: actor.userName });

  // 1) movement first: it is the part most likely to be rejected by validation
  if (ctx.bride && ctx.action === 'move' && ctx.groom && !same(ctx.bride.familyId, ctx.groom.familyId)) {
    const from = ctx.bride.familyId;
    const r = await transferMember(String(ctx.bride._id), String(ctx.groom.familyId), actor, { makeHead: false });
    effects.moves.push({ memberId: String(ctx.bride._id), fromFamilyId: String(from), toFamilyId: String(ctx.groom.familyId), wasHead: !!ctx.bride.isFamilyHead, oldMahallId: ctx.bride.mahallId, newMahallId: r.newMahallId });
  }
  if (ctx.bride && ctx.action === 'newFamily') {
    const mahallId = await nextFamilyMahallId(reg.tenantId);
    const houseName = reg.newFamilyHouseName || (ctx.groom ? `${ctx.groom.name}'s family` : `${ctx.bride.name}'s family`);
    const newFamily: any = await Family.create({
      tenantId: reg.tenantId,
      mahallId,
      houseName,
      status: 'approved',
      area: ctx.groomFamily?.area || ctx.brideFamily?.area,
      place: ctx.groomFamily?.place || ctx.brideFamily?.place,
      wardNumber: ctx.groomFamily?.wardNumber || ctx.brideFamily?.wardNumber,
      varisangyaGrade: ctx.groomFamily?.varisangyaGrade,
      lifecycleLog: [{ action: 'created_by_nikah', at: new Date(), byName: actor.userName, details: { nikahRegistrationId: String(reg._id) } }],
    });
    effects.createdFamilyId = String(newFamily._id);
    partial.createdFamilyId = effects.createdFamilyId;
    for (const [m, head] of [[ctx.groom, true], [ctx.bride, !ctx.groom]] as const) {
      if (!m) continue;
      const from = m.familyId;
      const r = await transferMember(String(m._id), String(newFamily._id), actor, { makeHead: head });
      effects.moves.push({ memberId: String(m._id), fromFamilyId: String(from), toFamilyId: String(newFamily._id), wasHead: !!m.isFamilyHead, oldMahallId: m.mahallId, newMahallId: r.newMahallId });
    }
  }

  // 2) marital status, marriageable flag, spouse links
  for (const [m, other] of [[ctx.groom, ctx.bride], [ctx.bride, ctx.groom]] as const) {
    if (!m) continue;
    const fresh: any = await Member.findById(m._id);
    if (alreadyMarriedTo(fresh, other)) continue;
    const prev = { maritalStatus: fresh.maritalStatus ?? null, isMarriageable: !!fresh.isMarriageable, spouseId: fresh.spouseId ?? null, marriageCount: fresh.marriageCount ?? 0, isWidow: !!fresh.isWidow };
    const set: any = { maritalStatus: 'married', isMarriageable: false, marriageCount: (fresh.marriageCount || 0) + 1, isWidow: false };
    // a man may already have a spouse link (polygyny); keep the first, the new wife still links to him
    if (other && !fresh.spouseId) set.spouseId = other._id;
    if (other && other.gender === 'female' && fresh.gender === 'female') delete set.spouseId; // defensive
    await Member.updateOne({ _id: fresh._id }, { $set: set });
    effects.members.push({ id: String(fresh._id), prev, setSpouseId: set.spouseId ? String(set.spouseId) : null });
  }
  return { effects, previousStatus: undefined as string | undefined };
}

async function rollbackNikah(reg: any, actor: LifecycleActor) {
  const e = reg.effects || {};
  const notes: string[] = [];
  for (const mv of [...(e.moves || [])].reverse()) {
    const m: any = await Member.findById(mv.memberId);
    if (!m || !same(m.familyId, mv.toFamilyId)) {
      notes.push('A member has been moved again since the nikah was approved, so we left them where they are.');
      continue;
    }
    const from: any = await Family.findById(mv.fromFamilyId);
    if (!from || from.isArchived) {
      notes.push('The original family is no longer available, so the member stays in the new family.');
      continue;
    }
    const heads = await livingHeads(from._id);
    const r = await transferMember(mv.memberId, mv.fromFamilyId, actor, { makeHead: !!mv.wasHead && heads.length === 0 });
    void r;
    if (mv.wasHead && heads.length === 0) await Family.updateOne({ _id: from._id }, { $unset: { needsHeadReassignment: '', needsHeadReason: '', needsHeadSince: '' } });
  }
  if (e.createdFamilyId) {
    const left = await Member.countDocuments({ familyId: e.createdFamilyId, status: { $ne: 'deleted' } });
    if (left === 0) {
      await Family.updateOne({ _id: e.createdFamilyId }, { $set: { isArchived: true, archivedAt: new Date(), archivedReason: 'Nikah registration was reverted' } });
    }
  }
  for (const mm of e.members || []) {
    const m: any = await Member.findById(mm.id);
    if (!m || m.maritalStatus !== 'married') continue;
    const set: any = { isMarriageable: mm.prev.isMarriageable, marriageCount: mm.prev.marriageCount, isWidow: mm.prev.isWidow };
    const unset: any = {};
    if (mm.prev.maritalStatus) set.maritalStatus = mm.prev.maritalStatus;
    else unset.maritalStatus = '';
    if (mm.setSpouseId && same(m.spouseId, mm.setSpouseId)) {
      if (mm.prev.spouseId) set.spouseId = mm.prev.spouseId;
      else unset.spouseId = '';
    }
    await Member.updateOne({ _id: m._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  }
  return notes;
}

/* =========================================================== RECONCILE */

const MODELS: Record<'death' | 'nikah', any> = { death: DeathRegistration, nikah: NikahRegistration };

async function issueCertificateNo(kind: 'death' | 'nikah', tenantId: any, date: Date) {
  const year = (date instanceof Date && !isNaN(date.getTime()) ? date : new Date()).getFullYear();
  const n = await nextSequence(`${kind}:${tenantId}:${year}`);
  return `${kind === 'nikah' ? 'NKH' : 'DTH'}-${year}-${String(n).padStart(4, '0')}`;
}

export interface ReconcileResult {
  applied: boolean;
  rolledBack: boolean;
  notes: string[];
  effects?: Record<string, any>;
}

/**
 * Bring a registration's side effects in line with its current status.
 * Safe to call any number of times; a no-op when nothing needs to change.
 */
export async function reconcileRegistration(kind: 'death' | 'nikah', registrationId: any, actor: LifecycleActor): Promise<ReconcileResult> {
  const Model = MODELS[kind];
  const result: ReconcileResult = { applied: false, rolledBack: false, notes: [] };
  let reg: any = await Model.findById(registrationId);
  if (!reg) throw new HttpError(404, 'Registration not found', 'NOT_FOUND');

  const wantApplied = reg.status === 'approved';
  const keyNow = kind === 'death' ? deathKey(reg) : nikahKey(reg);

  // Roll back when no longer approved, or when the inputs it was applied for have changed.
  if (reg.effectsApplied && (!wantApplied || reg.effects?.inputsKey !== keyNow)) {
    const claimed = await Model.findOneAndUpdate({ _id: reg._id, effectsApplied: true }, { $set: { effectsApplied: false } }, { new: false });
    if (claimed) {
      result.notes.push(...(kind === 'death' ? await rollbackDeath(claimed) : await rollbackNikah(claimed, actor)));
      await Model.updateOne(
        { _id: reg._id },
        { $unset: { effects: '', previousStatus: '', ...(wantApplied ? {} : { approvedAt: '', approvedBy: '' }) } }
      );
      result.rolledBack = true;
    }
    reg = await Model.findById(registrationId);
  }

  if (wantApplied && !reg.effectsApplied) {
    // Atomic claim: concurrent approvals apply exactly once
    const claimed = await Model.findOneAndUpdate({ _id: reg._id, effectsApplied: { $ne: true } }, { $set: { effectsApplied: true } }, { new: true });
    if (claimed) {
      try {
        const { effects, previousStatus } = kind === 'death' ? await applyDeath(claimed, actor) : await applyNikah(claimed, actor);
        const set: any = { effects, approvedAt: claimed.approvedAt || new Date(), approvedBy: claimed.approvedBy || actor.userName };
        if (previousStatus) set.previousStatus = previousStatus;
        if (!claimed.certificateNo) {
          set.certificateNo = await issueCertificateNo(kind, claimed.tenantId, kind === 'nikah' ? claimed.nikahDate : claimed.deathDate);
          if (kind === 'nikah') set.certificateIssuedAt = new Date();
        }
        await Model.updateOne({ _id: reg._id }, { $set: set });
        result.applied = true;
        result.effects = effects;
      } catch (err) {
        await Model.updateOne({ _id: reg._id }, { $unset: { effectsApplied: '' } });
        throw err;
      }
    }
  }
  return result;
}

/** Delete a registration, undoing whatever approving it did. */
export async function deleteRegistrationWithRollback(kind: 'death' | 'nikah', registrationId: any, actor: LifecycleActor) {
  const Model = MODELS[kind];
  const reg: any = await Model.findById(registrationId);
  if (!reg) return null;
  let notes: string[] = [];
  if (reg.effectsApplied) {
    const claimed = await Model.findOneAndUpdate({ _id: reg._id, effectsApplied: true }, { $set: { effectsApplied: false } }, { new: false });
    if (claimed) notes = kind === 'death' ? await rollbackDeath(claimed) : await rollbackNikah(claimed, actor);
  }
  await Model.deleteOne({ _id: reg._id });
  return { notes };
}

/** Summary shown next to a registration: what it changed (for the admin screen). */
export const describeEffects = (reg: any) =>
  reg?.effectsApplied ? { applied: true, at: reg.effects?.appliedAt, by: reg.effects?.appliedBy, certificateNo: reg.certificateNo } : { applied: false };
