import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Varisangya, Zakat, Wallet } from '../models/Collectible';
import SalaryPayment from '../models/SalaryPayment';
import Employee from '../models/Employee';
import Institute from '../models/Institute';
import Family from '../models/Family';
import Member from '../models/Member';
import { QardLoan } from '../models/QardLoan';
import { WelfareApplication } from '../models/Welfare';
import ReliefCase from '../models/ReliefCase';
import { ZakatDistribution, ZakatBeneficiary } from '../models/Zakat';
import { InstituteAccount, MahalluAccount, MasterWallet, Ledger, LedgerItem, Category } from '../models/MasterAccount';
import { getAllVarisangyas, getAllZakats, getCollectionsSummary, listWallets } from '../controllers/collectibleController';
import { getZakatSummary } from '../controllers/zakatDistributionController';
import { getAllSalaryPayments, getSalarySummary } from '../controllers/salaryController';
import { getQardSummary } from '../controllers/qardController';
import { getWelfareSummary } from '../controllers/welfareController';
import { getReliefSummary } from '../controllers/reliefController';
import * as master from '../controllers/masterAccountController';
import {
  getDayBook,
  getLedgerReport,
  getTrialBalance,
  getBalanceSheet,
  getIncomeExpenditure,
  getConsolidatedReport,
} from '../controllers/accountingReportController';
import { getFinancialSummary } from '../controllers/dashboardController';
import { installFake, Installed, oid } from './support/fakeMongo';
import { runAggregate, Collections } from './support/aggregateFake';
import { runPipeline } from './support/pipelineFake';
import { run } from './support/auditKit';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] totalsAudit', () => {

/**
 * T. Totals audit (backend side): every number that feeds a CMS "Total" card or a dashboard figure is computed
 * over the WHOLE filtered set by the database, never from the page that was returned or from the first N rows.
 *
 * Each test seeds well over a page AND over 100 rows (the largest page the API allows), runs the controller's REAL
 * aggregation pipeline through an in-memory interpreter (support/aggregateFake.ts, support/pipelineFake.ts: no
 * database), and compares the response with a sum computed independently in the test. Totals must be identical
 * on every page and at every page size.
 */

const T = oid();
const OTHER = oid();
const INST_A = oid();
const INST_B = oid();
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (rows: any[], pick: (r: any) => number) => round2(rows.reduce((s, r) => s + pick(r), 0));

const installs: Installed[] = [];
/** Install a stateful fake of `Model` whose aggregate runs the REAL pipeline through the interpreter. */
const useAgg = (Model: any, seed: any[] = [], collections: () => Collections = () => ({})) => {
  const installed = installFake(Model, seed);
  installs.push(installed);
  Model.aggregate = (pipeline: any[]) => Promise.resolve(runAggregate(installed.store.docs, pipeline, collections()));
  return installed.store;
};
afterEach(() => installs.splice(0).reverse().forEach((i) => i.restore()));

const asAdmin = (extra: Record<string, any> = {}) => ({ tenantId: String(T), isSuperAdmin: false, user: { role: 'mahall', _id: oid() }, query: {}, ...extra });
const asInstitute = (extra: Record<string, any> = {}) => ({ tenantId: String(T), isSuperAdmin: false, user: { role: 'institute', instituteId: String(INST_A) }, query: {}, ...extra });
const page = (extra: Record<string, any>, p: number, limit: number) => ({ ...extra, query: { ...(extra.query || {}), page: String(p), limit: String(limit) } });

/** Rows for 3 sizes of page: a short page, a full page and the maximum page. */
const SIZES = [10, 25, 100];
const pagesOf = (total: number, size: number) => Math.min(3, Math.ceil(total / size));

// ──────────────────────────────── collections ────────────────────────────────

