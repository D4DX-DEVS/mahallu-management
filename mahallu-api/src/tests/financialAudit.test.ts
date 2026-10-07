import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import SalaryPayment from '../models/SalaryPayment';
import Employee from '../models/Employee';
import Institute from '../models/Institute';
import { PettyCash, PettyCashTransaction } from '../models/PettyCash';
import { InstituteAccount, MahalluAccount, MasterWallet, Ledger, LedgerItem, Category } from '../models/MasterAccount';
import { DevelopmentProject } from '../models/DevelopmentProject';
import { WelfareApplication, WelfareScheme } from '../models/Welfare';
import { ZakatBeneficiary } from '../models/Zakat';
import ReliefCase from '../models/ReliefCase';
import { MarriageAssistance } from '../models/MarriageAssistance';
import { QardLoan } from '../models/QardLoan';
import Family from '../models/Family';
import Member from '../models/Member';
import * as ledgerService from '../services/ledgerPostingService';
import { createVarisangya, createZakat, updateVarisangya, updateZakat } from '../controllers/collectibleController';
import {
  createDistribution,
  updateDistribution,
  createBeneficiary,
  updateBeneficiary,
} from '../controllers/zakatDistributionController';
import { createSalaryPayment, updateSalaryPayment } from '../controllers/salaryController';
import { createPettyCash, updatePettyCash, recordExpense } from '../controllers/pettyCashController';
import { createApplication, updateApplication, createScheme, updateScheme } from '../controllers/welfareController';
import { createLoan, updateLoan } from '../controllers/qardController';
import { createReliefCase, updateReliefCase } from '../controllers/reliefController';
import { createAssistance, updateAssistance } from '../controllers/marriageAssistanceController';
import * as master from '../controllers/masterAccountController';
import { installFake, Installed, oid } from './support/fakeMongo';
import { fakeModel, callHandler, FakeCollection } from './fakeMongo';
import { makeWorld, World } from './support/collectiblesWorld';
import { run } from './support/auditKit';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] financialAudit', () => {

/**
 * F. Financial atomicity / idempotency final audit: the client cannot set balances, outcomes or owners.
 *
 * Every create / update handler of the money controllers is called with a HOSTILE body (balances, net and
 * approved amounts, status, receipt number, source and sourceId, account ids, verifier, tenant, institute, an
 * operator key and a dotted path) on stateful in-memory fakes, and what is stored / what reached the model
 * is checked: none of the hostile values may be there.
 */

const M = 987654.32; // a money value no test uses legitimately
const HX = String(oid()); // a foreign id used for every id-like hostile field
const OTHER_TENANT = String(oid());
const OTHER_INSTITUTE = String(oid());

const hostile = (over: Record<string, any> = {}): Record<string, any> => ({
  balance: M,
  currentBalance: M,
  outstandingBalance: M,
  netAmount: M,
  approvedAmount: M,
  disbursedDate: '2001-01-01',
  disbursedVia: 'ledger',
  source: 'HOSTILE-SOURCE',
  sourceId: HX,
  accountId: HX,
  accountType: 'institute',
  auto: true,
  verifiedBy: HX,
  createdBy: HX,
  approvedBy: HX,
  postedToLedger: true,
  history: [{ status: 'HOSTILE-HISTORY' }],
  repaymentSchedule: [{ amount: M }],
  tenantId: OTHER_TENANT,
  _id: HX,
  $inc: { balance: M },
  'balance.x': M,
  ...over,
});

const MARKERS = [String(M), 'HOSTILE-SOURCE', 'HOSTILE-HISTORY', HX, OTHER_TENANT];
/** The text a test must prove is free of every hostile value (stored documents and raw writes). */
const dump = (...parts: any[]) =>
  parts.map((p) => JSON.stringify(p, (_k, v) => (v instanceof mongoose.Types.ObjectId ? `oid:${String(v)}` : v))).join('\n');
const assertClean = (what: string, text: string, allowed: string[] = []) => {
  for (const marker of MARKERS) {
    if (allowed.includes(marker)) continue;
    assert.ok(!text.includes(marker), `${what}: hostile value reached the model: ${marker}`);
  }
};

let world: World;
const installs: Installed[] = [];
const restores: Array<() => void> = [];
const use = (Model: any, seed: any[] = []) => {
  const installed = installFake(Model, seed);
  installs.push(installed);
  return installed.store;
};
/** Record what is handed to Model[method] (the raw write), still running the real (fake) implementation. */
const spyWrites = (Model: any, methods: string[]): any[] => {
  const writes: any[] = [];
  for (const method of methods) {
    const original = Model[method];
    Model[method] = function (...args: any[]) {
      writes.push({ method, args: args.slice(0, 2) });
      return original.apply(this, args);
    };
    restores.push(() => (Model[method] = original));
  }
  return writes;
};
const overrideLedger = (name: 'postLedgerEntry' | 'reverseLedgerEntry', impl: (...args: any[]) => any) => {
  const original = (ledgerService as any)[name];
  (ledgerService as any)[name] = impl;
  restores.push(() => ((ledgerService as any)[name] = original));
};

