import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Family from '../models/Family';
import Member from '../models/Member';
import { Wallet } from '../models/Collectible';
import { listWallets } from '../controllers/collectibleController';
import { buildWalletListPipeline } from '../services/walletService';
import { walletListValidation } from '../validations/collectibleValidation';
import { call, oid } from './support/fakeMongo';
import { runPipeline } from './support/pipelineFake';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] walletList', () => {

/**
 * GET /collectibles/wallets: balances for EVERY family / member of the caller's Mahallu, paginated on the
 * server, with the totals over the whole filtered set. The real controller + the real aggregation
 * pipeline run here; only the database is replaced by an in-memory interpreter of that pipeline.
 */

const tenantA = oid();
const tenantB = oid();

let families: any[];
let members: any[];
let wallets: any[];
let pipelines: any[][];
let restore: Array<() => void> = [];

const stubAggregate = (Model: any, source: () => any[]) => {
  const original = Model.aggregate;
  Model.aggregate = (pipeline: any[]) => {
    pipelines.push(pipeline);
    return Promise.resolve(runPipeline(source(), pipeline, { [Wallet.collection.name]: wallets }));
  };
  restore.push(() => (Model.aggregate = original));
};

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Tenant A: 25 families "House 01".."House 25"; families 1..12 have a wallet balanced 100 * i.
 * Tenant B: 3 families, every one with a wallet, and wallets pointing at tenant A families
 * (a leak the aggregation must never count).
 */
beforeEach(() => {
  pipelines = [];
  families = Array.from({ length: 25 }, (_, i) => ({
    _id: oid(),
    tenantId: tenantA,
    houseName: `House ${pad(i + 1)}`,
    mahallId: `A-${pad(i + 1)}`,
    familyHead: `Head ${pad(i + 1)}`,
    status: 'approved',
  }));
  const familiesB = Array.from({ length: 3 }, (_, i) => ({ _id: oid(), tenantId: tenantB, houseName: `Other ${i}`, status: 'approved' }));
  families.push(...familiesB);

  wallets = [];
  families.slice(0, 12).forEach((f, i) => {
    wallets.push({ _id: oid(), tenantId: tenantA, familyId: f._id, key: `f:${f._id}`, balance: 100 * (i + 1), createdAt: new Date(2026, 0, i + 1) });
  });
  // tenant B's own wallets
  familiesB.forEach((f) => wallets.push({ _id: oid(), tenantId: tenantB, familyId: f._id, key: `f:${f._id}`, balance: 7000, createdAt: new Date(2026, 0, 1) }));
  // a tenant B wallet that names a tenant A family (corrupt / hostile data): never to be counted for A
  wallets.push({ _id: oid(), tenantId: tenantB, familyId: families[20]._id, key: `f:${families[20]._id}`, balance: 99999, createdAt: new Date(2026, 0, 1) });

  members = Array.from({ length: 14 }, (_, i) => ({
    _id: oid(),
    tenantId: tenantA,
    familyId: families[i % 3]._id,
    familyName: `House ${pad((i % 3) + 1)}`,
    name: `Member ${pad(i + 1)}`,
    mahallId: `M-${pad(i + 1)}`,
    status: 'active',
  }));
  members.push({ _id: oid(), tenantId: tenantA, familyId: families[0]._id, familyName: 'House 01', name: 'Member Gone', status: 'deleted' });
  members.push({ _id: oid(), tenantId: tenantB, familyId: families[25]._id, familyName: 'Other 0', name: 'Member B', status: 'active' });
  // members 1..5 have a wallet of 10 * i
  members.slice(0, 5).forEach((m, i) => {
    wallets.push({ _id: oid(), tenantId: tenantA, memberId: m._id, familyId: m.familyId, key: `m:${m._id}`, balance: 10 * (i + 1), createdAt: new Date(2026, 1, i + 1) });
  });

  stubAggregate(Family, () => families);
  stubAggregate(Member, () => members);
});

afterEach(() => {
  restore.forEach((fn) => fn());
  restore = [];
});