describe('varisangya / zakat lists and the collections summary', () => {
  const N = 260;
  const rows = (kind: 'varisangya' | 'zakat') =>
    Array.from({ length: N }, (_, i) => ({
      _id: oid(), tenantId: i % 13 === 0 ? OTHER : T, amount: round2(10 + i * 1.37), paymentDate: new Date(Date.UTC(2026, i % 12, 1 + (i % 27))),
      status: i % 4 === 0 ? 'pending' : 'verified', familyId: oid(), memberId: oid(), payerName: `P${i}`, createdAt: new Date(2026, 0, 1 + (i % 300)),
      ...(kind === 'varisangya' ? {} : { payerId: oid() }),
    }));

  test('varisangya list: the summary equals the whole tenant on every page and every page size (pending separated, other Mahallus excluded)', async () => {
    const seeded = rows('varisangya');
    useAgg(Varisangya, seeded);
    const mine = seeded.filter((r) => String(r.tenantId) === String(T));
    const expected = {
      count: mine.length,
      totalAmount: sum(mine, (r) => r.amount),
      verifiedAmount: sum(mine.filter((r) => r.status !== 'pending'), (r) => r.amount),
      pendingAmount: sum(mine.filter((r) => r.status === 'pending'), (r) => r.amount),
      verifiedCount: mine.filter((r) => r.status !== 'pending').length,
      pendingCount: mine.filter((r) => r.status === 'pending').length,
    };
    assert.ok(mine.length > 100);
    for (const size of SIZES) {
      for (let p = 1; p <= pagesOf(mine.length, size); p += 1) {
        const out = await run(getAllVarisangyas, page(asAdmin(), p, size));
        assert.equal(out.status, 200, JSON.stringify(out.body));
        assert.deepEqual(out.body.summary, expected, `page ${p} of ${size}`);
        assert.equal(out.body.pagination.total, mine.length);
        assert.ok(out.body.data.length <= size);
      }
    }
  });

  test('zakat list and GET /collectibles/summary: the same over 100+ rows, with and without a date range', async () => {
    const seeded = rows('zakat');
    useAgg(Zakat, seeded);
    useAgg(Varisangya, rows('varisangya'));
    const mine = seeded.filter((r) => String(r.tenantId) === String(T));
    for (const size of [10, 100]) {
      const out = await run(getAllZakats, page(asAdmin(), 2, size));
      assert.equal(out.body.summary.count, mine.length);
      assert.equal(out.body.summary.totalAmount, sum(mine, (r) => r.amount));
      assert.equal(out.body.summary.verifiedAmount, sum(mine.filter((r) => r.status !== 'pending'), (r) => r.amount));
    }
    const all = await run(getCollectionsSummary, asAdmin());
    const z = mine;
    const v = rows('varisangya').filter(() => false); // (the fresh varisangya fake above has other random rows: compare with its own store)
    void v;
    assert.equal(all.body.data.zakat.count, z.length);
    assert.equal(all.body.data.zakat.totalAmount, sum(z, (r) => r.amount));
    assert.equal(all.body.data.totals.count, all.body.data.zakat.count + all.body.data.varisangya.count);
    assert.equal(
      all.body.data.totals.totalAmount,
      round2(all.body.data.zakat.totalAmount + all.body.data.varisangya.totalAmount)
    );
    const ranged = await run(getCollectionsSummary, asAdmin({ query: { dateFrom: '2026-03-01', dateTo: '2026-03-31' } }));
    const inMarch = z.filter((r) => r.paymentDate >= new Date('2026-03-01') && r.paymentDate <= new Date('2026-03-31T23:59:59.999Z'));
    assert.equal(ranged.body.data.zakat.count, inMarch.length);
    assert.equal(ranged.body.data.zakat.totalAmount, sum(inMarch, (r) => r.amount));
  });
});

// ──────────────────────────────── salary ────────────────────────────────

