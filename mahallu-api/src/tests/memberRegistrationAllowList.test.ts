import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Member from '../models/Member';
import DocumentFile from '../models/DocumentFile';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import { requestNikahRegistration, requestDeathRegistration, requestNOC } from '../controllers/memberUserController';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] memberRegistrationAllowList', () => {

/**
 * Member-submitted nikah / death (and nikah NOC) registrations are built from an explicit
 * allow-list. A member used to be able to spread any body field into the saved document:
 * remarks, mahallId, the other side's groomId/brideId (any member of any Mahallu), the
 * graveRecordId, a familyId, and document ids that are not theirs.
 */

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();
const OTHER_TENANT = oid();
const FAMILY = oid();

const SIGNED_IN: any = { _id: oid(), tenantId: TENANT, name: 'Signed In', age: 30, phone: '9000000000', isFamilyHead: true, familyId: FAMILY, status: 'active' };
const FAMILY_MEMBER: any = { _id: oid(), tenantId: TENANT, name: 'Family Person', age: 20, familyId: FAMILY, status: 'active' };
const OUTSIDER_SAME_TENANT: any = { _id: oid(), tenantId: TENANT, name: 'Other Family', familyId: oid(), status: 'active' };
const OUTSIDER_OTHER_TENANT: any = { _id: oid(), tenantId: OTHER_TENANT, name: 'Other Mahallu', familyId: oid(), status: 'active' };
const MEMBERS = [SIGNED_IN, FAMILY_MEMBER, OUTSIDER_SAME_TENANT, OUTSIDER_OTHER_TENANT];

const sameId = (a: unknown, b: unknown) => String(a) === String(b);

/** Uploaded documents; the stub applies the same tenant / uploader filter the controller sends. */
const DOCS: any[] = [];
const addDoc = (documentType: string, uploadedByMemberId: any, tenantId: any) => {
  const doc = { _id: oid(), documentType, uploadedByMemberId, tenantId };
  DOCS.push(doc);
  return doc;
};
const ownDocs = {
  id_proof: addDoc('id_proof', SIGNED_IN._id, TENANT),
  age_proof: addDoc('age_proof', SIGNED_IN._id, TENANT),
  photo: addDoc('photo', SIGNED_IN._id, TENANT),
  death_proof: addDoc('death_proof', SIGNED_IN._id, TENANT),
};
const foreignMemberDoc = addDoc('id_proof', FAMILY_MEMBER._id, TENANT); // uploaded by someone else, same tenant
const foreignTenantDoc = addDoc('id_proof', SIGNED_IN._id, OTHER_TENANT); // other Mahallu

const nikahDocIds = () => [ownDocs.id_proof, ownDocs.age_proof, ownDocs.photo].map((d) => String(d._id));
const deathDocIds = () => [ownDocs.id_proof, ownDocs.death_proof].map((d) => String(d._id));

let attached: any[] = [];
let saves: Array<{ doc: any; documentsAtSave: string[] }> = [];
const original = {
  memberFindById: Member.findById,
  memberFindOne: Member.findOne,
  docFind: DocumentFile.find,
  docUpdateMany: DocumentFile.updateMany,
  nikahSave: NikahRegistration.prototype.save,
  deathSave: DeathRegistration.prototype.save,
  deathExists: DeathRegistration.exists,
  nocSave: NOC.prototype.save,
  nocFindById: NOC.findById,
};

before(() => {
  (Member as any).findById = async (id: unknown) => MEMBERS.find((m) => sameId(m._id, id)) ?? null;
  (Member as any).findOne = async (filter: any) =>
    MEMBERS.find(
      (m) =>
        (filter._id === undefined || sameId(m._id, filter._id)) &&
        (filter.familyId === undefined || sameId(m.familyId, filter.familyId)) &&
        (filter.tenantId === undefined || sameId(m.tenantId, filter.tenantId)) &&
        (filter.status === undefined ||
          (typeof filter.status === 'object' && '$ne' in filter.status ? m.status !== filter.status.$ne : m.status === filter.status))
    ) ?? null;
  (DocumentFile as any).find = (filter: any) => ({
    select: async () => {
      const wanted = ((filter._id && filter._id.$in) || []).map(String);
      return DOCS.filter(
        (d) =>
          wanted.includes(String(d._id)) &&
          sameId(d.tenantId, filter.tenantId) &&
          sameId(d.uploadedByMemberId, filter.uploadedByMemberId)
      );
    },
  });
  (DocumentFile as any).updateMany = async (filter: any) => {
    attached.push(...(filter._id.$in as unknown[]).map(String));
    return {};
  };
  const recordingSave = function (this: any) {
    saves.push({ doc: this, documentsAtSave: (this.documents || []).map(String) });
    return Promise.resolve(this);
  };
  (NikahRegistration.prototype as any).save = recordingSave;
  (DeathRegistration.prototype as any).save = recordingSave;
  (DeathRegistration as any).exists = async () => null; // no open death record yet
  (NOC.prototype as any).save = recordingSave;
  (NOC as any).findById = () => ({ populate: async () => ({}) });
});

