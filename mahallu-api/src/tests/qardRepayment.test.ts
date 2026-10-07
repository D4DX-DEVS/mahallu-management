import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { QardLoan, QardRepayment, buildRepaymentSchedule } from '../models/QardLoan';
import { createRepayment } from '../controllers/qardController';
import { fakeModel, FakeCollection, callHandler, oid, silenceConsoleError } from './fakeMongo';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] qardRepayment', () => {

/**
 * Qard repayments: race-safe, idempotent, compensated, and able to close a fractional balance.
 *
 * The models are replaced by a stateful in-memory fake (see fakeMongo.ts) whose writes are atomic
 * single-document operations and whose reads are snapshots, so parallel requests really interleave.
 */

const TENANT = String(oid());
const OTHER_TENANT = String(oid());

let loans: FakeCollection;
let repayments: FakeCollection;
const restorers: Array<() => void> = [];
let restoreConsole: () => void;

// One suite, so the model stubs live only while this file's tests run (the aggregate run shares one process).
describe('Qard repayments', () => {
before(() => {
  const l = fakeModel(QardLoan);
  const r = fakeModel(QardRepayment);
  loans = l.collection;
  repayments = r.collection;
  restorers.push(l.restore, r.restore);
  restoreConsole = silenceConsoleError();
});
after(() => {
  restorers.forEach((restore) => restore());
  restoreConsole();
});

beforeEach(() => {
  loans.rows.length = 0;
  loans.log.length = 0;
  repayments.rows.length = 0;
  repayments.log.length = 0;
  repayments.uniqueOn((candidate, rows) =>
    !!candidate.clientRequestId &&
    rows.some(
      (row) =>
        String(row.tenantId) === String(candidate.tenantId) && row.clientRequestId === candidate.clientRequestId
    )
  );
});

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (values: number[]) => round2(values.reduce((a, b) => a + b, 0));

const seedLoan = (extra: Record<string, any> = {}) => {
  const principal = extra.approvedAmount ?? 1000;
  const months = extra.repaymentMonths ?? 4;
  const [loan] = loans.seed({
    tenantId: TENANT,
    applicantName: 'Test Applicant',
    amount: principal,
    approvedAmount: principal,
    repaymentMonths: months,
    status: 'disbursed',
    outstandingBalance: principal,
    repaymentSchedule: buildRepaymentSchedule(principal, months, new Date(2026, 0, 15)),
    ...extra,
  });
  return loan;
};

const asMahall = (loan: any, body: Record<string, any>, extra: Record<string, any> = {}) => ({
  tenantId: TENANT,
  isSuperAdmin: false,
  user: { role: 'mahall', id: String(oid()) },
  body: { loanId: String(loan._id), ...body },
  ...extra,
});

const repay = (loan: any, body: Record<string, any>, extra: Record<string, any> = {}) =>
  callHandler(createRepayment as any, asMahall(loan, body, extra));

const current = (loan: any) => loans.get(loan._id)!;

describe('parallel repayments', () => {
  test('20 parallel repayments of 100 against 1000: exactly 10 apply, the balance never goes below zero', async () => {
    const loan = seedLoan();
    const results = await Promise.all(Array.from({ length: 20 }, () => repay(loan, { amount: 100 })));

    const applied = results.filter((r) => r.status === 201);
    const refused = results.filter((r) => r.status !== 201);
    assert.equal(applied.length, 10, 'ten payments fit into 1000');
    assert.equal(refused.length, 10);
    refused.forEach((r) =>
      // Over the balance is a 400; a request that only got to run after the loan closed is a 409.
      assert.ok([400, 409].includes(r.status), `refused with ${r.status}, expected a plain 400 or 409`)
    );

    const stored = current(loan);
    assert.equal(stored.outstandingBalance, 0);
    assert.equal(stored.status, 'closed');
    assert.equal(sum(repayments.rows.map((row) => row.amount)), 1000, 'repayment rows add up to the principal, not more');
    assert.equal(repayments.rows.length, 10);
    assert.equal(sum(stored.repaymentSchedule.map((i: any) => i.paidAmount)), 1000);
    stored.repaymentSchedule.forEach((i: any) => assert.equal(i.status, 'paid'));
  });

  test('uneven parallel payments stop at the balance and leave the schedule agreeing with it', async () => {
    const loan = seedLoan();
    const results = await Promise.all(Array.from({ length: 15 }, () => repay(loan, { amount: 77.77 })));
    const applied = results.filter((r) => r.status === 201).length;
    assert.equal(applied, 12, 'floor(1000 / 77.77) payments fit');

    const stored = current(loan);
    assert.equal(stored.outstandingBalance, round2(1000 - 12 * 77.77));
    assert.ok(stored.outstandingBalance > 0);
    assert.equal(stored.status, 'repaying');
    assert.equal(
      sum(stored.repaymentSchedule.map((i: any) => i.paidAmount)),
      round2(1000 - stored.outstandingBalance),
      'the schedule is rebuilt from the persisted balance, not patched'
    );
    assert.equal(sum(repayments.rows.map((row) => row.amount)), round2(12 * 77.77));
  });

  test('each applied repayment reports the balance it produced, strictly decreasing', async () => {
    const loan = seedLoan();
    const results = await Promise.all(Array.from({ length: 4 }, () => repay(loan, { amount: 250 })));
    const balances = results
      .filter((r) => r.status === 201)
      .map((r) => r.body.data.outstandingBalance)
      .sort((a, b) => b - a);
    assert.deepEqual(balances, [750, 500, 250, 0]);
  });
});

describe('idempotency (clientRequestId)', () => {
  test('the same clientRequestId applies once: the repeat returns the existing repayment with 200', async () => {
    const loan = seedLoan();
    const first = await repay(loan, { amount: 300, clientRequestId: 'req-0001-abcd' });
    assert.equal(first.status, 201);
    assert.equal(first.body.data.outstandingBalance, 700);

    const second = await repay(loan, { amount: 300, clientRequestId: 'req-0001-abcd' });
    assert.equal(second.status, 200);
    assert.equal(second.body.data.duplicate, true);
    assert.equal(String(second.body.data.repayment._id), String(first.body.data.repayment._id));
    assert.equal(second.body.data.outstandingBalance, 700);

    assert.equal(current(loan).outstandingBalance, 700, 'no second balance change');
    assert.equal(repayments.rows.length, 1, 'no second repayment row');
  });

  test('a repeat still answers 200 after the first payment closed the loan', async () => {
    const loan = seedLoan({ approvedAmount: 200, repaymentMonths: 2 });
    const first = await repay(loan, { amount: 200, clientRequestId: 'close-req-0001' });
    assert.equal(first.status, 201);
    assert.equal(current(loan).status, 'closed');

    const retry = await repay(loan, { amount: 200, clientRequestId: 'close-req-0001' });
    assert.equal(retry.status, 200, 'a retry is not "loan closed", it is the same payment');
    assert.equal(retry.body.data.status, 'closed');
  });

  test('the same id with a different amount or loan is refused with 409, not silently reused', async () => {
    const loan = seedLoan();
    const other = seedLoan();
    await repay(loan, { amount: 100, clientRequestId: 'req-shared-0001' });

    const differentAmount = await repay(loan, { amount: 150, clientRequestId: 'req-shared-0001' });
    assert.equal(differentAmount.status, 409);

    const differentLoan = await repay(other, { amount: 100, clientRequestId: 'req-shared-0001' });
    assert.equal(differentLoan.status, 409);
    assert.equal(current(other).outstandingBalance, 1000);
    assert.equal(repayments.rows.length, 1);
  });

  test('5 parallel requests with one id: one repayment row, the balance moves once', async () => {
    const loan = seedLoan();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => repay(loan, { amount: 100, clientRequestId: 'parallel-req-01' }))
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1, 'exactly one creates');
    results
      .filter((r) => r.status !== 201)
      .forEach((r) => {
        assert.equal(r.status, 200);
        assert.equal(r.body.data.duplicate, true);
      });
    assert.equal(repayments.rows.length, 1);
    const stored = current(loan);
    assert.equal(stored.outstandingBalance, 900);
    assert.equal(sum(stored.repaymentSchedule.map((i: any) => i.paidAmount)), 100);
  });

  test('ids are scoped per Mahallu: the same id in another Mahallu is a different request', async () => {
    const mine = seedLoan();
    const [theirs] = loans.seed({
      tenantId: OTHER_TENANT,
      amount: 500,
      approvedAmount: 500,
      repaymentMonths: 2,
      status: 'disbursed',
      outstandingBalance: 500,
      repaymentSchedule: buildRepaymentSchedule(500, 2, new Date(2026, 0, 15)),
    });
    const a = await repay(mine, { amount: 100, clientRequestId: 'tenant-scope-01' });
    const b = await callHandler(createRepayment as any, {
      tenantId: OTHER_TENANT,
      isSuperAdmin: false,
      user: { role: 'mahall' },
      body: { loanId: String(theirs._id), amount: 100, clientRequestId: 'tenant-scope-01' },
    });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
  });

  test('a malformed clientRequestId is a 400', async () => {
    const loan = seedLoan();
    for (const bad of ['short', 'has space in it!', 'x'.repeat(101), 12345678, { $gt: '' }]) {
      const result = await repay(loan, { amount: 100, clientRequestId: bad });
      assert.equal(result.status, 400, `clientRequestId ${JSON.stringify(bad)} must be refused`);
    }
    assert.equal(current(loan).outstandingBalance, 1000);
  });
});

