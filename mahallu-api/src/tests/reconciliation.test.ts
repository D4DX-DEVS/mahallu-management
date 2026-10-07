import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { ReconciliationIssue } from '../models/ReconciliationIssue';
import {
  RECONCILIATION_MESSAGE,
  ReconciliationRequiredError,
  buildReconciliationRecord,
  reportReconciliationRequired,
  runUndos,
  scrubText,
  sendReconciliationRequired,
} from '../utils/reconciliation';
import { CompensationFailedError, runAtomic } from '../utils/transaction';
import { listReconciliationIssues, resolveReconciliationIssue } from '../controllers/reconciliationController';
import * as ledgerService from '../services/ledgerPostingService';
import SalaryPayment from '../models/SalaryPayment';
import { deleteSalaryPayment } from '../controllers/salaryController';
import { matches } from './support/fakeMongo';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] reconciliation', () => {

/**
 * "An undo failed" must leave a durable, safe, deduplicated record and an honest response.
 * A stateful in-memory stand-in for the issue collection is used (no database).
 */

type Doc = Record<string, any>;
const oid = () => new mongoose.Types.ObjectId();
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const T1 = oid();
const T2 = oid();
const ID = '507f1f77bcf86cd799439011';

/** Emulates findOneAndUpdate with upsert on one collection guarded by the partial unique index on open issues. */
const makeStore = () => {
  const docs: Doc[] = [];
  const calls: Array<{ filter: Doc; update: Doc; options: Doc }> = [];
  let raceOnce = false;
  const model: any = {
    docs,
    calls,
    failWith: undefined as undefined | (() => Promise<never>),
    /** The next upsert loses an insert race (E11000) to a record that already exists. */
    loseRaceOnce() {
      raceOnce = true;
    },
    async findOneAndUpdate(filter: Doc, update: Doc, options: Doc = {}) {
      calls.push({ filter, update, options });
      if (model.failWith) return model.failWith();
      await tick();
      let doc: Doc = docs.find((d) => matches(d, filter)) as Doc;
      if (!doc) {
        if (!options.upsert) return null;
        if (raceOnce) {
          raceOnce = false;
          docs.push({ _id: oid(), ...filter, entity: 'WINNER', occurrences: 1, reason: 'first' });
          throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
        }
        doc = { _id: oid(), ...filter, ...(update.$setOnInsert || {}), occurrences: 0, createdAt: new Date() };
        docs.push(doc);
      }
      Object.assign(doc, update.$set || {});
      doc.occurrences += (update.$inc || {}).occurrences || 0;
      return doc;
    },
  };
  return model;
};

const realError = console.error;
const realWarn = console.warn;
const realInfo = console.info;
let errors: string[] = [];
beforeEach(() => {
  errors = [];
  console.error = (...args: any[]) => void errors.push(args.map(String).join(' '));
  console.warn = () => undefined;
  console.info = () => undefined;
});
afterEach(() => {
  console.error = realError;
  console.warn = realWarn;
  console.info = realInfo;
});

const structuredLine = (): Record<string, any> => {
  const line = errors.find((e) => e.startsWith('[RECONCILIATION REQUIRED] '));
  assert.ok(line, 'a [RECONCILIATION REQUIRED] line was written');
  return JSON.parse(line!.slice('[RECONCILIATION REQUIRED] '.length));
};

const connected = { isConnected: () => true };

