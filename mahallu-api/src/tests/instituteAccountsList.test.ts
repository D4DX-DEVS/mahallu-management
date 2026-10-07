import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { InstituteAccount } from '../models/MasterAccount';
import { getAllInstituteAccounts } from '../controllers/masterAccountController';
import { call, oid, installFake, Installed } from './support/fakeMongo';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] instituteAccountsList', () => {

/**
 * GET /master-accounts/institute (the Institute Accounts page and its export): who sees which accounts,
 * and that `search` is applied on the server so the visible list, its totals and an export of every page
 * are the same filtered set. The real controller runs against an in-memory InstituteAccount.
 */

const tenantA = oid();
const tenantB = oid();
const instA1 = oid();
const instA2 = oid();
const instB1 = oid();

let installed: Installed;
let accounts: any[];

const account = (tenantId: any, instituteId: any, n: number, over: Record<string, any> = {}) => ({
  _id: oid(),
  tenantId,
  instituteId,
  accountName: `Account ${n}`,
  accountNumber: String(1000 + n),
  bankName: n % 2 ? 'Federal Bank' : 'SBI',
  ifscCode: `IFSC000${n}`,
  balance: n * 10,
  status: 'active',
  ...over,
});

beforeEach(() => {
  accounts = [
    // tenant A: institute 1 has 15 accounts, institute 2 has 4
    ...Array.from({ length: 15 }, (_, i) => account(tenantA, instA1, i + 1)),
    ...Array.from({ length: 4 }, (_, i) => account(tenantA, instA2, i + 101)),
    // tenant B
    ...Array.from({ length: 3 }, (_, i) => account(tenantB, instB1, i + 201)),
  ];
  installed = installFake(InstituteAccount, accounts);
});
afterEach(() => installed.restore());

const mahallu = (query: Record<string, any>, tenantId = tenantA) => ({
  tenantId: String(tenantId),
  user: { _id: oid(), role: 'mahall' },
  query,
});
const institute = (instituteId: any, query: Record<string, any>, tenantId = tenantA) => ({
  tenantId: String(tenantId),
  user: { _id: oid(), role: 'institute', instituteId },
  query,
});

const idsOf = (reply: any) => reply.body.data.map((a: any) => String(a._id));
const inst = (a: any) => String(a.instituteId?._id ?? a.instituteId);

describe('institute role', () => {
  test('is pinned to its OWN institute, whatever instituteId or scope the request carries', async () => {
    for (const query of [
      {},
      { instituteId: String(instA2) },
      { instituteId: String(instB1) },
      { scope: 'mahallu' },
      { instituteId: String(instA2), scope: 'mahallu', limit: '100' },
    ]) {
      const reply = await call(getAllInstituteAccounts, institute(instA1, { limit: '100', ...query }));
      assert.equal(reply.status, 200);
      assert.equal(reply.body.data.length, 15, JSON.stringify(query));
      assert.ok(reply.body.data.every((a: any) => inst(a) === String(instA1)), JSON.stringify(query));
      assert.equal(reply.body.pagination.total, 15);
      assert.equal(reply.body.summary.count, 15);
      assert.equal(reply.body.summary.totalBalance, (15 * 16 * 10) / 2, 'totals cover only its own institute');
    }
  });

  test('another institute of the same Mahallu is never visible, even by naming it', async () => {
    const reply = await call(getAllInstituteAccounts, institute(instA2, { instituteId: String(instA1), limit: '100' }));
    assert.equal(reply.body.data.length, 4);
    assert.ok(reply.body.data.every((a: any) => inst(a) === String(instA2)));
  });

  test('an institute account not linked to any institute, or without a Mahallu, gets 403', async () => {
    const unlinked = await call(getAllInstituteAccounts, { tenantId: String(tenantA), user: { _id: oid(), role: 'institute' }, query: {} });
    assert.equal(unlinked.status, 403);
    const noTenant = await call(getAllInstituteAccounts, { user: { _id: oid(), role: 'institute', instituteId: instA1 }, query: {} });
    assert.equal(noTenant.status, 403);
    assert.equal(installed.store.count('find'), 0, 'no query ran');
  });

  test('search is applied within its own institute only', async () => {
    const reply = await call(getAllInstituteAccounts, institute(instA1, { search: 'Account 10', instituteId: String(instA2) }));
    assert.equal(reply.body.data.length, 1);
    assert.equal(reply.body.data[0].accountName, 'Account 10');
    const other = await call(getAllInstituteAccounts, institute(instA1, { search: 'Account 101' }));
    assert.equal(other.body.data.length, 0, 'an account of a sibling institute is not found by search');
  });
});

