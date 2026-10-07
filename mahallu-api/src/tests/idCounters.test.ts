import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Counter from '../models/Counter';
import Family from '../models/Family';
import Member from '../models/Member';
import User from '../models/User';
import { CounsellingCase, DisputeCase, InheritanceCase } from '../models/Counselling';
import { createFamily, bulkImportFamilies } from '../controllers/familyController';
import { createMember, bulkImportMembers } from '../controllers/memberController';
import { createCounsellingCase, createDisputeCase, createInheritanceCase } from '../controllers/counsellingController';

/**
 * Family ids (FID12), member ids (FID12-3) and case numbers (CNS-0004) came from "last created + 1" or
 * "count + 1": two creates at once were handed the same id, and a delete made the next create reuse an
 * id still in use. They now come from an atomic counter per (Mahallu, entity), seeded from the current
 * maximum, with a retry on a duplicate-key error when the unique (tenantId, mahallId / caseNo) index is
 * built, and plain success when it is not.
 *
 * The database is an in-memory fake; `withIndex` turns the unique-index behaviour on and off.
 */

const oid = () => new mongoose.Types.ObjectId();
const T1 = oid();
const T2 = oid();

const dupError = (field: string) =>
  Object.assign(new Error('E11000 duplicate key error collection: x index: tenantId_1_' + field + '_1'), {
    code: 11000,
    keyPattern: { tenantId: 1, [field]: 1 },
  });

let counters = new Map<string, number>();
let families: any[] = [];
let members: any[] = [];
let cases: Record<string, any[]> = { CNS: [], MSL: [], INH: [] };
let withIndex = true;
let forceDup: Record<string, number> = {};

const restore: Array<[any, string, any]> = [];
const stub = (target: any, key: string, impl: any) => { restore.push([target, key, target[key]]); target[key] = impl; };
const rowsMatching = (rows: any[], filter: any) =>
  rows.filter((r) => {
    if (filter.tenantId !== undefined && String(r.tenantId) !== String(filter.tenantId)) return false;
    if (filter.familyId !== undefined && String(r.familyId) !== String(filter.familyId)) return false;
    const rx = filter.mahallId?.$regex ?? filter.caseNo?.$regex;
    const value = r.mahallId ?? r.caseNo;
    if (rx && !rx.test(value ?? '')) return false;
    if (filter.mahallId?.$in && !filter.mahallId.$in.includes(r.mahallId)) return false;
    return true;
  });
const chainOf = (list: any[]) => {
  const chain: any = { select: () => chain, sort: () => chain, limit: () => chain, lean: async () => list, then: (r: any, j: any) => Promise.resolve(list).then(r, j) };
  return chain;
};

const saveInto = (rows: any[], field: 'mahallId' | 'caseNo') =>
  async function (this: any) {
    const value = this[field];
    if (forceDup[value]) { forceDup[value] -= 1; throw dupError(field); }
    if (withIndex && value && rows.some((r) => String(r.tenantId) === String(this.tenantId) && r[field] === value)) throw dupError(field);
    rows.push({ _id: this._id, tenantId: this.tenantId, familyId: this.familyId, [field]: value });
    return this;
  };

const run = async (fn: any, req: Record<string, any>) => {
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  await fn({ params: {}, query: {}, body: {}, user: { name: 'Admin' }, isSuperAdmin: false, ...req }, res);
  return out;
};