const admin = (query: Record<string, any>, extra: Record<string, any> = {}) => ({
  tenantId: String(tenantA),
  user: { _id: oid(), role: 'mahall' },
  query,
  ...extra,
});

const FAMILY_TOTAL = (100 * 12 * 13) / 2; // 100 + 200 + ... + 1200 = 7800
const MEMBER_TOTAL = 10 + 20 + 30 + 40 + 50;

describe('family wallets', () => {
  test('25 families, 12 with a wallet: the total is over ALL of them, not the page, and every family is listed', async () => {
    const first = await call(listWallets, admin({ type: 'family', limit: '10' }));
    assert.equal(first.status, 200);
    assert.equal(first.body.success, true);
    assert.equal(first.body.data.length, 10);
    assert.equal(first.body.pagination.total, 25);
    assert.equal(first.body.pagination.totalPages, 3);
    assert.deepEqual(first.body.summary, { totalBalance: FAMILY_TOTAL, count: 25, walletCount: 12, activeCount: 12 });

    // the summary is identical on every page, and the rows of all pages add up to it
    let sum = 0;
    const seen = new Set<string>();
    for (const page of [1, 2, 3]) {
      const reply = await call(listWallets, admin({ type: 'family', limit: '10', page: String(page) }));
      assert.deepEqual(reply.body.summary, first.body.summary, `summary on page ${page}`);
      reply.body.data.forEach((row: any) => {
        sum += row.balance;
        seen.add(row.familyId);
      });
      assert.equal(reply.body.pagination.page, page);
    }
    assert.equal(sum, FAMILY_TOTAL);
    assert.equal(seen.size, 25, 'no family is skipped or repeated across the pages');
  });

  test('page 2 and 3 are the right slices: wallets first by balance, then the empty ones by name', async () => {
    const p1 = await call(listWallets, admin({ type: 'family', limit: '10' }));
    assert.deepEqual(p1.body.data.map((r: any) => r.balance), [1200, 1100, 1000, 900, 800, 700, 600, 500, 400, 300]);
    assert.equal(p1.body.data[0].name, 'House 12');

    const p2 = await call(listWallets, admin({ type: 'family', limit: '10', page: '2' }));
    assert.deepEqual(p2.body.data.slice(0, 2).map((r: any) => r.balance), [200, 100]);
    assert.deepEqual(p2.body.data.slice(2).map((r: any) => r.name), ['House 13', 'House 14', 'House 15', 'House 16', 'House 17', 'House 18', 'House 19', 'House 20']);

    const p3 = await call(listWallets, admin({ type: 'family', limit: '10', page: '3' }));
    assert.deepEqual(p3.body.data.map((r: any) => r.name), ['House 21', 'House 22', 'House 23', 'House 24', 'House 25']);
    assert.equal(p3.body.pagination.skip, 20);

    const beyond = await call(listWallets, admin({ type: 'family', limit: '10', page: '9' }));
    assert.deepEqual(beyond.body.data, []);
    assert.equal(beyond.body.summary.totalBalance, FAMILY_TOTAL, 'the totals do not depend on the page asked for');
  });

  test('a family without a wallet appears with balance 0 and no walletId; one with a wallet carries its walletId', async () => {
    const reply = await call(listWallets, admin({ type: 'family', limit: '100' }));
    assert.equal(reply.body.data.length, 25);
    const empty = reply.body.data.find((r: any) => r.name === 'House 25');
    assert.equal(empty.balance, 0);
    assert.equal(empty.walletId, undefined);
    assert.equal(empty.familyId, String(families[24]._id));
    assert.equal(empty.mahallId, 'A-25');

    const funded = reply.body.data.find((r: any) => r.name === 'House 03');
    assert.equal(funded.balance, 300);
    assert.equal(funded.walletId, String(wallets.find((w) => String(w.familyId) === String(families[2]._id) && w.tenantId === tenantA)._id));
    assert.equal(funded.memberId, undefined);
  });

  test('another Mahallu is never listed or counted, even when its wallet points at one of this Mahallu\'s families', async () => {
    const a = await call(listWallets, admin({ type: 'family', limit: '100' }));
    assert.ok(a.body.data.every((r: any) => !String(r.name).startsWith('Other')));
    assert.equal(a.body.summary.totalBalance, FAMILY_TOTAL, 'the 99999 wallet of tenant B on House 21 is ignored');
    assert.equal(a.body.data.find((r: any) => r.name === 'House 21').balance, 0);

    const b = await call(listWallets, { tenantId: String(tenantB), user: { _id: oid(), role: 'mahall' }, query: { type: 'family' } });
    assert.equal(b.body.summary.count, 3);
    assert.equal(b.body.summary.totalBalance, 21000);
  });

  test('a query tenantId is ignored for a Mahallu admin (the server-side tenant wins)', async () => {
    const reply = await call(listWallets, admin({ type: 'family', limit: '100', tenantId: String(tenantB) }));
    assert.equal(reply.body.summary.count, 25);
    assert.equal(reply.body.summary.totalBalance, FAMILY_TOTAL);
    assert.ok(pipelines.every((p) => String(p[0].$match.tenantId) === String(tenantA)));
  });

  test('legacy duplicate wallets of one family do not double count (the oldest wins, like findWallet)', async () => {
    wallets.push({ _id: oid(), tenantId: tenantA, familyId: families[0]._id, key: undefined, balance: 5000, createdAt: new Date(2030, 0, 1) });
    // and a wallet created before keys existed, without the key field, is still found
    wallets.push({ _id: oid(), tenantId: tenantA, familyId: families[24]._id, balance: 40, createdAt: new Date(2026, 0, 1) });
    const reply = await call(listWallets, admin({ type: 'family', limit: '100' }));
    assert.equal(reply.body.data.find((r: any) => r.name === 'House 01').balance, 100);
    assert.equal(reply.body.data.find((r: any) => r.name === 'House 25').balance, 40);
    assert.equal(reply.body.summary.totalBalance, FAMILY_TOTAL + 40);
    assert.equal(reply.body.summary.walletCount, 13);
  });

  test('a member wallet that names a family is not that family\'s wallet', async () => {
    wallets.push({ _id: oid(), tenantId: tenantA, familyId: families[24]._id, memberId: oid(), key: 'm:x', balance: 777, createdAt: new Date(2026, 0, 1) });
    const reply = await call(listWallets, admin({ type: 'family', limit: '100' }));
    assert.equal(reply.body.data.find((r: any) => r.name === 'House 25').balance, 0);
    assert.equal(reply.body.summary.totalBalance, FAMILY_TOTAL);
  });

  test('the totals are rounded to 2 decimals', async () => {
    wallets.length = 0;
    [0.1, 0.2, 0.7].forEach((balance, i) => wallets.push({ _id: oid(), tenantId: tenantA, familyId: families[i]._id, balance, createdAt: new Date() }));
    const reply = await call(listWallets, admin({ type: 'family', limit: '100' }));
    assert.equal(reply.body.summary.totalBalance, 1);
    assert.equal(reply.body.summary.activeCount, 3);
  });
});