describe('compensation', () => {
  test('if the repayment row cannot be created, the balance, schedule and status are put back', async () => {
    const loan = seedLoan({ status: 'disbursed' });
    repayments.failNext('create', new Error('disk full'));

    const result = await repay(loan, { amount: 400 });
    assert.equal(result.status, 500);

    const stored = current(loan);
    assert.equal(stored.outstandingBalance, 1000, 'balance restored');
    assert.equal(stored.status, 'disbursed', 'status restored');
    assert.equal(sum(stored.repaymentSchedule.map((i: any) => i.paidAmount)), 0, 'schedule restored');
    assert.equal(repayments.rows.length, 0);
  });

  test('compensation is exact even when another repayment landed in between', async () => {
    const loan = seedLoan();
    // The first create fails; a concurrent second repayment succeeds while the first is being undone.
    repayments.failNext('create', new Error('transient'), (data) => data.amount === 400);
    const [failed, ok] = await Promise.all([repay(loan, { amount: 400 }), repay(loan, { amount: 100 })]);
    assert.equal(failed.status, 500);
    assert.equal(ok.status, 201);

    const stored = current(loan);
    assert.equal(stored.outstandingBalance, 900, 'only the 100 stands');
    assert.equal(sum(stored.repaymentSchedule.map((i: any) => i.paidAmount)), 100);
    assert.equal(sum(repayments.rows.map((row) => row.amount)), 100);
  });

  test('a closing payment whose row fails re-opens the loan', async () => {
    const loan = seedLoan({ approvedAmount: 200, repaymentMonths: 2, status: 'repaying', outstandingBalance: 200 });
    repayments.failNext('create', new Error('boom'));
    const result = await repay(loan, { amount: 200 });
    assert.equal(result.status, 500);
    const stored = current(loan);
    assert.equal(stored.outstandingBalance, 200);
    assert.equal(stored.status, 'repaying');
  });
});

