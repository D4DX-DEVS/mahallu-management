import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { LedgerItem, Ledger, Category, InstituteAccount, MahalluAccount, MasterWallet } from '../models/MasterAccount';
import Institute from '../models/Institute';
import { DevelopmentProject } from '../models/DevelopmentProject';
import * as master from '../controllers/masterAccountController';
import { getDayBook, getLedgerReport, getTrialBalance, getBalanceSheet } from '../controllers/accountingReportController';

/**
 * Account balances, ledger entry provenance, deletes, and the report pages.
 *
 *  - a balance can be set once, as the opening balance on create; every update drops it
 *  - `source` / `sourceId` / `accountId` from a client never reach a ledger item: a manual entry cannot pose as an
 *    auto-posted one (and later be "reversed" by reverseLedgerEntry)
 *  - an account / wallet that carries money, or is the only one for books with entries, is not deleted (409)
 *  - the day book and ledger report are paged, and their totals / running balances are computed over the WHOLE
 *    filtered set, so every page shows the same totals
 *  - list endpoints return server-side `summary` aggregates for the CMS "Total" cards
 *
 * Models are stateful in-memory fakes (no database) with a small find / sort / skip / limit / aggregate engine.
 */

const oid = () => new mongoose.Types.ObjectId();
const T_A = String(oid());
const T_B = String(oid());
const INST_1 = String(oid());
const INST_2 = String(oid());

type Doc = Record<string, any>;
const store: Record<string, Doc[]> = {};
const calls: Array<{ op: string; [k: string]: any }> = [];
const restorers: Array<() => void> = [];
const stub = (target: any, key: string, impl: any) => {
  const original = target[key];
  target[key] = impl;
  restorers.push(() => { target[key] = original; });
};
const same = (a: any, b: any) => String(a?._id ?? a) === String(b?._id ?? b);
const plain = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Mongo-ish matching: equality, null, $ne, $in, $gte/$lte/$lt, $or. */
const matches = (doc: Doc, filter: Doc): boolean =>
  Object.entries(filter || {}).every(([key, expected]: [string, any]) => {
    if (key === '$or') return (expected as Doc[]).some((f) => matches(doc, f));
    const actual = doc[key];
    if (expected === null) return actual === null || actual === undefined;
    if (expected instanceof mongoose.Types.ObjectId || typeof expected !== 'object') return same(actual, expected);
    if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
    return Object.entries(expected).every(([op, value]: [string, any]) => {
      switch (op) {
        case '$ne': return !same(actual, value);
        case '$in': return value.some((v: any) => same(actual, v));
        case '$gte': return actual >= value;
        case '$lte': return actual <= value;
        case '$lt': return actual < value;
        default: return true;
      }
    });
  });

const sortDocs = (docs: Doc[], spec: any): Doc[] => {
  const keys: Array<[string, number]> = typeof spec === 'string' ? [[spec.replace('-', ''), spec.startsWith('-') ? -1 : 1]] : Object.entries(spec || {}) as any;
  return [...docs].sort((a, b) => {
    for (const [key, dir] of keys) {
      const av = a[key] instanceof Date ? a[key].getTime() : String(a[key]);
      const bv = b[key] instanceof Date ? b[key].getTime() : String(b[key]);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
    }
    return 0;
  });
};

const POPULATE: Record<string, string> = { ledgerId: 'Ledger', categoryId: 'Category', instituteId: 'Institute' };

/** A thenable query with real skip / limit / sort / populate over the store. */
const query = (name: string, filter: Doc): any => {
  let spec: any;
  let skipN = 0;
  let limitN = Infinity;
  const paths: string[] = [];
  const run = () => {
    let docs = sortDocs((store[name] || []).filter((d) => matches(d, filter)), spec).slice(skipN, skipN + limitN);
    docs = docs.map((d) => {
      const out: Doc = { ...d };
      for (const path of paths) {
        const target = (store[POPULATE[path]] || []).find((x) => same(x._id, d[path]));
        if (target) out[path] = target;
      }
      return out;
    });
    return docs;
  };
  const c: any = {
    populate: (path: string) => { paths.push(path); return c; },
    select: () => c,
    lean: () => c,
    sort: (s: any) => { spec = s; return c; },
    skip: (n: number) => { skipN = n; return c; },
    limit: (n: number) => { limitN = n; return c; },
    then: (resolve: any, reject: any) => Promise.resolve(run()).then(resolve, reject),
  };
  return c;
};