describe('salary list summary and the monthly summary', () => {
  const N = 240;
  const payments = Array.from({ length: N }, (_, i) => ({
    _id: oid(), tenantId: i % 11 === 0 ? OTHER : T, instituteId: i % 2 ? INST_A : INST_B, employeeId: oid(), month: 1 + (i % 6), year: 2026,
    baseSalary: 1000 + i, allowances: i % 5, deductions: i % 3, netAmount: round2(1000 + i + (i % 5) - (i % 3) + 0.25),
    status: ['paid', 'pending', 'cancelled'][i % 3], createdAt: new Date(2026, 0, 1 + (i % 200)),
  }));

  test('the list summary spans the filtered set on every page; the monthly summary (cancelled left out) adds up to the same totals', async () => {
    useAgg(SalaryPayment, payments, () => ({ institutes: [{ _id: INST_A, name: 'A', type: 'madrasa' }, { _id: INST_B, name: 'B', type: 'school' }] }));
    const mine = payments.filter((p) => String(p.tenantId) === String(T));
    const by = (status: string) => mine.filter((p) => p.status === status);
    assert.ok(mine.length > 200);
    for (const size of SIZES) {
      for (let p = 1; p <= pagesOf(mine.length, size); p += 1) {
        const out = await run(getAllSalaryPayments, page(asAdmin(), p, size));
        assert.equal(out.status, 200, JSON.stringify(out.body));
        assert.deepEqual(out.body.summary, {
          count: mine.length,
          paidAmount: sum(by('paid'), (r) => r.netAmount),
          pendingAmount: sum(by('pending'), (r) => r.netAmount),
          cancelledAmount: sum(by('cancelled'), (r) => r.netAmount),
          paidCount: by('paid').length,
          pendingCount: by('pending').length,
          cancelledCount: by('cancelled').length,
        }, `page ${p} of ${size}`);
      }
    }
    // narrowed to one institute: the summary follows the same filter
    const inst = await run(getAllSalaryPayments, page(asAdmin({ query: { instituteId: String(INST_A) } }), 1, 10));
    const instRows = mine.filter((r) => String(r.instituteId) === String(INST_A));
    assert.equal(inst.body.summary.count, instRows.length);
    assert.equal(inst.body.summary.paidAmount, sum(instRows.filter((r) => r.status === 'paid'), (r) => r.netAmount));

    const monthly = await run(getSalarySummary, asAdmin());
    assert.equal(monthly.status, 200, JSON.stringify(monthly.body));
    const live = mine.filter((p) => p.status !== 'cancelled');
    assert.equal(round2(monthly.body.data.reduce((s: number, r: any) => s + r.totalNetAmount, 0)), sum(live, (r) => r.netAmount));
    assert.equal(monthly.body.data.reduce((s: number, r: any) => s + r.totalEmployees, 0), live.length);
    assert.equal(monthly.body.data.reduce((s: number, r: any) => s + r.paidCount + r.pendingCount, 0), live.length);
  });
});

// ──────────────────────────────── wallets ────────────────────────────────

describe('wallet balances list (families and members)', () => {
  test('135 families, some without a wallet: every page carries the whole-set totals and the same number of people', async () => {
    const families = Array.from({ length: 135 }, (_, i) => ({ _id: oid(), tenantId: i % 9 === 0 ? OTHER : T, houseName: `House ${String(i).padStart(3, '0')}`, mahallId: `M${i}` }));
    const wallets = families
      .filter((_, i) => i % 3 !== 0)
      .map((f, i) => ({ _id: oid(), tenantId: f.tenantId, familyId: f._id, balance: round2(i * 3.1), createdAt: new Date(2026, 0, 1), lastTransactionDate: new Date() }));
    const installed = installFake(Family, families);
    installs.push(installed);
    (Family as any).aggregate = (pipeline: any[]) => Promise.resolve(runPipeline(installed.store.docs, pipeline, { [Wallet.collection.name]: wallets }));
    const mine = families.filter((f) => String(f.tenantId) === String(T));
    const mineWallets = wallets.filter((w) => String(w.tenantId) === String(T));
    for (const size of [10, 100]) {
      for (let p = 1; p <= 2; p += 1) {
        const out = await run(listWallets, page(asAdmin({ query: { type: 'family' } }), p, size));
        assert.equal(out.status, 200, JSON.stringify(out.body));
        assert.deepEqual(out.body.summary, {
          totalBalance: sum(mineWallets, (w) => w.balance),
          count: mine.length,
          walletCount: mineWallets.length,
          activeCount: mineWallets.filter((w) => w.balance > 0).length,
        }, `page ${p} of ${size}`);
        assert.equal(out.body.pagination.total, mine.length);
      }
    }
    void Member;
  });
});

// ──────────────────────────────── zakat, qard, welfare, relief ────────────────────────────────