beforeEach(() => {
  world = makeWorld();
});
afterEach(() => {
  restores.splice(0).reverse().forEach((r) => r());
  installs.splice(0).reverse().forEach((i) => i.restore());
  world.restore();
});

const actor = () => world.ids.adminA;

// ──────────────────────────────── varisangya / zakat collections ────────────────────────────────

describe('collections', () => {
  test('createVarisangya: status, source, verifier, receipt, tenant and balances are the server\'s; the wallet holds exactly the paid amount', async () => {
    const reply = await run(createVarisangya, {
      ...world.asAdmin(),
      body: hostile({ memberId: String(world.ids.memberA1), amount: 10, paymentDate: '2026-03-02', status: 'pending' }),
    });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    const [row] = world.stores.varisangya.docs;
    assert.equal(row.status, 'verified');
    assert.equal(row.source, 'admin');
    assert.equal(String(row.verifiedBy), String(actor()));
    assert.equal(String(row.createdBy), String(actor()));
    assert.equal(String(row.tenantId), String(world.ids.tenantA));
    assert.equal(row.clientRequestId, undefined);
    assert.equal(world.stores.wallet.docs[0].balance, 10);
    assert.equal(world.stores.ledgerItem.docs[0].amount, 10);
    assert.equal(String(world.stores.ledgerItem.docs[0].sourceId), String(row._id));
    assert.notEqual(String(world.stores.ledgerItem.docs[0].accountId), HX);
    assert.equal(world.accountABalance(), 10);
    assertClean('createVarisangya', dump(world.stores.varisangya.docs, world.stores.wallet.docs, world.stores.txn.docs, world.stores.ledgerItem.docs, world.stores.mahalluAccount.docs));
  });

  test('createZakat: the same', async () => {
    const reply = await run(createZakat, {
      ...world.asAdmin(),
      body: hostile({ payerName: 'Some Payer', amount: 25, paymentDate: '2026-03-02', status: 'pending' }),
    });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    const [row] = world.stores.zakat.docs;
    assert.equal(row.status, 'verified');
    assert.equal(row.source, 'admin');
    assert.equal(String(row.verifiedBy), String(actor()));
    assert.equal(world.accountABalance(), 25);
    assertClean('createZakat', dump(world.stores.zakat.docs, world.stores.ledgerItem.docs, world.stores.mahalluAccount.docs));
  });

  test('updateVarisangya / updateZakat (pending and verified): only the whitelisted fields move; wallet and bank move only by the amount difference', async () => {
    const pending = {
      _id: oid(), tenantId: world.ids.tenantA, memberId: world.ids.memberA1, familyId: world.ids.familyA,
      amount: 100, paymentDate: new Date('2026-03-01'), status: 'pending', source: 'member',
    };
    world.stores.varisangya.insert(pending);
    let reply = await run(updateVarisangya, { ...world.asAdmin(), params: { id: String(pending._id) }, body: hostile({ amount: 120, remarks: 'ok', status: 'verified', receiptNo: 'HOSTILE-RECEIPT' }) });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    let row = world.stores.varisangya.docs[0];
    assert.equal(row.amount, 120);
    assert.equal(row.status, 'pending');
    assert.equal(row.receiptNo, undefined);
    assert.equal(row.source, 'member');
    assert.equal(world.stores.wallet.docs.length, 0, 'a pending payment has no wallet');
    assertClean('updateVarisangya (pending)', dump(world.stores.varisangya.docs));

    const created = await run(createVarisangya, { ...world.asAdmin(), body: { memberId: String(world.ids.memberA1), amount: 100, paymentDate: '2026-03-02' } });
    const id = created.body.data._id;
    const receipt = created.body.data.receiptNo;
    reply = await run(updateVarisangya, { ...world.asAdmin(), params: { id: String(id) }, body: hostile({ amount: 130, receiptNo: 'HOSTILE-RECEIPT', status: 'pending' }) });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    row = world.stores.varisangya.docs.find((d) => String(d._id) === String(id))!;
    assert.equal(row.amount, 130);
    assert.equal(row.status, 'verified');
    assert.equal(row.receiptNo, receipt);
    assert.equal(String(row.verifiedBy), String(actor()));
    assert.equal(world.stores.wallet.docs[0].balance, 130, 'the difference only');
    assert.equal(world.accountABalance(), 130);
    assertClean('updateVarisangya (verified)', dump(world.stores.varisangya.docs, world.stores.wallet.docs, world.stores.txn.docs, world.stores.ledgerItem.docs, world.stores.mahalluAccount.docs));

    const zakat = await run(createZakat, { ...world.asAdmin(), body: { payerName: 'Some Payer', amount: 50, paymentDate: '2026-03-02' } });
    reply = await run(updateZakat, { ...world.asAdmin(), params: { id: String(zakat.body.data._id) }, body: hostile({ amount: 60, receiptNo: 'HOSTILE-RECEIPT', status: 'pending' }) });
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    const z = world.stores.zakat.docs[0];
    assert.equal(z.status, 'verified');
    assert.equal(z.receiptNo, zakat.body.data.receiptNo);
    assertClean('updateZakat', dump(world.stores.zakat.docs, world.stores.ledgerItem.docs));
  });
});