after(() => {
  Object.assign(Member, { findById: original.memberFindById, findOne: original.memberFindOne });
  Object.assign(DocumentFile, { find: original.docFind, updateMany: original.docUpdateMany });
  (NikahRegistration.prototype as any).save = original.nikahSave;
  (DeathRegistration.prototype as any).save = original.deathSave;
  (DeathRegistration as any).exists = original.deathExists;
  (NOC.prototype as any).save = original.nocSave;
  (NOC as any).findById = original.nocFindById;
});

const run = async (handler: (req: any, res: any) => Promise<unknown>, body: Record<string, unknown>) => {
  saves = [];
  attached = [];
  const out: any = { status: 200, body: undefined };
  const res: any = {
    status(c: number) {
      out.status = c;
      return res;
    },
    json(b: any) {
      out.body = b;
      return res;
    },
  };
  await handler({ user: { memberId: SIGNED_IN._id, phone: '9000000000' }, body }, res);
  return out;
};

const lastSaved = <T>(Model: new (...a: any[]) => T) => saves.filter((s) => s.doc instanceof Model).map((s) => s.doc)[0] as any;
const savedBy = (Model: new (...a: any[]) => any) => saves.filter((s) => s.doc instanceof Model);

const hostileCommon = () => ({
  remarks: 'injected remarks',
  mahallId: 'INJECTED-MAHALL',
  status: 'approved',
  tenantId: String(OTHER_TENANT),
  submittedByMemberId: String(OUTSIDER_OTHER_TENANT._id),
  approvedBy: 'attacker',
  _id: String(oid()),
});

const nikahForm = (extra: Record<string, unknown> = {}) => ({
  mahallMemberType: 'groom',
  groomName: 'Typed Groom',
  groomNameMl: 'ml groom',
  groomAge: 27,
  brideName: 'Typed Bride',
  brideNameMl: 'ml bride',
  brideAge: 24,
  nikahDate: '2026-12-01',
  venue: 'Test Hall',
  waliName: 'Test Wali',
  witness1: 'Witness One',
  witness2: 'Witness Two',
  mahrAmount: 1000,
  mahrDescription: 'gold',
  documents: nikahDocIds(),
  ...extra,
});

const deathForm = (extra: Record<string, unknown> = {}) => ({
  deathDate: '2026-01-01',
  placeOfDeath: 'Home',
  causeOfDeath: 'Natural',
  informantName: 'Typed Informant',
  informantRelation: 'Son',
  informantPhone: '9111111111',
  documents: deathDocIds(),
  ...extra,
});

// ---------------------------------------------------------------- nikah

test('nikah: hostile body fields never reach the saved registration', async () => {
  const out = await run(
    requestNikahRegistration,
    nikahForm({
      ...hostileCommon(),
      groomId: String(OUTSIDER_OTHER_TENANT._id), // own side: must be replaced by the server
      brideId: String(OUTSIDER_OTHER_TENANT._id), // the other side: must never be accepted
      documents: [...nikahDocIds(), String(foreignMemberDoc._id), String(foreignTenantDoc._id)],
    })
  );
  assert.equal(out.status, 201);
  const record = lastSaved(NikahRegistration);
  assert.equal(record.remarks, undefined);
  assert.equal(record.mahallId, undefined);
  assert.equal(record.approvedBy, undefined);
  assert.equal(record.status, 'pending');
  assert.equal(String(record.tenantId), String(TENANT));
  assert.equal(String(record.submittedByMemberId), String(SIGNED_IN._id));
  assert.equal(String(record.groomId), String(SIGNED_IN._id));
  assert.equal(record.brideId, undefined);
  assert.notEqual(String(record._id), String(hostileCommon()._id));
});

test('nikah, bride side: the other side (groomId) is never taken from the body', async () => {
  await run(
    requestNikahRegistration,
    nikahForm({
      mahallMemberType: 'bride',
      groomId: String(OUTSIDER_OTHER_TENANT._id),
      brideId: String(OUTSIDER_SAME_TENANT._id),
      ...hostileCommon(),
    })
  );
  const record = lastSaved(NikahRegistration);
  assert.equal(record.groomId, undefined);
  assert.equal(String(record.brideId), String(SIGNED_IN._id));
  assert.equal(record.remarks, undefined);
  assert.equal(record.mahallId, undefined);
});