describe('reportReconciliationRequired', () => {
  test('writes ONE structured JSON line and a durable open record', async () => {
    const model = makeStore();
    const out = await reportReconciliationRequired(
      { flow: 'varisangya verify', entity: 'Varisangya', entityId: ID, tenantId: String(T1), step: 'wallet credit', reason: new Error('wallet could not be debited'), state: { amount: 50, walletId: ID } },
      { model, ...connected }
    );
    assert.deepEqual(out, { logged: true, persisted: true });
    assert.equal(errors.filter((e) => e.startsWith('[RECONCILIATION REQUIRED]')).length, 1);
    const logged = structuredLine();
    assert.equal(logged.flow, 'varisangya verify');
    assert.equal(logged.entity, 'Varisangya');
    assert.equal(logged.entityId, ID);
    assert.equal(logged.tenantId, String(T1));
    assert.equal(logged.step, 'wallet credit');
    assert.equal(logged.reason, 'Error: wallet could not be debited');
    assert.deepEqual(logged.state, { amount: 50, walletId: ID });
    assert.deepEqual(Object.keys(logged).sort(), ['at', 'entity', 'entityId', 'flow', 'reason', 'state', 'step', 'tenantId']);

    assert.equal(model.docs.length, 1);
    const doc = model.docs[0];
    assert.equal(doc.status, 'open');
    assert.equal(doc.flow, 'varisangya verify');
    assert.equal(doc.entityId, ID);
    assert.equal(doc.step, 'wallet credit');
    assert.equal(doc.occurrences, 1);
    assert.equal(String(doc.tenantId), String(T1));
  });

  test('neither the log line nor the record carries secrets or personal data', async () => {
    const model = makeStore();
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop';
    await reportReconciliationRequired(
      {
        flow: 'salary create',
        entity: 'SalaryPayment',
        entityId: ID,
        tenantId: String(T1),
        step: 'remove salary payment',
        reason: Object.assign(
          new Error(
            `failed for phone +91 98765 43210 / 9876543210 email m.ali@example.com token=abc123secret Authorization: Bearer ${jwt} uri mongodb+srv://admin:p4ss@cluster0.example.net/db key ${'a'.repeat(64)}`
          ),
          { name: 'Error', code: 'E_UNDO' }
        ),
        state: { amount: 100, phone: '9876543210', email: 'm.ali@example.com', name: 'Mohammed Ali', token: jwt, note: 'call 9876543210 now', loanId: ID },
      },
      { model, ...connected }
    );
    const everything = errors.join('\n') + JSON.stringify(model.docs);
    for (const secret of ['9876543210', '98765 43210', 'm.ali@example.com', 'abc123secret', jwt, 'admin:p4ss', 'cluster0.example.net', 'a'.repeat(64), 'Mohammed Ali']) {
      assert.ok(!everything.includes(secret), `leaked: ${secret}`);
    }
    const logged = structuredLine();
    assert.match(logged.reason, /^Error\[E_UNDO\]: /);
    assert.deepEqual(Object.keys(logged.state).sort(), ['amount', 'loanId', 'note']);
    assert.equal(logged.state.loanId, ID, 'ids survive scrubbing');
  });

  test('a driver error quotes stored values in its message, so only its class, code and code name are kept', async () => {
    const model = makeStore();
    await reportReconciliationRequired(
      {
        flow: 'f', entity: 'e', entityId: ID, tenantId: String(T1), step: 's',
        reason: Object.assign(new Error('E11000 duplicate key error collection: db.members index: x dup key: { name: "Mohammed Ali" }'), { name: 'MongoServerError', code: 11000, codeName: 'DuplicateKey' }),
      },
      { model, ...connected }
    );
    assert.equal(structuredLine().reason, 'MongoServerError[11000] DuplicateKey');
    assert.ok(!errors.join(' ').includes('Mohammed Ali') &&!JSON.stringify(model.docs).includes('Mohammed Ali'));
  });

  test('anything that is not a plain id is replaced, so free text can never ride in the id fields', () => {
    const record = buildReconciliationRecord({ flow: 'x', entity: 'y', entityId: 'John Doe 9876543210', tenantId: 'not-an-id', step: 's' });
    assert.equal(record.entityId, 'unknown');
    assert.equal(record.tenantId, undefined);
    assert.equal(scrubText(`id ${ID} stays`), `id ${ID} stays`);
  });

  test('duplicate failures (a retry storm) leave ONE open record with a counter', async () => {
    const model = makeStore();
    const input = { flow: 'zakat distribution delete', entity: 'ZakatDistribution', entityId: ID, tenantId: String(T1), step: 'distribution row', reason: 'x' };
    await Promise.all(Array.from({ length: 8 }, () => reportReconciliationRequired(input, { model, ...connected })));
    assert.equal(model.docs.length, 1);
    assert.equal(model.docs[0].occurrences, 8);
    // another step of the same record, or the same step of another record, is a different issue
    await reportReconciliationRequired({ ...input, step: 'ledger entry' }, { model, ...connected });
    await reportReconciliationRequired({ ...input, entityId: '507f1f77bcf86cd799439099' }, { model, ...connected });
    assert.equal(model.docs.length, 3);
  });

  test('losing the insert race to a concurrent report just bumps the winner (no second record, no throw)', async () => {
    const model = makeStore();
    model.loseRaceOnce();
    const out = await reportReconciliationRequired(
      { flow: 'f', entity: 'e', entityId: ID, tenantId: String(T1), step: 's', reason: 'again' },
      { model, ...connected }
    );
    assert.equal(out.persisted, true);
    assert.equal(model.docs.length, 1);
    assert.equal(model.docs[0].occurrences, 2);
    assert.equal(model.docs[0].reason, 'again');
  });

  test('a resolved issue does not absorb a new failure of the same step: a fresh open record is made', async () => {
    const model = makeStore();
    const input = { flow: 'f', entity: 'e', entityId: ID, tenantId: String(T1), step: 's', reason: 'r' };
    await reportReconciliationRequired(input, { model, ...connected });
    model.docs[0].status = 'resolved';
    await reportReconciliationRequired(input, { model, ...connected });
    assert.equal(model.docs.length, 2);
    assert.deepEqual(model.docs.map((d: Doc) => d.status).sort(), ['open', 'resolved']);
  });

  test('never throws, whatever the write does: rejection, synchronous throw, a hang, or no connection', async () => {
    const rejecting = makeStore();
    rejecting.failWith = () => Promise.reject(new Error('connection lost to db.internal:27017 password=hunter2'));
    const a = await reportReconciliationRequired({ flow: 'f', entity: 'e', entityId: ID, step: 's' }, { model: rejecting, ...connected });
    assert.deepEqual(a, { logged: true, persisted: false });

    const throwing: any = { findOneAndUpdate: () => { throw new Error('sync boom'); } };
    const b = await reportReconciliationRequired({ flow: 'f', entity: 'e', entityId: ID, step: 's' }, { model: throwing, ...connected });
    assert.equal(b.persisted, false);

    const hanging: any = { findOneAndUpdate: () => new Promise(() => undefined) };
    const started = Date.now();
    const c = await reportReconciliationRequired({ flow: 'f', entity: 'e', entityId: ID, step: 's' }, { model: hanging, ...connected, timeoutMs: 50 });
    assert.equal(c.persisted, false);
    assert.ok(Date.now() - started < 2000, 'a hung write does not hold the caller');

    let touched = false;
    const spy: any = { findOneAndUpdate: () => { touched = true; } };
    const d = await reportReconciliationRequired({ flow: 'f', entity: 'e', entityId: ID, step: 's' }, { model: spy, isConnected: () => false });
    assert.equal(d.persisted, false);
    assert.equal(touched, false, 'no database call when there is no connection');

    // hostile input cannot make it throw either
    const circular: any = {};
    circular.self = circular;
    await assert.doesNotReject(reportReconciliationRequired({ flow: circular, entity: circular, entityId: circular, step: circular, reason: circular, state: circular } as any, { model: spy, isConnected: () => false }));

    // the original reason is in the structured line each time, and the driver message never is
    assert.ok(errors.some((e) => e.startsWith('[RECONCILIATION REQUIRED]')));
    assert.ok(!errors.join('\n').includes('hunter2'));
    assert.ok(!errors.join('\n').includes('db.internal'));
  });
});