/** A tiny aggregation engine: $match, $sort, $limit and $group by '$type' / null with $sum. Anything else yields []. */
const aggregate = (name: string, pipeline: any[]): Doc[] => {
  let docs = [...(store[name] || [])];
  for (const stage of pipeline) {
    if (stage.$match) docs = docs.filter((d) => matches(d, stage.$match));
    else if (stage.$sort) docs = sortDocs(docs, stage.$sort);
    else if (stage.$limit !== undefined) docs = docs.slice(0, stage.$limit);
    else if (stage.$group) {
      const { _id, ...accumulators } = stage.$group;
      const groups = new Map<any, Doc>();
      for (const d of docs) {
        const key = _id === null ? null : d[String(_id).slice(1)];
        const row = groups.get(key) || { _id: key };
        for (const [field, spec] of Object.entries(accumulators) as Array<[string, any]>) {
          const expr = spec.$sum;
          let value: number;
          if (expr === 1) value = 1;
          else if (typeof expr === 'string') value = d[expr.slice(1)] || 0;
          else if (expr?.$cond) value = d.type === 'income' ? d.amount : -d.amount; // the signed-amount expression
          else value = 0;
          row[field] = (row[field] || 0) + value;
        }
        groups.set(key, row);
      }
      docs = [...groups.values()];
    } else return [];
  }
  return docs;
};

const stubModel = (Model: any) => {
  const name: string = Model.modelName;
  stub(Model, 'find', (filter: Doc) => { calls.push({ op: `${name}.find`, filter: plain(filter) }); return query(name, filter); });
  stub(Model, 'findOne', (filter: Doc) => {
    const q = query(name, filter);
    return Object.assign(q, { then: (resolve: any, reject: any) => Promise.resolve((store[name] || []).find((d) => matches(d, filter)) || null).then(resolve, reject) });
  });
  stub(Model, 'findById', (id: any) => {
    const found = (store[name] || []).find((d) => same(d._id, id)) || null;
    const q = query(name, { _id: id });
    return Object.assign(q, { then: (resolve: any, reject: any) => Promise.resolve(found ? { ...found } : null).then(resolve, reject) });
  });
  stub(Model, 'countDocuments', (filter: Doc) => {
    calls.push({ op: `${name}.countDocuments`, filter: plain(filter) });
    return Promise.resolve((store[name] || []).filter((d) => matches(d, filter)).length);
  });
  stub(Model, 'aggregate', (pipeline: any[]) => {
    calls.push({ op: `${name}.aggregate`, pipeline: plain(pipeline) });
    return Promise.resolve(aggregate(name, pipeline));
  });
  stub(Model, 'findByIdAndUpdate', (id: any, data: Doc) => {
    calls.push({ op: `${name}.update`, id: String(id), data: plain(data) });
    const doc = (store[name] || []).find((d) => same(d._id, id));
    if (doc) Object.assign(doc, data);
    const q = query(name, { _id: id });
    return Object.assign(q, { then: (resolve: any, reject: any) => Promise.resolve(doc ? { ...doc } : null).then(resolve, reject) });
  });
  stub(Model, 'findByIdAndDelete', (id: any) => {
    calls.push({ op: `${name}.delete`, id: String(id) });
    store[name] = (store[name] || []).filter((d) => !same(d._id, id));
    return Promise.resolve(null);
  });
  stub(Model.prototype, 'save', async function (this: any) {
    calls.push({ op: `${name}.save`, doc: plain(this.toObject()) });
    store[name] = [...(store[name] || []), { ...this.toObject() }];
    return this;
  });
};