describe('search', () => {
  test('search narrows the list AND the totals to the matching families (by name or Mahall id)', async () => {
    const byName = await call(listWallets, admin({ type: 'family', search: 'house 1' }));
    // House 10..19
    assert.equal(byName.body.summary.count, 10);
    assert.equal(byName.body.summary.totalBalance, 1000 + 1100 + 1200);
    assert.equal(byName.body.pagination.total, 10);

    const byMahallId = await call(listWallets, admin({ type: 'family', search: 'a-07' }));
    assert.equal(byMahallId.body.summary.count, 1);
    assert.equal(byMahallId.body.data[0].name, 'House 07');
    assert.equal(byMahallId.body.summary.totalBalance, 700);

    const none = await call(listWallets, admin({ type: 'family', search: 'zzz' }));
    assert.deepEqual(none.body.data, []);
    assert.deepEqual(none.body.summary, { totalBalance: 0, count: 0, walletCount: 0, activeCount: 0 });
    assert.equal(none.body.pagination.total, 0);
  });

  test('regex metacharacters in the search are literal text, never a pattern', async () => {
    families[0].houseName = 'Casa (Old) [1] a+b';
    const literal = await call(listWallets, admin({ type: 'family', search: '(Old) [1] a+b' }));
    assert.equal(literal.status, 200);
    assert.equal(literal.body.summary.count, 1);

    for (const term of ['.*', '((', '[a-z]+', '^House', 'House 0.', '(a+)+$', '\\']) {
      const reply = await call(listWallets, admin({ type: 'family', search: term }));
      assert.equal(reply.status, 200, `search "${term}" must not break the query`);
      assert.equal(reply.body.summary.count, 0, `search "${term}" matches literal text only`);
    }
    const stage = pipelines[pipelines.length - 1][0].$match;
    assert.equal(typeof stage.$or[0].houseName.$regex, 'string');
  });

  test('an array / object search value (?search[$ne]=x) is ignored rather than injected', async () => {
    const reply = await call(listWallets, admin({ type: 'family', search: { $ne: 'x' }, limit: '100' }));
    assert.equal(reply.status, 200);
    assert.equal(reply.body.summary.count, 25);
    assert.equal(pipelines[0][0].$match.$or, undefined);
  });
});