describe('atomic id counters', () => {
  beforeEach(() => {
    stub(Counter, 'findOneAndUpdate', async (filter: any, update: any) => {
      await Promise.resolve();
      const current = counters.get(filter._id);
      if (current === undefined) return null;
      const next = current + update.$inc.seq;
      counters.set(filter._id, next);
      return { seq: next };
    });
    stub(Counter, 'create', async (doc: any) => {
      await Promise.resolve();
      if (counters.has(doc._id)) throw Object.assign(new Error('E11000'), { code: 11000, keyPattern: { _id: 1 } });
      counters.set(doc._id, doc.seq);
      return doc;
    });

    stub(Family, 'find', (filter: any) => chainOf(rowsMatching(families, filter)));
    stub(Family, 'exists', async (filter: any) => (rowsMatching(families, filter).length ? { _id: oid() } : null));
    stub(Family, 'findById', (id: any) => {
      const family: any = { _id: id, tenantId: T1, houseName: 'House', mahallId: 'FID5' };
      return Object.assign(Promise.resolve(family), { select: () => ({ lean: async () => family }) });
    });
    stub(Family, 'distinct', async () => []);
    stub(Family, 'insertMany', async (docs: any[]) => { docs.forEach((d) => families.push(d)); return docs; });
    stub(Family.prototype, 'save', async function (this: any) { return saveInto(families, 'mahallId').call(this); });

    stub(Member, 'countDocuments', async (filter: any) => rowsMatching(members, filter).length);
    stub(Member, 'find', (filter: any) => chainOf(rowsMatching(members, filter)));
    stub(Member, 'exists', async (filter: any) => (rowsMatching(members, filter).length ? { _id: oid() } : null));
    stub(Member, 'insertMany', async (docs: any[]) => { docs.forEach((d) => members.push(d)); return docs; });
    stub(Member.prototype, 'save', async function (this: any) { return saveInto(members, 'mahallId').call(this); });
    stub(Member, 'findById', (id: any) => ({ populate: async () => ({ _id: id }) }));
    stub(User, 'findOne', async () => null);

    for (const [prefix, model] of [['CNS', CounsellingCase], ['MSL', DisputeCase], ['INH', InheritanceCase]] as const) {
      stub(model, 'find', (filter: any) => chainOf(rowsMatching(cases[prefix], filter)));
      stub(model.prototype, 'save', async function (this: any) { return saveInto(cases[prefix], 'caseNo').call(this); });
      stub(model.prototype, 'populate', async function (this: any) { return this; });
    }
  });
  afterEach(() => { for (const [t, k, v] of restore.reverse()) t[k] = v; restore.length = 0; });
  beforeEach(() => {
    counters = new Map();
    families = [];
    members = [];
    cases = { CNS: [], MSL: [], INH: [] };
    withIndex = true;
    forceDup = {};
  });

  const famReq = (tenant: any = T1, body: any = { houseName: 'House' }) => ({ tenantId: String(tenant), body });
  const ids = (rows: any[], field = 'mahallId') => rows.map((r) => r[field]).sort();

  // ---- families ----
  test('25 families created at once get 25 different ids, FID1..FID25', async () => {
    const outs = await Promise.all(Array.from({ length: 25 }, () => run(createFamily, famReq())));
    assert.ok(outs.every((o) => o.status === 201));
    const numbers = families.map((f) => Number(f.mahallId.replace('FID', ''))).sort((a, b) => a - b);
    assert.deepEqual(numbers, Array.from({ length: 25 }, (_, i) => i + 1));
  });

  test('the first id starts after the highest FID the Mahallu already has', async () => {
    families = [{ tenantId: T1, mahallId: 'FID7' }, { tenantId: T1, mahallId: 'FID12' }, { tenantId: T1, mahallId: 'OLD-3' }, { tenantId: T2, mahallId: 'FID99' }];
    await run(createFamily, famReq());
    assert.ok(families.some((f) => f.mahallId === 'FID13'));
    assert.ok(!counters.has(`family:${T2}`));
  });

  test('each Mahallu has its own sequence', async () => {
    await run(createFamily, famReq(T1));
    await run(createFamily, famReq(T2));
    await run(createFamily, famReq(T1));
    assert.deepEqual(ids(families.filter((f) => String(f.tenantId) === String(T1))), ['FID1', 'FID2']);
    assert.deepEqual(ids(families.filter((f) => String(f.tenantId) === String(T2))), ['FID1']);
  });

  test('a deleted family does not free its id for the next one', async () => {
    for (let i = 0; i < 3; i++) await run(createFamily, famReq());
    families.pop(); // FID3 deleted
    await run(createFamily, famReq());
    assert.deepEqual(ids(families), ['FID1', 'FID2', 'FID4']);
  });

  test('a duplicate-key error on the unique index is retried with the next number', async () => {
    forceDup = { FID1: 1 };
    const out = await run(createFamily, famReq());
    assert.equal(out.status, 201);
    assert.equal(out.body.data.mahallId, 'FID2');
  });

  test('an id already in use is never handed out again even when the unique index is not built', async () => {
    withIndex = false;
    families = [{ tenantId: T1, mahallId: 'FID3' }];
    const a = await run(createFamily, famReq());
    const b = await run(createFamily, famReq());
    assert.equal(a.status, 201);
    assert.deepEqual([a.body.data.mahallId, b.body.data.mahallId], ['FID4', 'FID5']);
  });

  test('the body cannot choose the id or the Mahallu', async () => {
    const out = await run(createFamily, famReq(T1, { houseName: 'H', mahallId: 'FID999', tenantId: String(T2), _id: String(oid()) }));
    assert.equal(out.body.data.mahallId, 'FID1');
    assert.equal(String(out.body.data.tenantId), String(T1));
  });

  test('no Mahallu: refused, nothing created', async () => {
    const out = await run(createFamily, { tenantId: undefined, body: { houseName: 'H', tenantId: String(T2) } });
    assert.equal(out.status, 400);
    assert.equal(families.length, 0);
  });

  test('bulk import reserves one block, keeps the format, and skips a block that overlaps used ids', async () => {
    families = [{ tenantId: T1, mahallId: 'FID2' }];
    const rows = Array.from({ length: 3 }, (_, i) => ({ houseName: `H${i}` }));
    const out = await run(bulkImportFamilies, famReq(T1, { families: rows }));
    assert.equal(out.status, 201);
    assert.deepEqual(ids(families.slice(1)), ['FID3', 'FID4', 'FID5']);

    // a counter that is behind the data: the first block collides with FID3..5 and is discarded
    counters.set(`family:${T1}`, 1);
    const again = await run(bulkImportFamilies, famReq(T1, { families: [{ houseName: 'x' }, { houseName: 'y' }] }));
    assert.equal(again.status, 201);
    const added = families.slice(4).map((f) => f.mahallId);
    assert.equal(new Set([...families.map((f) => f.mahallId)]).size, families.length, 'no id used twice');
    assert.deepEqual(added.sort(), ['FID6', 'FID7']);
  });

  test('a rejected bulk file burns no numbers', async () => {
    const out = await run(bulkImportFamilies, famReq(T1, { families: [{ houseName: 'ok' }, { houseName: '' }] }));
    assert.equal(out.status, 400);
    assert.equal(counters.has(`family:${T1}`), false);
  });

  // ---- members ----
  const memberReq = (body: any = {}) => ({ tenantId: String(T1), body: { familyId: String(oid()), familyName: 'House', name: 'M', ...body } });

  test('members added to one family at once get different ids FID5-1..FID5-N', async () => {
    const familyId = String(oid());
    const outs = await Promise.all(Array.from({ length: 12 }, () => run(createMember, memberReq({ familyId }))));
    assert.ok(outs.every((o) => o.status === 201), JSON.stringify(outs.find((o) => o.status !== 201)?.body));
    const numbers = members.map((m) => Number(m.mahallId.split('-')[1])).sort((a, b) => a - b);
    assert.deepEqual(numbers, Array.from({ length: 12 }, (_, i) => i + 1));
    assert.ok(members.every((m) => m.mahallId.startsWith('FID5-')));
  });

  test('the member sequence starts after the existing members of the family (count and highest id)', async () => {
    const familyId = String(oid());
    members = [
      { tenantId: T1, familyId, mahallId: 'FID5-2' },
      { tenantId: T1, familyId, mahallId: 'FID5-6' },
      { tenantId: T1, familyId, mahallId: undefined },
    ];
    const out = await run(createMember, memberReq({ familyId }));
    assert.equal(out.status, 201);
    assert.ok(members.some((m) => m.mahallId === 'FID5-7'));
  });

  test('a deleted member does not free its id; a duplicate-key error retries with the next number', async () => {
    const familyId = String(oid());
    for (let i = 0; i < 3; i++) await run(createMember, memberReq({ familyId }));
    members.pop();
    forceDup = { 'FID5-4': 1 };
    await run(createMember, memberReq({ familyId }));
    assert.deepEqual(members.map((m) => m.mahallId).sort(), ['FID5-1', 'FID5-2', 'FID5-5']);
  });

  test('member bulk import reserves a block and keeps the format', async () => {
    const familyId = String(oid());
    members = [{ tenantId: T1, familyId, mahallId: 'FID5-1' }];
    const out = await run(bulkImportMembers, { tenantId: String(T1), body: { familyId, members: [{ name: 'A' }, { name: 'B' }] } });
    // refBelongsToTenant looks the family up through Family.findById(...).select().lean(): tenant T1 above
    assert.equal(out.status, 201, JSON.stringify(out.body));
    assert.deepEqual(members.slice(1).map((m) => m.mahallId).sort(), ['FID5-2', 'FID5-3']);
  });

  // ---- case numbers ----
  const caseReq = (body: any, tenant: any = T1) => ({ tenantId: String(tenant), body });
  const counselling = { category: 'family', clientName: 'C', counsellorName: 'Z', appointmentDate: '2026-01-01' };

  test('counselling case numbers: concurrent creates are distinct and keep the CNS-0001 format', async () => {
    const outs = await Promise.all(Array.from({ length: 10 }, () => run(createCounsellingCase, caseReq(counselling))));
    assert.ok(outs.every((o) => o.status === 201), JSON.stringify(outs.find((o) => o.status !== 201)?.body));
    assert.deepEqual(ids(cases.CNS, 'caseNo'), Array.from({ length: 10 }, (_, i) => `CNS-${String(i + 1).padStart(4, '0')}`).sort());
  });

  test('case numbers are per Mahallu, per type, seeded above existing ones, and retried on a duplicate', async () => {
    cases.MSL = [{ tenantId: T1, caseNo: 'MSL-0009' }, { tenantId: T2, caseNo: 'MSL-0500' }];
    const msl = await run(createDisputeCase, caseReq({ type: 'family', parties: ['a', 'b'] }));
    assert.equal(msl.status, 201, JSON.stringify(msl.body));
    assert.ok(cases.MSL.some((c) => c.caseNo === 'MSL-0010'), JSON.stringify(cases.MSL));

    forceDup = { 'INH-0001': 1 };
    const inh = await run(createInheritanceCase, caseReq({ deceasedName: 'D', heirs: [{ name: 'h', relationship: 'son' }] }));
    assert.equal(inh.status, 201);
    assert.equal(cases.INH[0].caseNo, 'INH-0002');

    await run(createCounsellingCase, caseReq(counselling, T2));
    assert.equal(cases.CNS[0].caseNo, 'CNS-0001');
  });

  test('a case needs a Mahallu', async () => {
    const out = await run(createCounsellingCase, { tenantId: undefined, body: counselling });
    assert.equal(out.status, 400);
    assert.equal(cases.CNS.length, 0);
  });

  test('the unique indexes exist on the models (partial for family / member ids)', () => {
    const find = (schema: mongoose.Schema, keys: Record<string, number>) =>
      schema.indexes().find(([k]) => JSON.stringify(k) === JSON.stringify(keys));
    for (const model of [Family, Member]) {
      const idx = find(model.schema, { tenantId: 1, mahallId: 1 });
      assert.ok(idx, model.modelName);
      assert.equal((idx![1] as any).unique, true);
      assert.deepEqual((idx![1] as any).partialFilterExpression, { mahallId: { $type: 'string' } });
    }
    for (const model of [CounsellingCase, DisputeCase, InheritanceCase]) {
      const idx = find(model.schema, { tenantId: 1, caseNo: 1 });
      assert.ok(idx, model.modelName);
      assert.equal((idx![1] as any).unique, true);
    }
  });
});
