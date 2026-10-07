import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Member from '../models/Member';
import Family from '../models/Family';
import {
  DEFAULT_REPORT_MAX_ROWS,
  capRows,
  reportMaxRows,
  getAreaReport,
  getBloodBankReport,
  getOrphansReport,
} from '../controllers/reportController';

/**
 * The area, blood-bank and orphans reports loaded whole tenant collections into memory. The listed
 * rows are now capped (REPORT_MAX_ROWS, default 5000) with `.limit()` / `.lean()`, `truncated: true`
 * says when the cap was hit, and the totals are still counted by the database, so a capped list never
 * shows a wrong total.
 */

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();

describe('report row cap (pure)', () => {
  test('the default is 5000 and REPORT_MAX_ROWS overrides it', () => {
    assert.equal(DEFAULT_REPORT_MAX_ROWS, 5000);
    assert.equal(reportMaxRows({}), 5000);
    assert.equal(reportMaxRows({ REPORT_MAX_ROWS: '250' }), 250);
    for (const bad of ['', '0', '-1', 'abc', 'NaN']) assert.equal(reportMaxRows({ REPORT_MAX_ROWS: bad }), 5000, bad);
  });

  test('capRows: under, exactly at and over the cap', () => {
    assert.deepEqual(capRows([1, 2], 3), { rows: [1, 2], truncated: false });
    assert.deepEqual(capRows([1, 2, 3], 3), { rows: [1, 2, 3], truncated: false });
    assert.deepEqual(capRows([1, 2, 3, 4], 3), { rows: [1, 2, 3], truncated: true });
    assert.deepEqual(capRows([], 3), { rows: [], truncated: false });
  });
});