describe('member wallets', () => {
  test('lists every active member of the Mahallu with wallet balances, totals over all pages', async () => {
    const p1 = await call(listWallets, admin({ type: 'member', limit: '10' }));
    assert.equal(p1.status, 200);
    assert.equal(p1.body.pagination.total, 14, 'deleted members and other Mahallus are left out');
    assert.equal(p1.body.pagination.totalPages, 2);
    assert.deepEqual(p1.body.summary, { totalBalance: MEMBER_TOTAL, count: 14, walletCount: 5, activeCount: 5 });
    assert.deepEqual(p1.body.data.slice(0, 5).map((r: any) => r.balance), [50, 40, 30, 20, 10]);

    const p2 = await call(listWallets, admin({ type: 'member', limit: '10', page: '2' }));
    assert.equal(p2.body.data.length, 4);
    assert.ok(p2.body.data.every((r: any) => r.balance === 0 && r.walletId === undefined));
    assert.deepEqual(p2.body.summary, p1.body.summary);

    const row = p1.body.data[0];
    assert.equal(row.memberId, String(members[4]._id));
    assert.equal(row.name, 'Member 05');
    assert.equal(row.mahallId, 'M-05');
    assert.equal(row.familyId, String(members[4].familyId));
    assert.equal(row.familyName, 'House 02');
    assert.equal(row.familyId === undefined, false);
  });

  test('member search matches name or Mahall id and narrows the totals', async () => {
    const reply = await call(listWallets, admin({ type: 'member', search: 'member 0' }));
    assert.equal(reply.body.summary.count, 9);
    assert.equal(reply.body.summary.totalBalance, MEMBER_TOTAL);
    const byId = await call(listWallets, admin({ type: 'member', search: 'M-03' }));
    assert.equal(byId.body.summary.count, 1);
    assert.equal(byId.body.summary.totalBalance, 30);
  });

  test('a family wallet is not a member wallet', async () => {
    wallets.push({ _id: oid(), tenantId: tenantA, familyId: members[13].familyId, key: 'f:y', balance: 555, createdAt: new Date(2026, 0, 1) });
    const reply = await call(listWallets, admin({ type: 'member', limit: '100' }));
    assert.equal(reply.body.summary.totalBalance, MEMBER_TOTAL);
  });
});