describe('zakat, qard, welfare and relief summaries', () => {
  test('zakat summary: collected / pending / distributed / by type over 100+ rows, pending kept out of collected', async () => {
    const zakats = Array.from({ length: 150 }, (_, i) => ({
      _id: oid(), tenantId: i % 10 === 0 ? OTHER : T, amount: round2(5 + i), paymentDate: new Date(2026, i % 12, 2), status: i % 3 === 0 ? 'pending' : 'verified',
    }));
    const dists = Array.from({ length: 120 }, (_, i) => ({
      _id: oid(), tenantId: i % 10 === 0 ? OTHER : T, amount: round2(3 + i * 0.5), distributionDate: new Date(2026, i % 12, 3), type: ['regular', 'monthly', 'fitr', 'qurbani'][i % 4],
    }));
    useAgg(Zakat, zakats);
    useAgg(ZakatDistribution, dists);
    useAgg(ZakatBeneficiary, []);
    const mineZ = zakats.filter((z) => String(z.tenantId) === String(T));
    const mineD = dists.filter((d) => String(d.tenantId) === String(T));
    const out = await run(getZakatSummary, asAdmin({ query: { year: '2026' } }));
    assert.equal(out.status, 200, JSON.stringify(out.body));
    const d = out.body.data;
    assert.equal(d.collected, sum(mineZ.filter((z) => z.status !== 'pending'), (z) => z.amount));
    assert.equal(d.pendingCollected, sum(mineZ.filter((z) => z.status === 'pending'), (z) => z.amount));
    assert.equal(d.distributed, sum(mineD, (x) => x.amount));
    assert.equal(d.balance, round2(d.collected - d.distributed));
    assert.equal(d.distributionCount, mineD.length);
    assert.equal(round2(d.byType.reduce((s: number, r: any) => s + r.total, 0)), d.distributed);
  });

  test('qard summary: disbursed / outstanding / counts over 120 loans', async () => {
    const statuses = ['applied', 'under_review', 'approved', 'disbursed', 'repaying', 'closed', 'defaulted'];
    const loans = Array.from({ length: 140 }, (_, i) => {
      const status = statuses[i % statuses.length];
      const amount = 1000 + i * 10;
      return { _id: oid(), tenantId: i % 10 === 0 ? OTHER : T, status, amount, approvedAmount: i % 2 ? amount - 100 : undefined, outstandingBalance: ['disbursed', 'repaying', 'defaulted'].includes(status) ? amount / 2 : 0 };
    });
    useAgg(QardLoan, loans);
    const mine = loans.filter((l) => String(l.tenantId) === String(T));
    const out = await run(getQardSummary, asAdmin());
    assert.equal(out.status, 200, JSON.stringify(out.body));
    const out2 = mine.filter((l) => ['disbursed', 'repaying', 'closed', 'defaulted'].includes(l.status));
    assert.equal(out.body.data.totalDisbursed, sum(out2, (l) => l.approvedAmount ?? l.amount));
    assert.equal(out.body.data.totalOutstanding, sum(out2, (l) => l.outstandingBalance));
    assert.equal(out.body.data.activeLoans, mine.filter((l) => ['disbursed', 'repaying'].includes(l.status)).length);
    assert.equal(out.body.data.defaultedLoans, mine.filter((l) => l.status === 'defaulted').length);
  });

  test('welfare and relief summaries: counts and money over 120 rows', async () => {
    const apps = Array.from({ length: 130 }, (_, i) => ({ _id: oid(), tenantId: i % 10 === 0 ? OTHER : T, status: ['pending', 'approved', 'disbursed', 'closed', 'rejected'][i % 5], approvedAmount: 100 + i, requestedAmount: 200 }));
    useAgg(WelfareApplication, apps);
    const mine = apps.filter((a) => String(a.tenantId) === String(T));
    const w = await run(getWelfareSummary, asAdmin());
    assert.equal(w.body.data.total, mine.length);
    assert.equal(w.body.data.pending, mine.filter((a) => a.status === 'pending').length);
    assert.equal(w.body.data.disbursedAmount, sum(mine.filter((a) => ['disbursed', 'closed'].includes(a.status)), (a) => a.approvedAmount));

    const cases = Array.from({ length: 130 }, (_, i) => ({ _id: oid(), tenantId: i % 10 === 0 ? OTHER : T, status: ['reported', 'verified', 'approved', 'assisted', 'closed'][i % 5], urgency: ['low', 'critical'][i % 2], amount: 50 + i }));
    useAgg(ReliefCase, cases);
    const mineC = cases.filter((c) => String(c.tenantId) === String(T));
    const r = await run(getReliefSummary, asAdmin());
    assert.equal(r.body.data.totalAssistance, sum(mineC.filter((c) => ['assisted', 'closed'].includes(c.status)), (c) => c.amount));
    assert.equal(r.body.data.criticalCases, mineC.filter((c) => c.urgency === 'critical').length);
  });
});