describe('capped reports', () => {
  const restore: Array<[any, string, any]> = [];
  const stub = (target: any, key: string, impl: any) => { restore.push([target, key, target[key]]); target[key] = impl; };

  let memberRows: any[] = [];
  let familyRows: any[] = [];
  let limits: number[] = [];
  let leanCalls = 0;
  let queries: any[] = [];

  const chain = (rows: any[]) => {
    const c: any = {
      select: () => c, sort: () => c, populate: () => c,
      limit: (n: number) => { limits.push(n); c.n = n; return c; },
      lean: () => { leanCalls += 1; return c; },
      then: (r: any, j: any) => Promise.resolve(rows.slice(0, c.n ?? rows.length)).then(r, j),
    };
    return c;
  };

  const call = async (fn: any, req: Record<string, any> = {}) => {
    const out: any = { status: 200, body: undefined };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
    await fn({ query: {}, user: { role: 'mahall' }, tenantId: String(TENANT), isSuperAdmin: false, ...req }, res);
    return out;
  };

  beforeEach(() => {
    stub(Member, 'countDocuments', async () => memberRows.length);
    stub(Member, 'find', (q: any) => { queries.push(q); return chain(memberRows); });
    stub(Member, 'aggregate', async (pipeline: any[]) => {
      const group = pipeline.find((s) => s.$group)?.$group;
      if (group && group._id === '$bloodGroup') return [{ _id: 'A+', count: 3 }, { _id: 'O-', count: 2 }];
      if (group && group._id === '$familyId') return familyRows.map((f) => ({ _id: f._id, count: 2 }));
      return [{ _id: null, total: 40, male: 25, female: 15 }];
    });
    stub(Family, 'countDocuments', async () => 1234);
    stub(Family, 'find', () => chain(familyRows));
    stub(Family, 'distinct', async () => familyRows.map((f) => f._id));
  });
  afterEach(() => {
    for (const [t, k, v] of restore.reverse()) t[k] = v;
    delete process.env.REPORT_MAX_ROWS;
    restore.length = 0;
  });
  beforeEach(() => {
    memberRows = [];
    familyRows = [];
    limits = [];
    queries = [];
    leanCalls = 0;
    process.env.REPORT_MAX_ROWS = '3';
  });

  const orphan = (i: number) => ({ _id: oid(), name: `O${i}`, age: 10, gender: 'male', familyId: { houseName: `H${i}` } });

  test('orphans: the list is cut at the cap, truncated is true, the total is the real count', async () => {
    memberRows = Array.from({ length: 10 }, (_, i) => orphan(i));
    const out = await call(getOrphansReport);
    assert.equal(out.status, 200);
    assert.equal(out.body.data.orphans.length, 3);
    assert.equal(out.body.data.truncated, true);
    assert.equal(out.body.truncated, true);
    assert.equal(out.body.data.total, 10, 'the total is counted, not the length of the capped list');
    assert.deepEqual(out.body.data.orphans[0], { id: memberRows[0]._id, name: 'O0', age: 10, gender: 'male', family: 'H0' });
    assert.deepEqual(limits, [4], 'one extra row is read only to detect truncation');
    assert.equal(leanCalls, 1);
  });

  test('orphans: the minors filter runs in the database, and the shape is unchanged when nothing is cut', async () => {
    memberRows = [orphan(1), orphan(2)];
    const out = await call(getOrphansReport);
    assert.equal(out.body.data.truncated, undefined);
    assert.equal(out.body.truncated, undefined);
    assert.deepEqual(Object.keys(out.body.data).sort(), ['orphans', 'total']);
    assert.deepEqual(queries[0].age, { $type: 'number', $lt: 18 });
    assert.equal(String(queries[0].tenantId), String(TENANT));
  });

  test('exactly at the cap is not truncated', async () => {
    memberRows = [orphan(1), orphan(2), orphan(3)];
    const out = await call(getOrphansReport);
    assert.equal(out.body.data.orphans.length, 3);
    assert.equal(out.body.data.truncated, undefined);
  });

  test('blood bank: members are capped, the per-group counts and the total are not', async () => {
    memberRows = Array.from({ length: 8 }, (_, i) => ({ _id: oid(), name: `M${i}`, bloodGroup: 'A+' }));
    const out = await call(getBloodBankReport);
    assert.equal(out.body.data.members.length, 3);
    assert.equal(out.body.data.truncated, true);
    assert.equal(out.body.data.total, 8);
    assert.deepEqual(out.body.data.bloodGroupStats, { 'A+': 3, 'O-': 2 });
    assert.deepEqual(Object.keys(out.body.data).sort(), ['bloodGroupStats', 'members', 'total', 'truncated']);
    assert.equal(leanCalls, 1);
  });

  test('blood bank: only members with a blood group are listed, or the one asked for', async () => {
    await call(getBloodBankReport);
    assert.deepEqual(queries[0].bloodGroup, { $nin: [null, ''] });
    queries = [];
    await call(getBloodBankReport, { query: { bloodGroup: 'B+' } });
    assert.equal(queries[0].bloodGroup, 'B+');
    queries = [];
    await call(getBloodBankReport, { query: { bloodGroup: { $ne: 'x' } } });
    assert.deepEqual(queries[0].bloodGroup, { $nin: [null, ''] }, 'an operator object is not a filter');
  });

  test('area: families are capped, the totals are counted, and the shape is unchanged', async () => {
    familyRows = Array.from({ length: 9 }, (_, i) => ({ _id: oid(), houseName: `H${i}`, area: 'North' }));
    const out = await call(getAreaReport);
    assert.equal(out.status, 200);
    const data = out.body.data;
    assert.equal(data.totalFamilies, 1234);
    assert.equal(data.totalMembers, 40);
    assert.equal(data.maleCount, 25);
    assert.equal(data.femaleCount, 15);
    assert.equal(data.families.length, 3);
    assert.deepEqual(data.families[0], { id: familyRows[0]._id, houseName: 'H0', area: 'North', memberCount: 2 });
    assert.equal(data.truncated, true);
    assert.equal(out.body.truncated, true);
  });

  test('a user with no Mahallu gets a 403, not an unscoped report', async () => {
    for (const fn of [getAreaReport, getBloodBankReport, getOrphansReport]) {
      const out = await call(fn, { tenantId: undefined });
      assert.equal(out.status, 403, fn.name);
    }
  });
});