test('nikah: documents come only from the member\'s own uploads, never from the body', async () => {
  await run(
    requestNikahRegistration,
    nikahForm({ documents: [...nikahDocIds(), String(foreignMemberDoc._id), String(foreignTenantDoc._id), String(oid())] })
  );
  const saved = savedBy(NikahRegistration);
  assert.equal(saved[0].documentsAtSave.length, 0, 'the first save carries no body-supplied documents');
  const record = saved[0].doc;
  assert.deepEqual([...record.documents.map(String)].sort(), [...nikahDocIds()].sort());
  assert.ok(!attached.includes(String(foreignMemberDoc._id)));
  assert.ok(!attached.includes(String(foreignTenantDoc._id)));
});

test('nikah: another member\'s or tenant\'s documents alone do not satisfy the document check or get linked', async () => {
  const out = await run(
    requestNikahRegistration,
    nikahForm({ documents: [String(foreignMemberDoc._id), String(foreignTenantDoc._id)] })
  );
  assert.equal(out.status, 400);
  assert.equal(out.body.code, 'DOCUMENTS_REQUIRED');
  assert.equal(saves.length, 0);
  assert.equal(attached.length, 0);
});

test('nikah: the legitimate form fields are still saved', async () => {
  const out = await run(requestNikahRegistration, nikahForm());
  assert.equal(out.status, 201);
  const record = lastSaved(NikahRegistration);
  assert.equal(record.groomName, 'Typed Groom');
  assert.equal(record.groomNameMl, 'ml groom');
  assert.equal(record.groomAge, 27);
  assert.equal(record.brideName, 'Typed Bride');
  assert.equal(record.brideNameMl, 'ml bride');
  assert.equal(record.brideAge, 24);
  assert.equal(record.venue, 'Test Hall');
  assert.equal(record.waliName, 'Test Wali');
  assert.equal(record.witness1, 'Witness One');
  assert.equal(record.witness2, 'Witness Two');
  assert.equal(record.mahrAmount, 1000);
  assert.equal(record.mahrDescription, 'gold');
  assert.equal(record.mahallMemberType, 'groom');
  assert.equal(record.nikahDate.toISOString().slice(0, 10), '2026-12-01');
});

test('nikah: a family head can still apply for a family member, who becomes the linked subject', async () => {
  const out = await run(requestNikahRegistration, nikahForm({ subjectMemberId: String(FAMILY_MEMBER._id) }));
  assert.equal(out.status, 201);
  assert.equal(String(lastSaved(NikahRegistration).groomId), String(FAMILY_MEMBER._id));
});

test('nikah: a subject outside the member\'s own family is still refused', async () => {
  for (const outsider of [OUTSIDER_SAME_TENANT, OUTSIDER_OTHER_TENANT]) {
    const out = await run(requestNikahRegistration, nikahForm({ subjectMemberId: String(outsider._id) }));
    assert.equal(out.status, 404);
    assert.equal(saves.length, 0);
  }
});

// ---------------------------------------------------------------- death

test('death: hostile body fields never reach the saved registration', async () => {
  const graveRecordId = String(oid());
  const out = await run(
    requestDeathRegistration,
    deathForm({
      ...hostileCommon(),
      graveRecordId,
      familyId: String(oid()),
      deceasedId: String(OUTSIDER_OTHER_TENANT._id),
      deceasedName: 'Injected Name',
      documents: [...deathDocIds(), String(foreignMemberDoc._id), String(foreignTenantDoc._id)],
    })
  );
  assert.equal(out.status, 201);
  const record = lastSaved(DeathRegistration);
  assert.equal(record.remarks, undefined);
  assert.equal(record.mahallId, undefined);
  assert.equal(record.graveRecordId, undefined);
  assert.equal(record.approvedBy, undefined);
  assert.equal(record.status, 'pending');
  assert.equal(String(record.tenantId), String(TENANT));
  assert.equal(String(record.submittedByMemberId), String(SIGNED_IN._id));
  assert.equal(String(record.familyId), String(FAMILY));
  assert.equal(String(record.deceasedId), String(SIGNED_IN._id));
  assert.equal(record.deceasedName, SIGNED_IN.name);
});

