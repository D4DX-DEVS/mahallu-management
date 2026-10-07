import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import SalaryPayment from '../models/SalaryPayment';
import Employee from '../models/Employee';
import Institute from '../models/Institute';
import * as ledgerService from '../services/ledgerPostingService';
import * as salary from '../controllers/salaryController';

/**
 * Salary payments and the books.
 *
 * - netAmount is computed on the server (base + allowances - deductions, 2 decimals); a client value is ignored.
 * - status moves pending -> paid -> cancelled only; the ledger entry is posted on the way to paid and reversed on
 *   cancel / delete / amount change.
 * - a ledger failure undoes the change and answers an error; it is never swallowed.
 * - the summary leaves cancelled payments out.
 *
 * The models and the ledger service are replaced by small stateful in-memory fakes (no database), so each
 * assertion is about the end state of the "database" and "ledger", not about which calls were made.
 */

const oid = () => new mongoose.Types.ObjectId();
const T_A = String(oid());
const T_B = String(oid());
const INST_1 = String(oid());
const INST_2 = String(oid());
const EMP_1 = String(oid());
const EMP_2 = String(oid());

// ───────────── fakes ─────────────

let payments: any[] = [];
let ledger = new Map<string, any>();
let aggregates: any[] = [];
const ledgerFault = { post: false, reverse: false, postOnce: 0 };
const restorers: Array<() => void> = [];
const stub = (target: any, key: string, impl: any) => {
  const original = target[key];
  target[key] = impl;
  restorers.push(() => { target[key] = original; });
};
const chain = (result: any): any => {
  const c: any = {
    populate: () => c, select: () => c, sort: () => c, skip: () => c, limit: () => c, lean: () => c,
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return c;
};
const copy = (doc: any) => (doc ? { ...doc, toObject: () => ({ ...doc }) } : null);
const sameId = (a: any, b: any) => String(a?._id ?? a) === String(b?._id ?? b);

const people: Record<string, any> = {
  [EMP_1]: { _id: EMP_1, tenantId: T_A, instituteId: INST_1 },
  [EMP_2]: { _id: EMP_2, tenantId: T_A, instituteId: INST_2 },
};
const institutes: Record<string, any> = {
  [INST_1]: { _id: INST_1, tenantId: T_A },
  [INST_2]: { _id: INST_2, tenantId: T_A },
};

// Hooks live inside this suite so the stubs below never leak into the other suites when everything
// runs in one process (npm test).
describe('salary integrity', () => {
  before(() => {
    stub(console, 'error', () => {}); // the controller logs the failures these tests provoke on purpose
    stub(Employee, 'findById', (id: any) => chain(people[String(id)] || null));
    stub(Institute, 'findById', (id: any) => chain(institutes[String(id)] || null));
    stub(SalaryPayment, 'findById', (id: any) => chain(copy(payments.find((p) => sameId(p._id, id)))));
    stub(SalaryPayment, 'find', () => chain(payments.map(copy)));
    stub(SalaryPayment, 'countDocuments', () => chain(payments.length));
    stub(SalaryPayment, 'aggregate', (pipeline: any) => { aggregates.push(pipeline); return chain([]); });
    stub(SalaryPayment.prototype, 'save', async function (this: any) {
      const data = this.toObject();
      const clash = payments.find(
        (p) => String(p.instituteId) === String(data.instituteId) && String(p.employeeId) === String(data.employeeId) && p.month === data.month && p.year === data.year
      );
      if (clash) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      payments.push({ ...data });
      return this;
    });
    stub(SalaryPayment, 'findOneAndUpdate', (filter: any, update: any) => {
      const doc = payments.find((p) => sameId(p._id, filter._id) && (filter.status === undefined || p.status === filter.status));
      if (!doc) return chain(null);
      Object.assign(doc, update.$set ?? update);
      return chain(copy(doc));
    });
    stub(SalaryPayment, 'findByIdAndDelete', (id: any) => {
      payments = payments.filter((p) => !sameId(p._id, id));
      return chain(null);
    });
    stub(ledgerService, 'postLedgerEntry', async (params: any) => {
      if (ledgerFault.postOnce > 0) { ledgerFault.postOnce -= 1; throw new Error('ledger down'); }
      if (ledgerFault.post) throw new Error('ledger down');
      ledger.set(String(params.sourceId), { ...params }); // idempotent per source
      return { created: true } as any;
    });
    stub(ledgerService, 'reverseLedgerEntry', async (_source: any, sourceId: any) => {
      if (ledgerFault.reverse) throw new Error('ledger down');
      ledger.delete(String(sourceId));
    });
  });
  after(() => restorers.reverse().forEach((r) => r()));
  beforeEach(() => {
    payments = [];
    ledger = new Map();
    aggregates = [];
    ledgerFault.post = false;
    ledgerFault.reverse = false;
    ledgerFault.postOnce = 0;
  });

  const send = async (fn: any, req: Record<string, any>) => {
    const out: any = { status: 200, body: undefined };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
    await fn({ params: {}, query: {}, body: {}, headers: {}, ...req }, res);
    return out;
  };
  const asMahall = (extra: Record<string, any> = {}) => ({ tenantId: T_A, isSuperAdmin: false, user: { role: 'mahall' }, ...extra });
  const asInstitute = (extra: Record<string, any> = {}) => ({
    tenantId: T_A, isSuperAdmin: false, user: { role: 'institute', instituteId: INST_1 }, ...extra,
  });

  const body = (extra: Record<string, any> = {}) => ({
    instituteId: INST_1, employeeId: EMP_1, month: 3, year: 2025,
    baseSalary: 5000, allowances: 500, deductions: 200,
    paymentDate: '2025-03-31', paymentMethod: 'cash', ...extra,
  });
  const create = (extra: Record<string, any> = {}, who: any = asMahall) => send(salary.createSalaryPayment, who({ body: body(extra) }));
  const update = (id: any, patch: Record<string, any>, who: any = asMahall) =>
    send(salary.updateSalaryPayment, who({ params: { id: String(id) }, body: patch }));

  const seedPayment = (extra: Record<string, any> = {}) => {
    const doc = {
      _id: oid(), tenantId: T_A, instituteId: INST_1, employeeId: EMP_1, month: 3, year: 2025,
      baseSalary: 5000, allowances: 500, deductions: 200, netAmount: 5300,
      paymentDate: new Date('2025-03-31'), paymentMethod: 'cash', status: 'pending', ...extra,
    };
    payments.push(doc);
    if (doc.status === 'paid') ledger.set(String(doc._id), { amount: doc.netAmount, sourceId: doc._id });
    return doc;
  };
  const stored = (id: any) => payments.find((p) => sameId(p._id, id));

  // ───────────── tests ─────────────

  describe('create: net amount and status', () => {
    test('a client netAmount is ignored: the server computes base + allowances - deductions', async () => {
      const out = await create({ netAmount: 999999 });
      assert.equal(out.status, 201, JSON.stringify(out.body));
      assert.equal(payments.length, 1);
      assert.equal(payments[0].netAmount, 5300);
      assert.equal(payments[0].status, 'pending');
      assert.equal(ledger.size, 0, 'a pending payment is not in the books');
    });

    test('net is rounded to two decimals and floating point noise is removed', async () => {
      await create({ baseSalary: 0.1, allowances: 0.2, deductions: 0 });
      assert.equal(payments[0].netAmount, 0.3);
    });

    test('a negative net is refused and nothing is saved', async () => {
      const out = await create({ baseSalary: 100, allowances: 0, deductions: 100.01, status: 'paid' });
      assert.equal(out.status, 400);
      assert.match(out.body.message, /cannot be more than/);
      assert.equal(payments.length, 0);
      assert.equal(ledger.size, 0);
      assert.equal((await create({ baseSalary: 100, deductions: 100 })).status, 201, 'a net of exactly 0 is allowed');
    });

    test('bad amounts are refused by the controller even without the route validators', async () => {
      for (const patch of [
        { baseSalary: 0 }, { baseSalary: -5 }, { baseSalary: 10.999 }, { baseSalary: 1e300 }, { baseSalary: 'abc' }, { baseSalary: 100_000_000.01 },
        { allowances: -1 }, { allowances: 0.001 }, { deductions: 'abc' }, { deductions: 1e21 },
      ]) {
        const out = await create(patch);
        assert.equal(out.status, 400, JSON.stringify(patch));
      }
      assert.equal(payments.length, 0);
    });

    test('a payment may be created pending or paid, never cancelled or with an unknown status', async () => {
      assert.equal((await create({ status: 'cancelled' })).status, 400);
      assert.equal((await create({ status: 'refunded' })).status, 400);
      assert.equal(payments.length, 0);
    });

    test('a payment created as paid is posted once, for the computed net', async () => {
      const out = await create({ status: 'paid', netAmount: 1 });
      assert.equal(out.status, 201);
      assert.equal(ledger.size, 1);
      const entry = [...ledger.values()][0];
      assert.equal(entry.amount, 5300);
      assert.equal(entry.ledgerType, 'expense');
      assert.equal(entry.source, 'salary');
      assert.equal(String(entry.sourceId), String(payments[0]._id));
      assert.equal(String(entry.instituteId), INST_1);
    });

    test('tenantId, institute (for an institute admin) and unknown fields in the body never land', async () => {
      const out = await create({ tenantId: T_B, instituteId: INST_2, employeeId: EMP_1, hacked: true }, asInstitute);
      assert.equal(out.status, 201, JSON.stringify(out.body));
      assert.equal(String(payments[0].tenantId), T_A);
      assert.equal(String(payments[0].instituteId), INST_1);
      assert.equal(payments[0].hacked, undefined);
    });

    test('an employee can only be paid under their own institute', async () => {
      const out = await create({ instituteId: INST_1, employeeId: EMP_2 });
      assert.equal(out.status, 400);
      assert.match(out.body.message, /does not belong to the selected institute/);
      assert.equal(payments.length, 0);
    });

    test('the unique month index answers a plain duplicate message', async () => {
      assert.equal((await create()).status, 201);
      const again = await create();
      assert.equal(again.status, 400);
      assert.match(again.body.message, /already exists for that month/);
      assert.equal(payments.length, 1);
    });
  });

  describe('create: the ledger failure is not swallowed', () => {
    test('a failing post removes the payment and answers an error, not a success without a ledger entry', async () => {
      ledgerFault.post = true;
      const out = await create({ status: 'paid' });
      assert.equal(out.status, 500);
      assert.equal(out.body.success, false);
      assert.match(out.body.message, /nothing was saved/);
      assert.equal(payments.length, 0, 'the just-created payment is deleted');
      assert.equal(ledger.size, 0);
    });

    test('after the failure the same month can be recorded again', async () => {
      ledgerFault.post = true;
      await create({ status: 'paid' });
      ledgerFault.post = false;
      assert.equal((await create({ status: 'paid' })).status, 201);
      assert.equal(payments.length, 1);
      assert.equal(ledger.size, 1);
    });

    test('a pending payment does not touch the ledger, so a ledger outage does not block it', async () => {
      ledgerFault.post = true;
      assert.equal((await create({ status: 'pending' })).status, 201);
    });
  });

  describe('update: status transitions', () => {
    test('pending -> paid posts the entry once', async () => {
      const p = seedPayment();
      const out = await update(p._id, { status: 'paid' });
      assert.equal(out.status, 200, JSON.stringify(out.body));
      assert.equal(stored(p._id).status, 'paid');
      assert.equal(ledger.size, 1);
      assert.equal([...ledger.values()][0].amount, 5300);
    });

    test('paid -> paid with the same figures posts nothing new', async () => {
      const p = seedPayment({ status: 'paid' });
      const before = ledger.get(String(p._id));
      const out = await update(p._id, { status: 'paid', remarks: 'note' });
      assert.equal(out.status, 200);
      assert.equal(ledger.size, 1);
      assert.strictEqual(ledger.get(String(p._id)), before, 'the entry was not reversed and re-posted');
    });

    test('paid -> cancelled reverses the entry', async () => {
      const p = seedPayment({ status: 'paid' });
      const out = await update(p._id, { status: 'cancelled' });
      assert.equal(out.status, 200);
      assert.equal(stored(p._id).status, 'cancelled');
      assert.equal(ledger.size, 0);
    });

    test('pending -> cancelled needs no ledger work', async () => {
      const p = seedPayment();
      ledgerFault.reverse = true;
      ledgerFault.post = true;
      assert.equal((await update(p._id, { status: 'cancelled' })).status, 200);
      assert.equal(stored(p._id).status, 'cancelled');
    });

    test('paid -> pending is refused: no silent flip back, the ledger keeps its entry', async () => {
      const p = seedPayment({ status: 'paid' });
      const out = await update(p._id, { status: 'pending' });
      assert.equal(out.status, 409);
      assert.equal(stored(p._id).status, 'paid');
      assert.equal(ledger.size, 1);
    });

    test('a cancelled payment is final: it cannot be reopened or edited', async () => {
      const p = seedPayment({ status: 'cancelled' });
      for (const patch of [{ status: 'paid' }, { status: 'pending' }, { baseSalary: 9000 }, { remarks: 'x' }]) {
        assert.equal((await update(p._id, patch)).status, 409, JSON.stringify(patch));
      }
      assert.equal(stored(p._id).baseSalary, 5000);
      assert.equal(ledger.size, 0);
    });

    test('an unknown status never reaches the model', async () => {
      const p = seedPayment();
      assert.equal((await update(p._id, { status: 'refunded' })).status, 409);
      assert.equal(stored(p._id).status, 'pending');
    });
  });

  describe('update: net amount is the server\'s', () => {
    test('a client netAmount is ignored and the net is recomputed from base, allowances and deductions', async () => {
      const p = seedPayment();
      const out = await update(p._id, { baseSalary: 6000, netAmount: 1 });
      assert.equal(out.status, 200);
      assert.equal(stored(p._id).netAmount, 6300);
      assert.equal(stored(p._id).baseSalary, 6000);
      // netAmount alone changes nothing
      const alone = await update(p._id, { netAmount: 1 });
      assert.equal(alone.status, 200);
      assert.equal(stored(p._id).netAmount, 6300);
    });

    test('a change that would make the net negative is refused and nothing changes', async () => {
      const p = seedPayment();
      const out = await update(p._id, { deductions: 6000 });
      assert.equal(out.status, 400);
      assert.equal(stored(p._id).deductions, 200);
      assert.equal(stored(p._id).netAmount, 5300);
    });

    test('bad amounts on update are refused by the controller', async () => {
      const p = seedPayment();
      for (const patch of [{ baseSalary: 0 }, { baseSalary: 10.999 }, { allowances: -1 }, { deductions: 'abc' }, { baseSalary: 1e300 }]) {
        assert.equal((await update(p._id, patch)).status, 400, JSON.stringify(patch));
      }
      assert.equal(stored(p._id).netAmount, 5300);
    });

    test('changing the amount of a paid payment reverses the old entry and posts the new one: one entry, new amount', async () => {
      const p = seedPayment({ status: 'paid' });
      const out = await update(p._id, { allowances: 700 });
      assert.equal(out.status, 200);
      assert.equal(stored(p._id).netAmount, 5500);
      assert.equal(ledger.size, 1);
      assert.equal([...ledger.values()][0].amount, 5500);
    });

    test('changing only the remarks of a paid payment leaves the ledger alone', async () => {
      const p = seedPayment({ status: 'paid' });
      ledgerFault.reverse = true;
      ledgerFault.post = true;
      assert.equal((await update(p._id, { remarks: 'thanks' })).status, 200);
      assert.equal(ledger.size, 1);
    });

    test('tenantId and instituteId (for an institute admin) in the body are dropped', async () => {
      const p = seedPayment();
      const out = await update(p._id, { remarks: 'x', tenantId: T_B, instituteId: INST_2 }, asInstitute);
      assert.equal(out.status, 200);
      assert.equal(String(stored(p._id).tenantId), T_A);
      assert.equal(String(stored(p._id).instituteId), INST_1);
    });
  });

  describe('update: a ledger failure restores the payment', () => {
    test('pending -> paid with the ledger down: the payment stays pending, nothing is in the books, the answer is an error', async () => {
      const p = seedPayment();
      ledgerFault.post = true;
      const out = await update(p._id, { status: 'paid', baseSalary: 9000 });
      assert.equal(out.status, 500);
      assert.equal(stored(p._id).status, 'pending');
      assert.equal(stored(p._id).baseSalary, 5000, 'the amounts are put back too');
      assert.equal(stored(p._id).netAmount, 5300);
      assert.equal(ledger.size, 0);
    });

    test('paid, amount changed, new post fails: the old figures and the OLD ledger entry are back', async () => {
      const p = seedPayment({ status: 'paid' });
      ledgerFault.postOnce = 1; // the re-post of the new amount fails, the restore of the old one works
      const out = await update(p._id, { baseSalary: 9000 });
      assert.equal(out.status, 500);
      assert.equal(stored(p._id).baseSalary, 5000);
      assert.equal(stored(p._id).netAmount, 5300);
      assert.equal(stored(p._id).status, 'paid');
      assert.equal(ledger.size, 1);
      assert.equal([...ledger.values()][0].amount, 5300, 'the books show the old amount, once');
    });

    test('paid -> cancelled with the reversal failing: the payment stays paid and the entry stays', async () => {
      const p = seedPayment({ status: 'paid' });
      ledgerFault.reverse = true;
      const out = await update(p._id, { status: 'cancelled' });
      assert.equal(out.status, 500);
      assert.equal(stored(p._id).status, 'paid');
      assert.equal(ledger.size, 1);
    });

    test('two simultaneous pending -> paid updates: one wins, one is told to reload, the ledger has one entry', async () => {
      const p = seedPayment();
      const [a, b] = await Promise.all([update(p._id, { status: 'paid' }), update(p._id, { status: 'paid' })]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
      assert.equal(ledger.size, 1);
      assert.equal(stored(p._id).status, 'paid');
    });
  });

  describe('delete', () => {
    test('deleting a paid payment reverses its ledger entry', async () => {
      const p = seedPayment({ status: 'paid' });
      const out = await send(salary.deleteSalaryPayment, asMahall({ params: { id: String(p._id) } }));
      assert.equal(out.status, 200);
      assert.equal(payments.length, 0);
      assert.equal(ledger.size, 0);
    });

    test('if the entry cannot be reversed the payment is NOT deleted and the answer is an error', async () => {
      const p = seedPayment({ status: 'paid' });
      ledgerFault.reverse = true;
      const out = await send(salary.deleteSalaryPayment, asMahall({ params: { id: String(p._id) } }));
      assert.equal(out.status, 500);
      assert.equal(payments.length, 1);
      assert.equal(ledger.size, 1);
    });

    test('a pending or cancelled payment deletes without touching the ledger', async () => {
      const a = seedPayment();
      const b = seedPayment({ status: 'cancelled', month: 4 });
      ledgerFault.reverse = true;
      assert.equal((await send(salary.deleteSalaryPayment, asMahall({ params: { id: String(a._id) } }))).status, 200);
      assert.equal((await send(salary.deleteSalaryPayment, asMahall({ params: { id: String(b._id) } }))).status, 200);
      assert.equal(payments.length, 0);
    });
  });

  describe('summary', () => {
    test('cancelled payments are excluded from every total', async () => {
      await send(salary.getSalarySummary, asMahall());
      const match = aggregates[0][0].$match;
      assert.deepEqual(match.status, { $ne: 'cancelled' });
      assert.equal(String(match.tenantId), T_A);
    });

    test('the exclusion cannot be undone from the query string', async () => {
      await send(salary.getSalarySummary, asMahall({ query: { status: 'cancelled' } }));
      assert.deepEqual(aggregates[0][0].$match.status, { $ne: 'cancelled' });
    });

    test('an institute admin\'s summary is pinned to their institute and also leaves cancelled out', async () => {
      await send(salary.getSalarySummary, asInstitute({ query: { instituteId: INST_2 } }));
      const match = aggregates[0][0].$match;
      assert.equal(String(match.instituteId), INST_1);
      assert.deepEqual(match.status, { $ne: 'cancelled' });
    });
  });

  describe('an institute admin only reaches their own institute\'s payments by id', () => {
    test('get / update / delete of a sibling institute\'s payment are refused and change nothing', async () => {
      const sibling = seedPayment({ instituteId: INST_2, employeeId: EMP_2, status: 'paid' });
      const get = await send(salary.getSalaryPaymentById, asInstitute({ params: { id: String(sibling._id) } }));
      const put = await update(sibling._id, { status: 'cancelled' }, asInstitute);
      const del = await send(salary.deleteSalaryPayment, asInstitute({ params: { id: String(sibling._id) } }));
      for (const out of [get, put, del]) assert.equal(out.status, 403);
      assert.equal(stored(sibling._id).status, 'paid');
      assert.equal(ledger.size, 1);
    });

    test('another Mahallu\'s payment is refused for everyone', async () => {
      const foreign = seedPayment({ tenantId: T_B, instituteId: INST_2 });
      for (const who of [asMahall, asInstitute]) {
        assert.equal((await update(foreign._id, { remarks: 'x' }, who)).status, 403);
        assert.equal((await send(salary.deleteSalaryPayment, who({ params: { id: String(foreign._id) } }))).status, 403);
      }
      assert.equal(payments.length, 1);
    });

    test('their own payment works, and a missing one is a 404', async () => {
      const own = seedPayment();
      assert.equal((await send(salary.getSalaryPaymentById, asInstitute({ params: { id: String(own._id) } }))).status, 200);
      assert.equal((await send(salary.getSalaryPaymentById, asInstitute({ params: { id: String(oid()) } }))).status, 404);
    });
  });

  describe('canMoveSalaryStatus', () => {
    test('is exactly pending -> paid -> cancelled', () => {
      const ok: Array<[any, any]> = [['pending', 'pending'], ['pending', 'paid'], ['pending', 'cancelled'], ['paid', 'paid'], ['paid', 'cancelled'], ['cancelled', 'cancelled']];
      const all = ['pending', 'paid', 'cancelled'];
      for (const from of all) {
        for (const to of all) {
          assert.equal(salary.canMoveSalaryStatus(from as any, to as any), ok.some(([a, b]) => a === from && b === to), `${from} -> ${to}`);
        }
      }
    });
  });
});
