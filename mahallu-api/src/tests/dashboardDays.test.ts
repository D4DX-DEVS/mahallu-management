import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Family from '../models/Family';
import Member from '../models/Member';
import User from '../models/User';
import { LedgerItem, InstituteAccount } from '../models/MasterAccount';
import {
  getActivityTimeline,
  getFinancialSummary,
  getDashboardStats,
  getRecentFamilies,
  parseTimelineDays,
  MAX_TIMELINE_DAYS,
} from '../controllers/dashboardController';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] dashboardDays', () => {

/**
 * H9: `/dashboard/activity-timeline?days=` was parsed with parseInt and no ceiling, so
 * `?days=1000000000` ran a billion-iteration loop on the event loop. The value is now validated
 * BEFORE any query: missing -> 7, a whole number 1..90 -> accepted, everything else -> 400.
 *
 * Models are stubbed (no database); a rejected request must not touch any of them.
 */

const T_A = String(new mongoose.Types.ObjectId());
const INST_1 = String(new mongoose.Types.ObjectId());

const queries: Array<{ op: string; arg?: any }> = [];
const restorers: Array<() => void> = [];
const stub = (target: any, key: string, impl: any) => {
  const original = target[key];
  target[key] = impl;
  restorers.push(() => {
    target[key] = original;
  });
};
const plain = (v: any) => JSON.parse(JSON.stringify(v ?? null));

/** Awaitable and chainable, whatever the controller calls on it. */
const chain = (result: any): any => {
  const c: any = {
    sort: () => c,
    limit: () => c,
    select: () => c,
    lean: () => c,
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return c;
};

before(() => {
  for (const [name, Model] of Object.entries({ Family, Member, User, LedgerItem, InstituteAccount }) as Array<[string, any]>) {
    stub(Model, 'aggregate', (pipeline: any) => {
      queries.push({ op: `${name}.aggregate`, arg: plain(pipeline) });
      return chain([]);
    });
    stub(Model, 'countDocuments', (filter: any) => {
      queries.push({ op: `${name}.countDocuments`, arg: plain(filter) });
      return chain(0);
    });
    stub(Model, 'find', (filter: any) => {
      queries.push({ op: `${name}.find`, arg: plain(filter) });
      return chain([]);
    });
  }
});
after(() => restorers.reverse().forEach((r) => r()));
beforeEach(() => {
  queries.length = 0;
});

const run = async (fn: any, req: Record<string, any>) => {
  const out: any = { status: 200, body: undefined };
  const res: any = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: any) {
      out.body = body;
      return res;
    },
  };
  await fn({ query: {}, params: {}, body: {}, tenantId: T_A, isSuperAdmin: false, user: { role: 'mahall' }, ...req }, res);
  return out;
};

const timeline = (days: unknown, extra: Record<string, any> = {}) =>
  run(getActivityTimeline, { query: days === undefined ? {} : { days }, ...extra });

describe('parseTimelineDays', () => {
  test('missing is 7; a whole number 1..90 is itself', () => {
    assert.equal(parseTimelineDays(undefined), 7);
    for (const n of [1, 7, 30, 90]) assert.equal(parseTimelineDays(String(n)), n);
    assert.equal(parseTimelineDays('007'), 7);
    assert.equal(MAX_TIMELINE_DAYS, 90);
  });

  test('everything else is rejected', () => {
    for (const bad of ['0', '-1', '-7', '91', '100', '1000', '1000000000', '1e9', '1e1', '7.5', '7.0', 'abc', '', ' ', ' 7', '7 ', '+7', '0x10', 'NaN', 'Infinity', '7abc', ['7'], ['7', '30'], { $gt: '1' }, 7, null, true]) {
      assert.equal(parseTimelineDays(bad), null, JSON.stringify(bad));
    }
  });
});