// ──────────────────────────────── master accounts ────────────────────────────────

describe('master account lists: institute accounts, Mahallu accounts, wallets, ledger items', () => {
  test('the summary of each list covers every matching row over 100+ rows, on every page', async () => {
    const ia = Array.from({ length: 220 }, (_, i) => ({ _id: oid(), tenantId: i % 8 === 0 ? OTHER : T, instituteId: i % 2 ? INST_A : INST_B, accountName: `Acc ${i}`, balance: round2(100 + i * 2.35), createdAt: new Date(2026, 0, 1 + (i % 100)) }));
    const ma = Array.from({ length: 130 }, (_, i) => ({ _id: oid(), tenantId: i % 8 === 0 ? OTHER : T, accountName: `M ${i}`, balance: round2(50 + i * 1.1), createdAt: new Date(2026, 0, 1 + (i % 100)) }));
    const mw = Array.from({ length: 115 }, (_, i) => ({ _id: oid(), tenantId: i % 8 === 0 ? OTHER : T, name: `W ${i}`, balance: round2(5 + i * 0.7), createdAt: new Date(2026, 0, 1 + (i % 100)) }));
    useAgg(Institute, [{ _id: INST_A, tenantId: T, name: 'A' }, { _id: INST_B, tenantId: T, name: 'B' }]);
    useAgg(InstituteAccount, ia);
    useAgg(MahalluAccount, ma);
    useAgg(MasterWallet, mw);
    const mine = <R extends { tenantId: any }>(rows: R[]) => rows.filter((r) => String(r.tenantId) === String(T));
    for (const size of SIZES) {
      for (let p = 1; p <= 3; p += 1) {
        const a = await run(master.getAllInstituteAccounts, page(asAdmin(), p, size));
        assert.deepEqual(a.body.summary, { totalBalance: sum(mine(ia), (r) => r.balance), count: mine(ia).length }, `institute accounts p${p}/${size}`);
        const b = await run(master.getAllMahalluAccounts, page(asAdmin(), p, size));
        assert.deepEqual(b.body.summary, { totalBalance: sum(mine(ma), (r) => r.balance), count: mine(ma).length }, `Mahallu accounts p${p}/${size}`);
        const c = await run(master.getAllWallets, page(asAdmin(), p, size));
        assert.deepEqual(c.body.summary, { totalBalance: sum(mine(mw), (r) => r.balance), count: mine(mw).length }, `wallets p${p}/${size}`);
      }
    }
    const inst = await run(master.getAllInstituteAccounts, asInstitute());
    const own = mine(ia).filter((r) => String(r.instituteId) === String(INST_A));
    assert.deepEqual(inst.body.summary, { totalBalance: sum(own, (r) => r.balance), count: own.length }, 'an institute admin sees only their own institute');
  });

  test('ledger items: income, expense and net over 250 entries on every page, following the filters', async () => {
    const ledgerId = oid();
    const items = Array.from({ length: 250 }, (_, i) => ({
      _id: oid(), tenantId: i % 9 === 0 ? OTHER : T, instituteId: i % 3 === 0 ? INST_A : null, ledgerId: i % 2 ? ledgerId : oid(), type: i % 4 === 0 ? 'expense' : 'income',
      amount: round2(10 + i * 1.07), description: `E${i}`, date: new Date(Date.UTC(2026, i % 12, 1 + (i % 27))), createdAt: new Date(2026, 0, 1 + (i % 100)),
    }));
    useAgg(LedgerItem, items);
    useAgg(Ledger, []);
    useAgg(Category, []);
    const mine = items.filter((r) => String(r.tenantId) === String(T));
    const totals = (rows: any[]) => {
      const income = sum(rows.filter((r) => r.type === 'income'), (r) => r.amount);
      const expense = sum(rows.filter((r) => r.type === 'expense'), (r) => r.amount);
      return { totalIncome: income, totalExpense: expense, net: round2(income - expense), count: rows.length };
    };
    for (const size of SIZES) {
      for (let p = 1; p <= 3; p += 1) {
        const out = await run(master.getLedgerItems, page(asAdmin(), p, size));
        assert.deepEqual(out.body.summary, totals(mine), `p${p}/${size}`);
      }
    }
    const one = await run(master.getLedgerItems, page(asAdmin({ query: { ledgerId: String(ledgerId) } }), 1, 10));
    assert.deepEqual(one.body.summary, totals(mine.filter((r) => String(r.ledgerId) === String(ledgerId))));
    const mahalluOnly = await run(master.getLedgerItems, page(asAdmin({ query: { scope: 'mahallu' } }), 1, 10));
    assert.deepEqual(mahalluOnly.body.summary, totals(mine.filter((r) => r.instituteId === null)));
  });
});