describe('Mahallu admin', () => {
  test('without a filter sees every institute of the own Mahallu and nothing from another', async () => {
    const reply = await call(getAllInstituteAccounts, mahallu({ limit: '100' }));
    assert.equal(reply.body.data.length, 19);
    assert.ok(reply.body.data.every((a: any) => [String(instA1), String(instA2)].includes(inst(a))));
    assert.equal(reply.body.summary.count, 19);
  });

  test('instituteId narrows to that institute (list, pagination and totals agree)', async () => {
    const reply = await call(getAllInstituteAccounts, mahallu({ instituteId: String(instA2), limit: '10' }));
    assert.equal(reply.body.data.length, 4);
    assert.equal(reply.body.pagination.total, 4);
    assert.equal(reply.body.summary.count, 4);
    assert.equal(reply.body.summary.totalBalance, (101 + 102 + 103 + 104) * 10);
  });

  test('an instituteId that belongs to ANOTHER Mahallu returns nothing (the tenant is always part of the filter)', async () => {
    const reply = await call(getAllInstituteAccounts, mahallu({ instituteId: String(instB1), limit: '100' }));
    assert.equal(reply.status, 200);
    assert.deepEqual(reply.body.data, []);
    assert.equal(reply.body.pagination.total, 0);
    assert.deepEqual(reply.body.summary, { totalBalance: 0, count: 0 });
  });

  test('a query tenantId cannot switch Mahallu', async () => {
    const reply = await call(getAllInstituteAccounts, mahallu({ tenantId: String(tenantB), limit: '100' }));
    assert.equal(reply.body.data.length, 19);
    assert.ok(reply.body.data.every((a: any) => String(a.tenantId) === String(tenantA)));
  });

  test('a malformed instituteId is a 400, and an account without a Mahallu is a 403', async () => {
    const bad = await call(getAllInstituteAccounts, mahallu({ instituteId: 'nope' }));
    assert.equal(bad.status, 400);
    const noTenant = await call(getAllInstituteAccounts, { user: { _id: oid(), role: 'mahall' }, query: {} });
    assert.equal(noTenant.status, 403);
  });
});

describe('server-side search (what the export relies on)', () => {
  test('search matches name, bank, number and IFSC, narrows the list AND the totals, case-insensitively', async () => {
    const byBank = await call(getAllInstituteAccounts, mahallu({ search: 'federal', limit: '100' }));
    assert.ok(byBank.body.data.length > 0);
    assert.ok(byBank.body.data.every((a: any) => a.bankName === 'Federal Bank'));
    assert.equal(byBank.body.summary.count, byBank.body.data.length);
    assert.equal(byBank.body.summary.totalBalance, byBank.body.data.reduce((s: number, a: any) => s + a.balance, 0));

    assert.equal((await call(getAllInstituteAccounts, mahallu({ search: '1007' }))).body.data[0].accountName, 'Account 7');
    assert.equal((await call(getAllInstituteAccounts, mahallu({ search: 'ifsc0003' }))).body.data[0].accountName, 'Account 3');
  });

  test('regex metacharacters are literal text', async () => {
    installed.store.docs[0].accountName = 'Zakat (Fund) [A] a+b';
    for (const term of ['.*', '((', '[a-z]+', '^Account', '(a+)+$', '\\']) {
      const reply = await call(getAllInstituteAccounts, mahallu({ search: term }));
      assert.equal(reply.status, 200, term);
      assert.equal(reply.body.summary.count, 0, term);
    }
    const literal = await call(getAllInstituteAccounts, mahallu({ search: '(Fund) [A] a+b' }));
    assert.equal(literal.body.summary.count, 1);
  });

  test('an object/array search value is ignored, not injected', async () => {
    const reply = await call(getAllInstituteAccounts, mahallu({ search: { $ne: 'x' }, limit: '100' }));
    assert.equal(reply.body.data.length, 19);
  });

  test('paging through ALL pages with the same filters gives exactly the filtered set (the export)', async () => {
    const filters = { instituteId: String(instA1), search: 'Account 1' }; // Account 1, 10..15 of institute A1
    const expected = accounts
      .filter((a) => String(a.instituteId) === String(instA1) && /Account 1/i.test(a.accountName))
      .map((a) => String(a._id));
    assert.equal(expected.length, 7);

    const exported: string[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const reply = await call(getAllInstituteAccounts, mahallu({ ...filters, page: String(page), limit: '3' }));
      exported.push(...idsOf(reply));
      if (page >= reply.body.pagination.totalPages) break;
    }
    assert.equal(exported.length, 7);
    assert.deepEqual([...exported].sort(), [...expected].sort());
    assert.equal(new Set(exported).size, 7, 'no row twice across pages');
  });
});

});
