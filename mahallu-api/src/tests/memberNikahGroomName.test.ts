import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Member from '../models/Member';
import DocumentFile from '../models/DocumentFile';
import { NikahRegistration, NOC } from '../models/Registration';
import { requestNikahRegistration, requestNOC } from '../controllers/memberUserController';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] memberNikahGroomName', () => {

/**
 * Member Portal -> Nikah -> New Nikah Registration.
 *
 * The signed-in member is on one side of the nikah and is linked to it by id.
 * The groom's NAME, though, is whatever was typed on the form. The controller
 * used to write the signed-in member's own name over it, so a registration for
 * "QA Groom" was saved under the member's name (the QA account's "Test2").
 */

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();
const SIGNED_IN = { _id: oid(), tenantId: TENANT, name: 'Test2', age: 30, isFamilyHead: true, familyId: oid() };

let saved: any[] = [];
const original = {
  findById: Member.findById,
  find: DocumentFile.find,
  updateMany: DocumentFile.updateMany,
  save: NikahRegistration.prototype.save,
};

test.before(() => {
  (Member as any).findById = async () => SIGNED_IN;
  (DocumentFile as any).find = () => ({
    select: async () => [
      { _id: oid(), documentType: 'id_proof' },
      { _id: oid(), documentType: 'age_proof' },
      { _id: oid(), documentType: 'photo' },
    ],
  });
  (DocumentFile as any).updateMany = async () => ({});
  (NikahRegistration.prototype as any).save = async function () {
    saved.push(this);
    return this;
  };
});
test.after(() => {
  Object.assign(Member, { findById: original.findById });
  Object.assign(DocumentFile, { find: original.find, updateMany: original.updateMany });
  (NikahRegistration.prototype as any).save = original.save;
});

const form = (extra: Record<string, unknown> = {}) => ({
  mahallMemberType: 'groom',
  groomName: 'QA Groom',
  groomAge: 27,
  brideName: 'Shnehaa',
  brideAge: 24,
  nikahDate: '2026-12-01',
  venue: 'Test Hall',
  waliName: 'Test Wali',
  witness1: 'Witness One',
  witness2: 'Witness Two',
  mahrAmount: 1000,
  mahrDescription: '',
  documents: [oid().toString(), oid().toString(), oid().toString()],
  ...extra,
});

const submit = async (body: Record<string, unknown>) => {
  saved = [];
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
  await requestNikahRegistration({ user: { memberId: SIGNED_IN._id }, body } as any, res);
  return { out, record: saved[0] };
};

test('the groom name that was entered is the one saved, not the signed-in member\'s name', async () => {
  const { out, record } = await submit(form());
  assert.equal(out.status, 201);
  assert.equal(record.groomName, 'QA Groom');
  assert.notEqual(record.groomName, SIGNED_IN.name);
});

test('the signed-in member is still linked as the groom, and the other fields are untouched', async () => {
  const { record } = await submit(form());
  assert.equal(String(record.groomId), String(SIGNED_IN._id));
  assert.equal(record.mahallMemberType, 'groom');
  assert.equal(record.brideName, 'Shnehaa');
  assert.equal(record.brideAge, 24);
  assert.equal(record.groomAge, 27);
  assert.equal(record.venue, 'Test Hall');
  assert.equal(record.waliName, 'Test Wali');
  assert.equal(record.status, 'pending');
});

test('surrounding spaces in the entered groom name are trimmed, nothing else is changed', async () => {
  const { record } = await submit(form({ groomName: '  QA Groom  ' }));
  assert.equal(record.groomName, 'QA Groom');
});

test('a client that sends no groom name still gets the member record name as a fallback', async () => {
  const body: any = form();
  delete body.groomName;
  const { out, record } = await submit(body);
  assert.equal(out.status, 201);
  assert.equal(record.groomName, 'Test2');
});

test('on the bride side the entered bride name is the one saved, and the groom name is untouched', async () => {
  const { record } = await submit(form({ mahallMemberType: 'bride', groomName: 'Other Groom', brideName: 'Typed Bride' }));
  assert.equal(record.groomName, 'Other Groom');
  assert.equal(String(record.brideId), String(SIGNED_IN._id));
  assert.equal(record.brideName, 'Typed Bride');
  assert.notEqual(record.brideName, SIGNED_IN.name);
});

test('on the bride side, a missing bride name falls back to the member record name', async () => {
  // The route's guard only demands the OTHER side's name, so brideName may be absent here.
  const body: any = form({ mahallMemberType: 'bride', groomName: 'Other Groom' });
  delete body.brideName;
  const { out, record } = await submit(body);
  assert.equal(out.status, 201);
  assert.equal(record.brideName, SIGNED_IN.name);
});

test('the other side must still be named: missing bride name is refused', async () => {
  const { out } = await submit(form({ brideName: '' }));
  assert.equal(out.status, 400);
  assert.match(out.body.message, /bride/i);
});

/* The nikah NOC flow creates a linked NikahRegistration from the same kind of
 * form, and used to overwrite both names with the signed-in member's own. */
const submitNoc = async (body: Record<string, unknown>) => {
  saved = [];
  const origNocSave = NOC.prototype.save;
  const origNocFind = NOC.findById;
  (NOC.prototype as any).save = async function () { return this; };
  (NOC as any).findById = () => ({ populate: async () => ({}) });
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  try {
    await requestNOC({ user: { memberId: SIGNED_IN._id }, body: { type: 'nikah', ...body } } as any, res);
  } finally {
    (NOC.prototype as any).save = origNocSave;
    (NOC as any).findById = origNocFind;
  }
  return { out, record: saved.find((r) => r instanceof NikahRegistration) };
};

test('nikah NOC: the groom name that was entered is the one saved on the linked registration', async () => {
  const { out, record } = await submitNoc(form());
  assert.equal(out.status, 201);
  assert.equal(record.groomName, 'QA Groom');
  assert.equal(String(record.groomId), String(SIGNED_IN._id));
});

test('nikah NOC, bride side: the entered bride name is the one saved', async () => {
  const { record } = await submitNoc(form({ mahallMemberType: 'bride', groomName: 'Other Groom', brideName: 'Typed Bride' }));
  assert.equal(record.brideName, 'Typed Bride');
  assert.equal(record.groomName, 'Other Groom');
  assert.equal(String(record.brideId), String(SIGNED_IN._id));
});
});
