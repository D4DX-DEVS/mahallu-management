import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Member from '../models/Member';
import Family from '../models/Family';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import {
  createDeathRegistration,
  createNikahRegistration,
  createNOC,
  updateDeathRegistration,
  updateNikahRegistration,
} from '../controllers/registrationController';

/**
 * createDeathRegistration used to run `Member.findByIdAndUpdate(body.deceasedId, { isDead: true })`
 * with an unvalidated id and no tenant: any admin could mark any Mahallu's member as deceased. Every
 * id a registration links to must now be a well-formed id of a record of the caller's OWN Mahallu, and
 * the status change itself is scoped by tenant as well.
 */

const oid = () => new mongoose.Types.ObjectId();
const MINE = oid();
const THEIRS = oid();

const myMember = oid();
const myFamily = oid();
const foreignMember = oid();
const foreignFamily = oid();
const unknownId = oid();

const owners: Record<string, mongoose.Types.ObjectId> = {
  [String(myMember)]: MINE,
  [String(myFamily)]: MINE,
  [String(foreignMember)]: THEIRS,
  [String(foreignFamily)]: THEIRS,
};

let saved: any[] = [];
let memberUpdates: Array<{ filter: any; update: any }> = [];
let regUpdates: Array<{ filter: any; update: any }> = [];
let existingDeath: any;
let existingNikah: any;
let openDeathExists = false;

const restore: Array<[any, string, any]> = [];
const stub = (target: any, key: string, impl: any) => { restore.push([target, key, target[key]]); target[key] = impl; };
const lookup = (id: any) => ({ select: () => ({ lean: async () => (owners[String(id)] ? { _id: id, tenantId: owners[String(id)] } : null) }) });

const call = async (fn: any, req: Record<string, any>) => {
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  await fn({ params: {}, query: {}, body: {}, user: { name: 'Admin' }, ...req }, res);
  return out;
};
const asMine = { tenantId: String(MINE), isSuperAdmin: false };