describe('a failed undo ends in an explicit error that says the record needs administrator review', () => {
  const setConnected = (value: boolean) => {
    Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, get: () => (value ? 1 : 0) });
  };
  let original: any;
  let store: any;
  before(() => {
    original = ReconciliationIssue.findOneAndUpdate;
  });
  beforeEach(() => {
    store = makeStore();
    (ReconciliationIssue as any).findOneAndUpdate = (...args: any[]) => ({
      then: (resolve: any, reject: any) => store.findOneAndUpdate(...args).then(resolve, reject),
    });
    setConnected(true);
  });
  afterEach(() => {
    delete (mongoose.connection as any).readyState;
  });
  after(() => {
    (ReconciliationIssue as any).findOneAndUpdate = original;
  });

  const standalone: any = {
    readyState: 1,
    getClient: () => ({ topology: { description: { type: 'Single', servers: new Map([['h', { type: 'Standalone' }]]) } } }),
    startSession: async () => assert.fail('no session expected'),
  };

  test('runAtomic: the undo fails -> a record for the named entity, a clean log line, and a CompensationFailedError', async () => {
    await assert.rejects(
      runAtomic(
        async (_s, comp) => {
          comp.push('wallet credit', async () => { throw new Error('wallet unreachable for 9876543210'); });
          throw new Error('ledger down');
        },
        { connection: standalone, description: 'Varisangya verify', reconcile: { entity: 'Varisangya', entityId: ID, tenantId: T1 } }
      ),
      (err: any) => {
        assert.ok(err instanceof CompensationFailedError);
        assert.ok(err instanceof ReconciliationRequiredError);
        assert.equal(err.message, RECONCILIATION_MESSAGE);
        assert.match(err.message, /administrator/i);
        assert.equal(err.statusCode, 500);
        return true;
      }
    );
    assert.equal(store.docs.length, 1);
    const issue = store.docs[0];
    assert.equal(issue.flow, 'Varisangya verify');
    assert.equal(issue.entity, 'Varisangya');
    assert.equal(issue.entityId, ID);
    assert.equal(String(issue.tenantId), String(T1));
    assert.equal(issue.step, 'wallet credit');
    assert.ok(!JSON.stringify(issue).includes('9876543210'));
    assert.ok(!errors.join('\n').includes('9876543210'));
  });

  test('runAtomic: the record says which steps had completed, so an administrator knows what to check', async () => {
    await assert.rejects(
      runAtomic(
        async (_s, comp) => {
          comp.push('payment row', async () => undefined);
          comp.push('wallet credit', async () => { throw new Error('wallet unreachable'); });
          comp.push('ledger posting', async () => undefined);
          throw new Error('status update failed');
        },
        { connection: standalone, description: 'Varisangya create', reconcile: { entity: 'Varisangya', entityId: ID, tenantId: T1 } }
      ),
      (err: any) => err instanceof CompensationFailedError
    );
    const call = store.calls[store.calls.length - 1];
    const state = call.update.$setOnInsert.state;
    assert.equal(state.stepsDone, 'payment row > wallet credit > ledger posting');
    assert.equal(state.undoFailed, 'wallet credit');
    assert.equal(call.filter.step, 'wallet credit');
  });

  test('runAtomic: repeated failures of the same record make one open issue', async () => {
    const attempt = () =>
      runAtomic(
        async (_s, comp) => {
          comp.push('ledger entry', async () => { throw new Error('x'); });
          throw new Error('y');
        },
        { connection: standalone, description: 'zakat delete', reconcile: { entity: 'Zakat', entityId: ID, tenantId: T1 } }
      ).catch(() => undefined);
    for (let i = 0; i < 4; i++) await attempt();
    assert.equal(store.docs.length, 1);
    assert.equal(store.docs[0].occurrences, 4);
  });

  test('a failing write of the record does not change the error the user gets', async () => {
    store.failWith = () => Promise.reject(new Error('db gone'));
    await assert.rejects(
      runAtomic(
        async (_s, comp) => {
          comp.push('a', async () => { throw new Error('x'); });
          throw new Error('y');
        },
        { connection: standalone }
      ),
      (err: any) => err instanceof CompensationFailedError && /administrator/i.test(err.message)
    );
  });

  test('a handler (salary delete) whose compensation fails answers 500 with reconciliationRequired and the review message, and stores the issue', async () => {
    const salaryId = oid();
    const realFindById = (SalaryPayment as any).findById;
    const realDelete = (SalaryPayment as any).findByIdAndDelete;
    const realReverse = (ledgerService as any).reverseLedgerEntry;
    const realPost = (ledgerService as any).postLedgerEntry;
    (SalaryPayment as any).findById = async () => ({ _id: salaryId, tenantId: T1, instituteId: oid(), status: 'paid', netAmount: 100, month: 1, year: 2026, toObject() { return { ...this }; } });
    (SalaryPayment as any).findByIdAndDelete = async () => { throw new Error('delete failed'); };
    (ledgerService as any).reverseLedgerEntry = async () => [];
    (ledgerService as any).postLedgerEntry = async () => { throw new Error('ledger down, phone 9876543210'); };
    try {
      const out: any = { status: 200, body: undefined };
      const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
      await deleteSalaryPayment({ params: { id: String(salaryId) }, query: {}, body: {}, tenantId: String(T1), isSuperAdmin: false, user: { role: 'mahall', _id: oid() } } as any, res);
      assert.equal(out.status, 500);
      assert.equal(out.body.success, false);
      assert.equal(out.body.reconciliationRequired, true);
      assert.equal(out.body.message, RECONCILIATION_MESSAGE);
      assert.match(out.body.message, /administrator review/i);
      assert.equal(store.docs.length, 1);
      assert.equal(store.docs[0].flow, 'salary delete');
      assert.equal(store.docs[0].entity, 'SalaryPayment');
      assert.equal(store.docs[0].entityId, String(salaryId));
      assert.equal(String(store.docs[0].tenantId), String(T1));
      assert.ok(!JSON.stringify(store.docs).includes('9876543210'));
      assert.ok(!errors.join('\n').includes('9876543210'));
    } finally {
      (SalaryPayment as any).findById = realFindById;
      (SalaryPayment as any).findByIdAndDelete = realDelete;
      (ledgerService as any).reverseLedgerEntry = realReverse;
      (ledgerService as any).postLedgerEntry = realPost;
    }
  });

  test('runUndos continues past a failing step, reports each failure and returns the labels', async () => {
    const order: string[] = [];
    const { failed } = await runUndos(
      { flow: 'f', entity: 'e', entityId: ID, tenantId: T1 },
      [
        { label: 'one', undo: async () => { order.push('one'); } },
        { label: 'two', undo: async () => { throw new Error('nope'); } },
        { label: 'three', undo: async () => { order.push('three'); } },
      ],
      new Error('original')
    );
    assert.deepEqual(order, ['one', 'three']);
    assert.deepEqual(failed, ['two']);
    assert.equal(store.docs.length, 1);
    assert.equal(store.docs[0].step, 'two');
    assert.match(store.docs[0].reason, /undo failed \(Error: nope\) after: Error: original/);
  });

  test('sendReconciliationRequired is an error response, never a success', () => {
    const out: any = {};
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
    sendReconciliationRequired(res);
    assert.equal(out.status, 500);
    assert.equal(out.body.success, false);
    assert.equal(out.body.reconciliationRequired, true);
    assert.match(out.body.message, /administrator review/i);
  });
});