test('death: documents come only from the member\'s own uploads, never from the body', async () => {
  await run(
    requestDeathRegistration,
    deathForm({ documents: [...deathDocIds(), String(foreignMemberDoc._id), String(foreignTenantDoc._id)] })
  );
  const saved = savedBy(DeathRegistration);
  assert.equal(saved[0].documentsAtSave.length, 0, 'the first save carries no body-supplied documents');
  assert.deepEqual([...saved[0].doc.documents.map(String)].sort(), [...deathDocIds()].sort());
  assert.ok(!attached.includes(String(foreignMemberDoc._id)));
  assert.ok(!attached.includes(String(foreignTenantDoc._id)));
});

test('death: the legitimate form fields are still saved, and the informant defaults still apply', async () => {
  const out = await run(requestDeathRegistration, deathForm());
  assert.equal(out.status, 201);
  const record = lastSaved(DeathRegistration);
  assert.equal(record.placeOfDeath, 'Home');
  assert.equal(record.causeOfDeath, 'Natural');
  assert.equal(record.informantName, 'Typed Informant');
  assert.equal(record.informantRelation, 'Son');
  assert.equal(record.informantPhone, '9111111111');
  assert.equal(record.deathDate.toISOString().slice(0, 10), '2026-01-01');

  const bare: any = deathForm();
  delete bare.informantName;
  delete bare.informantPhone;
  await run(requestDeathRegistration, bare);
  const defaults = lastSaved(DeathRegistration);
  assert.equal(defaults.informantName, SIGNED_IN.name);
  assert.equal(defaults.informantPhone, SIGNED_IN.phone);
});

test('death: a family member can be reported; one outside the family or another Mahallu is refused', async () => {
  const ok = await run(requestDeathRegistration, deathForm({ deceasedMemberId: String(FAMILY_MEMBER._id) }));
  assert.equal(ok.status, 201);
  const record = lastSaved(DeathRegistration);
  assert.equal(String(record.deceasedId), String(FAMILY_MEMBER._id));
  assert.equal(record.deceasedName, FAMILY_MEMBER.name);

  for (const outsider of [OUTSIDER_SAME_TENANT, OUTSIDER_OTHER_TENANT]) {
    const out = await run(requestDeathRegistration, deathForm({ deceasedMemberId: String(outsider._id) }));
    assert.equal(out.status, 404);
    assert.equal(saves.length, 0);
  }
});

// ---------------------------------------------------------------- NOC (explicit fields already; kept under test)

test('NOC: hostile fields never reach the saved NOC', async () => {
  const out = await run(requestNOC, {
    type: 'common',
    purposeTitle: 'Travel',
    purposeDescription: 'Needs a certificate',
    ...hostileCommon(),
    applicantId: String(OUTSIDER_OTHER_TENANT._id),
    applicantName: 'Injected',
    graveRecordId: String(oid()),
    documents: [String(foreignMemberDoc._id), String(foreignTenantDoc._id)],
  });
  assert.equal(out.status, 201);
  const record = lastSaved(NOC);
  assert.equal(record.approvedBy, undefined);
  assert.equal(record.status, 'pending');
  assert.equal(String(record.tenantId), String(TENANT));
  assert.equal(String(record.submittedByMemberId), String(SIGNED_IN._id));
  assert.equal(String(record.applicantId), String(SIGNED_IN._id));
  assert.equal(record.applicantName, SIGNED_IN.name);
  assert.equal(record.purposeTitle, 'Travel');
  assert.equal(record.documents.length, 0);
  assert.equal(attached.length, 0);
});

test('nikah NOC: the linked nikah registration takes no injected fields', async () => {
  const out = await run(requestNOC, {
    type: 'nikah',
    ...nikahForm({
      ...hostileCommon(),
      groomId: String(OUTSIDER_OTHER_TENANT._id),
      brideId: String(OUTSIDER_OTHER_TENANT._id),
    }),
  });
  assert.equal(out.status, 201);
  const nikah = lastSaved(NikahRegistration);
  assert.equal(nikah.remarks, undefined);
  assert.equal(nikah.mahallId, undefined);
  assert.equal(nikah.status, 'pending');
  assert.equal(String(nikah.tenantId), String(TENANT));
  assert.equal(String(nikah.groomId), String(SIGNED_IN._id));
  assert.equal(nikah.brideId, undefined);
  assert.equal(nikah.groomName, 'Typed Groom');
  assert.equal(nikah.brideName, 'Typed Bride');
  const noc = lastSaved(NOC);
  assert.equal(noc.approvedBy, undefined);
  assert.equal(noc.status, 'pending');
});
});