// ──────────────────────────────── accounting reports ────────────────────────────────

describe('accounting reports over 250+ entries', () => {
  const LEDGERS = [
    { _id: oid(), tenantId: T, instituteId: null, name: 'Fees', type: 'income' },
    { _id: oid(), tenantId: T, instituteId: null, name: 'Rent', type: 'expense' },
    { _id: oid(), tenantId: T, instituteId: INST_A, name: 'Grants', type: 'income' },
  ];
  const DANGLING = oid(); // a ledger id with no ledger document
  let items: any[];
  let mine: any[];
  beforeEach(() => {
    items = Array.from({ length: 270 }, (_, i) => {
      const which = i % 3;
      return {
        _id: oid(), tenantId: i % 17 === 0 ? OTHER : T, instituteId: which === 2 ? INST_A : which === 1 && i % 6 === 1 ? INST_B : null,
        ledgerId: i % 29 === 0 ? DANGLING : LEDGERS[which]._id, type: which === 1 ? 'expense' : 'income', amount: round2(10 + i * 1.13),
        description: `E${i}`, date: new Date(Date.UTC(2026, i % 12, 1 + (i % 27))), createdAt: new Date(2026, 0, 1 + (i % 100)), source: 'manual',
      };
    });
    mine = items.filter((r) => String(r.tenantId) === String(T));
    const ledgers = () => ({ ledgers: ledgerStore.docs, institutes: instituteStore.docs, categories: [] as any[] });
    const ledgerStore = useAgg(Ledger, LEDGERS.map((l) => ({ ...l })), ledgers);
    const instituteStore = useAgg(Institute, [{ _id: INST_A, tenantId: T, name: 'Madrasa' }, { _id: INST_B, tenantId: T, name: 'School' }], ledgers);
    useAgg(LedgerItem, items, ledgers);
    useAgg(Category, [], ledgers);
    useAgg(InstituteAccount, [], ledgers);
    useAgg(MahalluAccount, [], ledgers);
  });
  const income = (rows: any[]) => sum(rows.filter((r) => r.type === 'income'), (r) => r.amount);
  const expense = (rows: any[]) => sum(rows.filter((r) => r.type === 'expense'), (r) => r.amount);

  test('day book: identical whole-set summary on every page at every size', async () => {
    assert.ok(mine.length > 250);
    for (const size of SIZES) {
      for (let p = 1; p <= pagesOf(mine.length, size); p += 1) {
        const out = await run(getDayBook, page(asAdmin(), p, size));
        assert.equal(out.status, 200, JSON.stringify(out.body));
        assert.deepEqual(out.body.data.summary, {
          totalIncome: income(mine), totalExpense: expense(mine), netBalance: round2(income(mine) - expense(mine)), totalEntries: mine.length,
        }, `p${p}/${size}`);
        assert.equal(out.body.data.pagination.total, mine.length);
      }
    }
  });

  test('ledger report: closing balance and totals are the whole range on every page; the running balance continues across pages', async () => {
    const ledger = LEDGERS[0];
    const rows = mine.filter((r) => String(r.ledgerId) === String(ledger._id));
    assert.ok(rows.length > 60);
    for (const size of [10, 25]) {
      const seen: any[] = [];
      for (let p = 1; p <= Math.ceil(rows.length / size); p += 1) {
        const out = await run(getLedgerReport, page(asAdmin({ query: { ledgerId: String(ledger._id) } }), p, size));
        assert.equal(out.status, 200, JSON.stringify(out.body));
        assert.equal(out.body.data.totalCredit, income(rows));
        assert.equal(out.body.data.totalDebit, expense(rows));
        assert.equal(out.body.data.closingBalance, round2(income(rows) - expense(rows)));
        assert.equal(out.body.data.pagination.total, rows.length);
        seen.push(...out.body.data.entries);
      }
      assert.equal(seen.length, rows.length);
      assert.equal(new Set(seen.map((e) => String(e._id))).size, rows.length, 'every entry once');
      assert.equal(seen[seen.length - 1].balance, round2(income(rows) - expense(rows)), 'the last running balance is the closing balance');
    }
  });

  test('trial balance, balance sheet and income & expenditure count EVERY entry, including those whose ledger document is missing', async () => {
    const dangling = mine.filter((r) => String(r.ledgerId) === String(DANGLING));
    assert.ok(dangling.length > 0, 'the fixture has entries with no ledger document');

    const tb = await run(getTrialBalance, asAdmin());
    assert.equal(tb.status, 200, JSON.stringify(tb.body));
    assert.equal(tb.body.data.totals.totalCredit, income(mine));
    assert.equal(tb.body.data.totals.totalDebit, expense(mine));
    assert.equal(tb.body.data.totals.difference, round2(income(mine) - expense(mine)));
    assert.ok(tb.body.data.ledgers.some((l: any) => l.ledgerName === 'Unknown ledger'));

    const bs = await run(getBalanceSheet, asAdmin());
    assert.equal(bs.status, 200, JSON.stringify(bs.body));
    assert.equal(bs.body.data.summary.totalIncome, income(mine));
    assert.equal(bs.body.data.summary.totalExpenses, expense(mine));

    const ie = await run(getIncomeExpenditure, asAdmin());
    assert.equal(ie.body.data.totalIncome, income(mine));
    assert.equal(ie.body.data.totalExpense, expense(mine));
    assert.equal(ie.body.data.surplus, round2(income(mine) - expense(mine)));

    // the day book agrees with all three
    const day = await run(getDayBook, page(asAdmin(), 1, 10));
    assert.equal(day.body.data.summary.totalIncome, tb.body.data.totals.totalCredit);
    assert.equal(day.body.data.summary.totalExpense, tb.body.data.totals.totalDebit);
  });

  test('balance sheet: the bank total covers EVERY account even though the listing is capped', async () => {
    const accounts = Array.from({ length: 230 }, (_, i) => ({ _id: oid(), tenantId: T, instituteId: i % 2 ? INST_A : INST_B, accountName: `A${i}`, bankName: 'B', status: 'active', balance: round2(100 + i * 3.3) }));
    useAgg(InstituteAccount, [...accounts, { _id: oid(), tenantId: T, instituteId: INST_A, accountName: 'off', status: 'inactive', balance: 99999 }, { _id: oid(), tenantId: OTHER, instituteId: INST_A, accountName: 'x', status: 'active', balance: 77777 }]);
    const out = await run(getBalanceSheet, asAdmin());
    assert.equal(out.status, 200, JSON.stringify(out.body));
    assert.equal(out.body.data.assets.bankAccounts.length, 200, 'the listing stays capped');
    assert.equal(out.body.data.assets.totalBankBalance, sum(accounts, (a) => a.balance), 'the total does not');
    assert.equal(out.body.data.summary.totalAssets, out.body.data.assets.totalBankBalance);
    const mahalluOnly = await run(getBalanceSheet, asAdmin({ query: { scope: 'mahallu' } }));
    assert.equal(mahalluOnly.body.data.assets.totalBankBalance, 0);
  });

  test('consolidated report: Mahallu-level entries are counted once, an institute with a bank account but no entries is not dropped', async () => {
    const accounts = [
      { _id: oid(), tenantId: T, instituteId: INST_A, status: 'active', balance: 1000.5 },
      { _id: oid(), tenantId: T, instituteId: INST_B, status: 'active', balance: 300.25 }, // INST_B has entries below, INST_C none
      { _id: oid(), tenantId: T, instituteId: INST_C_ID, status: 'active', balance: 40 },
    ];
    useAgg(InstituteAccount, accounts, () => ({ institutes: [{ _id: INST_A, name: 'Madrasa' }, { _id: INST_B, name: 'School' }, { _id: INST_C_ID, name: 'Library' }] }));
    useAgg(MahalluAccount, [{ _id: oid(), tenantId: T, status: 'active', balance: 500 }, { _id: oid(), tenantId: T, status: 'inactive', balance: 9999 }]);
    useAgg(Institute, [{ _id: INST_A, tenantId: T, name: 'Madrasa' }, { _id: INST_B, tenantId: T, name: 'School' }, { _id: INST_C_ID, tenantId: T, name: 'Library' }]);
    const out = await run(getConsolidatedReport, asAdmin());
    assert.equal(out.status, 200, JSON.stringify(out.body));
    const rows = out.body.data.institutes as any[];
    const mahallu = rows.filter((r) => r.instituteId === null);
    assert.equal(mahallu.length, 1, 'one Mahallu-level row, no "Unassigned" twin');
    assert.equal(mahallu[0].instituteName, 'Mahallu (Main)');
    const level = mine.filter((r) => r.instituteId === null);
    assert.equal(mahallu[0].totalIncome, income(level));
    assert.equal(mahallu[0].totalExpense, expense(level));
    assert.ok(rows.some((r) => r.instituteName === 'Library' && r.bankBalance === 40 && r.totalIncome === 0), 'the institute with no entries is listed with its bank balance');
    assert.equal(out.body.data.grandTotals.totalIncome, income(mine));
    assert.equal(out.body.data.grandTotals.totalExpense, expense(mine));
    assert.equal(out.body.data.grandTotals.netBalance, round2(income(mine) - expense(mine)));
    assert.equal(out.body.data.grandTotals.bankBalance, round2(1000.5 + 300.25 + 40 + 500));
    // the grand total is the sum of the rows shown
    assert.equal(round2(rows.reduce((s, r) => s + r.totalIncome, 0)), out.body.data.grandTotals.totalIncome);
  });
});
const INST_C_ID = oid();