// Hooks live inside this suite so the stubs below never leak into the other suites when everything
// runs in one process (npm test).
describe('account balances', () => {
  before(() => {
    [LedgerItem, Ledger, Category, InstituteAccount, MahalluAccount, MasterWallet, Institute, DevelopmentProject].forEach(stubModel);
  });
  after(() => restorers.reverse().forEach((r) => r()));
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    calls.length = 0;
    store.Institute = [{ _id: INST_1, tenantId: T_A }, { _id: INST_2, tenantId: T_A }];
  });

  const send = async (fn: any, req: Record<string, any>) => {
    calls.length = 0;
    const out: any = { status: 200, body: undefined };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
    await fn({ params: {}, query: {}, body: {}, headers: {}, ...req }, res);
    return out;
  };
  const asMahall = (extra: Record<string, any> = {}) => ({ tenantId: T_A, isSuperAdmin: false, user: { role: 'mahall' }, ...extra });
  const asInstitute = (extra: Record<string, any> = {}) => ({
    tenantId: T_A, isSuperAdmin: false, user: { role: 'institute', instituteId: INST_1 }, ...extra,
  });
  const callsOf = (op: string) => calls.filter((c) => c.op === op);
  const seed = (name: string, ...rows: Doc[]) => { store[name] = [...(store[name] || []), ...rows]; return rows[0]; };
  const stored = (name: string, id: any) => (store[name] || []).find((d) => same(d._id, id));

  // ─────────────────────────────── balances ───────────────────────────────

  describe('balance: opening balance on create only', () => {
    test('creating an institute account, a Mahallu account and a wallet keeps the opening balance', async () => {
      let out = await send(master.createInstituteAccount, asMahall({ body: { instituteId: INST_1, accountName: 'Main', balance: 2500.5 } }));
      assert.equal(out.status, 201, JSON.stringify(out.body));
      assert.equal(callsOf('InstituteAccount.save')[0].doc.balance, 2500.5);

      out = await send(master.createMahalluAccount, asMahall({ body: { accountName: 'Main', balance: 100 } }));
      assert.equal(out.status, 201);
      assert.equal(callsOf('MahalluAccount.save')[0].doc.balance, 100);

      out = await send(master.createWallet, asMahall({ body: { name: 'Reserve', type: 'reserve', balance: 40 } }));
      assert.equal(out.status, 201);
      assert.equal(callsOf('MasterWallet.save')[0].doc.balance, 40);
    });

    test('every update drops `balance`: institute account, Mahallu account and wallet', async () => {
      const account = seed('InstituteAccount', { _id: oid(), tenantId: T_A, instituteId: INST_1, accountName: 'A', balance: 500 });
      const mahalluAccount = seed('MahalluAccount', { _id: oid(), tenantId: T_A, accountName: 'M', balance: 700 });
      const wallet = seed('MasterWallet', { _id: oid(), tenantId: T_A, name: 'W', balance: 900 });

      let out = await send(master.updateInstituteAccount, asMahall({ params: { id: String(account._id) }, body: { accountName: 'Renamed', balance: 99999999 } }));
      assert.equal(out.status, 200, JSON.stringify(out.body));
      assert.deepEqual(callsOf('InstituteAccount.update')[0].data, { accountName: 'Renamed' });
      assert.equal(stored('InstituteAccount', account._id)!.balance, 500);

      out = await send(master.updateMahalluAccount, asMahall({ params: { id: String(mahalluAccount._id) }, body: { accountName: 'Renamed', balance: 0 } }));
      assert.equal(out.status, 200);
      assert.deepEqual(callsOf('MahalluAccount.update')[0].data, { accountName: 'Renamed' });
      assert.equal(stored('MahalluAccount', mahalluAccount._id)!.balance, 700);

      out = await send(master.updateWallet, asMahall({ params: { id: String(wallet._id) }, body: { name: 'Renamed', balance: -5 } }));
      assert.equal(out.status, 200);
      assert.deepEqual(callsOf('MasterWallet.update')[0].data, { name: 'Renamed' });
      assert.equal(stored('MasterWallet', wallet._id)!.balance, 900);
    });

    test('an institute admin cannot set their institute\'s balance either', async () => {
      const account = seed('InstituteAccount', { _id: oid(), tenantId: T_A, instituteId: INST_1, accountName: 'A', balance: 500 });
      const out = await send(master.updateInstituteAccount, asInstitute({ params: { id: String(account._id) }, body: { balance: 1, instituteId: INST_2, tenantId: T_B } }));
      assert.equal(out.status, 200);
      assert.deepEqual(callsOf('InstituteAccount.update')[0].data, {});
      assert.equal(stored('InstituteAccount', account._id)!.balance, 500);
    });
  });

  // ─────────────────────────────── ledger item provenance ───────────────────────────────

  describe('ledger items: source, sourceId and accountId are the system\'s', () => {
    const ledger = () => seed('Ledger', { _id: oid(), tenantId: T_A, instituteId: INST_1, name: 'Fees', type: 'income' });
    const item = (l: Doc, extra: Doc = {}) => ({ ledgerId: String(l._id), date: '2025-01-01', amount: 100, type: 'income', description: 'Fee', ...extra });

    test('a manual create cannot name a source or sourceId: it is stored as manual with no sourceId', async () => {
      const l = ledger();
      const forgedSource = String(oid());
      const out = await send(master.createLedgerItem, asMahall({ body: item(l, { instituteId: INST_1, source: 'salary', sourceId: forgedSource, accountId: String(oid()) }) }));
      assert.equal(out.status, 201, JSON.stringify(out.body));
      const saved = callsOf('LedgerItem.save')[0].doc;
      assert.equal(saved.source, 'manual');
      assert.equal(saved.sourceId, undefined);
      assert.equal(saved.accountId, undefined);
      assert.equal(saved.tenantId, T_A);
    });

    test('a manual entry that tried to pose as a salary entry is still an ordinary, editable, deletable manual one', async () => {
      const l = ledger();
      await send(master.createLedgerItem, asMahall({ body: item(l, { instituteId: INST_1, source: 'salary', sourceId: String(oid()) }) }));
      const created = store.LedgerItem[0];
      assert.equal(created.source, 'manual');
      const edit = await send(master.updateLedgerItem, asMahall({ params: { id: String(created._id) }, body: { description: 'edited' } }));
      assert.equal(edit.status, 200);
      const del = await send(master.deleteLedgerItem, asMahall({ params: { id: String(created._id) } }));
      assert.equal(del.status, 200);
    });

    test('an update cannot turn a manual entry into an auto-posted one, or re-point it', async () => {
      const l = ledger();
      const manual = seed('LedgerItem', { _id: oid(), tenantId: T_A, instituteId: INST_1, ledgerId: l._id, amount: 5, type: 'income', source: 'manual', description: 'x', date: new Date() });
      const out = await send(master.updateLedgerItem, asMahall({
        params: { id: String(manual._id) },
        body: { description: 'y', source: 'salary', sourceId: String(oid()), accountId: String(oid()), tenantId: T_B },
      }));
      assert.equal(out.status, 200, JSON.stringify(out.body));
      assert.deepEqual(callsOf('LedgerItem.update')[0].data, { description: 'y' });
      assert.equal(stored('LedgerItem', manual._id)!.source, 'manual');
    });

    test('an auto-posted entry still cannot be edited or deleted by hand', async () => {
      const l = ledger();
      const auto = seed('LedgerItem', { _id: oid(), tenantId: T_A, instituteId: INST_1, ledgerId: l._id, amount: 5, type: 'expense', source: 'salary', sourceId: oid(), description: 'x', date: new Date() });
      assert.equal((await send(master.updateLedgerItem, asMahall({ params: { id: String(auto._id) }, body: { description: 'y', source: 'manual' } }))).status, 400);
      assert.equal((await send(master.deleteLedgerItem, asMahall({ params: { id: String(auto._id) } }))).status, 400);
      assert.equal(callsOf('LedgerItem.update').length + callsOf('LedgerItem.delete').length, 0);
    });

    test('an entry\'s type must match its ledger, on create and on update', async () => {
      const incomeLedger = ledger();
      let out = await send(master.createLedgerItem, asMahall({ body: item(incomeLedger, { instituteId: INST_1, type: 'expense' }) }));
      assert.equal(out.status, 400);
      assert.match(out.body.message, /ledger you chose/);
      assert.equal(callsOf('LedgerItem.save').length, 0);

      const manual = seed('LedgerItem', { _id: oid(), tenantId: T_A, instituteId: INST_1, ledgerId: incomeLedger._id, amount: 5, type: 'income', source: 'manual', description: 'x', date: new Date() });
      out = await send(master.updateLedgerItem, asMahall({ params: { id: String(manual._id) }, body: { type: 'expense' } }));
      assert.equal(out.status, 400);
      assert.equal(callsOf('LedgerItem.update').length, 0);
      out = await send(master.updateLedgerItem, asMahall({ params: { id: String(manual._id) }, body: { type: 'income', amount: 6 } }));
      assert.equal(out.status, 200);
    });
  });

  // ─────────────────────────────── deleting accounts ───────────────────────────────

  describe('deleting an account or wallet', () => {
    test('a non-zero balance is refused with 409, for all three kinds, and nothing is deleted', async () => {
      const account = seed('InstituteAccount', { _id: oid(), tenantId: T_A, instituteId: INST_1, accountName: 'A', balance: 10 });
      const mahalluAccount = seed('MahalluAccount', { _id: oid(), tenantId: T_A, accountName: 'M', balance: -0.5 });
      const wallet = seed('MasterWallet', { _id: oid(), tenantId: T_A, name: 'W', balance: 1200 });
      for (const [fn, doc] of [
        [master.deleteInstituteAccount, account],
        [master.deleteMahalluAccount, mahalluAccount],
        [master.deleteWallet, wallet],
      ] as const) {
        const out = await send(fn, asMahall({ params: { id: String(doc._id) } }));
        assert.equal(out.status, 409, doc.accountName || doc.name);
        assert.match(out.body.message, /balance|holds/);
        assert.equal(calls.filter((c) => c.op.endsWith('.delete')).length, 0);
      }
      assert.equal(store.InstituteAccount.length + store.MahalluAccount.length + store.MasterWallet.length, 3);
    });

    test('the last account of an institute that has ledger entries is refused; with a sibling account it can go', async () => {
      const only = seed('InstituteAccount', { _id: oid(), tenantId: T_A, instituteId: INST_1, accountName: 'A', balance: 0 });
      seed('LedgerItem', { _id: oid(), tenantId: T_A, instituteId: INST_1, ledgerId: oid(), amount: 1, type: 'income', date: new Date() });
      let out = await send(master.deleteInstituteAccount, asMahall({ params: { id: String(only._id) } }));
      assert.equal(out.status, 409);
      assert.match(out.body.message, /ledger entr/);

      seed('InstituteAccount', { _id: oid(), tenantId: T_A, instituteId: INST_1, accountName: 'B', balance: 0 });
      out = await send(master.deleteInstituteAccount, asMahall({ params: { id: String(only._id) } }));
      assert.equal(out.status, 200, JSON.stringify(out.body));
      assert.equal(store.InstituteAccount.length, 1);
    });

    test('the last Mahallu account is judged against the Mahallu-level entries only, not an institute\'s', async () => {
      const only = seed('MahalluAccount', { _id: oid(), tenantId: T_A, accountName: 'M', balance: 0 });
      seed('LedgerItem', { _id: oid(), tenantId: T_A, instituteId: INST_1, ledgerId: oid(), amount: 1, type: 'income', date: new Date() });
      assert.equal((await send(master.deleteMahalluAccount, asMahall({ params: { id: String(only._id) } }))).status, 200, "an institute's entries are not the Mahallu's books");

      const second = seed('MahalluAccount', { _id: oid(), tenantId: T_A, accountName: 'M2', balance: 0 });
      seed('LedgerItem', { _id: oid(), tenantId: T_A, instituteId: null, ledgerId: oid(), amount: 1, type: 'income', date: new Date() });
      assert.equal((await send(master.deleteMahalluAccount, asMahall({ params: { id: String(second._id) } }))).status, 409);
    });

    test('an empty, unused account and a zero wallet are deleted', async () => {
      const account = seed('InstituteAccount', { _id: oid(), tenantId: T_A, instituteId: INST_1, accountName: 'A', balance: 0 });
      const wallet = seed('MasterWallet', { _id: oid(), tenantId: T_A, name: 'W', balance: 0 });
      const legacy = seed('MasterWallet', { _id: oid(), tenantId: T_A, name: 'Legacy' }); // no balance field at all
      assert.equal((await send(master.deleteInstituteAccount, asMahall({ params: { id: String(account._id) } }))).status, 200);
      assert.equal((await send(master.deleteWallet, asMahall({ params: { id: String(wallet._id) } }))).status, 200);
      assert.equal((await send(master.deleteWallet, asMahall({ params: { id: String(legacy._id) } }))).status, 200);
    });

    test('floating point dust on a zero balance does not block the delete', async () => {
      const wallet = seed('MasterWallet', { _id: oid(), tenantId: T_A, name: 'W', balance: 0.1 + 0.2 - 0.3 });
      assert.equal((await send(master.deleteWallet, asMahall({ params: { id: String(wallet._id) } }))).status, 200);
    });
  });

  // ─────────────────────────────── day book ───────────────────────────────

  /** 25 entries over 25 days, mixing types; every fifth is an "expense" sitting in an "income" ledger (a legacy mismatch). */
  const seedBook = () => {
    const incomeLedger = seed('Ledger', { _id: oid(), tenantId: T_A, instituteId: null, name: 'Fees', type: 'income' });
    const expenseLedger = seed('Ledger', { _id: oid(), tenantId: T_A, instituteId: null, name: 'Rent', type: 'expense' });
    const rows: Doc[] = [];
    for (let i = 0; i < 25; i += 1) {
      const type = i % 3 === 0 ? 'expense' : 'income';
      const inLedger = i % 5 === 0 ? incomeLedger : type === 'income' ? incomeLedger : expenseLedger; // item 0,5,10.. sit in the income ledger
      rows.push({
        _id: oid(), tenantId: T_A, instituteId: null, ledgerId: inLedger._id, type,
        amount: 100 + i * 7.25, description: `Entry ${i}`, source: 'manual',
        date: new Date(Date.UTC(2025, 0, 1 + i)), createdAt: new Date(Date.UTC(2025, 0, 1 + i)),
      });
    }
    // two entries on the very same day and createdAt, to prove the _id tie-break keeps pages disjoint
    rows.push({ ...rows[24], _id: oid(), description: 'Same day A' }, { ...rows[24], _id: oid(), description: 'Same day B' });
    seed('LedgerItem', ...rows);
    return { incomeLedger, expenseLedger, rows: store.LedgerItem };
  };
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  describe('day book: paging and totals', () => {
    test('pages of 10 over 27 entries: every entry appears exactly once, in order, and every page carries the SAME whole-set summary', async () => {
      const { rows } = seedBook();
      const expectedIncome = round2(rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0));
      const expectedExpense = round2(rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0));

      const seen: string[] = [];
      const summaries: any[] = [];
      let pageSizes: number[] = [];
      for (const page of [1, 2, 3, 4]) {
        const out = await send(getDayBook, asMahall({ query: { scope: 'mahallu', limit: '10', page: String(page) } }));
        assert.equal(out.status, 200, JSON.stringify(out.body));
        pageSizes.push(out.body.data.entries.length);
        seen.push(...out.body.data.entries.map((e: any) => String(e._id)));
        summaries.push(out.body.data.summary);
        assert.deepEqual(out.body.data.pagination, { page, limit: 10, skip: (page - 1) * 10, total: 27, totalPages: 3 });
      }
      assert.deepEqual(pageSizes, [10, 10, 7, 0]);
      assert.equal(new Set(seen).size, 27, 'no entry twice');
      assert.equal(seen.length, 27, 'no entry missed');
      for (const summary of summaries) {
        assert.deepEqual(summary, {
          totalIncome: expectedIncome,
          totalExpense: expectedExpense,
          netBalance: round2(expectedIncome - expectedExpense),
          totalEntries: 27,
        });
      }
    });

    test('the totals a page-summing client would get are WRONG on one page and right from the summary', async () => {
      const { rows } = seedBook();
      const first = await send(getDayBook, asMahall({ query: { scope: 'mahallu', limit: '10' } }));
      const pageIncome = first.body.data.entries.filter((e: any) => e.type === 'income').reduce((s: number, e: any) => s + e.amount, 0);
      const wholeIncome = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0);
      assert.ok(pageIncome < wholeIncome);
      assert.equal(first.body.data.summary.totalIncome, round2(wholeIncome));
    });

    test('income vs expense is the entry\'s own type (the posting service\'s rule), not the ledger it sits in', async () => {
      const { rows } = seedBook();
      const out = await send(getDayBook, asMahall({ query: { scope: 'mahallu', limit: '100' } }));
      const mismatched = out.body.data.entries.filter((e: any) => e.type === 'expense' && e.ledgerType === 'income');
      assert.ok(mismatched.length > 0, 'the fixture has expense entries in an income ledger');
      for (const entry of out.body.data.entries) {
        const row = rows.find((r) => String(r._id) === String(entry._id))!;
        assert.equal(entry.type, row.type);
      }
      const expense = round2(rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0));
      assert.equal(out.body.data.summary.totalExpense, expense);
    });

    test('with no limit the first 100 entries come back (the CMS keeps working) along with pagination and the summary', async () => {
      seedBook();
      const out = await send(getDayBook, asMahall({ query: { scope: 'mahallu' } }));
      assert.equal(out.body.data.entries.length, 27);
      assert.equal(out.body.data.pagination.limit, 100);
      assert.equal(out.body.data.pagination.totalPages, 1);
      assert.equal(out.body.data.summary.totalEntries, 27);
    });

    test('the response keeps the keys the CMS reads', async () => {
      seedBook();
      const out = await send(getDayBook, asMahall({ query: { scope: 'mahallu', limit: '1' } }));
      const entry = out.body.data.entries[0];
      for (const key of ['_id', 'date', 'description', 'ledger', 'ledgerType', 'category', 'institute', 'amount', 'paymentMethod', 'referenceNo', 'type']) {
        assert.ok(key in entry, key);
      }
      for (const key of ['totalIncome', 'totalExpense', 'netBalance', 'totalEntries']) assert.ok(key in out.body.data.summary, key);
    });

    test('the date range narrows both the page and the summary', async () => {
      seedBook();
      const out = await send(getDayBook, asMahall({ query: { scope: 'mahallu', startDate: '2025-01-01', endDate: '2025-01-10', limit: '100' } }));
      assert.equal(out.body.data.entries.length, 10);
      assert.equal(out.body.data.summary.totalEntries, 10);
    });
  });

  describe('ledger report: paging, running balance and totals', () => {
    test('running balances continue across pages and the closing balance equals the last row; totals cover the whole range', async () => {
      const { incomeLedger } = seedBook();
      const items = store.LedgerItem.filter((r) => same(r.ledgerId, incomeLedger._id));
      const range = { startDate: '2025-01-06', endDate: '2025-01-31' };
      const inRange = items.filter((r) => r.date >= new Date('2025-01-06') && r.date <= new Date('2025-01-31T23:59:59.999Z'));
      const before = items.filter((r) => r.date < new Date('2025-01-06'));
      const signed = (r: Doc) => (r.type === 'income' ? r.amount : -r.amount);
      const opening = round2(before.reduce((s, r) => s + signed(r), 0));
      const credit = round2(inRange.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0));
      const debit = round2(inRange.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0));

      const pages: any[] = [];
      for (let page = 1; page <= 3; page += 1) {
        const out = await send(getLedgerReport, asMahall({ query: { ledgerId: String(incomeLedger._id), ...range, limit: '5', page: String(page) } }));
        assert.equal(out.status, 200, JSON.stringify(out.body));
        pages.push(out.body.data);
      }
      const all = pages.flatMap((p) => p.entries);
      assert.equal(all.length, inRange.length);
      assert.equal(new Set(all.map((e: any) => String(e._id))).size, inRange.length);

      for (const data of pages) {
        assert.equal(data.openingBalance, opening);
        assert.equal(data.totalCredit, credit);
        assert.equal(data.totalDebit, debit);
        assert.equal(data.closingBalance, round2(opening + credit - debit));
        assert.equal(data.pagination.total, inRange.length);
      }
      // the running balance of every row is the opening plus everything up to and including it
      let running = opening;
      for (const entry of all) {
        running = round2(running + (entry.credit - entry.debit));
        assert.equal(entry.balance, running, entry.description);
      }
      assert.equal(all[all.length - 1].balance, pages[0].closingBalance);
    });

    test('classification uses the entry\'s type: an expense entry in an income ledger is a debit', async () => {
      const { incomeLedger } = seedBook();
      const out = await send(getLedgerReport, asMahall({ query: { ledgerId: String(incomeLedger._id), limit: '100' } }));
      const row = out.body.data.entries.find((e: any) => e.description === 'Entry 0'); // i = 0: expense, in the income ledger
      assert.equal(row.debit, row.amount);
      assert.equal(row.credit, 0);
    });
  });

  // ─────────────────────────────── list summaries ───────────────────────────────

  describe('list endpoints: whole-set summary aggregates', () => {
    test('ledger items: summary totals are over every matching item, not the page; pagination is unchanged', async () => {
      seedBook();
      const rows = store.LedgerItem;
      const income = round2(rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0));
      const expense = round2(rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0));
      for (const page of ['1', '2', '3']) {
        const out = await send(master.getLedgerItems, asMahall({ query: { page, limit: '10' } }));
        assert.equal(out.status, 200);
        assert.deepEqual(out.body.summary, { totalIncome: income, totalExpense: expense, net: round2(income - expense), count: 27 });
        assert.equal(out.body.pagination.total, 27);
        assert.ok(out.body.data.length <= 10);
      }
    });

    test('ledger items: the summary follows the same filters as the list (institute, ledger, dates) and the same scoping', async () => {
      const { incomeLedger } = seedBook();
      seed('LedgerItem', { _id: oid(), tenantId: T_A, instituteId: INST_1, ledgerId: oid(), type: 'income', amount: 1000, description: 'inst', date: new Date('2025-02-01') });
      seed('LedgerItem', { _id: oid(), tenantId: T_B, instituteId: null, ledgerId: oid(), type: 'income', amount: 5000, description: 'other mahallu', date: new Date('2025-02-01') });

      const mahalluOnly = await send(master.getLedgerItems, asMahall({ query: { scope: 'mahallu', limit: '10' } }));
      assert.equal(mahalluOnly.body.pagination.total, 27, 'Mahallu-level only, own Mahallu only');
      assert.equal(mahalluOnly.body.summary.count, 27);

      const institute = await send(master.getLedgerItems, asInstitute({ query: { limit: '10' } }));
      assert.deepEqual(institute.body.summary, { totalIncome: 1000, totalExpense: 0, net: 1000, count: 1 });

      const byLedger = await send(master.getLedgerItems, asMahall({ query: { ledgerId: String(incomeLedger._id), limit: '10' } }));
      assert.equal(byLedger.body.summary.count, byLedger.body.pagination.total);
    });

    test('institute accounts: totalBalance covers the whole filtered set, and an institute admin\'s covers only their institute', async () => {
      const accounts = Array.from({ length: 13 }, (_, i) => ({
        _id: oid(), tenantId: T_A, instituteId: i < 8 ? INST_1 : INST_2, accountName: `A${i}`, balance: 100 + i * 10.5, createdAt: new Date(2025, 0, i + 1),
      }));
      seed('InstituteAccount', ...accounts, { _id: oid(), tenantId: T_B, instituteId: INST_1, accountName: 'foreign', balance: 77777 });
      const total = round2(accounts.reduce((s, a) => s + a.balance, 0));
      const inst1 = round2(accounts.filter((a) => a.instituteId === INST_1).reduce((s, a) => s + a.balance, 0));

      const all = await send(master.getAllInstituteAccounts, asMahall({ query: { limit: '10' } }));
      assert.equal(all.body.data.length, 10);
      assert.deepEqual(all.body.summary, { totalBalance: total, count: 13 });
      assert.equal(all.body.pagination.total, 13);

      const narrowed = await send(master.getAllInstituteAccounts, asMahall({ query: { instituteId: INST_1, limit: '10' } }));
      assert.deepEqual(narrowed.body.summary, { totalBalance: inst1, count: 8 });

      const own = await send(master.getAllInstituteAccounts, asInstitute({ query: { instituteId: INST_2, limit: '10' } }));
      assert.deepEqual(own.body.summary, { totalBalance: inst1, count: 8 }, 'an institute admin\'s own institute, whatever ?instituteId says');
    });

    test('Mahallu accounts and wallets: totalBalance over the whole set; an institute admin gets an empty page and no books', async () => {
      seed('MahalluAccount', ...Array.from({ length: 12 }, (_, i) => ({ _id: oid(), tenantId: T_A, accountName: `M${i}`, balance: 50 + i, createdAt: new Date(2025, 0, i + 1) })));
      seed('MasterWallet', ...Array.from({ length: 11 }, (_, i) => ({ _id: oid(), tenantId: T_A, name: `W${i}`, balance: 10 + i, createdAt: new Date(2025, 0, i + 1) })));
      const accounts = await send(master.getAllMahalluAccounts, asMahall({ query: { limit: '10' } }));
      assert.deepEqual(accounts.body.summary, { totalBalance: 50 * 12 + 66, count: 12 });
      const wallets = await send(master.getAllWallets, asMahall({ query: { limit: '10' } }));
      assert.deepEqual(wallets.body.summary, { totalBalance: 10 * 11 + 55, count: 11 });

      for (const fn of [master.getAllMahalluAccounts, master.getAllWallets]) {
        const out = await send(fn, asInstitute());
        assert.equal(out.status, 200);
        assert.deepEqual(out.body.data, []);
        assert.equal(callsOf('MahalluAccount.aggregate').length + callsOf('MasterWallet.aggregate').length, 0);
      }
    });
  });

  // ─────────────────────────────── institute scope in the controllers themselves ───────────────────────────────

  describe('an institute caller is pinned to their institute even when the query says otherwise (controller level)', () => {
    const OWN = { tenantId: T_A, instituteId: INST_1 };
    const hostile = { scope: 'mahallu', includeEntities: `mahallu,${INST_2}`, instituteId: INST_2, tenantId: T_B };

    test('master accounts: lists ignore scope / includeEntities / instituteId / tenantId', async () => {
      for (const scope of ['mahallu', 'combined']) {
        const query = { ...hostile, scope };
        await send(master.getAllLedgers, asInstitute({ query }));
        assert.deepEqual(callsOf('Ledger.find')[0].filter, OWN, `ledgers ${scope}`);
        await send(master.getAllCategories, asInstitute({ query }));
        assert.deepEqual(callsOf('Category.find')[0].filter, OWN, `categories ${scope}`);
        await send(master.getAllInstituteAccounts, asInstitute({ query }));
        assert.deepEqual(callsOf('InstituteAccount.find')[0].filter, OWN, `accounts ${scope}`);
        await send(master.getLedgerItems, asInstitute({ query }));
        assert.deepEqual(callsOf('LedgerItem.find')[0].filter, OWN, `items ${scope}`);
        assert.deepEqual(callsOf('LedgerItem.aggregate')[0].pipeline[0].$match.tenantId, T_A);
        assert.equal(callsOf('LedgerItem.aggregate')[0].pipeline[0].$match.instituteId, INST_1, 'the summary is scoped the same way');
      }
    });

    test('reports: day book, trial balance and balance sheet ignore scope=mahallu / combined / includeEntities', async () => {
      for (const scope of ['mahallu', 'combined']) {
        const query = { ...hostile, scope };
        await send(getDayBook, asInstitute({ query }));
        assert.deepEqual(callsOf('LedgerItem.find')[0].filter, OWN, `day book ${scope}`);
        assert.deepEqual(callsOf('LedgerItem.aggregate')[0].pipeline[0].$match, OWN, `day book totals ${scope}`);

        await send(getTrialBalance, asInstitute({ query }));
        assert.deepEqual(callsOf('LedgerItem.aggregate')[0].pipeline[0].$match, OWN, `trial balance ${scope}`);

        await send(getBalanceSheet, asInstitute({ query }));
        assert.deepEqual(callsOf('InstituteAccount.find')[0].filter, { ...OWN, status: 'active' }, `balance sheet ${scope}`);
        assert.equal(callsOf('MahalluAccount.find').length, 0);
      }
    });

    test('by-id writes on a sibling institute\'s or the Mahallu\'s records are refused for an institute caller', async () => {
      const sibling = seed('InstituteAccount', { _id: oid(), tenantId: T_A, instituteId: INST_2, accountName: 'S', balance: 0 });
      const mahalluLevel = seed('Ledger', { _id: oid(), tenantId: T_A, instituteId: null, name: 'L', type: 'income' });
      const wallet = seed('MasterWallet', { _id: oid(), tenantId: T_A, name: 'W', balance: 0 });
      for (const [fn, doc] of [
        [master.updateInstituteAccount, sibling], [master.deleteInstituteAccount, sibling],
        [master.updateLedger, mahalluLevel], [master.deleteLedger, mahalluLevel],
        [master.updateWallet, wallet], [master.deleteWallet, wallet],
      ] as const) {
        const out = await send(fn, asInstitute({ params: { id: String(doc._id) }, body: { name: 'x' } }));
        assert.equal(out.status, 403);
      }
      assert.equal(calls.filter((c) => /\.(update|delete|save)$/.test(c.op)).length, 0);
    });
  });
});