// ──────────────────────────────── zakat distributions, beneficiaries ────────────────────────────────

describe('zakat distributions and beneficiaries', () => {
  const verified = () => {
    const row = { _id: oid(), tenantId: world.ids.tenantA, name: 'Beneficiary', verificationStatus: 'verified', status: 'active' };
    world.stores.beneficiary.insert(row);
    return row;
  };

  test('createDistribution / updateDistribution: tenant, creator, request id, beneficiary and posting flag are not taken from the body', async () => {
    const b = verified();
    const reply = await run(createDistribution, {
      ...world.asAdmin(),
      body: hostile({ beneficiaryId: String(b._id), amount: 10, postToLedger: true, distributionDate: '2026-03-02', receiptNo: undefined }),
    });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    let row = world.stores.distribution.docs[0];
    assert.equal(String(row.tenantId), String(world.ids.tenantA));
    assert.equal(String(row.createdBy), String(actor()));
    assert.equal(row.clientRequestId, undefined);
    assert.equal(String(row.beneficiaryId), String(b._id));
    assert.equal(world.stores.ledgerItem.docs[0].amount, 10);
    assert.equal(world.accountABalance(), -10);
    assertClean('createDistribution', dump(world.stores.distribution.docs, world.stores.ledgerItem.docs, world.stores.mahalluAccount.docs));

    const update = await run(updateDistribution, {
      ...world.asAdmin(),
      params: { id: String(row._id) },
      body: hostile({ amount: 15, beneficiaryId: HX, postToLedger: false, receiptNo: undefined }),
    });
    assert.equal(update.status, 200, JSON.stringify(update.body));
    row = world.stores.distribution.docs[0];
    assert.equal(row.amount, 15);
    assert.equal(String(row.beneficiaryId), String(b._id));
    assert.equal(row.postToLedger, true);
    assert.equal(String(row.createdBy), String(actor()));
    assert.equal(world.accountABalance(), -15, 'one entry, the new amount');
    assertClean('updateDistribution', dump(world.stores.distribution.docs, world.stores.ledgerItem.docs, world.stores.mahalluAccount.docs));
  });

  test('createBeneficiary / updateBeneficiary: verification, verifier, tenant and _id are not client-settable', async () => {
    const created = await run(createBeneficiary, {
      ...world.asAdmin(),
      body: hostile({ name: 'New Beneficiary', verificationStatus: 'verified', verifiedDate: '2001-01-01' }),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    let row = world.stores.beneficiary.docs[0];
    assert.equal(row.verificationStatus, 'pending');
    assert.equal(String(row.tenantId), String(world.ids.tenantA));
    assert.notEqual(String(row._id), HX);
    assert.equal(row.verifiedBy, undefined);
    // the fake stores what it is given; the real schema drops what it does not declare, so check through it
    assertClean('createBeneficiary', dump(world.stores.beneficiary.docs.map((d) => new ZakatBeneficiary(d).toObject())));

    const update = await run(updateBeneficiary, {
      ...world.asAdmin(),
      params: { id: String(row._id) },
      body: hostile({ notes: 'ok', verificationStatus: 'verified', verifiedBy: HX }),
    });
    assert.equal(update.status, 200, JSON.stringify(update.body));
    row = world.stores.beneficiary.docs[0];
    assert.equal(row.verificationStatus, 'pending');
    assert.equal(row.notes, 'ok');
    assert.equal(String(row.tenantId), String(world.ids.tenantA));
    assertClean('updateBeneficiary', dump(world.stores.beneficiary.docs.map((d) => new ZakatBeneficiary(d).toObject())));
  });
});

// ──────────────────────────────── salary ────────────────────────────────

describe('salary', () => {
  let institute: any;
  let employee: any;
  beforeEach(() => {
    institute = { _id: oid(), tenantId: world.ids.tenantA };
    employee = { _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id };
    use(Employee, [employee]);
    use(Institute, [institute]);
    overrideLedger('postLedgerEntry', async () => ({ created: true }));
    overrideLedger('reverseLedgerEntry', async () => []);
  });

  test('create and update: net amount is computed, status/owner/balances are not taken from the body', async () => {
    const payments = use(SalaryPayment);
    const writes = spyWrites(SalaryPayment, ['findOneAndUpdate']);
    const body = hostile({
      employeeId: String(employee._id), instituteId: String(institute._id), month: 3, year: 2026,
      baseSalary: 1000, allowances: 100, deductions: 50, paymentDate: '2026-03-31', paymentMethod: 'cash',
    });
    const created = await run(createSalaryPayment, { ...world.asAdmin(), body });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    let row = payments.docs[0];
    assert.equal(row.netAmount, 1050);
    assert.equal(row.status, 'pending');
    assert.equal(String(row.tenantId), String(world.ids.tenantA));
    for (const key of ['balance', 'currentBalance', 'outstandingBalance', 'approvedAmount', 'verifiedBy', 'source', 'sourceId', 'accountId']) {
      assert.equal(row[key], undefined, key);
    }
    assertClean('createSalaryPayment', dump(payments.docs));

    const updated = await run(updateSalaryPayment, {
      ...world.asAdmin(),
      params: { id: String(row._id) },
      body: hostile({ remarks: 'checked', allowances: 200, status: 'pending' }),
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    row = payments.docs[0];
    assert.equal(row.netAmount, 1150, 'recomputed from the parts, never taken from the client');
    assert.equal(row.status, 'pending');
    assertClean('updateSalaryPayment', dump(payments.docs, writes));
  });
});

describe('salary: concurrent edits of one payment', () => {
  const lag = (n: number) => new Promise<void>((resolve) => { let i = 0; const step = () => (i++ >= n ? resolve() : setImmediate(step)); step(); });
  let institute: any;
  let employee: any;
  beforeEach(() => {
    institute = { _id: oid(), tenantId: world.ids.tenantA };
    employee = { _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id };
    use(Employee, [employee]);
    use(Institute, [institute]);
  });

  test('two edits of the figures of a PAID payment, started at every offset: the ledger entry and the bank balance always end up matching the stored net', async () => {
    const account = { _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id, status: 'active', balance: 0, createdAt: new Date() };
    use(Ledger);
    use(MahalluAccount);
    const accounts = use(InstituteAccount, [account]);
    const items = use(LedgerItem);
    const id = oid();
    const payments = use(SalaryPayment, [{
      _id: id, tenantId: world.ids.tenantA, instituteId: institute._id, employeeId: employee._id, month: 3, year: 2026,
      baseSalary: 5000, allowances: 0, deductions: 0, netAmount: 5000, paymentDate: new Date('2026-03-31'), paymentMethod: 'cash', status: 'paid',
    }]);
    const edit = (baseSalary: number) => run(updateSalaryPayment, { ...world.asAdmin(), params: { id: String(id) }, body: { baseSalary } });
    const seen = new Set<string>();
    for (let offset = 0; offset < 16; offset += 1) {
      payments.docs[0].baseSalary = 5000;
      payments.docs[0].netAmount = 5000;
      payments.docs[0].status = 'paid';
      items.docs.splice(0);
      items.insert({ _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id, ledgerId: oid(), amount: 5000, type: 'expense', source: 'salary', sourceId: id, accountId: account._id, accountType: 'institute' });
      accounts.docs[0].balance = -5000;
      const [a, b] = await Promise.all([edit(6000), lag(offset).then(() => edit(7000))]);
      assert.ok([a.status, b.status].every((s) => s === 200 || s === 409), `offset ${offset}: ${a.status}/${b.status}`);
      assert.ok([a.status, b.status].includes(200));
      const net = payments.docs[0].netAmount;
      assert.equal(items.docs.length, 1, `offset ${offset}: exactly one ledger entry`);
      assert.equal(items.docs[0].amount, net, `offset ${offset}: the ledger entry holds the stored net`);
      assert.equal(accounts.docs[0].balance, -net, `offset ${offset}: the bank balance reflects the stored net`);
      seen.add(`${a.status}/${b.status}`);
    }
    assert.ok(seen.size >= 1);
  });

  test('two edits of different parts of a PENDING payment: the net is never computed from a stale snapshot (one wins, the other is told to reload)', async () => {
    const id = oid();
    const payments = use(SalaryPayment, [{
      _id: id, tenantId: world.ids.tenantA, instituteId: institute._id, employeeId: employee._id, month: 3, year: 2026,
      baseSalary: 1000, allowances: 0, deductions: 0, netAmount: 1000, paymentDate: new Date('2026-03-31'), status: 'pending',
    }]);
    for (let offset = 0; offset < 8; offset += 1) {
      Object.assign(payments.docs[0], { baseSalary: 1000, allowances: 0, deductions: 0, netAmount: 1000 });
      const [a, b] = await Promise.all([
        run(updateSalaryPayment, { ...world.asAdmin(), params: { id: String(id) }, body: { allowances: 100 } }),
        lag(offset).then(() => run(updateSalaryPayment, { ...world.asAdmin(), params: { id: String(id) }, body: { baseSalary: 2000 } })),
      ]);
      const row = payments.docs[0];
      assert.equal(row.netAmount, row.baseSalary + row.allowances - row.deductions, `offset ${offset} (${a.status}/${b.status}): net matches its parts`);
    }
  });
});

// ──────────────────────────────── petty cash ────────────────────────────────

describe('petty cash', () => {
  let institute: any;
  let funds: ReturnType<typeof use>;
  let txns: ReturnType<typeof use>;
  beforeEach(() => {
    institute = { _id: oid(), tenantId: world.ids.tenantA };
    use(Institute, [institute]);
    use(Category, []);
    funds = use(PettyCash);
    txns = use(PettyCashTransaction);
    overrideLedger('postLedgerEntry', async () => ({ created: true }));
  });

  test('create: the balance starts at the float, the status is active, and nothing else is taken', async () => {
    const reply = await run(createPettyCash, {
      ...world.asAdmin(),
      body: hostile({ custodianName: 'Custodian', floatAmount: 100, instituteId: String(institute._id), status: 'inactive' }),
    });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    const [fund] = funds.docs;
    assert.equal(fund.currentBalance, 100);
    assert.equal(fund.status, 'active');
    assert.equal(String(fund.tenantId), String(world.ids.tenantA));
    assert.equal(txns.docs.length, 1);
    assert.equal(txns.docs[0].type, 'float');
    assertClean('createPettyCash', dump(funds.docs, txns.docs));
  });

  test('update changes only the custodian and the status; an expense records only what it is given', async () => {
    const fund = { _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id, custodianName: 'Old', floatAmount: 100, currentBalance: 100, status: 'active' };
    funds.insert(fund);
    // the handler edits a loaded document and saves it: give the loaded fund a save() onto the store
    const store = funds;
    const original = (PettyCash as any).findOne;
    (PettyCash as any).findOne = (filter: any) => {
      const found = store.docs.find((d) => String(d._id) === String(filter._id));
      const wrapper: any = found ? { ...found } : null;
      if (wrapper) wrapper.save = async () => { Object.assign(found, { custodianName: wrapper.custodianName, status: wrapper.status }); return wrapper; };
      return { then: (res: any, rej: any) => Promise.resolve(wrapper).then(res, rej) };
    };
    restores.push(() => ((PettyCash as any).findOne = original));
    const updated = await run(updatePettyCash, { ...world.asAdmin(), params: { id: String(fund._id) }, body: hostile({ custodianName: 'New', floatAmount: M, status: 'inactive' }) });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(funds.docs[0].custodianName, 'New');
    assert.equal(funds.docs[0].status, 'inactive');
    assert.equal(funds.docs[0].floatAmount, 100);
    assert.equal(funds.docs[0].currentBalance, 100);
    assertClean('updatePettyCash', dump(funds.docs));

    funds.docs[0].status = 'active';
    const spent = await run(recordExpense, {
      ...world.asAdmin(),
      params: { id: String(fund._id) },
      body: hostile({ amount: 30, description: 'Tea', receiptNo: 'R-1', type: 'float', date: '2026-03-02' }),
    });
    assert.equal(spent.status, 201, JSON.stringify(spent.body));
    const [expense] = txns.docs;
    assert.equal(expense.type, 'expense');
    assert.equal(expense.amount, 30);
    assert.notEqual(expense.postedToLedger, true,'posting is the replenishment\'s decision, not the body\'s');
    assert.equal(String(expense.createdBy), String(actor()));
    assert.equal(funds.docs[0].currentBalance, 70);
    assertClean('recordExpense', dump(funds.docs, txns.docs));
  });
});

// ──────────────────────────────── welfare, qard, relief, marriage ────────────────────────────────

describe('welfare, qard, relief and marriage assistance', () => {
  const TENANT = String(oid());
  const fakes: Array<() => void> = [];
  const make = (Model: any): FakeCollection => {
    const f = fakeModel(Model);
    fakes.push(f.restore);
    return f.collection;
  };
  afterEach(() => fakes.splice(0).forEach((r) => r()));
  const as = (extra: Record<string, any> = {}) => ({ tenantId: TENANT, isSuperAdmin: false, user: { role: 'mahall', _id: oid(), id: String(oid()) }, ...extra });
  const send = (handler: any, extra: Record<string, any>) => callHandler(handler, as(extra));
  const writes = (c: FakeCollection) => dump(c.log, c.rows);

  test('welfare: a new application is pending with no approval; an edit cannot touch money or status; schemes cannot be re-owned', async () => {
    const apps = make(WelfareApplication);
    const schemes = make(WelfareScheme);
    make(Family);
    const family = oid();
    const [scheme] = schemes.seed({ tenantId: TENANT, name: 'Scheme', category: 'other' });
    // refBelongsToTenant reads the family
    (Family as any).findById = () => ({ select: () => ({ lean: async () => ({ _id: family, tenantId: TENANT }) }) });
    const created = await send(createApplication, { body: hostile({ schemeId: String(scheme._id), familyId: String(family), requestedAmount: 500, reason: 'r', status: 'approved' }) });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const app = apps.rows[0];
    assert.equal(app.status, 'pending');
    assert.equal(app.approvedAmount, undefined);
    assert.equal(app.disbursedVia, undefined);
    assert.equal(app.history.length, 1);
    assert.equal(String(app.tenantId), TENANT);
    assert.notEqual(String(app._id), HX);
    assertClean('createApplication', writes(apps));

    // everything money-like in an edit that CHANGES it is refused outright; the harmless remainder is applied
    const refused = await send(updateApplication, { params: { id: String(app._id) }, body: hostile({ reason: 'edited' }) });
    assert.equal(refused.status, 409);
    assert.equal(apps.rows[0].reason, 'r');
    const edit = await send(updateApplication, {
      params: { id: String(app._id) },
      body: hostile({ reason: 'edited', approvedAmount: undefined, disbursedDate: undefined, disbursedVia: undefined, status: 'disbursed' }),
    });
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
    assert.equal(apps.rows[0].reason, 'edited');
    assert.equal(apps.rows[0].status, 'pending');
    assert.equal(apps.rows[0].approvedAmount, undefined);
    assertClean('updateApplication', dump(apps.log.filter((l) => l.op !== 'create'), apps.rows));

    const madeScheme = await send(createScheme, { body: hostile({ name: 'S2' }) });
    assert.equal(madeScheme.status, 201, JSON.stringify(madeScheme.body));
    const row = schemes.rows.find((r) => r.name === 'S2')!;
    assert.equal(String(row.tenantId), TENANT);
    assert.equal(Object.prototype.hasOwnProperty.call(row, '_id') && String(row._id) === HX, false);
    const reScheme = await send(updateScheme, { params: { id: String(row._id) }, body: hostile({ name: 'S3' }) });
    assert.equal(reScheme.status, 200, JSON.stringify(reScheme.body));
    assert.equal(String(schemes.rows.find((r) => r.name === 'S3')!.tenantId), TENANT);
  });

  test('qard: a new loan is at its initial state with no balance, approval or schedule; an edit cannot move them', async () => {
    const loans = make(QardLoan);
    const created = await send(createLoan, { body: hostile({ applicantName: 'Applicant', amount: 1000, repaymentMonths: 4, status: 'disbursed' }) });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const loan = loans.rows[0];
    assert.equal(loan.status, 'applied');
    assert.equal(loan.outstandingBalance, 0);
    assert.deepEqual(loan.repaymentSchedule, []);
    assert.equal(loan.approvedAmount, undefined);
    assert.equal(loan.approvedBy, undefined);
    assertClean('createLoan', writes(loans));

    const edit = await send(updateLoan, { params: { id: String(loan._id) }, body: hostile({ applicantName: 'Renamed', amount: undefined, status: 'repaying', approvedAmount: undefined }) });
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
    assert.equal(loans.rows[0].applicantName, 'Renamed');
    assert.equal(loans.rows[0].status, 'applied');
    assert.equal(loans.rows[0].outstandingBalance, 0);
    assert.equal(loans.rows[0].approvedAmount, undefined);
    assertClean('updateLoan', dump(loans.log.filter((l) => l.op !== 'create'), loans.rows));
  });

  test('relief: a report starts as reported with no amount or assistance; an edit cannot change the status', async () => {
    const cases = make(ReliefCase);
    const created = await send(createReliefCase, { body: hostile({ title: 'Flood', description: 'd', amount: 5000, assistanceGiven: 'x', status: 'closed' }) });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const row = cases.rows[0];
    assert.equal(row.status, 'reported');
    assert.equal(row.amount, undefined);
    assert.equal(row.assistanceGiven, undefined);
    assertClean('createReliefCase', writes(cases));

    const edit = await send(updateReliefCase, { params: { id: String(row._id) }, body: hostile({ title: 'Flood 2', status: 'closed', amount: undefined }) });
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
    assert.equal(cases.rows[0].status, 'reported');
    assertClean('updateReliefCase', dump(cases.log.filter((l) => l.op !== 'create'), cases.rows));
  });

  test('marriage assistance: a request is `requested` whatever the body says; an edit cannot change the status', async () => {
    const records = make(MarriageAssistance);
    const member = oid();
    (Member as any).findById = async () => ({ _id: member, tenantId: TENANT });
    const created = await send(createAssistance, { body: hostile({ memberId: String(member), type: 'nikah', amount: 5000, status: 'completed' }) });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const row = records.rows[0];
    assert.equal(row.status, 'requested');
    assert.equal(String(row.tenantId), TENANT);
    assertClean('createAssistance', writes(records));

    const edit = await send(updateAssistance, { params: { id: String(row._id) }, body: hostile({ notes: 'n', status: 'completed', amount: undefined }) });
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
    assert.equal(records.rows[0].status, 'requested');
    assertClean('updateAssistance', dump(records.log.filter((l) => l.op !== 'create'), records.rows));
  });
});

// ──────────────────────────────── master accounts ────────────────────────────────

describe('master accounts: no body path reaches balance, ownership or provenance', () => {
  const T = () => String(world.ids.tenantA);
  let institute: any;
  let stores: Record<string, ReturnType<typeof use>>;
  const spies: Record<string, any[]> = {};
  beforeEach(() => {
    institute = { _id: oid(), tenantId: world.ids.tenantA };
    for (const key of Object.keys(spies)) delete spies[key];
    stores = {
      institute: use(Institute, [institute]),
      instituteAccount: use(InstituteAccount),
      mahalluAccount2: use(MahalluAccount),
      masterWallet: use(MasterWallet),
      ledger: use(Ledger),
      ledgerItem2: use(LedgerItem),
      category: use(Category),
      project: use(DevelopmentProject),
    };
  });
  const as = (extra: Record<string, any> = {}) => ({ tenantId: T(), isSuperAdmin: false, user: { role: 'mahall', _id: oid() }, ...extra });
  const spy = (Model: any, key: string) => (spies[key] = spyWrites(Model, ['findByIdAndUpdate']));
  const updatePayloads = () => Object.values(spies).flat().map((w) => w.args[1]);

  test('updates: the payload handed to findByIdAndUpdate has no balance, tenantId, _id, source, sourceId, accountId, accountType, auto, operator or dotted key', async () => {
    spy(InstituteAccount, 'ia'); spy(MahalluAccount, 'ma'); spy(MasterWallet, 'mw'); spy(Ledger, 'l'); spy(LedgerItem, 'li'); spy(Category, 'c');
    const ledger = { _id: oid(), tenantId: world.ids.tenantA, instituteId: null, name: 'Fees', type: 'income' };
    stores.ledger.insert(ledger);
    const rows = {
      ia: { _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id, accountName: 'A', balance: 10 },
      ma: { _id: oid(), tenantId: world.ids.tenantA, accountName: 'M', balance: 20 },
      mw: { _id: oid(), tenantId: world.ids.tenantA, name: 'W', balance: 30 },
      c: { _id: oid(), tenantId: world.ids.tenantA, instituteId: null, name: 'Cat', type: 'income' },
      li: { _id: oid(), tenantId: world.ids.tenantA, instituteId: null, ledgerId: ledger._id, type: 'income', amount: 5, description: 'manual', source: 'manual', date: new Date() },
    };
    stores.instituteAccount.insert(rows.ia);
    stores.mahalluAccount2.insert(rows.ma);
    stores.masterWallet.insert(rows.mw);
    stores.category.insert(rows.c);
    stores.ledgerItem2.insert(rows.li);

    const body = hostile({ accountName: 'Renamed', name: 'Renamed', description: 'd', instituteId: undefined, sourceId: HX });
    const calls: Array<[any, any]> = [
      [master.updateInstituteAccount, rows.ia], [master.updateMahalluAccount, rows.ma], [master.updateWallet, rows.mw],
      [master.updateCategory, rows.c], [master.updateLedger, ledger], [master.updateLedgerItem, rows.li],
    ];
    for (const [fn, row] of calls) {
      const out = await run(fn, as({ params: { id: String(row._id) }, body }));
      assert.equal(out.status, 200, `${fn.name}: ${JSON.stringify(out.body)}`);
    }
    const payloads = updatePayloads();
    assert.equal(payloads.length, 6);
    for (const payload of payloads) {
      for (const key of ['balance', 'tenantId', '_id', 'source', 'sourceId', 'accountId', 'accountType', 'auto', '$inc', 'balance.x', 'createdAt']) {
        if (key === 'source' && payload.source === 'manual') continue;
        assert.ok(!(key in payload), `${key} reached findByIdAndUpdate: ${JSON.stringify(payload)}`);
      }
      assert.ok(!Object.keys(payload).some((k) => k.startsWith('$') || k.includes('.')));
    }
    // and the balances on disk are untouched
    assert.equal(stores.instituteAccount.docs[0].balance, 10);
    assert.equal(stores.mahalluAccount2.docs[0].balance, 20);
    assert.equal(stores.masterWallet.docs[0].balance, 30);
    assert.equal(stores.ledgerItem2.docs[0].source, 'manual');
    assert.equal(stores.ledgerItem2.docs[0].sourceId, undefined);
    assert.equal(stores.ledgerItem2.docs[0].accountId, undefined);
  });

  test('a tenantId / instituteId in an update body cannot re-parent a record; an institute admin cannot name an institute at all', async () => {
    spy(InstituteAccount, 'ia'); spy(Ledger, 'l');
    const ia = { _id: oid(), tenantId: world.ids.tenantA, instituteId: institute._id, accountName: 'A', balance: 10 };
    stores.instituteAccount.insert(ia);
    // a Mahallu admin naming an institute of another Mahallu is refused
    stores.institute.insert({ _id: OTHER_INSTITUTE, tenantId: OTHER_TENANT });
    const refused = await run(master.updateInstituteAccount, as({ params: { id: String(ia._id) }, body: { instituteId: OTHER_INSTITUTE, tenantId: OTHER_TENANT } }));
    assert.equal(refused.status, 400);
    assert.equal(updatePayloads().length, 0, 'nothing reached the model');
    // an institute admin: instituteId (and tenantId) in the body are dropped before the write
    const own = { tenantId: T(), isSuperAdmin: false, user: { role: 'institute', instituteId: String(institute._id), _id: oid() } };
    const out = await run(master.updateInstituteAccount, { ...own, params: { id: String(ia._id) }, body: { accountName: 'Mine', instituteId: OTHER_INSTITUTE, tenantId: OTHER_TENANT } });
    assert.equal(out.status, 200, JSON.stringify(out.body));
    const [payload] = updatePayloads();
    assert.deepEqual(payload, { accountName: 'Mine' });
  });

  test('creates: balance only as the documented opening balance; provenance, account link, auto flag, tenant and _id are the server\'s', async () => {
    const wallet = await run(master.createWallet, as({ body: hostile({ name: 'W', type: 'cash', balance: 250 }) }));
    assert.equal(wallet.status, 201, JSON.stringify(wallet.body));
    assert.equal(stores.masterWallet.docs[0].balance, 250, 'the opening balance, validated by the route');
    assert.equal(String(stores.masterWallet.docs[0].tenantId), T());
    assert.notEqual(String(stores.masterWallet.docs[0]._id), HX);

    const ledger = await run(master.createLedger, as({ body: hostile({ name: 'L', type: 'income', balance: undefined }) }));
    assert.equal(ledger.status, 201, JSON.stringify(ledger.body));
    assert.equal(stores.ledger.docs[0].auto, undefined, 'a hand-made ledger cannot claim to be auto-created');

    const item = await run(master.createLedgerItem, as({ body: hostile({ ledgerId: String(stores.ledger.docs[0]._id), type: 'income', amount: 10, description: 'manual', date: '2026-03-02', balance: undefined }) }));
    assert.equal(item.status, 201, JSON.stringify(item.body));
    const row = stores.ledgerItem2.docs[0];
    assert.equal(row.source, 'manual');
    assert.equal(row.sourceId, undefined);
    assert.equal(row.accountId, undefined);
    assert.equal(row.accountType, undefined);
    assert.equal(String(row.tenantId), T());
    assert.equal(row.amount, 10);
    assert.equal(world.accountABalance(), 0, 'a manual entry never moves a bank balance');
    assertClean('createLedgerItem', dump(stores.ledgerItem2.docs, stores.ledger.docs, stores.masterWallet.docs));
  });
});

});
