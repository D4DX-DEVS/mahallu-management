import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { QardLoan, QardRepayment, QARD_TRANSITIONS, QARD_STATUSES } from '../models/QardLoan';
import { WelfareApplication, WelfareScheme, WELFARE_TRANSITIONS, WELFARE_STATUSES } from '../models/Welfare';
import ReliefCase, { RELIEF_TRANSITIONS, RELIEF_STATUSES } from '../models/ReliefCase';
import {
  Scholarship,
  ScholarshipAward,
  AWARD_TRANSITIONS,
  AWARD_STATUSES,
} from '../models/Scholarship';
import {
  MarriageAssistance,
  MARRIAGE_ASSISTANCE_TRANSITIONS,
  MARRIAGE_ASSISTANCE_STATUSES,
} from '../models/MarriageAssistance';
import Member from '../models/Member';
import Family from '../models/Family';
import * as qard from '../controllers/qardController';
import * as welfare from '../controllers/welfareController';
import * as relief from '../controllers/reliefController';
import * as scholarship from '../controllers/scholarshipController';
import * as marriage from '../controllers/marriageAssistanceController';
import { fakeModel, FakeCollection, callHandler, oid, silenceConsoleError } from './fakeMongo';

/**
 * Workflow integrity: no generic update changes a status or posted money, and every status endpoint
 * enforces its transition map - every allowed edge and every disallowed edge, table-driven through
 * the real controllers (models replaced by an in-memory fake, see fakeMongo.ts).
 */

const TENANT = String(oid());
const FAMILY = oid();
const MEMBER = oid();
const SCHOLARSHIP = oid();

const c: Record<string, FakeCollection> = {};
const restorers: Array<() => void> = [];
let restoreConsole: () => void;

const MODELS: Record<string, any> = {
  loans: QardLoan,
  repayments: QardRepayment,
  apps: WelfareApplication,
  schemes: WelfareScheme,
  relief: ReliefCase,
  awards: ScholarshipAward,
  scholarships: Scholarship,
  marriage: MarriageAssistance,
  members: Member,
  families: Family,
};

const asMahall = (extra: Record<string, any> = {}) => ({
  tenantId: TENANT,
  isSuperAdmin: false,
  user: { role: 'mahall', _id: oid(), id: String(oid()) },
  ...extra,
});
const call = (handler: any, extra: Record<string, any>) => callHandler(handler, asMahall(extra));
const roleOf = (role: string, extra: Record<string, any>) =>
  asMahall({ user: { role, _id: oid() }, ...extra });