describe('access and limits', () => {
  test('an account without a Mahallu is refused with 403 before any query runs (non-super)', async () => {
    for (const user of [{ _id: oid(), role: 'mahall' }, { _id: oid(), role: 'institute', instituteId: oid() }]) {
      const reply = await call(listWallets, { user, query: { type: 'family' } });
      assert.equal(reply.status, 403, `role ${user.role}`);
      assert.equal(reply.body.success, false);
    }
    assert.equal(pipelines.length, 0);
  });

  test('a super admin must have a Mahallu selected (400) and may name one with ?tenantId=', async () => {
    const none = await call(listWallets, { isSuperAdmin: true, user: { _id: oid(), role: 'super_admin' }, query: { type: 'family' } });
    assert.equal(none.status, 400);
    assert.equal(pipelines.length, 0);

    const named = await call(listWallets, { isSuperAdmin: true, user: { _id: oid(), role: 'super_admin' }, query: { type: 'family', tenantId: String(tenantB) } });
    assert.equal(named.status, 200);
    assert.equal(named.body.summary.count, 3);

    const bad = await call(listWallets, { isSuperAdmin: true, user: { _id: oid(), role: 'super_admin' }, query: { type: 'family', tenantId: 'not-an-id' } });
    assert.equal(bad.status, 400);
  });

  test('limit is capped at 100 and the default is 10; a missing/garbage type is a 400', async () => {
    const big = await call(listWallets, admin({ type: 'family', limit: '1000' }));
    assert.equal(big.body.pagination.limit, 100);
    assert.equal(big.body.data.length, 25);
    const def = await call(listWallets, admin({ type: 'family' }));
    assert.equal(def.body.pagination.limit, 10);
    assert.equal(def.body.data.length, 10);

    for (const type of [undefined, '', 'wallet', ['family', 'member'], { $ne: 'x' }]) {
      const reply = await call(listWallets, admin({ type }));
      if (Array.isArray(type)) assert.equal(reply.status, 200, 'the first array value is used');
      else assert.equal(reply.status, 400, `type ${JSON.stringify(type)}`);
    }
  });

  test('the whole list is ONE aggregation (no per-family query)', async () => {
    await call(listWallets, admin({ type: 'family', limit: '100' }));
    assert.equal(pipelines.length, 1);
    const stages = pipelines[0].map((s) => Object.keys(s)[0]);
    assert.deepEqual(stages, ['$match', '$lookup', '$unwind', '$project', '$facet']);
  });

  test('the wallet join is tenant-checked on both sides', () => {
    const pipeline = buildWalletListPipeline({ type: 'family', tenantId: tenantA, skip: 0, limit: 10 });
    assert.equal(String((pipeline[0] as any).$match.tenantId), String(tenantA));
    const lookupMatch = (pipeline[1] as any).$lookup.pipeline[0].$match.$expr.$and;
    assert.ok(lookupMatch.some((c: any) => c.$eq && c.$eq[0] === '$tenantId' && String(c.$eq[1]) === String(tenantA)));
  });
});

describe('query validators (what the route runs before the controller)', () => {
  const run = async (query: Record<string, any>) => {
    const req: any = { query, body: {}, params: {}, headers: {} };
    await Promise.all(walletListValidation.map((chain) => chain.run(req)));
    return validationResult(req).array().map((e: any) => e.path);
  };

  test('accepts valid input', async () => {
    assert.deepEqual(await run({ type: 'family', page: '2', limit: '100', search: 'abc' }), []);
    assert.deepEqual(await run({ type: 'member' }), []);
  });

  test('rejects a missing or unknown type, bad paging, limit above 100 and an oversized search', async () => {
    assert.deepEqual(await run({}), ['type']);
    assert.deepEqual(await run({ type: 'zakat' }), ['type']);
    assert.deepEqual(await run({ type: 'family', limit: '101' }), ['limit']);
    assert.deepEqual(await run({ type: 'family', limit: '0' }), ['limit']);
    assert.deepEqual(await run({ type: 'family', page: '0' }), ['page']);
    assert.deepEqual(await run({ type: 'family', page: 'abc' }), ['page']);
    assert.deepEqual(await run({ type: 'family', search: 'x'.repeat(101) }), ['search']);
  });
});

});
