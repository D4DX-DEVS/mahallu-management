import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { PettyCash, PettyCashTransaction } from '../models/PettyCash';
import Institute from '../models/Institute';
import { Category } from '../models/MasterAccount';
import * as ledgerService from '../services/ledgerPostingService';
import * as petty from '../controllers/pettyCashController';

/**
 * Petty cash: the balance can never be overdrawn, never drifts from the transactions, and a replenishment posts
 * each expense to the books exactly once.
 *
 * The models are small STATEFUL fakes whose conditional updates (`currentBalance >= amount` with `$inc`, and the
 * claim of an unposted expense) are atomic, like MongoDB's single-document updates. Every handler awaits a few
 * ticks between its reads and writes, so parallel requests really do interleave and all read the same stale fund.
 */

const oid = () => new mongoose.Types.ObjectId();
const T_A = String(oid());
const T_B = String(oid());
const INST_1 = String(oid());
const INST_2 = String(oid());

type Doc = Record<string, any>;
let funds: Doc[] = [];
let txns: Doc[] = [];
let ledger: Doc[] = [];
const fault = { txnSave: false, post: false, staleUnposted: false };
const restorers: Array<() => void> = [];
const stub = (target: any, key: string, impl: any) => {
  const original = target[key];
  target[key] = impl;
  restorers.push(() => { target[key] = original; });
};
const same = (a: any, b: any) => String(a?._id ?? a) === String(b?._id ?? b);
const tick = async (n = 3) => { for (let i = 0; i < n; i += 1) await Promise.resolve(); };
const chain = (result: any): any => {
  const c: any = {
    populate: () => c, select: () => c, sort: () => c, skip: () => c, limit: () => c, lean: () => c,
    then: (resolve: any, reject: any) => tick().then(() => result).then(resolve, reject),
  };
  return c;
};

/** Enough of Mongo's matcher for the filters these handlers use. */
const matches = (doc: Doc, filter: Doc): boolean =>
  Object.entries(filter || {}).every(([key, expected]: [string, any]) => {
    const actual = doc[key];
    if (expected && typeof expected === 'object' && !(expected instanceof mongoose.Types.ObjectId)) {
      if ('$gte' in expected) return typeof actual === 'number' && actual >= expected.$gte;
      if ('$ne' in expected) return actual !== expected.$ne;
      return true;
    }
    return same(actual, expected);
  });