describe('Workflow integrity: status transitions', () => {
  before(() => {
    for (const [key, Model] of Object.entries(MODELS)) {
      const f = fakeModel(Model);
      c[key] = f.collection;
      restorers.push(f.restore);
    }
    restoreConsole = silenceConsoleError();
  });
  after(() => {
    restorers.forEach((restore) => restore());
    restoreConsole();
  });
  beforeEach(() => {
    for (const col of Object.values(c)) {
      col.rows.length = 0;
      col.log.length = 0;
    }
    c.members.seed({ _id: MEMBER, tenantId: TENANT, name: 'Member' });
    c.families.seed({ _id: FAMILY, tenantId: TENANT, houseName: 'House' });
    c.scholarships.seed({ _id: SCHOLARSHIP, tenantId: TENANT, name: 'Scholarship', amount: 500 });
  });

  /* ---------------------------------------------------------------------------------------------
   * Transition tables: the literal tables below are the documented contract. If a map changes,
   * this test changes with it - on purpose.
   * ------------------------------------------------------------------------------------------- */

  type Table = Record<string, string[]>;

  const TABLES: Array<{
    name: string;
    expected: Table;
    actual: Table;
    statuses: readonly string[];
    /** Seed a record in `from` and return the handler call that asks for `to`. */
    attempt: (from: string, to: string) => Promise<{ status: number; body: any }>;
    read: () => any;
  }> = [
    {
      name: 'qard loan',
      statuses: QARD_STATUSES,
      actual: QARD_TRANSITIONS,
      expected: {
        applied: ['under_review', 'rejected'],
        under_review: ['approved', 'rejected'],
        approved: ['disbursed', 'rejected'],
        disbursed: ['repaying', 'closed', 'defaulted'],
        repaying: ['closed', 'defaulted'],
        defaulted: ['closed'],
        rejected: [],
        closed: [],
      },
      attempt: (from, to) => {
        const [loan] = c.loans.seed({
          tenantId: TENANT,
          applicantName: 'A',
          amount: 100,
          approvedAmount: 100,
          repaymentMonths: 6,
          status: from,
          outstandingBalance: 0,
          repaymentSchedule: [],
        });
        return call(qard.updateLoanStatus, { params: { id: String(loan._id) }, body: { status: to } });
      },
      read: () => c.loans.rows[0],
    },
    {
      name: 'welfare application',
      statuses: WELFARE_STATUSES,
      actual: WELFARE_TRANSITIONS,
      expected: {
        pending: ['verified', 'rejected'],
        verified: ['approved', 'rejected'],
        approved: ['disbursed', 'rejected'],
        disbursed: ['closed'],
        rejected: [],
        closed: [],
      },
      attempt: (from, to) => {
        const [app] = c.apps.seed({
          tenantId: TENANT,
          schemeId: oid(),
          familyId: FAMILY,
          requestedAmount: 100,
          approvedAmount: 100,
          status: from,
          history: [],
        });
        return call(welfare.updateApplicationStatus, {
          params: { id: String(app._id) },
          body: { status: to, disbursedVia: 'cash' },
        });
      },
      read: () => c.apps.rows[0],
    },
    {
      name: 'relief case',
      statuses: RELIEF_STATUSES,
      actual: RELIEF_TRANSITIONS,
      expected: {
        reported: ['verified', 'closed'],
        verified: ['approved', 'closed'],
        approved: ['assisted', 'closed'],
        assisted: ['closed'],
        closed: [],
      },
      attempt: (from, to) => {
        const [item] = c.relief.seed({ tenantId: TENANT, title: 'Case', status: from, assistanceGiven: 'food kit' });
        return call(relief.updateReliefStatus, { params: { id: String(item._id) }, body: { status: to } });
      },
      read: () => c.relief.rows[0],
    },
    {
      name: 'scholarship award',
      statuses: AWARD_STATUSES,
      actual: AWARD_TRANSITIONS,
      expected: { applied: ['approved'], approved: ['paid'], paid: [] },
      attempt: (from, to) => {
        const [award] = c.awards.seed({
          tenantId: TENANT,
          scholarshipId: SCHOLARSHIP,
          memberId: MEMBER,
          amount: 100,
          status: from,
        });
        return call(scholarship.updateAwardStatus, { params: { id: String(award._id) }, body: { status: to } });
      },
      read: () => c.awards.rows[0],
    },
    {
      name: 'marriage assistance',
      statuses: MARRIAGE_ASSISTANCE_STATUSES,
      actual: MARRIAGE_ASSISTANCE_TRANSITIONS,
      expected: { requested: ['approved'], approved: ['completed'], completed: [] },
      attempt: (from, to) => {
        const [item] = c.marriage.seed({ tenantId: TENANT, type: 'financial_assistance', amount: 100, status: from });
        return call(marriage.updateAssistanceStatus, { params: { id: String(item._id) }, body: { status: to } });
      },
      read: () => c.marriage.rows[0],
    },
  ];

  for (const table of TABLES) {
    describe(`${table.name} transition map`, () => {
      test('the map is the documented table', () => {
        assert.deepEqual(table.actual, table.expected);
        for (const status of table.statuses) assert.ok(Array.isArray(table.actual[status]), `${status} has a list`);
      });

      for (const from of table.statuses) {
        for (const to of table.statuses) {
          const allowed = table.expected[from].includes(to);
          test(`${from} -> ${to} is ${allowed ? 'allowed (200)' : 'refused (409)'}`, async () => {
            const result = await table.attempt(from, to);
            if (allowed) {
              assert.equal(result.status, 200, JSON.stringify(result.body));
              assert.equal(table.read().status, to);
            } else {
              assert.equal(result.status, 409, JSON.stringify(result.body));
              assert.equal(table.read().status, from, 'a refused move changes nothing');
            }
          });
        }
      }
    });
  }

  test('every status endpoint answers 400 for an unknown status, 403 for a non-admin role and 404 for a missing record', async () => {
    const endpoints: Array<[string, any, () => any]> = [
      ['qard', qard.updateLoanStatus, () => c.loans.seed({ tenantId: TENANT, amount: 100, status: 'applied' })[0]],
      ['welfare', welfare.updateApplicationStatus, () => c.apps.seed({ tenantId: TENANT, requestedAmount: 10, status: 'pending', history: [] })[0]],
      ['relief', relief.updateReliefStatus, () => c.relief.seed({ tenantId: TENANT, title: 't', status: 'reported' })[0]],
      ['award', scholarship.updateAwardStatus, () => c.awards.seed({ tenantId: TENANT, amount: 10, status: 'applied' })[0]],
      ['marriage', marriage.updateAssistanceStatus, () => c.marriage.seed({ tenantId: TENANT, type: 'financial_assistance', status: 'requested' })[0]],
    ];
    for (const [name, handler, seed] of endpoints) {
      const record = seed();
      const params = { id: String(record._id) };
      assert.equal((await call(handler, { params, body: { status: 'bogus' } })).status, 400, `${name} bad status`);
      for (const role of ['survey', 'institute', 'member']) {
        const denied = await callHandler(handler, roleOf(role, { params, body: { status: 'verified' } }));
        assert.equal(denied.status, 403, `${name} as ${role}`);
      }
      const missing = await call(handler, { params: { id: String(oid()) }, body: { status: 'approved' } });
      assert.equal(missing.status, 404, `${name} missing`);
      assert.equal(c[{ qard: 'loans', welfare: 'apps', relief: 'relief', award: 'awards', marriage: 'marriage' }[name]!].rows[0].status,
        record.status, `${name}: nothing changed`);
    }
  });

  test('every status endpoint refuses a record from another Mahallu (404)', async () => {
    const foreign = String(oid());
    const cases: Array<[any, any, string]> = [
      [qard.updateLoanStatus, c.loans.seed({ tenantId: foreign, amount: 1, status: 'applied' })[0], 'under_review'],
      [welfare.updateApplicationStatus, c.apps.seed({ tenantId: foreign, requestedAmount: 1, status: 'pending', history: [] })[0], 'verified'],
      [relief.updateReliefStatus, c.relief.seed({ tenantId: foreign, title: 't', status: 'reported' })[0], 'verified'],
      [scholarship.updateAwardStatus, c.awards.seed({ tenantId: foreign, amount: 1, status: 'applied' })[0], 'approved'],
      [marriage.updateAssistanceStatus, c.marriage.seed({ tenantId: foreign, type: 'financial_assistance', status: 'requested' })[0], 'approved'],
    ];
    for (const [handler, record, status] of cases) {
      const result = await call(handler, { params: { id: String(record._id) }, body: { status } });
      assert.equal(result.status, 404);
    }
  });

  /* ---------------------------------------------------------------------------------------------
   * Marriage assistance
   * ------------------------------------------------------------------------------------------- */

  describe('marriage assistance', () => {
    const seed = (extra: Record<string, any> = {}) =>
      c.marriage.seed({ tenantId: TENANT, type: 'financial_assistance', amount: 1000, status: 'requested', ...extra })[0];

    test('a generic update cannot change the status or skip the transition map', async () => {
      const item = seed();
      for (const status of ['approved', 'completed']) {
        const result = await call(marriage.updateAssistance, {
          params: { id: String(item._id) },
          body: { status, notes: `try ${status}` },
        });
        assert.equal(result.status, 200);
        assert.equal(c.marriage.get(item._id)!.status, 'requested', `PUT {status:${status}} must not move the record`);
      }
      assert.equal(c.marriage.get(item._id)!.notes, 'try completed', 'the other fields did update');
    });

    test('a generic update cannot reach tenantId, approval or any server-owned field', async () => {
      const item = seed();
      const other = String(oid());
      await call(marriage.updateAssistance, {
        params: { id: String(item._id) },
        body: { tenantId: other, approvedBy: other, approvedAt: '2026-01-01', status: 'completed', notes: 'ok' },
      });
      const stored = c.marriage.get(item._id)!;
      assert.equal(String(stored.tenantId), TENANT);
      assert.equal(stored.approvedBy, undefined);
      assert.equal(stored.approvedAt, undefined);
      assert.equal(stored.status, 'requested');
    });

    test('create always starts as requested, whatever the body says', async () => {
      const result = await call(marriage.createAssistance, {
        body: { memberId: String(MEMBER), type: 'financial_assistance', amount: 500, status: 'completed', approvedBy: 'x' },
      });
      assert.equal(result.status, 201);
      assert.equal(c.marriage.rows[0].status, 'requested');
      assert.equal(c.marriage.rows[0].approvedBy, undefined);
    });

    test('the amount is fixed once the request leaves "requested"', async () => {
      for (const status of ['approved', 'completed']) {
        const item = seed({ status });
        const refused = await call(marriage.updateAssistance, { params: { id: String(item._id) }, body: { amount: 9 } });
        assert.equal(refused.status, 409, status);
        const same = await call(marriage.updateAssistance, { params: { id: String(item._id) }, body: { amount: 1000, notes: 'fine' } });
        assert.equal(same.status, 200, 'the unchanged amount can be re-sent');
      }
      const open = seed();
      assert.equal((await call(marriage.updateAssistance, { params: { id: String(open._id) }, body: { amount: 250.5 } })).status, 200);
      assert.equal(c.marriage.get(open._id)!.amount, 250.5);
    });

    test('10 parallel approvals: exactly one wins, the rest are 409', async () => {
      const item = seed();
      const results = await Promise.all(
        Array.from({ length: 10 }, () => call(marriage.updateAssistanceStatus, { params: { id: String(item._id) }, body: { status: 'approved' } }))
      );
      assert.equal(results.filter((r) => r.status === 200).length, 1);
      assert.equal(results.filter((r) => r.status === 409).length, 9);
    });

    test('status notes are bounded and an unknown status is a 400', async () => {
      const item = seed();
      const long = await call(marriage.updateAssistanceStatus, {
        params: { id: String(item._id) },
        body: { status: 'approved', notes: 'x'.repeat(2001) },
      });
      assert.equal(long.status, 400);
      assert.equal(c.marriage.get(item._id)!.status, 'requested');
    });

    test('a completed request cannot be deleted', async () => {
      const done = seed({ status: 'completed' });
      assert.equal((await call(marriage.deleteAssistance, { params: { id: String(done._id) } })).status, 409);
      assert.ok(c.marriage.get(done._id));
      const open = seed();
      assert.equal((await call(marriage.deleteAssistance, { params: { id: String(open._id) } })).status, 200);
    });
  });

  /* ---------------------------------------------------------------------------------------------
   * Scholarship awards
   * ------------------------------------------------------------------------------------------- */

  describe('scholarship awards', () => {
    const seed = (extra: Record<string, any> = {}) =>
      c.awards.seed({ tenantId: TENANT, scholarshipId: SCHOLARSHIP, memberId: MEMBER, amount: 500, status: 'applied', ...extra })[0];

    test('an award cannot be created as paid (or approved): the first state is forced server-side', async () => {
      for (const status of ['paid', 'approved', 'applied', 'bogus', undefined]) {
        c.awards.rows.length = 0;
        const result = await call(scholarship.createAward, {
          body: {
            scholarshipId: String(SCHOLARSHIP),
            memberId: String(MEMBER),
            amount: 500,
            status,
            paidAt: '2026-01-01',
            paidBy: 'x',
            tenantId: String(oid()),
          },
        });
        assert.equal(result.status, 201, String(status));
        const stored = c.awards.rows[0];
        assert.equal(stored.status, 'applied', `body status ${String(status)} is ignored`);
        assert.equal(stored.paidAt, undefined);
        assert.equal(stored.paidBy, undefined);
        assert.equal(String(stored.tenantId), TENANT);
      }
    });

    test('generic update: an illegal jump is a 409, the legal next step works, the same status is a no-op', async () => {
      const item = seed();
      assert.equal((await call(scholarship.updateAward, { params: { id: String(item._id) }, body: { status: 'paid' } })).status, 409);
      assert.equal(c.awards.get(item._id)!.status, 'applied');
      assert.equal((await call(scholarship.updateAward, { params: { id: String(item._id) }, body: { status: 'applied', remarks: 'r' } })).status, 200);
      assert.equal((await call(scholarship.updateAward, { params: { id: String(item._id) }, body: { status: 'approved' } })).status, 200);
      assert.equal(c.awards.get(item._id)!.status, 'approved');
      assert.equal((await call(scholarship.updateAward, { params: { id: String(item._id) }, body: { status: 'applied' } })).status, 409, 'no going back');
    });

    test('amount and beneficiary are fixed once approved or paid (409), but editable while applied', async () => {
      const applied = seed();
      assert.equal((await call(scholarship.updateAward, { params: { id: String(applied._id) }, body: { amount: 600 } })).status, 200);
      assert.equal(c.awards.get(applied._id)!.amount, 600);

      const otherMember = oid();
      c.members.seed({ _id: otherMember, tenantId: TENANT, name: 'Other' });
      for (const status of ['approved', 'paid']) {
        const item = seed({ status });
        for (const body of [{ amount: 1 }, { memberId: String(otherMember) }, { scholarshipId: String(oid()) }]) {
          const result = await call(scholarship.updateAward, { params: { id: String(item._id) }, body });
          assert.equal(result.status, 409, `${status} ${JSON.stringify(body)}`);
        }
        const kept = c.awards.get(item._id)!;
        assert.equal(kept.amount, 500);
        assert.equal(String(kept.memberId), String(MEMBER));
        const same = await call(scholarship.updateAward, {
          params: { id: String(item._id) },
          body: { amount: 500, memberId: String(MEMBER), remarks: 'note only' },
        });
        assert.equal(same.status, 200, 'unchanged values re-sent by a form are fine');
        assert.equal(c.awards.get(item._id)!.remarks, 'note only');
      }
    });

    test('a paid award cannot be deleted; an applied or approved one can', async () => {
      const paid = seed({ status: 'paid' });
      assert.equal((await call(scholarship.deleteAward, { params: { id: String(paid._id) } })).status, 409);
      assert.ok(c.awards.get(paid._id));
      for (const status of ['applied', 'approved']) {
        const item = seed({ status });
        assert.equal((await call(scholarship.deleteAward, { params: { id: String(item._id) } })).status, 200, status);
      }
    });

    test('the award is claimed atomically: 10 parallel approvals give one 200', async () => {
      const item = seed();
      const results = await Promise.all(
        Array.from({ length: 10 }, () => call(scholarship.updateAwardStatus, { params: { id: String(item._id) }, body: { status: 'approved' } }))
      );
      assert.equal(results.filter((r) => r.status === 200).length, 1);
    });

    test('an amount edit cannot slip in after the approval it raced', async () => {
      const item = seed();
      const [approved, edited] = await Promise.all([
        call(scholarship.updateAwardStatus, { params: { id: String(item._id) }, body: { status: 'approved' } }),
        call(scholarship.updateAward, { params: { id: String(item._id) }, body: { amount: 1 } }),
      ]);
      assert.equal(approved.status, 200);
      const stored = c.awards.get(item._id)!;
      if (edited.status === 200) assert.equal(stored.amount, 1, 'the edit landed first, before approval');
      else assert.equal(stored.amount, 500);
    });

    test('award amounts must be positive, within the maximum, with at most 2 decimals', async () => {
      const item = seed();
      for (const bad of [0, -1, 100_000_001, 10.999, 'abc']) {
        const result = await call(scholarship.updateAward, { params: { id: String(item._id) }, body: { amount: bad } });
        assert.equal(result.status, 400, JSON.stringify(bad));
      }
      assert.equal(c.awards.get(item._id)!.amount, 500);
    });
  });

  /* ---------------------------------------------------------------------------------------------
   * Qard
   * ------------------------------------------------------------------------------------------- */

  describe('qard loans', () => {
    const seed = (extra: Record<string, any> = {}) =>
      c.loans.seed({
        tenantId: TENANT,
        applicantName: 'A',
        amount: 100,
        repaymentMonths: 6,
        status: 'applied',
        outstandingBalance: 0,
        repaymentSchedule: [],
        ...extra,
      })[0];

    test('create is always applied, with no approved amount, balance or schedule from the body', async () => {
      const result = await call(qard.createLoan, {
        body: {
          applicantName: 'X',
          amount: 100,
          status: 'disbursed',
          approvedAmount: 100,
          outstandingBalance: 999,
          monthlyInstallment: 5,
          approvedBy: String(oid()),
          repaymentSchedule: [{ amount: 1, paidAmount: 1, status: 'paid', dueDate: '2026-01-01' }],
          tenantId: String(oid()),
        },
      });
      assert.equal(result.status, 201);
      const stored = c.loans.rows[0];
      assert.equal(stored.status, 'applied');
      assert.equal(stored.approvedAmount, undefined);
      assert.equal(stored.outstandingBalance, 0);
      assert.equal(stored.monthlyInstallment, undefined);
      assert.equal(stored.approvedBy, undefined);
      assert.deepEqual(stored.repaymentSchedule, []);
      assert.equal(String(stored.tenantId), TENANT);
    });

    test('a generic update cannot change status, approval, balance or schedule', async () => {
      const loan = seed({ status: 'repaying', approvedAmount: 100, outstandingBalance: 60 });
      const result = await call(qard.updateLoan, {
        params: { id: String(loan._id) },
        body: {
          status: 'closed',
          approvedAmount: 1,
          outstandingBalance: 0,
          repaymentSchedule: [],
          disbursedDate: '2020-01-01',
          monthlyInstallment: 1,
          approvedBy: String(oid()),
          notes: 'hello',
        },
      });
      assert.equal(result.status, 200);
      const stored = c.loans.get(loan._id)!;
      assert.equal(stored.status, 'repaying');
      assert.equal(stored.approvedAmount, 100);
      assert.equal(stored.outstandingBalance, 60);
      assert.equal(stored.monthlyInstallment, undefined);
      assert.equal(stored.approvedBy, undefined);
      assert.equal(stored.notes, 'hello');
    });

    test('amount and repaymentMonths are editable only at the initial state (409 after)', async () => {
      const fresh = seed();
      const ok = await call(qard.updateLoan, { params: { id: String(fresh._id) }, body: { amount: 250, repaymentMonths: 10 } });
      assert.equal(ok.status, 200);
      assert.equal(c.loans.get(fresh._id)!.amount, 250);
      assert.equal(c.loans.get(fresh._id)!.repaymentMonths, 10);

      for (const status of QARD_STATUSES.filter((s) => s !== 'applied')) {
        const loan = seed({ status, approvedAmount: 100 });
        for (const body of [{ amount: 999 }, { repaymentMonths: 24 }]) {
          const refused = await call(qard.updateLoan, { params: { id: String(loan._id) }, body });
          assert.equal(refused.status, 409, `${status} ${JSON.stringify(body)}`);
        }
        const same = await call(qard.updateLoan, { params: { id: String(loan._id) }, body: { amount: 100, repaymentMonths: 6, notes: 'only a note' } });
        assert.equal(same.status, 200, `${status}: an unchanged value re-sent is fine`);
        assert.equal(c.loans.get(loan._id)!.amount, 100);
      }
    });

    test('allowOverApproval must be the boolean true; approvedAmount must be positive, <= max, 2dp', async () => {
      for (const bad of ['true', 'false', 'yes', 1, '1', 0, null, {}]) {
        const loan = seed({ status: 'under_review' });
        const result = await call(qard.updateLoanStatus, {
          params: { id: String(loan._id) },
          body: { status: 'approved', approvedAmount: 500, allowOverApproval: bad },
        });
        assert.equal(result.status, 400, `allowOverApproval ${JSON.stringify(bad)}`);
        assert.equal(c.loans.get(loan._id)!.status, 'under_review');
      }
      const loan = seed({ status: 'under_review' });
      const over = await call(qard.updateLoanStatus, { params: { id: String(loan._id) }, body: { status: 'approved', approvedAmount: 500 } });
      assert.equal(over.status, 400, 'over-approval needs the flag');
      for (const bad of [0, -5, 100_000_001, 10.999, '1e3']) {
        const refused = await call(qard.updateLoanStatus, {
          params: { id: String(loan._id) },
          body: { status: 'approved', approvedAmount: bad, allowOverApproval: true },
        });
        assert.equal(refused.status, 400, `approvedAmount ${JSON.stringify(bad)}`);
      }
      const ok = await call(qard.updateLoanStatus, { params: { id: String(loan._id) }, body: { status: 'approved', approvedAmount: 500.25, allowOverApproval: true } });
      assert.equal(ok.status, 200);
      assert.equal(c.loans.get(loan._id)!.approvedAmount, 500.25);
    });

    test('a loan cannot be closed while money is outstanding, a defaulted one included', async () => {
      for (const status of ['disbursed', 'repaying', 'defaulted']) {
        const loan = seed({ status, approvedAmount: 100, outstandingBalance: 40 });
        const result = await call(qard.updateLoanStatus, { params: { id: String(loan._id) }, body: { status: 'closed' } });
        assert.equal(result.status, 409, status);
        assert.equal(c.loans.get(loan._id)!.status, status);
      }
      const settled = seed({ status: 'defaulted', approvedAmount: 100, outstandingBalance: 0 });
      assert.equal((await call(qard.updateLoanStatus, { params: { id: String(settled._id) }, body: { status: 'closed' } })).status, 200);
    });

    test('disbursement builds the schedule once: 10 parallel disbursements give one 200 and one schedule', async () => {
      const loan = seed({ status: 'approved', approvedAmount: 100 });
      const results = await Promise.all(
        Array.from({ length: 10 }, () => call(qard.updateLoanStatus, { params: { id: String(loan._id) }, body: { status: 'disbursed' } }))
      );
      assert.equal(results.filter((r) => r.status === 200).length, 1);
      const stored = c.loans.get(loan._id)!;
      assert.equal(stored.repaymentSchedule.length, 6);
      assert.equal(stored.outstandingBalance, 100);
    });

    test('a loan whose money went out cannot be deleted (409); an application can', async () => {
      for (const status of ['disbursed', 'repaying', 'closed', 'defaulted']) {
        const loan = seed({ status, approvedAmount: 100 });
        assert.equal((await call(qard.deleteLoan, { params: { id: String(loan._id) } })).status, 409, status);
        assert.ok(c.loans.get(loan._id));
      }
      const draft = seed();
      assert.equal((await call(qard.deleteLoan, { params: { id: String(draft._id) } })).status, 200);
    });

    test('a loan edit that races a disbursement cannot re-price the disbursed loan', async () => {
      const loan = seed({ status: 'approved', approvedAmount: 100 });
      const [moved, edited] = await Promise.all([
        call(qard.updateLoanStatus, { params: { id: String(loan._id) }, body: { status: 'disbursed' } }),
        call(qard.updateLoan, { params: { id: String(loan._id) }, body: { notes: 'n' } }),
      ]);
      assert.equal(moved.status, 200);
      assert.ok([200, 409].includes(edited.status));
      assert.equal(c.loans.get(loan._id)!.status, 'disbursed');
    });
  });

  /* ---------------------------------------------------------------------------------------------
   * Relief
   * ------------------------------------------------------------------------------------------- */

  describe('relief cases', () => {
    const seed = (extra: Record<string, any> = {}) =>
      c.relief.seed({ tenantId: TENANT, title: 'Case', status: 'reported', ...extra })[0];

    test('a generic update cannot change the status', async () => {
      const item = seed();
      const result = await call(relief.updateReliefCase, { params: { id: String(item._id) }, body: { status: 'closed', notes: 'n' } });
      assert.equal(result.status, 200);
      assert.equal(c.relief.get(item._id)!.status, 'reported');
    });

    test('the amount is editable before assistance and frozen from "assisted" on (409)', async () => {
      const open = seed({ status: 'approved' });
      assert.equal((await call(relief.updateReliefCase, { params: { id: String(open._id) }, body: { amount: 300 } })).status, 200);
      assert.equal(c.relief.get(open._id)!.amount, 300);

      for (const status of ['assisted', 'closed']) {
        const item = seed({ status, amount: 300, assistanceGiven: 'food' });
        const refused = await call(relief.updateReliefCase, { params: { id: String(item._id) }, body: { amount: 1 } });
        assert.equal(refused.status, 409, status);
        assert.equal(c.relief.get(item._id)!.amount, 300);
        const same = await call(relief.updateReliefCase, { params: { id: String(item._id) }, body: { amount: 300, notes: 'n' } });
        assert.equal(same.status, 200, 'an unchanged amount can be re-sent');
      }
    });

    test('the status endpoint records the amount on assistance, and refuses to change it afterwards', async () => {
      const item = seed({ status: 'approved' });
      const assisted = await call(relief.updateReliefStatus, {
        params: { id: String(item._id) },
        body: { status: 'assisted', assistanceGiven: 'food kit', amount: 1500.5 },
      });
      assert.equal(assisted.status, 200);
      assert.equal(c.relief.get(item._id)!.amount, 1500.5);

      const change = await call(relief.updateReliefStatus, { params: { id: String(item._id) }, body: { status: 'closed', amount: 5 } });
      assert.equal(change.status, 409);
      assert.equal(c.relief.get(item._id)!.status, 'assisted');
      const close = await call(relief.updateReliefStatus, { params: { id: String(item._id) }, body: { status: 'closed', amount: 1500.5 } });
      assert.equal(close.status, 200);
    });

    test('status body validation: assisted needs assistance, notes bounded, amount valid', async () => {
      const item = seed({ status: 'approved' });
      const path = { id: String(item._id) };
      assert.equal((await call(relief.updateReliefStatus, { params: path, body: { status: 'assisted' } })).status, 400);
      for (const bad of [0, -3, 10.999, 100_000_001, 'abc']) {
        const result = await call(relief.updateReliefStatus, { params: path, body: { status: 'assisted', assistanceGiven: 'x', amount: bad } });
        assert.equal(result.status, 400, `amount ${JSON.stringify(bad)}`);
      }
      const long = await call(relief.updateReliefStatus, { params: path, body: { status: 'assisted', assistanceGiven: 'x', notes: 'n'.repeat(2001) } });
      assert.equal(long.status, 400);
      assert.equal(c.relief.get(item._id)!.status, 'approved');
    });

    test('a case where assistance was given cannot be deleted; an open one can', async () => {
      const assisted = seed({ status: 'assisted', amount: 100, assistanceGiven: 'food' });
      assert.equal((await call(relief.deleteReliefCase, { params: { id: String(assisted._id) } })).status, 409);
      const closedWithMoney = seed({ status: 'closed', amount: 100, assistanceGiven: 'food' });
      assert.equal((await call(relief.deleteReliefCase, { params: { id: String(closedWithMoney._id) } })).status, 409);
      assert.ok(c.relief.get(assisted._id) && c.relief.get(closedWithMoney._id));

      for (const status of ['reported', 'verified', 'approved']) {
        const item = seed({ status });
        assert.equal((await call(relief.deleteReliefCase, { params: { id: String(item._id) } })).status, 200, status);
      }
      const closedEmpty = seed({ status: 'closed' });
      assert.equal((await call(relief.deleteReliefCase, { params: { id: String(closedEmpty._id) } })).status, 200);
    });

    test('create ignores status, assistance and amount from the body', async () => {
      const result = await call(relief.createReliefCase, {
        body: { title: 'New', status: 'assisted', amount: 99, assistanceGiven: 'everything', familyId: String(FAMILY) },
      });
      assert.equal(result.status, 201);
      const stored = c.relief.rows[0];
      assert.equal(stored.status, 'reported');
      assert.equal(stored.amount, undefined);
      assert.equal(stored.assistanceGiven, undefined);
    });
  });

  /* ---------------------------------------------------------------------------------------------
   * Welfare: generic update never moves the status
   * ------------------------------------------------------------------------------------------- */

  describe('welfare applications', () => {
    test('a generic update cannot change the status through any field', async () => {
      const [app] = c.apps.seed({ tenantId: TENANT, schemeId: oid(), requestedAmount: 100, status: 'pending', history: [] });
      const result = await call(welfare.updateApplication, {
        params: { id: String(app._id) },
        body: { status: 'disbursed', reason: 'ok' },
      });
      assert.equal(result.status, 200);
      assert.equal(c.apps.get(app._id)!.status, 'pending');
    });
  });
});