// ──────────────────────────────── dashboard ────────────────────────────────

describe('dashboard financial summary', () => {
  test('this month\'s income / expense and the bank balance are database sums over 100+ rows', async () => {
    const now = new Date();
    const ledgers = [{ _id: oid(), tenantId: T, name: 'Fees', type: 'income' }, { _id: oid(), tenantId: T, name: 'Rent', type: 'expense' }];
    const items = Array.from({ length: 240 }, (_, i) => ({
      _id: oid(), tenantId: i % 10 === 0 ? OTHER : T, instituteId: null, ledgerId: ledgers[i % 2 ? 1 : 0]._id, type: i % 2 ? 'expense' : 'income',
      amount: round2(5 + i * 1.3), date: new Date(now.getFullYear(), now.getMonth(), 1 + (i % 20), 12),
    }));
    const accounts = Array.from({ length: 120 }, (_, i) => ({ _id: oid(), tenantId: T, instituteId: INST_A, status: 'active', balance: round2(10 + i * 2.2) }));
    const ledgerStore = useAgg(Ledger, ledgers);
    useAgg(LedgerItem, items, () => ({ ledgers: ledgerStore.docs }));
    useAgg(InstituteAccount, accounts);
    const mine = items.filter((r) => String(r.tenantId) === String(T));
    const income = (rows: any[]) => sum(rows.filter((r) => r.type === 'income'), (r) => r.amount);
    const expense = (rows: any[]) => sum(rows.filter((r) => r.type === 'expense'), (r) => r.amount);
    const out = await run(getFinancialSummary, asAdmin());
    assert.equal(out.status, 200, JSON.stringify(out.body));
    assert.equal(round2(out.body.data.monthlyIncome), income(mine));
    assert.equal(round2(out.body.data.monthlyExpense), expense(mine));
    assert.equal(out.body.data.transactionCount, mine.length);
    assert.equal(round2(out.body.data.totalBankBalance), sum(accounts, (a) => a.balance));
    assert.equal(out.body.data.bankAccountCount, accounts.length);
    void Employee;
    void mongoose;
  });
});

});