describe('static checks over the source', () => {
  const src = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
    });

  test('every place that constructs a CompensationFailedError also reports it through the reconciliation reporter', () => {
    const root = path.resolve(__dirname, '..');
    const sites = walk(root).filter((f) => !f.includes(`${path.sep}tests${path.sep}`) && /new CompensationFailedError\(/.test(fs.readFileSync(f, 'utf8')));
    assert.ok(sites.length >= 1);
    for (const file of sites) {
      const code = fs.readFileSync(file, 'utf8');
      assert.match(code, /reportFailedUndoSteps|reportReconciliationRequired/, `${path.relative(root, file)} throws CompensationFailedError without reporting it`);
      const constructs = (code.match(/new CompensationFailedError\(/g) || []).length;
      const reports = (code.match(/reportFailedUndoSteps\(|reportReconciliationRequired\(/g) || []).length;
      assert.ok(reports >= constructs, `${path.relative(root, file)}: ${constructs} throw site(s) but only ${reports} report call(s)`);
    }
  });

  test('every compensating handler routes a failed undo through the reporter, and the old log-only swallowing is gone', () => {
    for (const file of [
      'controllers/salaryController.ts',
      'controllers/pettyCashController.ts',
      'controllers/welfareController.ts',
      'controllers/qardController.ts',
      'services/ledgerPostingService.ts',
    ]) {
      assert.match(src(file), /utils\/reconciliation'/, `${file} does not use the reconciliation reporter`);
    }
    const swallowed = [
      'Salary ledger cleanup failed',
      'Salary payment cleanup failed',
      'Salary payment restore failed',
      'Salary ledger restore failed',
      'Petty cash cleanup failed',
      'Failed to undo a petty cash replenishment',
      'Failed to give a petty cash amount back',
      'Failed to release a petty cash expense claim',
      'could not be reverted',
      'could not reverse a failed repayment',
      '[ledger] could not remove an entry',
      '[ledger] could not restore an entry',
    ];
    for (const file of ['controllers/salaryController.ts', 'controllers/pettyCashController.ts', 'controllers/welfareController.ts', 'controllers/qardController.ts', 'services/ledgerPostingService.ts']) {
      const code = src(file);
      for (const text of swallowed) assert.ok(!code.includes(text), `${file} still swallows a failed undo: "${text}"`);
    }
  });

  test('the zakat distribution flows tell runAtomic which record they work on', () => {
    const code = src('controllers/zakatDistributionController.ts');
    const calls = (code.match(/runAtomic\(/g) || []).length;
    const named = (code.match(/reconcile:\s*\{/g) || []).length;
    assert.ok(calls >= 3);
    assert.equal(named, calls);
  });
});

describe('list and resolve are admin-only and tenant-scoped', () => {
  let issues: Doc[];
  let original: Record<string, any>;
  before(() => {
    original = {
      find: ReconciliationIssue.find,
      countDocuments: ReconciliationIssue.countDocuments,
      findOneAndUpdate: ReconciliationIssue.findOneAndUpdate,
    };
    const chain = (rows: () => Doc[]) => {
      const state: Doc = {};
      const q: any = {
        sort: () => q,
        skip: (n: number) => ((state.skip = n), q),
        limit: (n: number) => ((state.limit = n), q),
        lean: () => q,
        then: (resolve: any, reject: any) =>
          tick().then(() => rows().slice(state.skip || 0, (state.skip || 0) + (state.limit || 1000))).then(resolve, reject),
      };
      return q;
    };
    (ReconciliationIssue as any).find = (filter: Doc) => chain(() => issues.filter((d) => matches(d, filter)).map((d) => ({ ...d })));
    (ReconciliationIssue as any).countDocuments = async (filter: Doc) => issues.filter((d) => matches(d, filter)).length;
    (ReconciliationIssue as any).findOneAndUpdate = (filter: Doc, update: Doc) => {
      const q: any = {
        lean: () => q,
        then: (resolve: any, reject: any) =>
          tick()
            .then(() => {
              const doc = issues.find((d) => matches(d, filter));
              if (!doc) return null;
              Object.assign(doc, update.$set);
              return { ...doc };
            })
            .then(resolve, reject),
      };
      return q;
    };
  });
  after(() => {
    Object.assign(ReconciliationIssue, original);
  });

  const issue = (tenantId: any, extra: Doc = {}) => ({ _id: oid(), tenantId, flow: 'f', entity: 'e', entityId: ID, step: 's', reason: 'r', status: 'open', occurrences: 1, createdAt: new Date(), ...extra });
  beforeEach(() => {
    issues = [issue(T1), issue(T1), issue(T1, { status: 'resolved' }), issue(T2), issue(null)];
  });

  const send = async (fn: any, req: Doc) => {
    const out: any = { status: 200, body: undefined };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
    await fn({ params: {}, query: {}, body: {}, headers: {}, ...req }, res);
    return out;
  };
  const admin = (tenant: any, extra: Doc = {}) => ({ tenantId: String(tenant), isSuperAdmin: false, user: { role: 'mahall', _id: oid() }, ...extra });
  const superAdmin = (extra: Doc = {}) => ({ isSuperAdmin: true, user: { role: 'super_admin', _id: oid() }, ...extra });

  test('a Mahallu admin lists only their own open issues', async () => {
    const out = await send(listReconciliationIssues, admin(T1));
    assert.equal(out.status, 200);
    assert.equal(out.body.data.length, 2);
    assert.ok(out.body.data.every((d: Doc) => String(d.tenantId) === String(T1) && d.status === 'open'));
    assert.equal(out.body.pagination.total, 2);
  });

  test('?status=resolved / all, and an invalid status is refused', async () => {
    assert.equal((await send(listReconciliationIssues, admin(T1, { query: { status: 'resolved' } }))).body.data.length, 1);
    assert.equal((await send(listReconciliationIssues, admin(T1, { query: { status: 'all' } }))).body.data.length, 3);
    assert.equal((await send(listReconciliationIssues, admin(T1, { query: { status: '$ne' } }))).status, 400);
  });

  test('a Mahallu admin cannot widen the scope with ?tenantId=', async () => {
    const out = await send(listReconciliationIssues, admin(T1, { query: { tenantId: String(T2) } }));
    assert.ok(out.body.data.every((d: Doc) => String(d.tenantId) === String(T1)));
  });

  test('a super admin sees every Mahallu (including issues with no Mahallu), or the one they name', async () => {
    const all = await send(listReconciliationIssues, superAdmin({ query: { status: 'all' } }));
    assert.equal(all.body.data.length, 5);
    const one = await send(listReconciliationIssues, superAdmin({ query: { tenantId: String(T2) } }));
    assert.equal(one.body.data.length, 1);
    assert.equal(String(one.body.data[0].tenantId), String(T2));
    assert.equal((await send(listReconciliationIssues, superAdmin({ query: { tenantId: 'nope' } }))).status, 400);
  });

  test('only administrators: institute, survey and member accounts are refused, and so is an account with no Mahallu', async () => {
    for (const role of ['institute', 'survey', 'member']) {
      const out = await send(listReconciliationIssues, { tenantId: String(T1), isSuperAdmin: false, user: { role, instituteId: String(oid()) } });
      assert.equal(out.status, 403, role);
      const r = await send(resolveReconciliationIssue, { params: { id: String(issues[0]._id) }, body: { note: 'fixed' }, tenantId: String(T1), isSuperAdmin: false, user: { role, instituteId: String(oid()) } });
      assert.equal(r.status, 403, role);
    }
    assert.equal((await send(listReconciliationIssues, { isSuperAdmin: false, user: { role: 'mahall' } })).status, 403);
  });

  test('resolving closes the issue, records who and why, and cannot be repeated', async () => {
    const target = issues[0];
    const adminReq = admin(T1);
    const out = await send(resolveReconciliationIssue, { ...adminReq, params: { id: String(target._id) }, body: { note: 'Corrected the wallet balance by hand' } });
    assert.equal(out.status, 200);
    assert.equal(out.body.data.status, 'resolved');
    assert.equal(out.body.data.note, 'Corrected the wallet balance by hand');
    assert.equal(String(out.body.data.resolvedBy), String(adminReq.user._id));
    assert.ok(out.body.data.resolvedAt instanceof Date);
    assert.equal(issues[0].status, 'resolved');
    const again = await send(resolveReconciliationIssue, { ...adminReq, params: { id: String(target._id) }, body: { note: 'second try' } });
    assert.equal(again.status, 404);
  });

  test("a Mahallu admin cannot resolve another Mahallu's issue (or one with no Mahallu); the record is untouched", async () => {
    for (const foreign of [issues[3], issues[4]]) {
      const out = await send(resolveReconciliationIssue, { ...admin(T1), params: { id: String(foreign._id) }, body: { note: 'not mine' } });
      assert.equal(out.status, 404);
      assert.equal(foreign.status, 'open');
    }
  });

  test('a super admin can resolve any; a note is required; a bad id is not found', async () => {
    const ok = await send(resolveReconciliationIssue, { ...superAdmin(), params: { id: String(issues[3]._id) }, body: { note: 'Done by support' } });
    assert.equal(ok.status, 200);
    for (const body of [{}, { note: '' }, { note: 'ab' }, { note: 'x'.repeat(501) }, { note: { $ne: 1 } }]) {
      const out = await send(resolveReconciliationIssue, { ...admin(T1), params: { id: String(issues[1]._id) }, body });
      assert.equal(out.status, 400, JSON.stringify(body));
    }
    assert.equal(issues[1].status, 'open');
    assert.equal((await send(resolveReconciliationIssue, { ...admin(T1), params: { id: 'not-an-id' }, body: { note: 'abc' } })).status, 404);
  });
});

});
