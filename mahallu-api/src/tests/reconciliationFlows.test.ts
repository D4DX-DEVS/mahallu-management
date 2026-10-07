import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { RECONCILIATION_MESSAGE, ReconciliationRequiredError, reportReconciliationRequired } from '../utils/reconciliation';
import { ReconciliationIssue } from '../models/ReconciliationIssue';
import SalaryPayment from '../models/SalaryPayment';
import Employee from '../models/Employee';
import Institute from '../models/Institute';
import { PettyCash, PettyCashTransaction } from '../models/PettyCash';
import { WelfareApplication } from '../models/Welfare';
import Family from '../models/Family';
import { QardLoan, QardRepayment, buildRepaymentSchedule } from '../models/QardLoan';
import * as ledgerService from '../services/ledgerPostingService';
import { postLedgerEntry, reverseLedgerEntry } from '../services/ledgerPostingService';
import {
  createVarisangya,
  createZakat,
  verifyVarisangya,
  verifyZakat,
  updateVarisangya,
  updateZakat,
  deleteZakat,
} from '../controllers/collectibleController';
import { createDistribution, updateDistribution, deleteDistribution } from '../controllers/zakatDistributionController';
import { createSalaryPayment, updateSalaryPayment, deleteSalaryPayment } from '../controllers/salaryController';
import { createPettyCash, recordExpense, replenishPettyCash } from '../controllers/pettyCashController';
import { updateApplicationStatus } from '../controllers/welfareController';
import { createRepayment } from '../controllers/qardController';
import { listReconciliationIssues, resolveReconciliationIssue } from '../controllers/reconciliationController';
import { ZakatBeneficiary } from '../models/Zakat';
import { installFake, Installed, oid } from './support/fakeMongo';
import { fakeModel, callHandler, FakeCollection } from './fakeMongo';
import { makeWorld, World } from './support/collectiblesWorld';
import { SECRET_MARKERS, capture, connectReconciliationStore, everythingLogged, hostileError, run, IssueStore, Run } from './support/auditKit';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] reconciliationFlows', () => {

/**
 * R. The reconciliation system, flow by flow.
 *
 * For EVERY money flow that can end in "the step failed AND its undo failed too" this proves, on stateful
 * in-memory fakes (failures injected into the model the undo uses):
 *   - the answer is 500 with `reconciliationRequired: true` and the administrator-review message, never a success;
 *   - exactly ONE `[RECONCILIATION REQUIRED]` line per failed undo step, and one open ReconciliationIssue for it,
 *     naming the flow, the entity, its id and its Mahallu;
 *   - nothing in the log line, the stored record or the response carries a Mongo URI, a token, an e-mail
 *     address or a phone number, even when the failing errors are full of them.
 * Plus the admin view (list / resolve) over the records those flows really produced, and static checks that
 * no compensating call site can skip the reporter.
 */

let world: World;
let issues: IssueStore;
const extraInstalls: Installed[] = [];
const extraRestores: Array<() => void> = [];
const use = (Model: any, seed: any[] = []) => {
  const installed = installFake(Model, seed);
  extraInstalls.push(installed);
  return installed.store;
};
const overrideLedger = (name: 'postLedgerEntry' | 'reverseLedgerEntry', impl: (...args: any[]) => any) => {
  const original = (ledgerService as any)[name];
  (ledgerService as any)[name] = impl;
  extraRestores.push(() => ((ledgerService as any)[name] = original));
};

beforeEach(() => {
  world = makeWorld();
  issues = connectReconciliationStore();
});
afterEach(() => {
  extraRestores.splice(0).reverse().forEach((restore) => restore());
  extraInstalls.splice(0).reverse().forEach((installed) => installed.restore());
  issues.restore();
  world.restore();
});