describe('final repayment and input rules', () => {
  test('a fractional balance can be closed by paying exactly what remains', async () => {
    const loan = seedLoan({ approvedAmount: 100.5, repaymentMonths: 3 });

    const first = await repay(loan, { amount: 100 });
    assert.equal(first.status, 201);
    assert.equal(first.body.data.outstandingBalance, 0.5);
    assert.equal(first.body.data.status, 'repaying');

    assert.equal((await repay(loan, { amount: 0.51 })).status, 400, 'more than remains is refused');
    assert.equal((await repay(loan, { amount: 0.505 })).status, 400, 'three decimals are refused');

    const last = await repay(loan, { amount: 0.5 });
    assert.equal(last.status, 201);
    assert.equal(last.body.data.outstandingBalance, 0);
    assert.equal(last.body.data.status, 'closed');

    const stored = current(loan);
    assert.equal(stored.status, 'closed');
    stored.repaymentSchedule.forEach((i: any) => assert.equal(i.status, 'paid'));
    assert.equal(sum(repayments.rows.map((row) => row.amount)), 100.5);
  });

  test('a repayment larger than the outstanding balance is a 400 and changes nothing', async () => {
    const loan = seedLoan();
    const result = await repay(loan, { amount: 1000.01 });
    assert.equal(result.status, 400);
    assert.equal(current(loan).outstandingBalance, 1000);
    assert.equal(repayments.rows.length, 0);
  });

  test('zero, negative, huge, 3-decimal and non-numeric amounts are 400', async () => {
    const loan = seedLoan();
    for (const bad of [0, -5, 100_000_001, 10.999, '1e3', 'abc', null, undefined, true, [], {}]) {
      const result = await repay(loan, { amount: bad });
      assert.equal(result.status, 400, `amount ${JSON.stringify(bad)} must be refused`);
    }
    assert.equal(current(loan).outstandingBalance, 1000);
    assert.equal(loans.log.length, 0, 'nothing was written');
  });

  test('a loan that is not repayable answers 409; a missing or foreign loan answers 404; a non-admin 403', async () => {
    for (const status of ['applied', 'under_review', 'approved', 'rejected', 'closed', 'defaulted']) {
      const loan = seedLoan({ status });
      assert.equal((await repay(loan, { amount: 10 })).status, 409, `${status} loan`);
    }
    const missing = await callHandler(createRepayment as any, {
      tenantId: TENANT,
      user: { role: 'mahall' },
      body: { loanId: String(oid()), amount: 10 },
    });
    assert.equal(missing.status, 404);

    const foreign = seedLoan({ tenantId: OTHER_TENANT });
    assert.equal((await repay(foreign, { amount: 10 })).status, 404, 'another Mahallu\'s loan is invisible');

    const loan = seedLoan();
    const survey = await callHandler(createRepayment as any, {
      tenantId: TENANT,
      isSuperAdmin: false,
      user: { role: 'survey' },
      body: { loanId: String(loan._id), amount: 10 },
    });
    assert.equal(survey.status, 403);
    assert.equal(current(loan).outstandingBalance, 1000);
  });
});

});
});
