import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { LedgerItem, Ledger, Category, InstituteAccount, MahalluAccount, MasterWallet } from '../models/MasterAccount';
import Institute from '../models/Institute';
import Employee from '../models/Employee';
import SalaryPayment from '../models/SalaryPayment';
import { PettyCash, PettyCashTransaction } from '../models/PettyCash';
import HealthResource from '../models/HealthResource';
import Member from '../models/Member';
import { DevelopmentProject } from '../models/DevelopmentProject';
import {
  getDayBook,
  getTrialBalance,
  getBalanceSheet,
  getLedgerReport,
  getIncomeExpenditure,
  getConsolidatedReport,
} from '../controllers/accountingReportController';
import * as master from '../controllers/masterAccountController';
import * as salary from '../controllers/salaryController';
import * as petty from '../controllers/pettyCashController';
import * as health from '../controllers/healthResourceController';

/**
 * Institute privacy and tenant scoping of the finance controllers.
 *
 * The guarantee: an institute admin only ever reads or writes THEIR institute's records. `scope`,
 * `includeEntities`, `instituteId` and `ledgerId` from the client can never widen that; Mahallu-level
 * records (instituteId null), sibling institutes' records and other Mahallus' records are refused;
 * a body can neither set tenantId/instituteId nor reference foreign ids; and a non-super-admin with
 * no Mahallu is refused instead of getting an unscoped query.
 *
 * Models are stubbed (no database, matching this project's other suites), so each assertion is on
 * the exact filter the controller handed to the model, or on a model call that must NOT happen.
 */

const oid = () => new mongoose.Types.ObjectId();
const T_A = String(oid());
const T_B = String(oid());
const INST_1 = String(oid()); // the institute admin's own institute (tenant A)
const INST_2 = String(oid()); // a sibling institute in tenant A
const INST_X = String(oid()); // an institute of tenant B

type Call = { op: string; [k: string]: any };
const calls: Call[] = [];
const store: Record<string, any[]> = {};
const restorers: Array<() => void> = [];

const stub = (target: any, key: string, impl: any) => {
  const original = target[key];
  target[key] = impl;
  restorers.push(() => {
    target[key] = original;
  });
};