describe('GET /dashboard/activity-timeline', () => {
  test('no days: seven entries, one per day', async () => {
    const out = await timeline(undefined);
    assert.equal(out.status, 200);
    assert.equal(out.body.data.length, 7);
    assert.equal(queries.length, 1);
  });

  test('7, 30 and 90 days return exactly that many entries, oldest first, ending today', async () => {
    for (const days of [7, 30, 90]) {
      const out = await timeline(String(days));
      assert.equal(out.status, 200);
      assert.equal(out.body.data.length, days);
      const dates = out.body.data.map((d: any) => d.date);
      assert.deepEqual([...dates].sort(), dates);
      assert.equal(dates[dates.length - 1], new Date().toISOString().split('T')[0]);
    }
  });

  test('the query is scoped to the caller\'s Mahallu and the requested window', async () => {
    await timeline('30');
    const match = queries[0].arg[0].$match;
    assert.equal(match.tenantId, T_A);
    const span = new Date(match.createdAt.$lte).getTime() - new Date(match.createdAt.$gte).getTime();
    assert.ok(Math.abs(span - 30 * 24 * 60 * 60 * 1000) < 2 * 60 * 60 * 1000, 'window is about 30 days');
  });

  const rejected: Array<[string, unknown]> = [
    ['negative', '-5'],
    ['zero', '0'],
    ['91', '91'],
    ['huge', '1000000000'],
    ['1e9', '1e9'],
    ['non-numeric', 'abc'],
    ['float', '7.5'],
    ['empty string', ''],
    ['array', ['7', '30']],
    ['single-element array', ['7']],
    ['object', { $gt: '0' }],
  ];
  for (const [label, value] of rejected) {
    test(`days = ${label} -> 400 with a clear message and no query`, async () => {
      const start = Date.now();
      const out = await timeline(value);
      assert.equal(out.status, 400);
      assert.equal(out.body.success, false);
      assert.match(out.body.message, /between 1 and 90/);
      assert.equal(queries.length, 0, 'no model query may run for a rejected value');
      assert.ok(Date.now() - start < 1000, 'rejected immediately');
    });
  }

  test('rejected even for a super admin, and before the tenant check', async () => {
    const out = await timeline('1000000000', { tenantId: undefined, isSuperAdmin: true, user: { role: 'super_admin' } });
    assert.equal(out.status, 400);
    assert.equal(queries.length, 0);
    const noTenant = await timeline('1000000000', { tenantId: undefined });
    assert.equal(noTenant.status, 400);
  });

  test('a valid days with no Mahallu is refused (fail closed) and runs no query', async () => {
    const out = await timeline('7', { tenantId: undefined });
    assert.equal(out.status, 403);
    assert.equal(queries.length, 0);
  });
});

describe('the other dashboard handlers fail closed', () => {
  test('without a Mahallu, a non-super-admin gets 403 and no query', async () => {
    for (const fn of [getDashboardStats, getRecentFamilies, getFinancialSummary]) {
      const out = await run(fn, { tenantId: undefined });
      assert.equal(out.status, 403, fn.name);
      assert.equal(queries.length, 0, fn.name);
    }
  });

  test('stats are scoped to the Mahallu', async () => {
    const out = await run(getDashboardStats, {});
    assert.equal(out.status, 200);
    assert.ok(queries.length > 0);
    for (const q of queries) assert.equal(q.arg.tenantId, T_A, q.op);
  });

  test('recent families clamps an oversized limit', async () => {
    const out = await run(getRecentFamilies, { query: { limit: '1000000000' } });
    assert.equal(out.status, 200);
  });

  test('recent families: an institute account gets an empty list and no family query', async () => {
    const out = await run(getRecentFamilies, { user: { role: 'institute', instituteId: INST_1 } });
    assert.equal(out.status, 200);
    assert.deepEqual(out.body, { success: true, data: [] });
    assert.equal(queries.length, 0);
  });
});

describe('GET /dashboard/financial-summary', () => {
  const institute = { user: { role: 'institute', instituteId: INST_1 } };

  test('a Mahallu admin sees the whole Mahallu', async () => {
    const out = await run(getFinancialSummary, {});
    assert.equal(out.status, 200);
    const ledger = queries.filter((q) => q.op === 'LedgerItem.aggregate');
    for (const q of ledger) {
      assert.equal(q.arg[0].$match.tenantId, T_A);
      assert.equal('instituteId' in q.arg[0].$match, false);
    }
    assert.equal(queries.find((q) => q.op === 'InstituteAccount.aggregate')!.arg[0].$match.instituteId, undefined);
  });

  test('an institute admin sees only their own institute: ledger and bank accounts', async () => {
    const out = await run(getFinancialSummary, { ...institute, query: { instituteId: String(new mongoose.Types.ObjectId()), scope: 'mahallu' } });
    assert.equal(out.status, 200);
    const ledger = queries.filter((q) => q.op === 'LedgerItem.aggregate');
    assert.equal(ledger.length, 2);
    for (const q of ledger) {
      assert.equal(q.arg[0].$match.tenantId, T_A);
      assert.equal(q.arg[0].$match.instituteId, INST_1);
    }
    const bank = queries.find((q) => q.op === 'InstituteAccount.aggregate')!.arg[0].$match;
    assert.equal(bank.tenantId, T_A);
    assert.equal(bank.instituteId, INST_1);
  });

  test('an institute account with no institute is refused', async () => {
    const out = await run(getFinancialSummary, { user: { role: 'institute' } });
    assert.equal(out.status, 403);
    assert.equal(queries.length, 0);
  });
});
});