const apply = (doc: Doc, update: Doc) => {
  for (const [k, v] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + (v as number);
  for (const [k, v] of Object.entries(update.$set || {})) doc[k] = v;
};

const asFundDoc = (doc: Doc) => {
  const wrapper: Doc = { ...doc };
  wrapper.save = async () => { Object.assign(doc, { custodianName: wrapper.custodianName, status: wrapper.status }); return wrapper; };
  return wrapper;
};

// Hooks live inside this suite so the stubs below never leak into the other suites when everything
// runs in one process (npm test).
describe('petty cash integrity', () => {
  before(() => {
    stub(console, 'error', () => {});
    stub(Institute, 'findById', (id: any) => chain({ _id: id, tenantId: T_A }));
    stub(Category, 'findById', (id: any) => chain({ _id: id, tenantId: T_A, instituteId: INST_1 }));

    stub(PettyCash, 'find', (filter: Doc) => chain(funds.filter((f) => matches(f, filter)).map((f) => ({ ...f }))));
    stub(PettyCash, 'findOne', (filter: Doc) => {
      const doc = funds.find((f) => matches(f, filter));
      return chain(doc ? asFundDoc(doc) : null);
    });
    stub(PettyCash, 'findById', (id: any) => chain(funds.find((f) => same(f._id, id)) ? { ...funds.find((f) => same(f._id, id)) } : null));
    stub(PettyCash, 'findOneAndUpdate', (filter: Doc, update: Doc) => {
      // check-and-change in one synchronous step: atomic, like a single MongoDB update
      const doc = funds.find((f) => matches(f, filter));
      if (doc) apply(doc, update);
      return chain(doc ? { ...doc } : null);
    });
    stub(PettyCash, 'updateOne', (filter: Doc, update: Doc) => {
      const doc = funds.find((f) => matches(f, filter));
      if (doc) apply(doc, update);
      return chain({});
    });
    stub(PettyCash, 'findByIdAndDelete', (id: any) => { funds = funds.filter((f) => !same(f._id, id)); return chain(null); });
    stub(PettyCash.prototype, 'save', async function (this: any) { funds.push({ ...this.toObject() }); return this; });

    stub(PettyCashTransaction.prototype, 'save', async function (this: any) {
      await tick();
      if (fault.txnSave) throw new Error('write failed');
      txns.push({ ...this.toObject() });
      return this;
    });
    stub(PettyCashTransaction, 'find', (filter: Doc) => {
      const wanted = { ...filter };
      delete wanted.postedToLedger;
      return chain(
        txns
          .filter((t) => matches(t, wanted) && (fault.staleUnposted || t.postedToLedger !== true))
          .map((t) => ({ ...t }))
      );
    });
    stub(PettyCashTransaction, 'findOneAndUpdate', (filter: Doc, update: Doc) => {
      const doc = txns.find((t) => matches(t, filter));
      if (doc) apply(doc, update);
      return chain(doc ? { ...doc } : null);
    });
    stub(PettyCashTransaction, 'updateOne', (filter: Doc, update: Doc) => {
      const doc = txns.find((t) => matches(t, filter));
      if (doc) apply(doc, update);
      return chain({});
    });

    stub(ledgerService, 'postLedgerEntry', async (params: any) => {
      await tick();
      if (fault.post) throw new Error('ledger down');
      ledger.push({ ...params });
      return { created: true } as any;
    });
  });
  after(() => restorers.reverse().forEach((r) => r()));
  beforeEach(() => {
    funds = [];
    txns = [];
    ledger = [];
    fault.txnSave = false;
    fault.post = false;
    fault.staleUnposted = false;
  });

  const send = async (fn: any, req: Record<string, any>) => {
    const out: any = { status: 200, body: undefined };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
    await fn({ params: {}, query: {}, body: {}, headers: {}, ...req }, res);
    return out;
  };
  const asMahall = (extra: Record<string, any> = {}) => ({ tenantId: T_A, isSuperAdmin: false, user: { role: 'mahall', _id: oid() }, ...extra });
  const asInstitute = (extra: Record<string, any> = {}) => ({
    tenantId: T_A, isSuperAdmin: false, user: { role: 'institute', instituteId: INST_1, _id: oid() }, ...extra,
  });

  const seedFund = (extra: Record<string, any> = {}) => {
    const doc = {
      _id: oid(), tenantId: T_A, instituteId: INST_1, custodianName: 'Custodian',
      floatAmount: 100, currentBalance: 100, status: 'active', ...extra,
    };
    funds.push(doc);
    return doc;
  };
  const expense = (fund: Doc, amount: any, extra: Record<string, any> = {}) =>
    send(petty.recordExpense, asMahall({ params: { id: String(fund._id) }, body: { amount, description: 'Stationery', ...extra } }));
  const replenish = (fund: Doc, who: any = asMahall) => send(petty.replenishPettyCash, who({ params: { id: String(fund._id) } }));
  const balanceOf = (fund: Doc) => funds.find((f) => same(f._id, fund._id))!.currentBalance;
  const expensesOf = (fund: Doc) => txns.filter((t) => same(t.pettyCashId, fund._id) && t.type === 'expense');

  describe('expenses can never overdraw the fund', () => {
    test('30 parallel expenses of 10 against a balance of 100: exactly 10 succeed, the balance ends at 0, never below', async () => {
      const fund = seedFund();
      const results = await Promise.all(Array.from({ length: 30 }, () => expense(fund, 10)));
      const ok = results.filter((r) => r.status === 201);
      const refused = results.filter((r) => r.status === 400);
      assert.equal(ok.length, 10);
      assert.equal(refused.length, 20);
      for (const r of refused) assert.match(r.body.message, /isn't enough petty cash/);
      assert.equal(balanceOf(fund), 0);
      assert.equal(expensesOf(fund).length, 10, 'one transaction per taken amount, none for refused ones');
      assert.equal(expensesOf(fund).reduce((s, t) => s + t.amount, 0), 100);
    });

    test('30 parallel expenses of mixed sizes: the money taken always equals the transactions recorded', async () => {
      const fund = seedFund({ floatAmount: 1000, currentBalance: 1000 });
      const amounts = Array.from({ length: 30 }, (_, i) => 20 + i * 3.5); // 20 .. 121.5, total well over 1000
      const results = await Promise.all(amounts.map((a) => expense(fund, a)));
      const taken = expensesOf(fund).reduce((s, t) => s + t.amount, 0);
      assert.ok(balanceOf(fund) >= 0, 'never negative');
      assert.ok(Math.abs(1000 - taken - balanceOf(fund)) < 1e-6, 'balance = float - recorded expenses');
      assert.equal(results.filter((r) => r.status === 201).length, expensesOf(fund).length);
      assert.ok(taken <= 1000);
    });

    test('an expense above the balance is refused and changes nothing; exactly the balance is allowed', async () => {
      const fund = seedFund({ currentBalance: 40 });
      assert.equal((await expense(fund, 40.01)).status, 400);
      assert.equal(balanceOf(fund), 40);
      assert.equal(expensesOf(fund).length, 0);
      assert.equal((await expense(fund, 40)).status, 201);
      assert.equal(balanceOf(fund), 0);
      assert.equal((await expense(fund, 0.01)).status, 400);
    });

    test('binary noise in a stored balance does not refuse the last paisa', async () => {
      const fund = seedFund({ currentBalance: 0.1 + 0.2 }); // 0.30000000000000004
      assert.equal((await expense(fund, 0.3)).status, 201);
      const fund2 = seedFund({ currentBalance: 0.3 - 1e-17 });
      assert.equal((await expense(fund2, 0.3)).status, 201);
      const fund3 = seedFund({ currentBalance: 0.29 });
      assert.equal((await expense(fund3, 0.3)).status, 400, 'a real shortfall is still refused');
    });

    test('bad amounts are refused by the controller itself: nothing is taken', async () => {
      const fund = seedFund();
      for (const amount of [0, '0', -5, 0.001, 10.999, 'abc', 1e300, NaN, null, undefined, true, [5], '1e1', 100_000_000.01]) {
        const out = await expense(fund, amount);
        assert.equal(out.status, 400, JSON.stringify(amount));
      }
      assert.equal((await expense(fund, 5, { description: '' })).status, 400);
      assert.equal((await expense(fund, 5, { date: 'not a date' })).status, 400);
      assert.equal(balanceOf(fund), 100);
      assert.equal(txns.length, 0);
    });

    test('a numeric string with two decimals is accepted and recorded as a number', async () => {
      const fund = seedFund();
      assert.equal((await expense(fund, '12.50')).status, 201);
      assert.equal(balanceOf(fund), 87.5);
      assert.equal(expensesOf(fund)[0].amount, 12.5);
    });

    test('an inactive fund takes no expenses', async () => {
      const fund = seedFund({ status: 'inactive' });
      assert.equal((await expense(fund, 5)).status, 404);
      assert.equal(balanceOf(fund), 100);
    });
  });

  describe('a failure between the two writes is compensated', () => {
    test('the transaction cannot be written: the amount is given back and the answer is an error', async () => {
      const fund = seedFund();
      fault.txnSave = true;
      const out = await expense(fund, 30);
      assert.equal(out.status, 500);
      assert.equal(balanceOf(fund), 100, 'the balance is whole again');
      assert.equal(txns.length, 0);
    });

    test('parallel expenses with the transaction write failing leave the balance untouched', async () => {
      const fund = seedFund();
      fault.txnSave = true;
      const results = await Promise.all(Array.from({ length: 12 }, () => expense(fund, 10)));
      assert.ok(results.every((r) => r.status === 500 || r.status === 400));
      assert.equal(balanceOf(fund), 100);
    });

    test('after a failure the fund works again', async () => {
      const fund = seedFund();
      fault.txnSave = true;
      await expense(fund, 30);
      fault.txnSave = false;
      assert.equal((await expense(fund, 30)).status, 201);
      assert.equal(balanceOf(fund), 70);
    });

    test('the float transaction cannot be written: the new fund is taken back instead of living without a float record', async () => {
      fault.txnSave = true;
      const out = await send(petty.createPettyCash, asMahall({ body: { custodianName: 'Custodian', floatAmount: 500, instituteId: INST_1 } }));
      assert.equal(out.status, 500);
      assert.equal(funds.length, 0);
    });
  });

  describe('replenishment posts each expense exactly once', () => {
    const fundWithExpenses = async () => {
      const fund = seedFund();
      await expense(fund, 25);
      await expense(fund, 35, { description: 'Tea' });
      assert.equal(balanceOf(fund), 40);
      return fund;
    };

    test('a double click: one replenishes, the other changes nothing; every expense is in the ledger once', async () => {
      const fund = await fundWithExpenses();
      const [a, b] = await Promise.all([replenish(fund), replenish(fund)]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
      assert.equal(balanceOf(fund), 100);
      assert.equal(ledger.length, 2, 'two expenses, two ledger entries, not four');
      assert.deepEqual(ledger.map((l) => l.amount).sort((x, y) => x - y), [25, 35]);
      assert.equal(txns.filter((t) => t.type === 'replenishment').length, 1);
      assert.equal(txns.filter((t) => t.type === 'replenishment')[0].amount, 60);
      assert.ok(expensesOf(fund).every((t) => t.postedToLedger === true));
    });

    test('a second click after the first finished finds nothing to replenish', async () => {
      const fund = await fundWithExpenses();
      assert.equal((await replenish(fund)).status, 200);
      const again = await replenish(fund);
      assert.equal(again.status, 400);
      assert.equal(ledger.length, 2);
      assert.equal(txns.filter((t) => t.type === 'replenishment').length, 1);
    });

    test('five clicks at once: one winner, five-minus-one refused, still two ledger entries', async () => {
      const fund = await fundWithExpenses();
      const results = await Promise.all(Array.from({ length: 5 }, () => replenish(fund)));
      assert.equal(results.filter((r) => r.status === 200).length, 1);
      assert.equal(ledger.length, 2);
    });

    test('each expense is claimed before it is posted: a stale list cannot post an already-claimed expense again', async () => {
      const fund = await fundWithExpenses();
      // another request has already claimed (and posted) the first expense, but this one still sees it as unposted
      const taken = expensesOf(fund)[0];
      taken.postedToLedger = true;
      fault.staleUnposted = true;
      assert.equal((await replenish(fund)).status, 200);
      assert.equal(ledger.length, 1, 'only the expense nobody else had claimed');
      assert.ok(ledger.every((l) => String(l.sourceId) !== String(taken._id)));
    });

    test('the ledger entries are the expenses, as petty_cash source, expense type, with their own ids', async () => {
      const fund = await fundWithExpenses();
      await replenish(fund);
      for (const entry of ledger) {
        assert.equal(entry.source, 'petty_cash');
        assert.equal(entry.ledgerType, 'expense');
        assert.equal(entry.ledgerName, 'Petty Cash Expenses');
        assert.equal(String(entry.instituteId), INST_1);
      }
      assert.deepEqual(ledger.map((l) => String(l.sourceId)).sort(), expensesOf(fund).map((t) => String(t._id)).sort());
    });

    test('a ledger failure is reported, the expense is released and is posted at the next replenishment', async () => {
      const fund = await fundWithExpenses();
      fault.post = true;
      const first = await replenish(fund);
      assert.equal(first.status, 200);
      assert.equal(first.body.ledgerPending, 2);
      assert.match(first.body.message, /could not be posted/);
      assert.equal(balanceOf(fund), 100, 'the fund itself is replenished');
      assert.ok(expensesOf(fund).every((t) => t.postedToLedger === false), 'released, not lost');
      assert.equal(ledger.length, 0);

      fault.post = false;
      await expense(fund, 10, { description: 'More' });
      assert.equal((await replenish(fund)).status, 200);
      assert.equal(ledger.length, 3, 'the two earlier expenses and the new one, each once');
    });

    test('the transaction write failing gives the balance back and posts nothing', async () => {
      const fund = await fundWithExpenses();
      fault.txnSave = true;
      const out = await replenish(fund);
      assert.equal(out.status, 500);
      assert.equal(balanceOf(fund), 40);
      assert.equal(ledger.length, 0);
      assert.ok(expensesOf(fund).every((t) => t.postedToLedger !== true));
    });

    test('a fund with nothing spent has nothing to replenish', async () => {
      const fund = seedFund();
      assert.equal((await replenish(fund)).status, 400);
    });
  });

  describe('create and update are whitelisted', () => {
    test('the balance and status in the body are ignored: the fund starts active with balance = float, and the float is recorded', async () => {
      const out = await send(petty.createPettyCash, asMahall({
        body: { custodianName: 'Custodian', floatAmount: 750.5, currentBalance: 99999, status: 'inactive', instituteId: INST_1, tenantId: T_B, _id: String(oid()) },
      }));
      assert.equal(out.status, 201, JSON.stringify(out.body));
      assert.equal(funds.length, 1);
      assert.equal(funds[0].currentBalance, 750.5);
      assert.equal(funds[0].floatAmount, 750.5);
      assert.equal(funds[0].status, 'active');
      assert.equal(String(funds[0].tenantId), T_A);
      assert.equal(txns.filter((t) => t.type === 'float').length, 1);
      assert.equal(txns.find((t) => t.type === 'float')!.amount, 750.5);
    });

    test('a float that is not a positive amount with at most two decimals is refused', async () => {
      for (const floatAmount of [0, '0', -1, 10.999, 'abc', 1e300, NaN, null, undefined, 100_000_000.01]) {
        const out = await send(petty.createPettyCash, asMahall({ body: { custodianName: 'Custodian', floatAmount, instituteId: INST_1 } }));
        assert.equal(out.status, 400, JSON.stringify(floatAmount));
      }
      assert.equal((await send(petty.createPettyCash, asMahall({ body: { custodianName: 'x', floatAmount: 5, instituteId: INST_1 } }))).status, 400);
      assert.equal(funds.length, 0);
    });

    test('an institute admin is forced into their own institute', async () => {
      const out = await send(petty.createPettyCash, asInstitute({ body: { custodianName: 'Custodian', floatAmount: 100, instituteId: INST_2 } }));
      assert.equal(out.status, 201);
      assert.equal(String(funds[0].instituteId), INST_1);
    });

    test('update changes only the custodian and the status; the float and balance in the body are ignored', async () => {
      const fund = seedFund({ currentBalance: 40 });
      const out = await send(petty.updatePettyCash, asMahall({
        params: { id: String(fund._id) },
        body: { custodianName: 'New Name', status: 'inactive', floatAmount: 1, currentBalance: 99999, tenantId: T_B },
      }));
      assert.equal(out.status, 200, JSON.stringify(out.body));
      assert.equal(fund.custodianName, 'New Name');
      assert.equal(fund.status, 'inactive');
      assert.equal(fund.floatAmount, 100);
      assert.equal(fund.currentBalance, 40);
      assert.equal(String(fund.tenantId), T_A);
      assert.equal((await send(petty.updatePettyCash, asMahall({ params: { id: String(fund._id) }, body: { status: 'deleted' } }))).status, 400);
      assert.equal((await send(petty.updatePettyCash, asMahall({ params: { id: String(fund._id) }, body: { custodianName: ' ' } }))).status, 400);
    });

    test('another institute\'s fund is not found for an institute admin: no expense, no replenishment', async () => {
      const sibling = seedFund({ instituteId: INST_2, currentBalance: 50 });
      const out = await send(petty.recordExpense, asInstitute({ params: { id: String(sibling._id) }, body: { amount: 5, description: 'x' } }));
      assert.equal(out.status, 404);
      assert.equal((await send(petty.replenishPettyCash, asInstitute({ params: { id: String(sibling._id) } }))).status, 404);
      assert.equal(balanceOf(sibling), 50);
      assert.equal(txns.length, 0);
    });
  });
});