describe('registration records stay inside their Mahallu', () => {
  beforeEach(() => {
    stub(Member, 'findById', lookup);
    stub(Family, 'findById', lookup);
    stub(Member, 'findOneAndUpdate', async (filter: any, update: any) => { memberUpdates.push({ filter, update }); return {}; });
    stub(Member, 'findByIdAndUpdate', async () => { throw new Error('an unscoped by-id update must not be used'); });
    for (const model of [DeathRegistration, NikahRegistration, NOC] as any[]) {
      stub(model.prototype, 'save', async function (this: any) { saved.push(this); return this; });
    }
    stub(DeathRegistration, 'findById', async () => existingDeath);
    stub(DeathRegistration, 'exists', async () => (openDeathExists ? { _id: oid() } : null));
    stub(DeathRegistration, 'updateOne', async () => ({}));
    stub(Member, 'updateOne', async () => ({}));
    stub(NikahRegistration, 'findById', (id: any) => Object.assign(Promise.resolve(existingNikah), { select: lookup(id).select }));
    for (const model of [DeathRegistration, NikahRegistration] as any[]) {
      stub(model, 'findOneAndUpdate', (filter: any, update: any) => {
        regUpdates.push({ filter, update });
        const saved: any = { ...existingDeath, ...Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)) };
        saved.populate = async () => saved;
        const chain: any = { populate: () => chain, then: (r: any) => r(saved) };
        return chain;
      });
    }
  });
  afterEach(() => { for (const [t, k, v] of restore.reverse()) t[k] = v; restore.length = 0; });
  beforeEach(() => {
    saved = [];
    memberUpdates = [];
    regUpdates = [];
    existingDeath = { _id: oid(), tenantId: MINE, status: 'pending' };
    existingNikah = { _id: oid(), tenantId: MINE };
    openDeathExists = false;
  });

  const death = (extra: Record<string, any> = {}) => ({ deceasedName: 'X', deathDate: '2026-01-01', ...extra });

  test("a death registration for another Mahallu's member is refused and nobody is marked dead", async () => {
    const out = await call(createDeathRegistration, { ...asMine, body: death({ deceasedId: String(foreignMember) }) });
    assert.equal(out.status, 404);
    assert.equal(out.body.success, false);
    assert.equal(memberUpdates.length, 0);
    assert.equal(saved.length, 0);
  });

  test('an unknown member id is refused the same way (it does not reveal whether it exists elsewhere)', async () => {
    const unknown = await call(createDeathRegistration, { ...asMine, body: death({ deceasedId: String(unknownId) }) });
    const foreign = await call(createDeathRegistration, { ...asMine, body: death({ deceasedId: String(foreignMember) }) });
    assert.equal(unknown.status, 404);
    assert.deepEqual(unknown.body, foreign.body);
  });

  test('malformed ids are a plain 400: strings, objects, arrays, numbers', async () => {
    for (const bad of ['abc', '123', { $ne: null }, ['x'], 12345, 'zzzzzzzzzzzzzzzzzzzzzzzz']) {
      const out = await call(createDeathRegistration, { ...asMine, body: death({ deceasedId: bad }) });
      assert.equal(out.status, 400, JSON.stringify(bad));
      assert.ok(!/cast|objectid|bson/i.test(out.body.message));
    }
    assert.equal(memberUpdates.length, 0);
  });

  test("a foreign family or grave record on a death registration is refused too", async () => {
    const out = await call(createDeathRegistration, { ...asMine, body: death({ familyId: String(foreignFamily) }) });
    assert.equal(out.status, 404);
    assert.equal(saved.length, 0);
  });

  test('own member: registered as pending, and the member is NOT changed until approval', async () => {
    const out = await call(createDeathRegistration, { ...asMine, body: death({ deceasedId: String(myMember), familyId: String(myFamily), status: 'approved' }) });
    assert.equal(out.status, 201);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].status, 'pending', 'a body status is ignored on create');
    assert.equal(memberUpdates.length, 0);
  });

  test('a second open death record for the same member is a 409', async () => {
    openDeathExists = true;
    const out = await call(createDeathRegistration, { ...asMine, body: death({ deceasedId: String(myMember) }) });
    assert.equal(out.status, 409);
    assert.equal(saved.length, 0);
  });

  test('approve marks the member deceased (scoped by id AND Mahallu); reject leaves them alone', async () => {
    existingDeath = { ...existingDeath, deceasedId: myMember, deathDate: new Date('2026-01-01') };
    const rejected = await call(updateDeathRegistration, { ...asMine, params: { id: String(existingDeath._id) }, body: { status: 'rejected' } });
    assert.equal(rejected.status, 200);
    assert.equal(memberUpdates.length, 0);

    const approved = await call(updateDeathRegistration, { ...asMine, params: { id: String(existingDeath._id) }, body: { status: 'approved' } });
    assert.equal(approved.status, 200);
    assert.equal(memberUpdates.length, 1);
    assert.equal(String(memberUpdates[0].filter._id), String(myMember));
    assert.equal(String(memberUpdates[0].filter.tenantId), String(MINE));
    assert.deepEqual(memberUpdates[0].update.$set, {
      isDead: true, status: 'inactive', dateOfDeath: existingDeath.deathDate, deathRecordId: existingDeath._id,
    });
  });

  test('reverting an approved record reactivates the member, only if it is the record that marked them', async () => {
    existingDeath = { ...existingDeath, deceasedId: myMember, status: 'approved' };
    const out = await call(updateDeathRegistration, { ...asMine, params: { id: String(existingDeath._id) }, body: { status: 'pending' } });
    assert.equal(out.status, 200);
    assert.equal(memberUpdates.length, 1);
    assert.equal(String(memberUpdates[0].filter.deathRecordId), String(existingDeath._id));
    assert.deepEqual(memberUpdates[0].update.$set, { isDead: false, status: 'active' });
  });

  test('approving while another open record exists for the member is a 409 and changes nothing', async () => {
    existingDeath = { ...existingDeath, deceasedId: myMember };
    openDeathExists = true;
    const out = await call(updateDeathRegistration, { ...asMine, params: { id: String(existingDeath._id) }, body: { status: 'approved' } });
    assert.equal(out.status, 409);
    assert.equal(regUpdates.length, 0);
    assert.equal(memberUpdates.length, 0);
  });

  test('a registration without a deceased member changes no member', async () => {
    const out = await call(createDeathRegistration, { ...asMine, body: death() });
    assert.equal(out.status, 201);
    assert.equal(memberUpdates.length, 0);
  });

  test('the Mahallu comes from the server: a body tenantId is ignored', async () => {
    const out = await call(createDeathRegistration, { ...asMine, body: death({ tenantId: String(THEIRS) }) });
    assert.equal(out.status, 201);
    assert.equal(String(saved[0].tenantId), String(MINE));
  });

  test('fails closed: a non-super user with no Mahallu cannot create into one named in the body', async () => {
    for (const fn of [createDeathRegistration, createNikahRegistration, createNOC]) {
      const out = await call(fn, {
        tenantId: undefined,
        isSuperAdmin: false,
        body: { ...death({ tenantId: String(THEIRS), deceasedId: String(foreignMember) }), type: 'common', purposeTitle: 'T', purposeDescription: 'D', applicantName: 'A', groomName: 'G', brideName: 'B', nikahDate: '2026-01-01' },
      });
      assert.equal(out.status, 400, fn.name);
    }
    assert.equal(saved.length, 0);
    assert.equal(memberUpdates.length, 0);
  });

  test("a super admin who named a Mahallu may register in it, and ids are checked against THAT Mahallu", async () => {
    const asSuper = { tenantId: undefined, isSuperAdmin: true };
    const wrong = await call(createDeathRegistration, { ...asSuper, body: death({ tenantId: String(THEIRS), deceasedId: String(myMember) }) });
    assert.equal(wrong.status, 404);
    const right = await call(createDeathRegistration, { ...asSuper, body: death({ tenantId: String(THEIRS), deceasedId: String(foreignMember) }) });
    assert.equal(right.status, 201);
    assert.equal(String(saved[0].tenantId), String(THEIRS));
    const none = await call(createDeathRegistration, { ...asSuper, body: death({ deceasedId: String(myMember) }) });
    assert.equal(none.status, 400);
  });

  test("nikah: another Mahallu's groom or bride cannot be linked", async () => {
    const base = { groomName: 'G', brideName: 'B', nikahDate: '2026-01-01' };
    for (const field of ['groomId', 'brideId', 'submittedByMemberId']) {
      const out = await call(createNikahRegistration, { ...asMine, body: { ...base, [field]: String(foreignMember) } });
      assert.equal(out.status, 404, field);
    }
    const ok = await call(createNikahRegistration, { ...asMine, body: { ...base, groomId: String(myMember) } });
    assert.equal(ok.status, 201);
    assert.deepEqual(saved.length, 1);
  });

  test("NOC: another Mahallu's applicant or nikah registration cannot be linked", async () => {
    const base = { applicantName: 'A', type: 'common', purposeTitle: 'T', purposeDescription: 'D' };
    const foreignApplicant = await call(createNOC, { ...asMine, body: { ...base, applicantId: String(foreignMember) } });
    assert.equal(foreignApplicant.status, 404);
    const foreignNikah = await call(createNOC, { ...asMine, body: { ...base, nikahRegistrationId: String(unknownId) } });
    assert.equal(foreignNikah.status, 404);
    const ok = await call(createNOC, { ...asMine, body: { ...base, applicantId: String(myMember) } });
    assert.equal(ok.status, 201);
  });

  test('updates keep the links inside the registration\'s own Mahallu and write by id AND Mahallu', async () => {
    const badDeath = await call(updateDeathRegistration, { ...asMine, params: { id: String(existingDeath._id) }, body: { deceasedId: String(foreignMember) } });
    assert.equal(badDeath.status, 404);
    const badNikah = await call(updateNikahRegistration, { ...asMine, params: { id: String(existingNikah._id) }, body: { groomId: String(foreignMember) } });
    assert.equal(badNikah.status, 404);
    assert.equal(regUpdates.length, 0);

    const ok = await call(updateDeathRegistration, { ...asMine, params: { id: String(existingDeath._id) }, body: { deceasedId: String(myMember), status: 'approved' } });
    assert.equal(ok.status, 200);
    assert.equal(String(regUpdates[0].filter.tenantId), String(MINE));
    assert.equal(String(regUpdates[0].filter._id), String(existingDeath._id));
  });

  test("another Mahallu's registration cannot be updated at all", async () => {
    existingDeath.tenantId = THEIRS;
    const out = await call(updateDeathRegistration, { ...asMine, params: { id: String(existingDeath._id) }, body: { status: 'approved' } });
    assert.equal(out.status, 403);
    assert.equal(regUpdates.length, 0);
  });
});