/** JSON-stable view of a filter/pipeline: ObjectIds become hex strings, Dates ISO strings. */
const plain = (value: any): any => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/** A thenable query: every builder method returns itself and awaiting yields `result`. */
const chain = (result: any): any => {
  const c: any = {
    populate: () => c,
    select: () => c,
    sort: () => c,
    skip: () => c,
    limit: () => c,
    lean: () => c,
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return c;
};

const same = (a: any, b: any) => String(a?._id ?? a) === String(b?._id ?? b);

/** Just enough of Mongo's matching to let findOne/find honour tenant/institute/_id filters. */
const matches = (doc: any, filter: any): boolean =>
  Object.entries(filter || {}).every(([key, expected]: [string, any]) => {
    if (key.startsWith('$')) return true;
    const actual = doc[key];
    if (expected === null) return actual === null || actual === undefined;
    if (expected && typeof expected === 'object' && !(expected instanceof mongoose.Types.ObjectId)) {
      if (Array.isArray(expected.$in)) return expected.$in.some((v: any) => same(v, actual));
      if (Array.isArray(expected.$nin)) return !expected.$nin.some((v: any) => same(v, actual));
      return true;
    }
    return same(actual, expected);
  });

const stubModel = (Model: any) => {
  const name: string = Model.modelName;
  const docs = () => store[name] || [];
  stub(Model, 'find', (filter: any) => {
    calls.push({ op: `${name}.find`, filter: plain(filter) });
    return chain(docs().filter((d) => matches(d, filter)));
  });
  stub(Model, 'findOne', (filter: any) => {
    calls.push({ op: `${name}.findOne`, filter: plain(filter) });
    return chain(docs().find((d) => matches(d, filter)) || null);
  });
  stub(Model, 'findById', (id: any) => {
    calls.push({ op: `${name}.findById`, id: String(id) });
    return chain(docs().find((d) => same(d._id, id)) || null);
  });
  stub(Model, 'countDocuments', (filter: any) => {
    calls.push({ op: `${name}.countDocuments`, filter: plain(filter) });
    return chain(0);
  });
  stub(Model, 'aggregate', (pipeline: any) => {
    calls.push({ op: `${name}.aggregate`, pipeline: plain(pipeline) });
    return chain([]);
  });
  stub(Model, 'findByIdAndUpdate', (id: any, data: any) => {
    calls.push({ op: `${name}.update`, id: String(id), data: plain(data) });
    const existing = docs().find((d) => same(d._id, id)) || {};
    return chain({ ...existing, ...data, _id: id });
  });
  stub(Model, 'findOneAndUpdate', (filter: any, data: any) => {
    calls.push({ op: `${name}.update`, filter: plain(filter), data: plain(data) });
    const existing = docs().find((d) => matches(d, filter));
    const applied = data && (data.$set || data.$inc) ? { ...(data.$set || {}) } : data;
    return chain(existing ? { ...existing, ...applied, _id: existing._id } : null);
  });
  stub(Model, 'updateOne', (filter: any, data: any) => {
    calls.push({ op: `${name}.updateOne`, filter: plain(filter), data: plain(data) });
    return chain({});
  });
  stub(Model, 'findByIdAndDelete', (id: any) => {
    calls.push({ op: `${name}.delete`, id: String(id) });
    return chain(null);
  });
  stub(Model, 'deleteMany', () => chain({}));
  stub(Model, 'deleteOne', (filter: any) => {
    calls.push({ op: `${name}.delete`, filter: plain(filter) });
    return chain({});
  });
  stub(Model, 'create', async (data: any) => {
    calls.push({ op: `${name}.create`, doc: plain(data) });
    return { ...data };
  });
  stub(Model.prototype, 'save', async function (this: any) {
    calls.push({ op: `${name}.save`, doc: plain(this.toObject()) });
    return this;
  });
};

// Hooks live inside this suite so the stubs below never leak into the other suites when everything
// runs in one process (npm test).
describe('institute privacy', () => {
  before(() => {
    [
      LedgerItem, Ledger, Category, InstituteAccount, MahalluAccount, MasterWallet, Institute, Employee,
      SalaryPayment, PettyCash, PettyCashTransaction, HealthResource, Member, DevelopmentProject,
    ].forEach(stubModel);
  });
  after(() => restorers.reverse().forEach((r) => r()));

  const doc = (tenant: string, institute: string | null, extra: Record<string, any> = {}) => ({
    _id: oid(),
    tenantId: tenant,
    instituteId: institute,
    ...extra,
  });

  const seed = (name: string, ...rows: any[]) => {
    store[name] = [...(store[name] || []), ...rows];
    return rows[0];
  };

  beforeEach(() => {
    calls.length = 0;
    for (const k of Object.keys(store)) delete store[k];
  });

  const callsOf = (op: string) => calls.filter((c) => c.op === op);
  const noWrites = () => calls.filter((c) => /\.(save|update|delete|create)$/.test(c.op));

  const run = async (fn: any, req: Record<string, any>) => {
    calls.length = 0;
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
    await fn({ params: {}, query: {}, body: {}, headers: {}, ...req }, res);
    return out;
  };

  const asInstitute = (extra: Record<string, any> = {}) => ({
    tenantId: T_A,
    isSuperAdmin: false,
    user: { role: 'institute', instituteId: INST_1, tenantId: T_A },
    ...extra,
  });
  const asMahall = (extra: Record<string, any> = {}) => ({
    tenantId: T_A,
    isSuperAdmin: false,
    user: { role: 'mahall', tenantId: T_A },
    ...extra,
  });
  const asSuper = (extra: Record<string, any> = {}) => ({
    tenantId: undefined,
    isSuperAdmin: true,
    user: { role: 'super_admin' },
    ...extra,
  });
  /** A staff account with no Mahallu (authMiddleware refuses these, this is the defence in depth). */
  const noTenant = (role: string) => ({
    tenantId: undefined,
    isSuperAdmin: false,
    user: { role, instituteId: role === 'institute' ? INST_1 : undefined },
  });

  const OWN_ONLY = { tenantId: T_A, instituteId: INST_1 };
  const firstMatch = (op: string, index = 0) => callsOf(op)[index].pipeline[0].$match;

  // ─────────────────────────────── accounting reports ───────────────────────────────

  describe('reports: an institute admin is pinned to their own institute', () => {
    test('scope=mahallu is ignored (day book)', async () => {
      const out = await run(getDayBook, asInstitute({ query: { scope: 'mahallu' } }));
      assert.equal(out.status, 200);
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter, OWN_ONLY);
    });

    test('scope=combined naming Mahallu and a sibling institute is ignored (trial balance)', async () => {
      const out = await run(getTrialBalance, asInstitute({ query: { scope: 'combined', includeEntities: `mahallu,${INST_2}` } }));
      assert.equal(out.status, 200);
      assert.deepEqual(firstMatch('LedgerItem.aggregate'), OWN_ONLY);
    });

    test("a foreign instituteId is ignored (income & expenditure) and so is a combined list that omits the caller's own", async () => {
      await run(getIncomeExpenditure, asInstitute({ query: { instituteId: INST_2 } }));
      assert.deepEqual(firstMatch('LedgerItem.aggregate', 0), OWN_ONLY);
      assert.deepEqual(firstMatch('LedgerItem.aggregate', 1), OWN_ONLY);
      await run(getIncomeExpenditure, asInstitute({ query: { scope: 'combined', includeEntities: INST_2, instituteId: INST_2 } }));
      assert.deepEqual(firstMatch('LedgerItem.aggregate', 0), OWN_ONLY);
    });

    test("the balance sheet's bank accounts are the institute's own only; Mahallu accounts are never read", async () => {
      const out = await run(getBalanceSheet, asInstitute({ query: { scope: 'mahallu' } }));
      assert.equal(out.status, 200);
      assert.deepEqual(firstMatch('LedgerItem.aggregate', 0), OWN_ONLY);
      assert.deepEqual(callsOf('InstituteAccount.find')[0].filter, { ...OWN_ONLY, status: 'active' });
      assert.equal(callsOf('MahalluAccount.find').length, 0);

      await run(getBalanceSheet, asInstitute({ query: { scope: 'combined', includeEntities: `mahallu,${INST_2}` } }));
      assert.deepEqual(callsOf('InstituteAccount.find')[0].filter, { ...OWN_ONLY, status: 'active' });
      assert.equal(callsOf('MahalluAccount.find').length, 0);
    });

    test('the consolidated report shows only their own institute: no Mahallu row, no sibling institutes', async () => {
      const out = await run(getConsolidatedReport, asInstitute({ query: { instituteId: INST_2 } }));
      assert.equal(out.status, 200);
      assert.deepEqual(firstMatch('LedgerItem.aggregate', 0), OWN_ONLY);
      assert.deepEqual(callsOf('InstituteAccount.aggregate')[0].pipeline[0].$match, { status: 'active', ...OWN_ONLY });
      assert.equal(callsOf('MahalluAccount.aggregate').length, 0);
      assert.equal(callsOf('LedgerItem.aggregate').length, 1, 'no Mahallu-level ledger aggregation');
      assert.equal(out.body.data.institutes.some((i: any) => i.instituteId === null), false);
    });

    test("the ledger report refuses another institute's ledger, a Mahallu-level ledger and another Mahallu's ledger", async () => {
      const foreign = seed('Ledger', doc(T_A, INST_2, { name: 'Sibling', type: 'income' }));
      const mahalluLevel = seed('Ledger', doc(T_A, null, { name: 'Mahallu', type: 'income' }));
      const otherTenant = seed('Ledger', doc(T_B, INST_X, { name: 'Other Mahallu', type: 'income' }));
      for (const ledger of [foreign, mahalluLevel, otherTenant]) {
        const out = await run(getLedgerReport, asInstitute({ query: { ledgerId: String(ledger._id) } }));
        assert.equal(out.status, 403);
        assert.equal(callsOf('LedgerItem.find').length + callsOf('LedgerItem.aggregate').length, 0);
        assert.equal(JSON.stringify(out.body).includes(ledger.name), false, 'the foreign ledger name must not leak');
      }
    });

    test("the ledger report serves the caller's own ledger, with the institute filter forced", async () => {
      const own = seed('Ledger', doc(T_A, INST_1, { name: 'Fees', type: 'income' }));
      const out = await run(getLedgerReport, asInstitute({ query: { ledgerId: String(own._id), scope: 'mahallu' } }));
      assert.equal(out.status, 200);
      assert.equal(out.body.data.ledger.name, 'Fees');
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter, { ...OWN_ONLY, ledgerId: String(own._id) });
    });

    test("a Mahallu admin cannot open another Mahallu's ledger either, and a missing one is 404", async () => {
      const otherTenant = seed('Ledger', doc(T_B, INST_X, { name: 'Other', type: 'income' }));
      assert.equal((await run(getLedgerReport, asMahall({ query: { ledgerId: String(otherTenant._id) } }))).status, 403);
      assert.equal((await run(getLedgerReport, asMahall({ query: { ledgerId: String(oid()) } }))).status, 404);
    });
  });

  describe('reports: Mahallu admins and super admins keep Mahallu-wide access', () => {
    test('scope=mahallu, combined and a plain instituteId behave as before', async () => {
      await run(getDayBook, asMahall({ query: { scope: 'mahallu' } }));
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter, { tenantId: T_A, instituteId: null });

      await run(getDayBook, asMahall({ query: { scope: 'combined', includeEntities: `mahallu,${INST_1},${INST_2}` } }));
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter, {
        tenantId: T_A,
        $or: [{ instituteId: null }, { instituteId: { $in: [INST_1, INST_2] } }],
      });

      await run(getDayBook, asMahall({ query: { instituteId: INST_2 } }));
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter, { tenantId: T_A, instituteId: INST_2 });

      await run(getDayBook, asMahall());
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter, { tenantId: T_A });
    });

    test("the consolidated report includes the Mahallu's own row and every institute; ?instituteId narrows to one", async () => {
      const all = await run(getConsolidatedReport, asMahall());
      assert.equal(all.status, 200);
      assert.deepEqual(firstMatch('LedgerItem.aggregate', 0), { tenantId: T_A });
      assert.equal(callsOf('MahalluAccount.aggregate').length, 1);
      assert.equal(all.body.data.institutes[0].instituteName, 'Mahallu (Main)');

      await run(getConsolidatedReport, asMahall({ query: { instituteId: INST_2 } }));
      assert.deepEqual(firstMatch('LedgerItem.aggregate', 0), { tenantId: T_A, instituteId: INST_2 });
      assert.equal(callsOf('MahalluAccount.aggregate').length, 0);
    });

    test('a super admin with no Mahallu selected is not pinned to one; with one selected they are', async () => {
      await run(getDayBook, asSuper({ query: { scope: 'mahallu' } }));
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter, { instituteId: null });
      await run(getDayBook, asSuper({ tenantId: T_B }));
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter, { tenantId: T_B });
    });

    test('the balance sheet reads Mahallu bank accounts for scope=mahallu', async () => {
      await run(getBalanceSheet, asMahall({ query: { scope: 'mahallu' } }));
      assert.deepEqual(callsOf('MahalluAccount.find')[0].filter, { tenantId: T_A, status: 'active' });
    });
  });

  describe('reports: bad ids and dates answer 400, not 500', () => {
    const allReports = [getDayBook, getTrialBalance, getBalanceSheet, getLedgerReport, getIncomeExpenditure, getConsolidatedReport];
    /** [label, query, handlers it applies to] */
    const bad: Array<[string, Record<string, any>, any[]]> = [
      ['ledgerId', { ledgerId: 'not-an-id' }, [getLedgerReport]],
      ['12-char ledgerId', { ledgerId: 'aaaaaaaaaaaa' }, [getLedgerReport]],
      ['array ledgerId', { ledgerId: [INST_1, INST_2] }, [getLedgerReport]],
      ['instituteId', { ledgerId: String(oid()), instituteId: 'zzz' }, allReports],
      ['includeEntities item', { ledgerId: String(oid()), scope: 'combined', includeEntities: `mahallu,${INST_1},bogus` }, allReports],
      ['startDate', { ledgerId: String(oid()), startDate: 'garbage' }, allReports],
      ['endDate', { ledgerId: String(oid()), endDate: '2025-13-45' }, allReports],
      ['array date', { ledgerId: String(oid()), startDate: ['2025-01-01', '2025-02-01'] }, allReports],
      ['reversed range', { ledgerId: String(oid()), startDate: '2025-05-01', endDate: '2025-04-01' }, allReports],
    ];
    for (const [label, query, handlers] of bad) {
      test(`invalid ${label}`, async () => {
        for (const fn of handlers) {
          for (const who of [asMahall, asSuper]) {
            const out = await run(fn, who({ query }));
            assert.equal(out.status, 400, `${fn.name} ${label}`);
            assert.equal(typeof out.body.message, 'string');
            assert.doesNotMatch(out.body.message, /BSON|ObjectId|Cast/i);
            assert.equal(calls.length, 0, 'no query ran');
          }
        }
      });
    }

    test('an institute admin still gets 400 for a malformed date or ledger id', async () => {
      assert.equal((await run(getDayBook, asInstitute({ query: { startDate: 'nope' } }))).status, 400);
      assert.equal((await run(getLedgerReport, asInstitute({ query: { ledgerId: 'x' } }))).status, 400);
    });

    test('a date-only endDate covers the whole last day; a timestamp is used as given', async () => {
      await run(getDayBook, asMahall({ query: { startDate: '2025-03-01', endDate: '2025-03-31' } }));
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter.date, {
        $gte: '2025-03-01T00:00:00.000Z',
        $lte: '2025-03-31T23:59:59.999Z',
      });
      await run(getDayBook, asMahall({ query: { endDate: '2025-03-31T10:00:00.000Z' } }));
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter.date, { $lte: '2025-03-31T10:00:00.000Z' });
    });
  });

  // ─────────────────────────────── master accounts ───────────────────────────────

  describe('master accounts: lists', () => {
    test('institute admin: scope, instituteId and tenantId from the client never widen a list', async () => {
      const query = { scope: 'mahallu', instituteId: INST_2, tenantId: T_B };
      await run(master.getAllLedgers, asInstitute({ query }));
      assert.deepEqual(callsOf('Ledger.find')[0].filter, OWN_ONLY);
      await run(master.getAllCategories, asInstitute({ query }));
      assert.deepEqual(callsOf('Category.find')[0].filter, OWN_ONLY);
      await run(master.getAllInstituteAccounts, asInstitute({ query }));
      assert.deepEqual(callsOf('InstituteAccount.find')[0].filter, OWN_ONLY);
      await run(master.getLedgerItems, asInstitute({ query }));
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter, OWN_ONLY);
      assert.deepEqual(callsOf('LedgerItem.countDocuments')[0].filter, OWN_ONLY);
    });

    test("ledger items: a foreign ledgerId can only narrow the caller's own rows, so it returns nothing of anyone else's", async () => {
      const foreignLedger = String(oid());
      await run(master.getLedgerItems, asInstitute({ query: { ledgerId: foreignLedger, scope: 'mahallu' } }));
      assert.deepEqual(callsOf('LedgerItem.find')[0].filter, { ...OWN_ONLY, ledgerId: foreignLedger });
    });

    test('Mahallu-level collections (wallets, Mahallu bank accounts) are empty for an institute admin and never queried', async () => {
      for (const fn of [master.getAllWallets, master.getAllMahalluAccounts]) {
        const out = await run(fn, asInstitute());
        assert.equal(out.status, 200);
        assert.deepEqual(out.body.data, []);
        assert.equal(out.body.pagination.total, 0);
        assert.equal(calls.length, 0);
      }
    });

    test('mahall: scope=mahallu and instituteId behave as before, always inside their own Mahallu', async () => {
      await run(master.getAllLedgers, asMahall({ query: { scope: 'mahallu', type: 'income' } }));
      assert.deepEqual(callsOf('Ledger.find')[0].filter, { tenantId: T_A, type: 'income', instituteId: null });
      await run(master.getAllCategories, asMahall({ query: { instituteId: INST_2 } }));
      assert.deepEqual(callsOf('Category.find')[0].filter, { tenantId: T_A, instituteId: INST_2 });
      await run(master.getAllMahalluAccounts, asMahall({ query: { tenantId: T_B } }));
      assert.deepEqual(callsOf('MahalluAccount.find')[0].filter, { tenantId: T_A });
      await run(master.getAllWallets, asMahall());
      assert.deepEqual(callsOf('MasterWallet.find')[0].filter, { tenantId: T_A });
    });

    test('super admin: unpinned without a Mahallu; ?tenantId must be a real id', async () => {
      await run(master.getAllLedgers, asSuper({ query: { scope: 'mahallu' } }));
      assert.deepEqual(callsOf('Ledger.find')[0].filter, { instituteId: null });
      await run(master.getAllLedgers, asSuper({ query: { tenantId: T_B } }));
      assert.deepEqual(callsOf('Ledger.find')[0].filter, { tenantId: T_B });
      assert.equal((await run(master.getAllLedgers, asSuper({ query: { tenantId: 'x' } }))).status, 400);
    });

    test('bad ids and dates in a list query are 400 and run no query', async () => {
      for (const query of [{ instituteId: 'zzz' }, { ledgerId: 'zzz' }, { startDate: 'bad' }, { endDate: '2025-02-30x' }]) {
        const out = await run(master.getLedgerItems, asMahall({ query }));
        assert.equal(out.status, 400, JSON.stringify(query));
        assert.equal(calls.length, 0);
      }
      assert.equal((await run(master.getAllLedgers, asMahall({ query: { instituteId: ['a', 'b'] } }))).status, 400);
      assert.equal((await run(master.getAllCategories, asInstitute({ query: { instituteId: 'zzz' } }))).status, 200, 'ignored for the institute role');
      const out = await run(master.getLedgerItems, asMahall({ query: { endDate: '2025-03-31' } }));
      assert.equal(callsOf('LedgerItem.find')[0].filter.date.$lte, '2025-03-31T23:59:59.999Z');
      assert.equal(out.status, 200);
    });

    test('a user with no Mahallu is refused on every list instead of getting an unscoped query', async () => {
      for (const role of ['mahall', 'institute', 'survey']) {
        for (const fn of [
          master.getAllInstituteAccounts, master.getAllCategories, master.getAllWallets, master.getAllLedgers,
          master.getLedgerItems, master.getAllMahalluAccounts, salary.getAllSalaryPayments, salary.getSalarySummary,
          petty.getAllPettyCash, getDayBook, getTrialBalance, getBalanceSheet, getIncomeExpenditure, getConsolidatedReport,
        ]) {
          const out = await run(fn, noTenant(role));
          assert.equal(out.status, 403, `${role} ${fn.name}`);
          assert.equal(calls.length, 0, `${fn.name} must not query`);
        }
      }
    });

    test('an institute account with no institute is refused too', async () => {
      const out = await run(master.getAllLedgers, { tenantId: T_A, isSuperAdmin: false, user: { role: 'institute' } });
      assert.equal(out.status, 403);
      assert.equal(calls.length, 0);
    });
  });

  describe('master accounts: by id', () => {
    /** [handler, model name, whether the model has an institute] */
    const byId: Array<[string, any, string, boolean]> = [
      ['updateInstituteAccount', master.updateInstituteAccount, 'InstituteAccount', true],
      ['deleteInstituteAccount', master.deleteInstituteAccount, 'InstituteAccount', true],
      ['updateCategory', master.updateCategory, 'Category', true],
      ['deleteCategory', master.deleteCategory, 'Category', true],
      ['updateLedger', master.updateLedger, 'Ledger', true],
      ['deleteLedger', master.deleteLedger, 'Ledger', true],
      ['updateLedgerItem', master.updateLedgerItem, 'LedgerItem', true],
      ['deleteLedgerItem', master.deleteLedgerItem, 'LedgerItem', true],
      ['updateWallet', master.updateWallet, 'MasterWallet', false],
      ['deleteWallet', master.deleteWallet, 'MasterWallet', false],
      ['updateMahalluAccount', master.updateMahalluAccount, 'MahalluAccount', false],
      ['deleteMahalluAccount', master.deleteMahalluAccount, 'MahalluAccount', false],
    ];

    for (const [name, fn, model, hasInstitute] of byId) {
      test(`${name}: institute admin refused for a sibling institute's, a Mahallu-level and another Mahallu's record`, async () => {
        const foreign = seed(model, doc(T_A, INST_2, { source: 'manual' }));
        const mahalluLevel = seed(model, doc(T_A, null, { source: 'manual' }));
        const otherTenant = seed(model, doc(T_B, INST_X, { source: 'manual' }));
        for (const record of [foreign, mahalluLevel, otherTenant]) {
          const out = await run(fn, asInstitute({ params: { id: String(record._id) }, body: { name: 'x' } }));
          assert.equal(out.status, 403, `${name} ${record._id}`);
          assert.deepEqual(noWrites(), []);
        }
      });

      test(`${name}: another Mahallu's record is refused for a Mahallu admin; a missing one is 404`, async () => {
        const otherTenant = seed(model, doc(T_B, INST_X, { source: 'manual' }));
        const out = await run(fn, asMahall({ params: { id: String(otherTenant._id) }, body: { name: 'x' } }));
        assert.equal(out.status, 403);
        assert.deepEqual(noWrites(), []);
        assert.equal((await run(fn, asMahall({ params: { id: String(oid()) }, body: {} }))).status, 404);
      });

      test(`${name}: the Mahallu admin's own record works`, async () => {
        const own = seed(model, doc(T_A, hasInstitute ? INST_2 : null, { source: 'manual' }));
        const out = await run(fn, asMahall({ params: { id: String(own._id) }, body: { name: 'new' } }));
        assert.equal(out.status, 200, `${name}: ${JSON.stringify(out.body)}`);
      });

      if (hasInstitute) {
        test(`${name}: the institute admin's own record works`, async () => {
          const own = seed(model, doc(T_A, INST_1, { source: 'manual' }));
          const out = await run(fn, asInstitute({ params: { id: String(own._id) }, body: { name: 'new' } }));
          assert.equal(out.status, 200, `${name}: ${JSON.stringify(out.body)}`);
        });
      } else {
        test(`${name}: an institute admin is refused even for a Mahallu record in their own Mahallu`, async () => {
          const own = seed(model, doc(T_A, null));
          const out = await run(fn, asInstitute({ params: { id: String(own._id) }, body: { name: 'x' } }));
          assert.equal(out.status, 403);
          assert.deepEqual(noWrites(), []);
        });
      }

      test(`${name}: refused with no Mahallu`, async () => {
        const own = seed(model, doc(T_A, INST_1, { source: 'manual' }));
        const out = await run(fn, { ...noTenant('mahall'), params: { id: String(own._id) }, body: {} });
        assert.equal(out.status, 403);
        assert.equal(calls.length, 0);
      });
    }

    test('updates cannot move a record: tenantId is dropped, and an institute admin cannot change instituteId', async () => {
      const own = seed('Ledger', doc(T_A, INST_1));
      await run(master.updateLedger, asInstitute({ params: { id: String(own._id) }, body: { name: 'n', tenantId: T_B, instituteId: INST_2, _id: String(oid()) } }));
      assert.deepEqual(callsOf('Ledger.update')[0].data, { name: 'n' });

      const mahallLedger = seed('Ledger', doc(T_A, INST_2));
      await run(master.updateLedger, asMahall({ params: { id: String(mahallLedger._id) }, body: { name: 'n', tenantId: T_B } }));
      assert.deepEqual(callsOf('Ledger.update')[0].data, { name: 'n' });
    });

    test('a Mahallu admin cannot re-point a record at a foreign institute or foreign ledger', async () => {
      seed('Institute', { _id: new mongoose.Types.ObjectId(INST_X), tenantId: T_B });
      const category = seed('Category', doc(T_A, INST_2));
      let out = await run(master.updateCategory, asMahall({ params: { id: String(category._id) }, body: { instituteId: INST_X } }));
      assert.equal(out.status, 400);
      assert.deepEqual(noWrites(), []);

      const item = seed('LedgerItem', doc(T_A, INST_2, { source: 'manual' }));
      const foreignLedger = seed('Ledger', doc(T_B, INST_X));
      out = await run(master.updateLedgerItem, asMahall({ params: { id: String(item._id) }, body: { ledgerId: String(foreignLedger._id) } }));
      assert.equal(out.status, 400);
      assert.deepEqual(noWrites(), []);
    });
  });

  describe('master accounts: creates', () => {
    const savedDoc = (model: string) => callsOf(`${model}.save`)[0]?.doc;

    test("an institute admin's creates are forced into their own institute and Mahallu, whatever the body says", async () => {
      const body = { name: 'Fees', type: 'income', tenantId: T_B, instituteId: INST_2 };
      for (const [fn, model] of [
        [master.createLedger, 'Ledger'],
        [master.createCategory, 'Category'],
      ] as const) {
        const out = await run(fn, asInstitute({ body }));
        assert.equal(out.status, 201, model);
        assert.equal(savedDoc(model).tenantId, T_A);
        assert.equal(savedDoc(model).instituteId, INST_1);
      }
      const out = await run(master.createInstituteAccount, asInstitute({ body: { accountName: 'Acc', tenantId: T_B, instituteId: INST_2 } }));
      assert.equal(out.status, 201);
      assert.equal(savedDoc('InstituteAccount').tenantId, T_A);
      assert.equal(savedDoc('InstituteAccount').instituteId, INST_1);
    });

    test('an institute admin cannot create Mahallu-level wallets or bank accounts', async () => {
      for (const fn of [master.createWallet, master.createMahalluAccount]) {
        const out = await run(fn, asInstitute({ body: { name: 'W', accountName: 'A' } }));
        assert.equal(out.status, 403);
        assert.deepEqual(noWrites(), []);
      }
    });

    test('a ledger item may only reference ledgers/categories of the caller\'s own institute', async () => {
      const own = seed('Ledger', doc(T_A, INST_1));
      const sibling = seed('Ledger', doc(T_A, INST_2));
      const mahalluLedger = seed('Ledger', doc(T_A, null));
      const otherTenant = seed('Ledger', doc(T_B, INST_X));
      const category = seed('Category', doc(T_A, INST_1));
      const foreignCategory = seed('Category', doc(T_A, INST_2));
      const base = { amount: 10, description: 'd', date: '2025-01-01', type: 'income' };

      for (const ledger of [sibling, mahalluLedger, otherTenant]) {
        const out = await run(master.createLedgerItem, asInstitute({ body: { ...base, ledgerId: String(ledger._id) } }));
        assert.equal(out.status, 400);
        assert.deepEqual(noWrites(), []);
      }
      let out = await run(master.createLedgerItem, asInstitute({ body: { ...base, ledgerId: String(own._id), categoryId: String(foreignCategory._id) } }));
      assert.equal(out.status, 400);
      out = await run(master.createLedgerItem, asInstitute({ body: { ...base, ledgerId: 'junk' } }));
      assert.equal(out.status, 400);
      assert.deepEqual(noWrites(), []);

      out = await run(master.createLedgerItem, asInstitute({ body: { ...base, ledgerId: String(own._id), categoryId: String(category._id), tenantId: T_B, instituteId: INST_2 } }));
      assert.equal(out.status, 201);
      assert.equal(savedDoc('LedgerItem').tenantId, T_A);
      assert.equal(savedDoc('LedgerItem').instituteId, INST_1);
    });

    test('a Mahallu admin cannot create into another Mahallu or reference its institutes/ledgers', async () => {
      seed('Institute', { _id: new mongoose.Types.ObjectId(INST_X), tenantId: T_B }, { _id: new mongoose.Types.ObjectId(INST_2), tenantId: T_A });
      const foreignLedger = seed('Ledger', doc(T_B, INST_X));
      const ownLedger = seed('Ledger', doc(T_A, INST_2));

      let out = await run(master.createCategory, asMahall({ body: { name: 'c', type: 'income', instituteId: INST_X } }));
      assert.equal(out.status, 400);
      out = await run(master.createLedgerItem, asMahall({ body: { ledgerId: String(foreignLedger._id) } }));
      assert.equal(out.status, 400);
      assert.deepEqual(noWrites(), []);

      out = await run(master.createLedgerItem, asMahall({ body: { ledgerId: String(ownLedger._id), instituteId: INST_2, tenantId: T_B } }));
      assert.equal(out.status, 201);
      assert.equal(savedDoc('LedgerItem').tenantId, T_A, 'a body tenantId never wins');

      // Mahallu-level (no institute) is the Mahallu admin's to create
      out = await run(master.createLedger, asMahall({ body: { name: 'General', type: 'expense', tenantId: T_B } }));
      assert.equal(out.status, 201);
      assert.equal(savedDoc('Ledger').tenantId, T_A);
      assert.equal(savedDoc('Ledger').instituteId, null);
    });

    test('a super admin must pick a Mahallu first (400), and a Mahallu-less staff account is 403', async () => {
      assert.equal((await run(master.createLedger, asSuper({ body: { name: 'x', type: 'income', tenantId: T_B } }))).status, 400);
      assert.equal((await run(master.createLedger, { ...noTenant('mahall'), body: { name: 'x', type: 'income', tenantId: T_B } })).status, 403);
      assert.deepEqual(noWrites(), []);
      assert.equal((await run(master.createLedger, asSuper({ tenantId: T_B, body: { name: 'x', type: 'income', tenantId: T_A } }))).status, 201);
      assert.equal(savedDoc('Ledger').tenantId, T_B);
    });
  });

  // ─────────────────────────────── salary ───────────────────────────────

  describe('salary', () => {
    test('lists and the summary are pinned to the institute admin\'s institute', async () => {
      await run(salary.getAllSalaryPayments, asInstitute({ query: { instituteId: INST_2, employeeId: String(oid()), month: '3', year: '2025' } }));
      const filter = callsOf('SalaryPayment.find')[0].filter;
      assert.equal(filter.tenantId, T_A);
      assert.equal(filter.instituteId, INST_1);
      assert.equal(filter.month, 3);
      assert.equal(filter.year, 2025);

      await run(salary.getSalarySummary, asInstitute({ query: { instituteId: INST_2 } }));
      assert.deepEqual(firstMatch('SalaryPayment.aggregate'), { ...OWN_ONLY, status: { $ne: 'cancelled' } });
    });

    test('a Mahallu admin may narrow by institute; the summary casts ids so the aggregate can match', async () => {
      await run(salary.getAllSalaryPayments, asMahall({ query: { instituteId: INST_2 } }));
      assert.deepEqual(callsOf('SalaryPayment.find')[0].filter, { tenantId: T_A, instituteId: INST_2 });
      await run(salary.getSalarySummary, asMahall({ query: { instituteId: INST_2 } }));
      const pipeline = callsOf('SalaryPayment.aggregate')[0].pipeline;
      assert.deepEqual(pipeline[0].$match, { tenantId: T_A, instituteId: INST_2, status: { $ne: 'cancelled' } });
    });

    test('malformed filters are 400', async () => {
      for (const query of [{ instituteId: 'x' }, { employeeId: ['a'] }, { month: 'abc' }, { year: '20x5' }]) {
        const out = await run(salary.getAllSalaryPayments, asMahall({ query }));
        assert.equal(out.status, 400, JSON.stringify(query));
        assert.equal(calls.length, 0);
      }
    });

    const byId: Array<[string, any]> = [
      ['getSalaryPaymentById', salary.getSalaryPaymentById],
      ['updateSalaryPayment', salary.updateSalaryPayment],
      ['deleteSalaryPayment', salary.deleteSalaryPayment],
    ];
    for (const [name, fn] of byId) {
      test(`${name}: refuses a sibling institute's, a Mahallu-level and another Mahallu's payment`, async () => {
        const foreign = seed('SalaryPayment', doc(T_A, INST_2, { status: 'pending' }));
        const mahalluLevel = seed('SalaryPayment', doc(T_A, null, { status: 'pending' }));
        const otherTenant = seed('SalaryPayment', doc(T_B, INST_X, { status: 'pending' }));
        for (const record of [foreign, mahalluLevel, otherTenant]) {
          const out = await run(fn, asInstitute({ params: { id: String(record._id) }, body: { remarks: 'x' } }));
          assert.equal(out.status, 403, `${name}`);
          assert.deepEqual(noWrites(), []);
        }
        const out = await run(fn, asMahall({ params: { id: String(otherTenant._id) }, body: {} }));
        assert.equal(out.status, 403);
        assert.deepEqual(noWrites(), []);
      });

      test(`${name}: serves the institute admin's own payment`, async () => {
        const own = seed('SalaryPayment', doc(T_A, INST_1, { status: 'pending', baseSalary: 1, allowances: 0, deductions: 0 }));
        const out = await run(fn, asInstitute({ params: { id: String(own._id) }, body: { remarks: 'x' } }));
        assert.equal(out.status, 200, JSON.stringify(out.body));
      });
    }

    test('update drops tenantId and instituteId from the body for an institute admin and still recomputes net', async () => {
      const own = seed('SalaryPayment', doc(T_A, INST_1, { status: 'pending', baseSalary: 100, allowances: 0, deductions: 0 }));
      await run(salary.updateSalaryPayment, asInstitute({ params: { id: String(own._id) }, body: { baseSalary: 500, tenantId: T_B, instituteId: INST_2 } }));
      assert.deepEqual(callsOf('SalaryPayment.update')[0].data, { baseSalary: 500, netAmount: 500 });
    });

    test('update by a Mahallu admin cannot re-point the payment at a foreign employee or institute', async () => {
      const own = seed('SalaryPayment', doc(T_A, INST_2, { status: 'pending' }));
      const foreignEmployee = seed('Employee', doc(T_B, INST_X));
      const out = await run(salary.updateSalaryPayment, asMahall({ params: { id: String(own._id) }, body: { employeeId: String(foreignEmployee._id) } }));
      assert.equal(out.status, 400);
      assert.deepEqual(noWrites(), []);
    });

    test('employee history: refuses another institute\'s employee, and scopes the payments query', async () => {
      const foreign = seed('Employee', doc(T_A, INST_2));
      const mahalluLevel = seed('Employee', doc(T_A, null));
      for (const employee of [foreign, mahalluLevel]) {
        const out = await run(salary.getEmployeeSalaryHistory, asInstitute({ params: { employeeId: String(employee._id) } }));
        assert.equal(out.status, 403);
        assert.equal(callsOf('SalaryPayment.find').length, 0);
      }
      const own = seed('Employee', doc(T_A, INST_1));
      const out = await run(salary.getEmployeeSalaryHistory, asInstitute({ params: { employeeId: String(own._id) } }));
      assert.equal(out.status, 200);
      assert.deepEqual(callsOf('SalaryPayment.find')[0].filter, { employeeId: String(own._id), tenantId: T_A, instituteId: INST_1 });

      const otherTenant = seed('Employee', doc(T_B, INST_X));
      assert.equal((await run(salary.getEmployeeSalaryHistory, asMahall({ params: { employeeId: String(otherTenant._id) } }))).status, 403);
    });

    test('create forces the institute admin\'s institute and tenant, and refuses foreign employees', async () => {
      const own = seed('Employee', doc(T_A, INST_1));
      const sibling = seed('Employee', doc(T_A, INST_2));
      const otherTenant = seed('Employee', doc(T_B, INST_X));
      const base = { month: 3, year: 2025, baseSalary: 100, status: 'pending' };

      for (const employee of [sibling, otherTenant]) {
        const out = await run(salary.createSalaryPayment, asInstitute({ body: { ...base, employeeId: String(employee._id) } }));
        assert.equal(out.status, 400);
        assert.deepEqual(noWrites(), []);
      }
      const out = await run(salary.createSalaryPayment, asInstitute({ body: { ...base, employeeId: String(own._id), tenantId: T_B, instituteId: INST_2 } }));
      assert.equal(out.status, 201, JSON.stringify(out.body));
      const saved = callsOf('SalaryPayment.save')[0].doc;
      assert.equal(saved.tenantId, T_A);
      assert.equal(saved.instituteId, INST_1);
    });

    test('create by a Mahallu admin ignores a body tenantId and refuses a foreign institute', async () => {
      seed('Institute', { _id: new mongoose.Types.ObjectId(INST_X), tenantId: T_B });
      const employee = seed('Employee', doc(T_A, INST_2));
      let out = await run(salary.createSalaryPayment, asMahall({ body: { employeeId: String(employee._id), instituteId: INST_X, baseSalary: 100 } }));
      assert.equal(out.status, 400);
      assert.deepEqual(noWrites(), []);
      seed('Institute', { _id: new mongoose.Types.ObjectId(INST_2), tenantId: T_A });
      out = await run(salary.createSalaryPayment, asMahall({ body: { employeeId: String(employee._id), instituteId: INST_2, tenantId: T_B, status: 'pending', baseSalary: 100 } }));
      assert.equal(out.status, 201, JSON.stringify(out.body));
      assert.equal(callsOf('SalaryPayment.save')[0].doc.tenantId, T_A);
    });
  });

  // ─────────────────────────────── petty cash ───────────────────────────────

  describe('petty cash', () => {
    const fund = (tenant: string, institute: string, extra: Record<string, any> = {}) =>
      doc(tenant, institute, { status: 'active', floatAmount: 100, currentBalance: 100, custodianName: 'C', save: async () => {}, ...extra });

    test('an institute admin\'s list ignores ?instituteId', async () => {
      await run(petty.getAllPettyCash, asInstitute({ query: { instituteId: INST_2 } }));
      assert.deepEqual(callsOf('PettyCash.find')[0].filter, OWN_ONLY);
      await run(petty.getAllPettyCash, asMahall({ query: { instituteId: INST_2 } }));
      assert.deepEqual(callsOf('PettyCash.find')[0].filter, { tenantId: T_A, instituteId: INST_2 });
      assert.equal((await run(petty.getAllPettyCash, asMahall({ query: { instituteId: 'x' } }))).status, 400);
    });

    const byId: Array<[string, any]> = [
      ['getPettyCash', petty.getPettyCash],
      ['updatePettyCash', petty.updatePettyCash],
      ['getPettyCashTransactions', petty.getPettyCashTransactions],
      ['recordExpense', petty.recordExpense],
      ['replenishPettyCash', petty.replenishPettyCash],
    ];
    for (const [name, fn] of byId) {
      test(`${name}: another institute's and another Mahallu's fund is not found and nothing is written`, async () => {
        const sibling = seed('PettyCash', fund(T_A, INST_2));
        const otherTenant = seed('PettyCash', fund(T_B, INST_X));
        for (const record of [sibling, otherTenant]) {
          const out = await run(fn, asInstitute({ params: { id: String(record._id) }, body: { amount: 5, description: 'd', custodianName: 'hax' } }));
          assert.equal(out.status, 404, name);
          assert.deepEqual(noWrites(), []);
          assert.equal(callsOf('PettyCashTransaction.find').length, 0);
        }
        const out = await run(fn, asMahall({ params: { id: String(otherTenant._id) }, body: { amount: 5, description: 'd' } }));
        assert.equal(out.status, 404);
        assert.deepEqual(noWrites(), []);
      });

      test(`${name}: the lookup carries tenant (+ institute for an institute admin) in the query, and a bad id is 404`, async () => {
        const own = seed('PettyCash', fund(T_A, INST_1));
        await run(fn, asInstitute({ params: { id: String(own._id) }, body: { amount: 5, description: 'd' } }));
        const lookup = callsOf('PettyCash.findOne')[0];
        assert.equal(lookup.filter.tenantId, T_A);
        assert.equal(lookup.filter.instituteId, INST_1);
        assert.equal((await run(fn, asInstitute({ params: { id: 'nope' } }))).status, 404);
        assert.equal(calls.length, 0);
      });

      test(`${name}: refused with no Mahallu`, async () => {
        const out = await run(fn, { ...noTenant('mahall'), params: { id: String(oid()) } });
        assert.equal(out.status, 403);
        assert.equal(calls.length, 0);
      });
    }

    test('the institute admin can read their own fund and its transactions', async () => {
      const own = seed('PettyCash', fund(T_A, INST_1));
      assert.equal((await run(petty.getPettyCash, asInstitute({ params: { id: String(own._id) } }))).status, 200);
      const out = await run(petty.getPettyCashTransactions, asInstitute({ params: { id: String(own._id) } }));
      assert.equal(out.status, 200);
      assert.deepEqual(callsOf('PettyCashTransaction.find')[0].filter, { pettyCashId: String(own._id), ...OWN_ONLY });
    });

    test('an expense category must be in the same Mahallu and, for an institute admin, institute', async () => {
      const own = seed('PettyCash', fund(T_A, INST_1));
      const foreignCategory = seed('Category', doc(T_B, INST_X));
      const siblingCategory = seed('Category', doc(T_A, INST_2));
      for (const category of [foreignCategory, siblingCategory]) {
        const out = await run(petty.recordExpense, asInstitute({ params: { id: String(own._id) }, body: { amount: 5, description: 'd', categoryId: String(category._id) } }));
        assert.equal(out.status, 400);
        assert.equal(callsOf('PettyCashTransaction.save').length, 0);
      }
      const ownCategory = seed('Category', doc(T_A, INST_1));
      const out = await run(petty.recordExpense, asInstitute({ params: { id: String(own._id) }, body: { amount: 5, description: 'd', categoryId: String(ownCategory._id) } }));
      assert.equal(out.status, 201, JSON.stringify(out.body));
    });

    test('create forces the institute admin\'s institute and tenant', async () => {
      const out = await run(petty.createPettyCash, asInstitute({ body: { custodianName: 'Custodian', floatAmount: 100, tenantId: T_B, instituteId: INST_2 } }));
      assert.equal(out.status, 201, JSON.stringify(out.body));
      const saved = callsOf('PettyCash.save')[0].doc;
      assert.equal(saved.tenantId, T_A);
      assert.equal(saved.instituteId, INST_1);
    });

    test('create by a Mahallu admin: body tenantId ignored, foreign institute refused', async () => {
      seed('Institute', { _id: new mongoose.Types.ObjectId(INST_X), tenantId: T_B }, { _id: new mongoose.Types.ObjectId(INST_2), tenantId: T_A });
      let out = await run(petty.createPettyCash, asMahall({ body: { custodianName: 'Custodian', floatAmount: 100, instituteId: INST_X } }));
      assert.equal(out.status, 400);
      assert.deepEqual(noWrites(), []);
      out = await run(petty.createPettyCash, asMahall({ body: { custodianName: 'Custodian', floatAmount: 100, instituteId: INST_2, tenantId: T_B } }));
      assert.equal(out.status, 201, JSON.stringify(out.body));
      assert.equal(callsOf('PettyCash.save')[0].doc.tenantId, T_A);
    });
  });

  // ─────────────────────────────── health resources ───────────────────────────────

  describe('health resources', () => {
    const resource = (type: string, tenant = T_A) => doc(tenant, null, { type, name: 'r' });
    const withHealth = { user: { role: 'mahall', tenantId: T_A, permissions: { sensitiveModules: ['health'] } } };
    const withOther = { user: { role: 'mahall', tenantId: T_A, permissions: { sensitiveModules: ['welfare'] } } };

    test('GET /:id on palliative_case / patient_support needs the health module, like the list does', async () => {
      for (const type of ['palliative_case', 'patient_support']) {
        const record = seed('HealthResource', resource(type));
        const params = { id: String(record._id) };
        for (const user of [asMahall(), asMahall(withOther), asInstitute()]) {
          const out = await run(health.getHealthResourceById, { ...user, params });
          assert.equal(out.status, 403, type);
          assert.equal(out.body.data, undefined);
        }
        assert.equal((await run(health.getHealthResourceById, asMahall({ ...withHealth, params }))).status, 200);
        assert.equal((await run(health.getHealthResourceById, asSuper({ tenantId: T_A, params }))).status, 200);
      }
    });

    test('non-sensitive types stay readable without the module', async () => {
      const record = seed('HealthResource', resource('doctor'));
      const out = await run(health.getHealthResourceById, asMahall({ params: { id: String(record._id) } }));
      assert.equal(out.status, 200);
    });

    test("another Mahallu's record is not found (tenant is in the query), sensitive or not", async () => {
      const record = seed('HealthResource', resource('doctor', T_B));
      const out = await run(health.getHealthResourceById, asMahall({ ...withHealth, params: { id: String(record._id) } }));
      assert.equal(out.status, 404);
      assert.equal(callsOf('HealthResource.findOne')[0].filter.tenantId, T_A);
    });

    test('a user with no Mahallu is refused on every handler', async () => {
      for (const fn of [
        health.getAllHealthResources, health.getAllSensitiveHealthResources, health.getHealthResourceById,
        health.createHealthResource, health.createSensitiveHealthResource, health.updateHealthResource,
        health.deleteHealthResource, health.getHealthSummary,
      ]) {
        const out = await run(fn, { ...noTenant('mahall'), params: { id: String(oid()) }, body: { type: 'doctor' } });
        assert.equal(out.status, 403, fn.name);
        assert.equal(calls.length, 0, fn.name);
      }
    });

    test('creates cannot be pointed at another Mahallu through the body', async () => {
      const out = await run(health.createHealthResource, asMahall({ body: { type: 'doctor', name: 'D', tenantId: T_B } }));
      assert.equal(out.status, 201);
      assert.equal(callsOf('HealthResource.create')[0].doc.tenantId, T_A);
      const sensitive = await run(health.createSensitiveHealthResource, asMahall({ ...withHealth, body: { type: 'palliative_case', name: 'P', tenantId: T_B } }));
      assert.equal(sensitive.status, 201);
      assert.equal(callsOf('HealthResource.create')[0].doc.tenantId, T_A);
    });
  });
});