/** The shared expectations for "the undo failed". */
const expectReview = (
  result: Run,
  expected: { flow: string; entity: string; entityId: unknown; tenantId: unknown; steps: string[] }
) => {
  assert.equal(result.status, 500, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.equal(result.body.reconciliationRequired, true, 'the answer says the record needs review');
  assert.equal(result.body.message, RECONCILIATION_MESSAGE);
  assert.match(result.body.message, /administrator review/i);

  const lines = result.reconciliation;
  assert.deepEqual(lines.map((l) => l.step).sort(), [...expected.steps].sort(), 'one log line per failed undo step');
  for (const line of lines) {
    assert.equal(line.flow, expected.flow);
    assert.equal(line.entity, expected.entity);
    assert.equal(line.entityId, String(expected.entityId));
    assert.equal(line.tenantId, String(expected.tenantId));
  }

  const open = issues.store.docs.filter((d) => d.status === 'open');
  assert.deepEqual(open.map((d) => d.step).sort(), [...expected.steps].sort(), 'one open record per failed undo step');
  for (const doc of open) {
    assert.equal(doc.flow, expected.flow);
    assert.equal(doc.entity, expected.entity);
    assert.equal(doc.entityId, String(expected.entityId));
    assert.equal(String(doc.tenantId), String(expected.tenantId));
    assert.equal(doc.occurrences, 1);
  }

  const everything = everythingLogged(result, issues.store);
  for (const secret of SECRET_MARKERS) assert.ok(!everything.includes(secret), `leaked: ${secret}`);
};

const wallet = (w: World) => w.stores.wallet.docs[0];
const debitFilter = (filter: any) => !!filter && filter.balance !== undefined; // the guarded debit of a wallet
const creditFilter = (filter: any) => !!filter && filter.balance === undefined && filter._id !== undefined;

// ──────────────────────────────── varisangya / zakat collections ────────────────────────────────

describe('varisangya and zakat collections (runAtomic)', () => {
  const pendingVarisangya = () => {
    const row = {
      _id: oid(), tenantId: world.ids.tenantA, memberId: world.ids.memberA1, familyId: world.ids.familyA,
      amount: 100, paymentDate: new Date('2026-03-01'), status: 'pending', source: 'member',
    };
    world.stores.varisangya.insert(row);
    return row;
  };
  const pendingZakat = () => {
    const row = {
      _id: oid(), tenantId: world.ids.tenantA, payerName: 'Seeded Payer', payerId: world.ids.memberA1,
      amount: 100, paymentDate: new Date('2026-03-01'), status: 'pending', source: 'member',
    };
    world.stores.zakat.insert(row);
    return row;
  };
  const createVerifiedZakat = async () => {
    const reply = await run(createZakat, { ...world.asAdmin(), body: { payerName: 'Admin Entered', amount: 100, paymentDate: '2026-03-02' } });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    return reply.body.data;
  };

  test('varisangya verify: the ledger step fails and the wallet credit cannot be undone', async () => {
    const row = pendingVarisangya();
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', hostileError(), 1);
    world.stores.wallet.failOn('Wallet.findOneAndUpdate', hostileError('MongoServerError'), 1, debitFilter);
    const result = await run(verifyVarisangya, { ...world.asAdmin(), params: { id: String(row._id) } });
    expectReview(result, { flow: 'varisangya verify', entity: 'varisangya', entityId: row._id, tenantId: world.ids.tenantA, steps: ['wallet credit'] });
    // the steps that COULD be undone were: the payment is pending again and has no journal row
    assert.equal(world.stores.varisangya.docs[0].status, 'pending');
    assert.equal(world.stores.txn.docs.length, 0);
    // ...and the one that could not is exactly what the record points at: the wallet still holds the credit
    assert.equal(wallet(world).balance, 100);
  });

  test('zakat verify: the ledger step fails and the status cannot be put back', async () => {
    const row = pendingZakat();
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', hostileError(), 1);
    world.stores.zakat.failOn('Zakat.updateOne', hostileError(), 1);
    const result = await run(verifyZakat, { ...world.asAdmin(), params: { id: String(row._id) } });
    expectReview(result, { flow: 'zakat verify', entity: 'zakat', entityId: row._id, tenantId: world.ids.tenantA, steps: ['payment status'] });
    assert.equal(world.stores.zakat.docs[0].status, 'verified', 'the record points at the half-done step');
  });

  test('varisangya create: two undo steps fail, both are reported once each', async () => {
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', hostileError(), 1);
    world.stores.wallet.failOn('Wallet.findOneAndUpdate', hostileError('MongoServerError'), 1, debitFilter);
    world.stores.varisangya.failOn('Varisangya.deleteOne', hostileError(), 1);
    const result = await run(createVarisangya, {
      ...world.asAdmin(),
      body: { memberId: String(world.ids.memberA1), amount: 100, paymentDate: '2026-03-02' },
    });
    const rowId = world.stores.varisangya.docs[0]._id; // the row that could not be removed
    expectReview(result, {
      flow: 'varisangya create', entity: 'varisangya', entityId: rowId, tenantId: world.ids.tenantA,
      steps: ['wallet credit', 'payment row'],
    });
  });

  test('zakat update (verified, amount changed): the old ledger entry and the old fields cannot be restored', async () => {
    const created = await createVerifiedZakat();
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', hostileError(), 2); // the new post, then the restore of the old entry
    world.stores.zakat.failOn('Zakat.updateOne', hostileError(), 1);
    const result = await run(updateZakat, { ...world.asAdmin(), params: { id: String(created._id) }, body: { amount: 150 } });
    expectReview(result, {
      flow: 'zakat update', entity: 'zakat', entityId: created._id, tenantId: world.ids.tenantA,
      steps: ['previous ledger entry', 'payment fields'],
    });
  });

  test('varisangya update (verified, amount lowered): the wallet adjustment and the old ledger entry cannot be undone', async () => {
    const created = await run(createVarisangya, { ...world.asAdmin(), body: { memberId: String(world.ids.memberA1), amount: 100, paymentDate: '2026-03-02' } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.data._id;
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', hostileError(), 2);
    world.stores.wallet.failOn('Wallet.findOneAndUpdate', hostileError('MongoServerError'), 1, creditFilter);
    const result = await run(updateVarisangya, { ...world.asAdmin(), params: { id: String(id) }, body: { amount: 60 } });
    expectReview(result, {
      flow: 'varisangya update', entity: 'varisangya', entityId: id, tenantId: world.ids.tenantA,
      steps: ['previous ledger entry', 'wallet adjustment'],
    });
  });

  test('zakat delete: the ledger reversal fails and the payment row cannot be put back', async () => {
    const created = await createVerifiedZakat();
    world.stores.ledgerItem.failOn('LedgerItem.find', hostileError(), 1);
    world.stores.zakat.failOn('Zakat.create', hostileError(), 1);
    const result = await run(deleteZakat, { ...world.asAdmin(), params: { id: String(created._id) } });
    expectReview(result, { flow: 'zakat delete', entity: 'zakat', entityId: created._id, tenantId: world.ids.tenantA, steps: ['payment row'] });
    assert.equal(world.stores.zakat.docs.length, 0, 'the record points at the missing row');
  });

  test('a failed ledger step whose own cleanup failed (ReconciliationRequiredError from the service) is also a 500 with the flag, reported once', async () => {
    const row = pendingZakat();
    // the entry is stored, the balance update fails, and removing the entry fails too
    world.stores.mahalluAccount.failOn('MahalluAccount.findOneAndUpdate', hostileError(), 1);
    world.stores.ledgerItem.failOn('LedgerItem.deleteOne', hostileError(), 1);
    const result = await run(verifyZakat, { ...world.asAdmin(), params: { id: String(row._id) } });
    assert.equal(result.status, 500);
    assert.equal(result.body.reconciliationRequired, true);
    assert.equal(result.body.message, RECONCILIATION_MESSAGE);
    assert.equal(result.reconciliation.length, 1, 'one line, from the service that knows what is half-written');
    assert.equal(result.reconciliation[0].step, 'remove ledger entry after failed balance update');
    assert.equal(result.reconciliation[0].entity, 'LedgerItem');
    assert.deepEqual(
      issues.store.docs.map((d) => [d.flow, d.step, d.status]),
      [['ledger post (zakat)', 'remove ledger entry after failed balance update', 'open']]
    );
    for (const secret of SECRET_MARKERS) assert.ok(!everythingLogged(result, issues.store).includes(secret), secret);
  });
});

// ──────────────────────────────── the ledger service itself ────────────────────────────────

describe('ledgerPostingService', () => {
  const params = (over: Record<string, any> = {}) => ({
    tenantId: world.ids.tenantA, ledgerName: 'Zakat Collections', ledgerType: 'income' as const, amount: 40,
    description: 'x', date: new Date('2026-03-01'), source: 'zakat' as const, sourceId: oid(), ...over,
  });

  test('post: the balance update fails and the new entry cannot be removed -> ReconciliationRequiredError, one line, one record', async () => {
    const p = params();
    world.stores.mahalluAccount.failOn('MahalluAccount.findOneAndUpdate', hostileError(), 1);
    world.stores.ledgerItem.failOn('LedgerItem.deleteOne', hostileError('MongoServerError'), 1);
    const result = await capture(() => postLedgerEntry(p));
    assert.ok(result.error instanceof ReconciliationRequiredError);
    assert.equal((result.error as ReconciliationRequiredError).message, RECONCILIATION_MESSAGE);
    assert.equal(result.reconciliation.length, 1);
    const [issue] = issues.store.docs;
    assert.equal(issue.flow, 'ledger post (zakat)');
    assert.equal(issue.entity, 'LedgerItem');
    assert.equal(issue.step, 'remove ledger entry after failed balance update');
    assert.equal(String(issue.tenantId), String(world.ids.tenantA));
    assert.deepEqual(issue.state, { source: 'zakat', sourceId: String(p.sourceId), amount: 40, balanceMoved: false });
    const everything = result.errors.join('\n') + JSON.stringify(issues.store.docs);
    for (const secret of SECRET_MARKERS) assert.ok(!everything.includes(secret), secret);
    assert.equal(world.stores.ledgerItem.docs.length, 1, 'the half-written entry is what the record is about');
  });

  test('post: when the entry CAN be removed it is a plain error, no record', async () => {
    world.stores.mahalluAccount.failOn('MahalluAccount.findOneAndUpdate', hostileError(), 1);
    const result = await capture(() => postLedgerEntry(params()));
    assert.ok(result.error instanceof Error && !(result.error instanceof ReconciliationRequiredError));
    assert.equal(result.reconciliation.length, 0);
    assert.equal(issues.store.docs.length, 0);
    assert.equal(world.stores.ledgerItem.docs.length, 0);
  });

  test('reverse: the balance update fails and the entry cannot be restored -> ReconciliationRequiredError, one line, one record', async () => {
    const p = params();
    await postLedgerEntry(p);
    world.stores.mahalluAccount.failOn('MahalluAccount.findOneAndUpdate', hostileError(), 1);
    world.stores.ledgerItem.failOn('LedgerItem.create', hostileError('MongoServerError'), 1);
    const result = await capture(() => reverseLedgerEntry('zakat', p.sourceId, { tenantId: world.ids.tenantA }));
    assert.ok(result.error instanceof ReconciliationRequiredError);
    assert.equal(result.reconciliation.length, 1);
    const [issue] = issues.store.docs;
    assert.equal(issue.flow, 'ledger reversal (zakat)');
    assert.equal(issue.step, 'restore ledger entry after failed reversal');
    assert.equal(issue.state.balanceMoved, false);
    const everything = result.errors.join('\n') + JSON.stringify(issues.store.docs);
    for (const secret of SECRET_MARKERS) assert.ok(!everything.includes(secret), secret);
    assert.equal(world.stores.ledgerItem.docs.length, 0, 'the entry is gone while the balance never moved');
  });
});

// ──────────────────────────────── zakat distributions ────────────────────────────────

describe('zakat distributions (runAtomic)', () => {
  const beneficiary = () => {
    const row = { _id: oid(), tenantId: world.ids.tenantA, name: 'Hostile Beneficiary', verificationStatus: 'verified', status: 'active' };
    world.stores.beneficiary.insert(row);
    return row;
  };
  const postedDistribution = async () => {
    const b = beneficiary();
    const reply = await run(createDistribution, {
      ...world.asAdmin(),
      body: { beneficiaryId: String(b._id), amount: 100, postToLedger: true, distributionDate: '2026-03-02' },
    });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    return reply.body.data;
  };

  test('create: the ledger post fails and the distribution row cannot be removed', async () => {
    const b = beneficiary();
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', hostileError(), 1);
    world.stores.distribution.failOn('ZakatDistribution.deleteOne', hostileError(), 1);
    const result = await run(createDistribution, {
      ...world.asAdmin(),
      body: { beneficiaryId: String(b._id), amount: 100, postToLedger: true, distributionDate: '2026-03-02' },
    });
    const rowId = world.stores.distribution.docs[0]._id;
    expectReview(result, { flow: 'zakat distribution create', entity: 'ZakatDistribution', entityId: rowId, tenantId: world.ids.tenantA, steps: ['distribution row'] });
  });

  test('update: the old ledger entry and the old fields cannot be restored', async () => {
    const created = await postedDistribution();
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', hostileError(), 2);
    world.stores.distribution.failOn('ZakatDistribution.updateOne', hostileError(), 1);
    const result = await run(updateDistribution, { ...world.asAdmin(), params: { id: String(created._id) }, body: { amount: 150 } });
    expectReview(result, {
      flow: 'zakat distribution update', entity: 'ZakatDistribution', entityId: created._id, tenantId: world.ids.tenantA,
      steps: ['previous ledger entry', 'distribution fields'],
    });
  });

  test('delete: the ledger reversal fails and the distribution row cannot be put back', async () => {
    const created = await postedDistribution();
    world.stores.ledgerItem.failOn('LedgerItem.find', hostileError(), 1);
    world.stores.distribution.failOn('ZakatDistribution.create', hostileError(), 1);
    const result = await run(deleteDistribution, { ...world.asAdmin(), params: { id: String(created._id) } });
    expectReview(result, { flow: 'zakat distribution delete', entity: 'ZakatDistribution', entityId: created._id, tenantId: world.ids.tenantA, steps: ['distribution row'] });
  });
});

// ──────────────────────────────── salary (runUndos) ────────────────────────────────

describe('salary (runUndos)', () => {
  let employee: any;
  let institute: any;
  let payments: ReturnType<typeof use>;
  beforeEach(() => {
    institute = { _id: oid(), tenantId: world.ids.tenantA };
    employee = { _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id };
    use(Employee, [employee]);
    use(Institute, [institute]);
    payments = use(SalaryPayment);
  });
  const createBody = (over: Record<string, any> = {}) => ({
    employeeId: String(employee._id), instituteId: String(institute._id), month: 3, year: 2026,
    baseSalary: 1000, allowances: 0, deductions: 0, paymentDate: '2026-03-31', paymentMethod: 'cash', status: 'paid', ...over,
  });
  const seedPaid = () => {
    const row = {
      _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id, employeeId: employee._id, month: 3, year: 2026,
      baseSalary: 1000, allowances: 0, deductions: 0, netAmount: 1000, paymentDate: new Date('2026-03-31'), status: 'paid',
    };
    payments.insert(row);
    return row;
  };

  test('create (paid): the ledger post fails and the payment cannot be removed', async () => {
    overrideLedger('postLedgerEntry', async () => { throw hostileError(); });
    overrideLedger('reverseLedgerEntry', async () => []);
    payments.failOn('SalaryPayment.findByIdAndDelete', hostileError(), 1);
    const result = await run(createSalaryPayment, { ...world.asAdmin(), body: createBody() });
    expectReview(result, { flow: 'salary create', entity: 'SalaryPayment', entityId: payments.docs[0]._id, tenantId: world.ids.tenantA, steps: ['remove salary payment'] });
  });

  test('create (paid): a half-posted ledger (the service says so) is a review error even though the payment was removed', async () => {
    overrideLedger('postLedgerEntry', async () => { throw new ReconciliationRequiredError(hostileError(), ['ledger entry removal']); });
    overrideLedger('reverseLedgerEntry', async () => []);
    const result = await run(createSalaryPayment, { ...world.asAdmin(), body: createBody() });
    assert.equal(result.status, 500);
    assert.equal(result.body.reconciliationRequired, true);
    assert.equal(payments.docs.length, 0);
  });

  test('update (paid -> cancelled): the reversal fails, and neither the payment nor the ledger entry can be restored', async () => {
    const row = seedPaid();
    overrideLedger('reverseLedgerEntry', async () => { throw hostileError(); });
    overrideLedger('postLedgerEntry', async () => { throw hostileError(); });
    // the claim (filtered on status) goes through; the restore (filtered on _id only) fails
    payments.failOn('SalaryPayment.findOneAndUpdate', hostileError(), 1, (filter: any) => filter && filter.status === undefined);
    const result = await run(updateSalaryPayment, { ...world.asAdmin(), params: { id: String(row._id) }, body: { status: 'cancelled' } });
    expectReview(result, {
      flow: 'salary update', entity: 'SalaryPayment', entityId: row._id, tenantId: world.ids.tenantA,
      steps: ['restore salary payment', 'restore salary ledger entry'],
    });
  });

  test('delete (paid): the row cannot be deleted and the ledger entry cannot be restored', async () => {
    const row = seedPaid();
    overrideLedger('reverseLedgerEntry', async () => []);
    overrideLedger('postLedgerEntry', async () => { throw hostileError(); });
    payments.failOn('SalaryPayment.findByIdAndDelete', hostileError(), 1);
    const result = await run(deleteSalaryPayment, { ...world.asAdmin(), params: { id: String(row._id) } });
    expectReview(result, { flow: 'salary delete', entity: 'SalaryPayment', entityId: row._id, tenantId: world.ids.tenantA, steps: ['restore salary ledger entry'] });
  });

  test('delete (paid): a half-reversed ledger (the service says so) is a review error and the payment stays', async () => {
    const row = seedPaid();
    overrideLedger('reverseLedgerEntry', async () => { throw new ReconciliationRequiredError(hostileError(), ['ledger entry restore']); });
    const result = await run(deleteSalaryPayment, { ...world.asAdmin(), params: { id: String(row._id) } });
    assert.equal(result.status, 500);
    assert.equal(result.body.reconciliationRequired, true);
    assert.equal(payments.docs.length, 1);
  });

  test('a plain ledger failure whose undo works is an ordinary error: no review flag, no record', async () => {
    overrideLedger('postLedgerEntry', async () => { throw hostileError(); });
    overrideLedger('reverseLedgerEntry', async () => []);
    const result = await run(createSalaryPayment, { ...world.asAdmin(), body: createBody() });
    assert.equal(result.status, 500);
    assert.equal(result.body.reconciliationRequired, undefined);
    assert.equal(result.reconciliation.length, 0);
    assert.equal(issues.store.docs.length, 0);
    assert.equal(payments.docs.length, 0, 'and the payment really was taken back');
    for (const secret of SECRET_MARKERS) assert.ok(!JSON.stringify(result.body).includes(secret), secret);
  });
});

// ──────────────────────────────── petty cash (runUndos) ────────────────────────────────

describe('petty cash (runUndos)', () => {
  let institute: any;
  let funds: ReturnType<typeof use>;
  let txns: ReturnType<typeof use>;
  beforeEach(() => {
    institute = { _id: oid(), tenantId: world.ids.tenantA };
    use(Institute, [institute]);
    funds = use(PettyCash);
    txns = use(PettyCashTransaction);
    overrideLedger('postLedgerEntry', async () => ({ created: true }));
  });
  const seedFund = (over: Record<string, any> = {}) => {
    const row = { _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id, custodianName: 'Custodian', floatAmount: 100, currentBalance: 100, status: 'active', ...over };
    funds.insert(row);
    return row;
  };

  test('create: the float transaction cannot be written and the new fund cannot be taken back', async () => {
    txns.failOn('PettyCashTransaction.save', hostileError(), 1);
    funds.failOn('PettyCash.findByIdAndDelete', hostileError(), 1);
    const result = await run(createPettyCash, { ...world.asAdmin(), body: { custodianName: 'Custodian', floatAmount: 100, instituteId: String(institute._id) } });
    expectReview(result, { flow: 'petty cash create', entity: 'PettyCash', entityId: funds.docs[0]._id, tenantId: world.ids.tenantA, steps: ['remove new petty cash fund'] });
  });

  test('create: the float cannot be posted to the ledger -> 201 with a clear warning (documented), and exactly one record', async () => {
    overrideLedger('postLedgerEntry', async () => { throw hostileError(); });
    const result = await run(createPettyCash, { ...world.asAdmin(), body: { custodianName: 'Custodian', floatAmount: 100, instituteId: String(institute._id) } });
    assert.equal(result.status, 201);
    assert.equal(result.body.ledgerPending, 1);
    assert.match(result.body.message, /administrator needs to review/i);
    assert.equal(result.reconciliation.length, 1);
    assert.equal(result.reconciliation[0].step, 'post float to ledger');
    assert.equal(issues.store.docs.length, 1);
    for (const secret of SECRET_MARKERS) assert.ok(!everythingLogged(result, issues.store).includes(secret), secret);
  });

  test('expense: the expense cannot be recorded and the amount cannot be given back', async () => {
    const fund = seedFund();
    txns.failOn('PettyCashTransaction.save', hostileError(), 1);
    funds.failOn('PettyCash.updateOne', hostileError(), 1);
    const result = await run(recordExpense, { ...world.asAdmin(), params: { id: String(fund._id) }, body: { amount: 30, description: 'Tea' } });
    expectReview(result, { flow: 'petty cash expense', entity: 'PettyCash', entityId: fund._id, tenantId: world.ids.tenantA, steps: ['give petty cash amount back'] });
    assert.equal(funds.docs[0].currentBalance, 70, 'the record points at the taken money');
  });

  test('replenish: the replenishment cannot be recorded and the balance cannot be put back', async () => {
    const fund = seedFund({ currentBalance: 60 });
    txns.failOn('PettyCashTransaction.save', hostileError(), 1);
    funds.failOn('PettyCash.updateOne', hostileError(), 1);
    const result = await run(replenishPettyCash, { ...world.asAdmin(), params: { id: String(fund._id) } });
    expectReview(result, { flow: 'petty cash replenish', entity: 'PettyCash', entityId: fund._id, tenantId: world.ids.tenantA, steps: ['undo petty cash replenishment'] });
  });

  test('replenish: an expense cannot be posted and its claim cannot be released', async () => {
    const fund = seedFund({ currentBalance: 70 });
    const expense = { _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id, pettyCashId: fund._id, type: 'expense', amount: 30, description: 'Tea', date: new Date(), postedToLedger: false };
    txns.insert(expense);
    overrideLedger('postLedgerEntry', async () => { throw hostileError(); });
    txns.failOn('PettyCashTransaction.updateOne', hostileError(), 1);
    const result = await run(replenishPettyCash, { ...world.asAdmin(), params: { id: String(fund._id) } });
    expectReview(result, { flow: 'petty cash replenish', entity: 'PettyCashTransaction', entityId: expense._id, tenantId: world.ids.tenantA, steps: ['release expense claim'] });
    assert.equal(txns.docs.find((d) => String(d._id) === String(expense._id))!.postedToLedger, true, 'flagged posted but not in the ledger: what the record is about');
  });
});

// ──────────────────────────────── welfare (runUndos) ────────────────────────────────

describe('welfare disbursement (runUndos)', () => {
  let apps: FakeCollection;
  let restoreModels: Array<() => void>;
  const TENANT = String(oid());
  beforeEach(() => {
    const a = fakeModel(WelfareApplication);
    const f = fakeModel(Family);
    apps = a.collection;
    restoreModels = [a.restore, f.restore];
  });
  afterEach(() => restoreModels.forEach((r) => r()));
  const seedApproved = () =>
    apps.seed({ tenantId: TENANT, schemeId: oid(), familyId: oid(), requestedAmount: 500, approvedAmount: 500, status: 'approved', history: [] })[0];
  const move = (app: any) =>
    run((req, res) => callHandler(updateApplicationStatus as any, req).then((out) => res.status(out.status).json(out.body)), {
      tenantId: TENANT, isSuperAdmin: false, user: { role: 'mahall', _id: oid() },
      params: { id: String(app._id) }, body: { status: 'disbursed', disbursedVia: 'ledger' },
    });
  void move;

  const direct = (app: any) =>
    run(updateApplicationStatus as any, {
      tenantId: TENANT, isSuperAdmin: false, user: { role: 'mahall', _id: oid() },
      params: { id: String(app._id) }, body: { status: 'disbursed', disbursedVia: 'ledger' },
    });

  test('the ledger post fails and the disbursed status cannot be reverted', async () => {
    const app = seedApproved();
    overrideLedger('postLedgerEntry', async () => { throw hostileError(); });
    apps.failNext('findOneAndUpdate', hostileError(), ({ filter }) => filter.status === 'disbursed');
    const result = await direct(app);
    assert.equal(result.status, 500);
    assert.equal(result.body.reconciliationRequired, true);
    assert.equal(result.body.message, RECONCILIATION_MESSAGE);
    assert.deepEqual(result.reconciliation.map((l) => [l.flow, l.entity, l.step, l.entityId, l.tenantId]), [
      ['welfare disbursement', 'WelfareApplication', 'revert disbursed status', String(app._id), TENANT],
    ]);
    assert.equal(apps.get(app._id)!.status, 'disbursed', 'the record points at the half-done state');
    for (const secret of SECRET_MARKERS) assert.ok(!result.errors.filter((l) => l.startsWith('[RECONCILIATION')).join('').includes(secret), secret);
  });

  test('a half-posted ledger (the service says so) is a review error even though the status was reverted', async () => {
    const app = seedApproved();
    overrideLedger('postLedgerEntry', async () => { throw new ReconciliationRequiredError(hostileError(), ['ledger entry removal']); });
    const result = await direct(app);
    assert.equal(result.status, 500);
    assert.equal(result.body.reconciliationRequired, true);
    assert.equal(apps.get(app._id)!.status, 'approved');
  });

  test('a plain failure that reverts cleanly is an ordinary 500: no review flag, no record', async () => {
    const app = seedApproved();
    overrideLedger('postLedgerEntry', async () => { throw hostileError(); });
    const result = await direct(app);
    assert.equal(result.status, 500);
    assert.equal(result.body.reconciliationRequired, undefined);
    assert.equal(result.reconciliation.length, 0);
    assert.equal(apps.get(app._id)!.status, 'approved');
  });
});

// ──────────────────────────────── qard repayment (runUndos) ────────────────────────────────

describe('qard repayment (runUndos)', () => {
  let loans: FakeCollection;
  let repayments: FakeCollection;
  let restoreModels: Array<() => void>;
  const TENANT = String(oid());
  beforeEach(() => {
    const l = fakeModel(QardLoan);
    const r = fakeModel(QardRepayment);
    loans = l.collection;
    repayments = r.collection;
    restoreModels = [l.restore, r.restore];
  });
  afterEach(() => restoreModels.forEach((r) => r()));
  const seedLoan = () =>
    loans.seed({
      tenantId: TENANT, applicantName: 'Applicant', amount: 1000, approvedAmount: 1000, repaymentMonths: 4, status: 'disbursed',
      outstandingBalance: 1000, repaymentSchedule: buildRepaymentSchedule(1000, 4, new Date(2026, 0, 15)),
    })[0];
  const repay = (loan: any, extra: Record<string, any> = {}) =>
    run(createRepayment as any, {
      tenantId: TENANT, isSuperAdmin: false, user: { role: 'mahall', id: String(oid()) },
      body: { loanId: String(loan._id), amount: 100, ...extra },
    });
  /** the 2nd findOneAndUpdate is the undo of the balance move */
  const failSecondMove = () => {
    let calls = 0;
    loans.failNext('findOneAndUpdate', hostileError(), () => ++calls === 2);
  };

  test('the repayment row cannot be written and the balance cannot be put back', async () => {
    const loan = seedLoan();
    repayments.failNext('create', hostileError());
    failSecondMove();
    const result = await repay(loan);
    assert.equal(result.status, 500);
    assert.equal(result.body.reconciliationRequired, true);
    assert.equal(result.body.message, RECONCILIATION_MESSAGE);
    assert.deepEqual(result.reconciliation.map((l) => [l.flow, l.entity, l.step, l.entityId, l.tenantId]), [
      ['qard repayment', 'QardLoan', 'reverse loan balance', String(loan._id), TENANT],
    ]);
    assert.equal(loans.get(loan._id)!.outstandingBalance, 900, 'the record points at the moved balance');
    assert.equal(repayments.rows.length, 0);
    for (const secret of SECRET_MARKERS) assert.ok(!result.errors.filter((l) => l.startsWith('[RECONCILIATION')).join('').includes(secret), secret);
  });

  test('a duplicate clientRequestId whose balance cannot be put back is NOT answered with the "duplicate" success', async () => {
    const loan = seedLoan();
    repayments.failNext('create', Object.assign(new Error('E11000 duplicate key error'), { code: 11000 }));
    failSecondMove();
    const result = await repay(loan, { clientRequestId: 'req-12345678' });
    assert.equal(result.status, 500);
    assert.equal(result.body.reconciliationRequired, true);
    assert.equal(result.body.data, undefined);
  });

  test('the same failure with a working undo is an ordinary error: balance restored, no flag', async () => {
    const loan = seedLoan();
    repayments.failNext('create', hostileError());
    const result = await repay(loan);
    assert.equal(result.status, 500);
    assert.equal(result.body.reconciliationRequired, undefined);
    assert.equal(result.reconciliation.length, 0);
    assert.equal(loans.get(loan._id)!.outstandingBalance, 1000);
  });
});

// ──────────────────────────────── scrubbing ────────────────────────────────

describe('scrubbing hostile text (no secrets, contact details or credentials in a record)', () => {
  const cases: Array<[string, string, string[]]> = [
    ['a phone number glued to a word', 'wallet mobile9876543210 unreachable', ['9876543210']],
    ['international and spaced phone numbers', 'call +91 98765 43210 or (0484) 2345-678', ['98765 43210', '2345-678']],
    ['a Basic authorization credential', 'Authorization: Basic dXNlcjpwYXNzd29yZA==', ['dXNlcjpwYXNzd29yZA']],
    ['a bearer token and a JWT', 'Authorization: Bearer abc.def.ghi and eyJhbGciOiJI.eyJzdWIiOiJ4.sigsigsigsig', ['abc.def.ghi', 'sigsigsigsig']],
    ['a Mongo URI with credentials', 'connect mongodb+srv://svc:S3cretPw@cluster0.hostile.example.net/prod failed', ['S3cretPw', 'cluster0.hostile']],
    ['another URI with credentials', 'redis://default:hunter2@cache.internal:6379', ['hunter2', 'cache.internal']],
    ['an e-mail address', 'send to a.hostile@example.org now', ['a.hostile@example.org']],
    ['key=value secrets', 'password=hunter2 api_key=AKIA123456 otp: 123456', ['hunter2', 'AKIA123456']],
    ['a long opaque key', `key ${'Ab1'.repeat(20)}`, ['Ab1Ab1Ab1Ab1Ab1Ab1']],
  ];
  for (const [label, input, forbidden] of cases) {
    test(label, async () => {
      const result = await capture(async () => {        return reportReconciliationRequired({ flow: 'f', entity: 'e', entityId: '507f1f77bcf86cd799439011', tenantId: String(world.ids.tenantA), step: 's', reason: new Error(input), state: { note: input } });
      });
      const everything = result.errors.join('\n') + JSON.stringify(issues.store.docs);
      for (const secret of forbidden) assert.ok(!everything.includes(secret), `leaked ${secret}`);
      assert.equal(result.reconciliation.length, 1);
    });
  }

  test('a 24-character id whose characters happen to be a long digit run stays readable', async () => {
    const id = '1234567890123456789012ab';
    const result = await capture(async () => {      return reportReconciliationRequired({ flow: 'f', entity: 'e', entityId: id, tenantId: String(world.ids.tenantA), step: 's', reason: new Error(`entry ${id} could not be restored`), state: { ledgerId: id } });
    });
    assert.equal(result.reconciliation[0].entityId, id);
    assert.match(result.reconciliation[0].reason, new RegExp(id));
    assert.equal(result.reconciliation[0].state.ledgerId, id);
  });

  test('KNOWN LIMIT: a person\'s name inside a plain Error message cannot be recognised as personal data; driver / validation errors drop their message entirely, and keys such as name / phone / email never enter the state', async () => {
    const driver = Object.assign(new Error('E11000 duplicate key { name: "Mohammed Ali" }'), { name: 'MongoServerError', code: 11000, codeName: 'DuplicateKey' });
    const result = await capture(async () => {      return reportReconciliationRequired({ flow: 'f', entity: 'e', entityId: '507f1f77bcf86cd799439011', step: 's', reason: driver, state: { name: 'Mohammed Ali', phone: '9876543210', email: 'a@b.co', amount: 5 } });
    });
    const everything = result.errors.join('\n');
    assert.ok(!everything.includes('Mohammed Ali'));
    assert.deepEqual(result.reconciliation[0].state, { amount: 5 });
  });
});

// ──────────────────────────────── the same failure reported twice ────────────────────────────────

describe('repeats', () => {
  test('retrying the same half-done flow bumps ONE open record (a counter), it does not pile up records', async () => {
    const row = {
      _id: oid(), tenantId: world.ids.tenantA, payerName: 'Seeded Payer', payerId: world.ids.memberA1,
      amount: 100, paymentDate: new Date('2026-03-01'), status: 'pending', source: 'member',
    };
    world.stores.zakat.insert(row);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.stores.zakat.docs[0].status = 'pending';
      world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', hostileError(), 1);
      world.stores.zakat.failOn('Zakat.updateOne', hostileError(), 1);
      const result = await run(verifyZakat, { ...world.asAdmin(), params: { id: String(row._id) } });
      assert.equal(result.status, 500);
      assert.equal(result.reconciliation.length, 1, 'a line per failure');
    }
    assert.equal(issues.store.docs.length, 1);
    assert.equal(issues.store.docs[0].occurrences, 3);
  });
});

// ──────────────────────────────── the administrator's view of what the flows produced ────────────────────────────────

describe('what an administrator can see and do with the records the flows produced', () => {
  const adminReq = (tenant: any, extra: Record<string, any> = {}) => ({ tenantId: String(tenant), isSuperAdmin: false, user: { role: 'mahall', _id: oid() }, query: {}, body: {}, ...extra });

  const produce = async () => {
    const row = {
      _id: oid(), tenantId: world.ids.tenantA, payerName: 'Seeded Payer', payerId: world.ids.memberA1,
      amount: 100, paymentDate: new Date('2026-03-01'), status: 'pending', source: 'member',
    };
    world.stores.zakat.insert(row);
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', hostileError(), 1);
    world.stores.zakat.failOn('Zakat.updateOne', hostileError(), 1);
    await run(verifyZakat, { ...world.asAdmin(), params: { id: String(row._id) } });
    return row;
  };

  test('the list item is enough to find and repair: flow, entity, id, step, reason class, counters; no personal data', async () => {
    const row = await produce();
    const listed = await run(listReconciliationIssues, adminReq(world.ids.tenantA));
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.length, 1);
    const item = listed.body.data[0];
    assert.equal(item.flow, 'zakat verify');
    assert.equal(item.entity, 'zakat');
    assert.equal(item.entityId, String(row._id));
    assert.equal(item.step, 'payment status');
    assert.equal(item.status, 'open');
    assert.equal(item.occurrences, 1);
    assert.match(item.reason, /^undo failed \(Error: .*\) after: Error: /);
    assert.ok(item.lastSeenAt && item.createdAt);
    assert.equal(JSON.stringify(item).includes('Seeded Payer'), false, 'no payer name');
    for (const secret of SECRET_MARKERS) assert.ok(!JSON.stringify(item).includes(secret), secret);
  });

  test('a Mahallu admin of ANOTHER Mahallu sees nothing and cannot resolve it; a super admin sees it', async () => {
    await produce();
    const other = await run(listReconciliationIssues, adminReq(world.ids.tenantB));
    assert.equal(other.body.data.length, 0);
    const id = String(issues.store.docs[0]._id);
    const refused = await run(resolveReconciliationIssue, adminReq(world.ids.tenantB, { params: { id }, body: { note: 'not mine' } }));
    assert.equal(refused.status, 404);
    assert.equal(issues.store.docs[0].status, 'open');
    const superAdmin = await run(listReconciliationIssues, { isSuperAdmin: true, user: { role: 'super_admin', _id: oid() }, query: { status: 'all' }, body: {} });
    assert.equal(superAdmin.body.data.length, 1);
  });

  test('resolving closes the record but repairs NOTHING: the half-done payment is exactly as it was', async () => {
    const row = await produce();
    const before = JSON.stringify([world.stores.zakat.docs, world.stores.ledgerItem.docs, world.stores.mahalluAccount.docs]);
    const id = String(issues.store.docs[0]._id);
    const resolved = await run(resolveReconciliationIssue, adminReq(world.ids.tenantA, { params: { id }, body: { note: 'Checked the books by hand' } }));
    assert.equal(resolved.status, 200);
    assert.equal(issues.store.docs[0].status, 'resolved');
    assert.equal(issues.store.docs[0].note, 'Checked the books by hand');
    assert.equal(JSON.stringify([world.stores.zakat.docs, world.stores.ledgerItem.docs, world.stores.mahalluAccount.docs]), before);
    assert.equal(world.stores.zakat.docs.find((d) => String(d._id) === String(row._id))!.status, 'verified');
    // it no longer shows in the default (open) list, but does in resolved / all
    assert.equal((await run(listReconciliationIssues, adminReq(world.ids.tenantA))).body.data.length, 0);
    assert.equal((await run(listReconciliationIssues, adminReq(world.ids.tenantA, { query: { status: 'resolved' } }))).body.data.length, 1);
    assert.equal((await run(listReconciliationIssues, adminReq(world.ids.tenantA, { query: { status: 'all' } }))).body.data.length, 1);
  });

  test('survey, institute and member accounts get 403 on both endpoints', async () => {
    await produce();
    const id = String(issues.store.docs[0]._id);
    for (const role of ['survey', 'institute', 'member']) {
      const caller = { tenantId: String(world.ids.tenantA), isSuperAdmin: false, user: { role, instituteId: String(oid()), _id: oid() } };
      assert.equal((await run(listReconciliationIssues, { ...caller, query: {} })).status, 403, role);
      assert.equal((await run(resolveReconciliationIssue, { ...caller, params: { id }, body: { note: 'let me fix it' } })).status, 403, role);
    }
    assert.equal(issues.store.docs[0].status, 'open');
  });

  test('the records of the runUndos flows carry a small state map of what is half-done (ids and the amount moved, no contact data)', async () => {
    const institute = { _id: oid(), tenantId: world.ids.tenantA };
    use(Institute, [institute]);
    const funds = use(PettyCash);
    const txns = use(PettyCashTransaction);
    overrideLedger('postLedgerEntry', async () => ({ created: true }));
    const fund = { _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id, custodianName: 'Mohammed Ali', floatAmount: 100, currentBalance: 100, status: 'active' };
    funds.insert(fund);
    txns.failOn('PettyCashTransaction.save', hostileError(), 1);
    funds.failOn('PettyCash.updateOne', hostileError(), 1);
    await run(recordExpense, { ...world.asAdmin(), params: { id: String(fund._id) }, body: { amount: 30, description: 'Tea for 9876543210' } });
    const listed = await run(listReconciliationIssues, adminReq(world.ids.tenantA));
    const item = listed.body.data[0];
    assert.deepEqual(item.state, { amountTaken: 30, expenseRecorded: false });
    assert.equal(JSON.stringify(item).includes('Mohammed Ali'), false, 'the custodian is not in the record');
    assert.equal(JSON.stringify(item).includes('9876543210'), false);
  });
});

// ──────────────────────────────── static checks over the source ────────────────────────────────

describe('static: no compensating call site can skip the reporter', () => {
  const root = path.resolve(__dirname, '..');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? (e.name === 'tests' || e.name === 'scripts' ? [] : walk(p)) : p.endsWith('.ts') ? [p] : [];
    });
  const files = walk(root).map((file) => ({ file: path.relative(root, file), code: fs.readFileSync(file, 'utf8') }));

  test('every runAtomic(...) call names the record it works on (reconcile: { entity, entityId, tenantId }) and its flow', () => {
    let calls = 0;
    for (const { file, code } of files) {
      if (file.endsWith(`utils${path.sep}transaction.ts`)) continue;
      const parts = code.split(/\brunAtomic\(/).slice(1);
      calls += parts.length;
      parts.forEach((part, i) => {
        // each part runs up to the next runAtomic call, so it holds this call's options
        const statement = part;
        assert.match(statement, /reconcile:\s*\{[^}]*entity:[^}]*entityId:[^}]*tenantId:/s, `${file}: runAtomic call #${i + 1} has no reconcile { entity, entityId, tenantId }`);
        assert.match(statement, /description:/, `${file}: runAtomic call #${i + 1} has no description`);
      });
    }
    assert.ok(calls >= 8, `expected the collection and distribution flows, found ${calls} runAtomic calls`);
  });

  test('every runUndos(...) caller answers a failed undo with the review response', () => {
    let sites = 0;
    for (const { file, code } of files) {
      if (file.endsWith(`utils${path.sep}reconciliation.ts`)) continue;
      const parts = code.split(/\brunUndos\(/).slice(1);
      sites += parts.length;
      parts.forEach((part, i) => {
        const after = part.slice(0, 2600);
        assert.match(after, /\.?failed\.length\s*>\s*0|released\.failed\.length/, `${file}: runUndos call #${i + 1} never looks at the steps that failed`);
        assert.match(after, /sendReconciliationRequired\(res\)/, `${file}: runUndos call #${i + 1} does not answer with sendReconciliationRequired`);
      });
    }
    assert.ok(sites >= 9, `expected the salary, petty cash, welfare and qard flows, found ${sites} runUndos calls`);
  });

  test('every place that catches a ledger failure also handles a ReconciliationRequiredError from the service', () => {
    for (const file of ['controllers/salaryController.ts', 'controllers/welfareController.ts']) {
      const code = files.find((f) => f.file.replace(/\\/g, '/') === file)!.code;
      assert.match(code, /instanceof ReconciliationRequiredError/, `${file} does not look at ReconciliationRequiredError`);
    }
  });

  test('sendFailure marks a ReconciliationRequiredError as one (so a runAtomic flow answers like the rest)', () => {
    const code = files.find((f) => f.file.replace(/\\/g, '/') === 'utils/userMessages.ts')!.code;
    assert.match(code, /reconciliationRequired/);
  });

  test('nothing writes the review marker except the reporter (one place, one format)', () => {
    for (const { file, code } of files) {
      if (file.replace(/\\/g, '/') === 'utils/reconciliation.ts') continue;
      assert.ok(!/console\.\w+\([^)]*\[RECONCILIATION REQUIRED\]/.test(code), `${file} writes the marker itself`);
    }
  });

  test('the ReconciliationIssue model keeps one OPEN record per failing step (partial unique index)', () => {
    const indexes = (ReconciliationIssue.schema.indexes() as Array<[Record<string, number>, Record<string, any>]>);
    const unique = indexes.find(([, opts]) => opts?.unique);
    assert.deepEqual(unique && Object.keys(unique[0]), ['tenantId', 'flow', 'entityId', 'step']);
    assert.deepEqual(unique![1].partialFilterExpression, { status: 'open' });
  });

  void ZakatBeneficiary;
});

});
