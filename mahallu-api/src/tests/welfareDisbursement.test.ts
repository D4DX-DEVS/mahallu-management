import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { WelfareApplication, WelfareScheme } from '../models/Welfare';
import Family from '../models/Family';
import * as ledgerService from '../services/ledgerPostingService';
import {
  createApplication,
  updateApplication,
  updateApplicationStatus,
  deleteApplication,
} from '../controllers/welfareController';
import {
  updateWelfareApplicationStatusValidation,
  updateWelfareApplicationValidation,
} from '../validations/moduleValidation';
import { fakeModel, FakeCollection, callHandler, oid, silenceConsoleError } from './fakeMongo';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] welfareDisbursement', () => {

/**
 * Welfare disbursement: the claim comes before the ledger posting, a posting failure hands the claim
 * back, money is frozen once an application is approved, and `override` is a real boolean.
 */

const TENANT = String(oid());
const FAMILY = oid();

let apps: FakeCollection;
let schemes: FakeCollection;
let families: FakeCollection;
const restorers: Array<() => void> = [];
let restoreConsole: () => void;

type PostCall = Record<string, any>;
let posted: PostCall[] = [];
let postImpl: (params: any) => Promise<void>;
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

// One suite, so the model stubs live only while this file's tests run (the aggregate run shares one process).
describe('Welfare disbursement', () => {
before(() => {
  for (const [Model, assign] of [
    [WelfareApplication, (c: FakeCollection) => (apps = c)],
    [WelfareScheme, (c: FakeCollection) => (schemes = c)],
    [Family, (c: FakeCollection) => (families = c)],
  ] as Array<[any, (c: FakeCollection) => void]>) {
    const f = fakeModel(Model);
    assign(f.collection);
    restorers.push(f.restore);
  }
  const original = (ledgerService as any).postLedgerEntry;
  (ledgerService as any).postLedgerEntry = (params: any) => postImpl(params);
  restorers.push(() => {
    (ledgerService as any).postLedgerEntry = original;
  });
  restoreConsole = silenceConsoleError();
});
after(() => {
  restorers.forEach((restore) => restore());
  restoreConsole();
});

beforeEach(() => {
  for (const c of [apps, schemes, families]) {
    c.rows.length = 0;
    c.log.length = 0;
  }
  families.seed({ _id: FAMILY, tenantId: TENANT, houseName: 'Test house' });
  posted = [];
  postImpl = async (params) => {
    await tick();
    posted.push(params);
  };
});

const seedApp = (extra: Record<string, any> = {}) => {
  const [app] = apps.seed({
    tenantId: TENANT,
    schemeId: oid(),
    familyId: FAMILY,
    requestedAmount: 5000,
    reason: 'original reason',
    priority: 'medium',
    status: 'approved',
    approvedAmount: 5000,
    history: [],
    ...extra,
  });
  return app;
};

const asMahall = (extra: Record<string, any> = {}) => ({
  tenantId: TENANT,
  isSuperAdmin: false,
  user: { role: 'mahall', _id: oid(), id: String(oid()) },
  ...extra,
});

const move = (app: any, body: Record<string, any>, extra: Record<string, any> = {}) =>
  callHandler(updateApplicationStatus as any, asMahall({ params: { id: String(app._id) }, body, ...extra }));
const edit = (app: any, body: Record<string, any>) =>
  callHandler(updateApplication as any, asMahall({ params: { id: String(app._id) }, body }));
const stored = (app: any) => apps.get(app._id)!;

describe('disbursement claims the application before posting', () => {
  test('20 parallel ledger disbursements post the expense once', async () => {
    const app = seedApp();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => move(app, { status: 'disbursed', disbursedVia: 'ledger' }))
    );

    assert.equal(results.filter((r) => r.status === 200).length, 1, 'exactly one request wins the claim');
    results.filter((r) => r.status !== 200).forEach((r) => assert.equal(r.status, 409));
    assert.equal(posted.length, 1, 'the ledger is posted once');
    assert.equal(posted[0].source, 'welfare');
    assert.equal(String(posted[0].sourceId), String(app._id));
    assert.equal(posted[0].amount, 5000);
    assert.equal(posted[0].ledgerType, 'expense');

    const s = stored(app);
    assert.equal(s.status, 'disbursed');
    assert.equal(s.disbursedVia, 'ledger');
    assert.equal(s.history.filter((h: any) => h.status === 'disbursed').length, 1);
  });

  test('the claim is made before the ledger is touched', async () => {
    const app = seedApp();
    let statusWhenPosting: string | undefined;
    postImpl = async () => {
      statusWhenPosting = stored(app).status;
    };
    const result = await move(app, { status: 'disbursed', disbursedVia: 'ledger' });
    assert.equal(result.status, 200);
    assert.equal(statusWhenPosting, 'disbursed', 'the application was already claimed when the entry was posted');
  });

  test('a posting failure hands the claim back: approved again, no disbursement details, no history entry', async () => {
    const app = seedApp();
    postImpl = async () => {
      await tick();
      throw new Error('ledger down');
    };
    const failed = await move(app, { status: 'disbursed', disbursedVia: 'ledger' });
    assert.equal(failed.status, 500);
    assert.match(failed.body.message, /still approved/);

    const s = stored(app);
    assert.equal(s.status, 'approved');
    assert.equal(s.disbursedDate, undefined);
    assert.equal(s.disbursedVia, undefined);
    assert.equal(s.history.some((h: any) => h.status === 'disbursed'), false);
    assert.equal(posted.length, 0, 'nothing was posted');

    // The retry works and posts once.
    postImpl = async (params) => {
      posted.push(params);
    };
    const retry = await move(app, { status: 'disbursed', disbursedVia: 'ledger' });
    assert.equal(retry.status, 200);
    assert.equal(posted.length, 1);
    assert.equal(stored(app).status, 'disbursed');
  });

  test('a cash or bank disbursement posts nothing to the ledger', async () => {
    for (const via of ['cash', 'bank', undefined]) {
      posted = [];
      const app = seedApp();
      const result = await move(app, { status: 'disbursed', ...(via ? { disbursedVia: via } : {}) });
      assert.equal(result.status, 200);
      assert.equal(stored(app).disbursedVia, via ?? 'cash');
      assert.equal(posted.length, 0);
    }
  });

  test('disbursing an application that is not approved is a 409 and posts nothing', async () => {
    for (const status of ['pending', 'verified', 'rejected', 'disbursed', 'closed']) {
      const app = seedApp({ status });
      const result = await move(app, { status: 'disbursed', disbursedVia: 'ledger' });
      assert.equal(result.status, 409, status);
    }
    assert.equal(posted.length, 0);
  });
});

describe('money is frozen once an application is approved', () => {
  test('requestedAmount can be corrected while pending or verified, never after approval', async () => {
    for (const status of ['pending', 'verified']) {
      const app = seedApp({ status, approvedAmount: undefined });
      const ok = await edit(app, { requestedAmount: 6000 });
      assert.equal(ok.status, 200, status);
      assert.equal(stored(app).requestedAmount, 6000);
    }
    for (const status of ['approved', 'disbursed', 'closed', 'rejected']) {
      const app = seedApp({ status });
      const refused = await edit(app, { requestedAmount: 7000 });
      assert.equal(refused.status, 409, status);
      assert.equal(stored(app).requestedAmount, 5000, `${status}: unchanged`);
    }
  });

  test('re-sending the unchanged amount with other edits is fine (the edit form sends everything)', async () => {
    const app = seedApp({ status: 'approved' });
    const result = await edit(app, { requestedAmount: 5000, reason: 'a better reason', priority: 'high' });
    assert.equal(result.status, 200);
    assert.equal(stored(app).reason, 'a better reason');
    assert.equal(stored(app).priority, 'high');
  });

  test('approvedAmount, disbursedDate and disbursedVia cannot be edited through the generic update', async () => {
    for (const status of ['pending', 'approved', 'disbursed']) {
      const app = seedApp({ status, approvedAmount: status === 'pending' ? undefined : 5000 });
      for (const body of [
        { approvedAmount: 9999 },
        { disbursedDate: '2026-01-01' },
        { disbursedVia: 'ledger' },
      ]) {
        const result = await edit(app, body);
        assert.equal(result.status, 409, `${status} ${JSON.stringify(body)}`);
      }
      assert.equal(stored(app).approvedAmount, status === 'pending' ? undefined : 5000);
    }
  });

  test('a generic update can never change the status or the history', async () => {
    const app = seedApp({ status: 'pending', approvedAmount: undefined });
    const result = await edit(app, { status: 'disbursed', history: [{ status: 'disbursed' }], reason: 'x' });
    assert.equal(result.status, 200);
    assert.equal(stored(app).status, 'pending');
    assert.deepEqual(stored(app).history, []);
  });

  test('an edit that races an approval cannot overwrite the approved application', async () => {
    const app = seedApp({ status: 'verified', approvedAmount: undefined });
    const [approved, edited] = await Promise.all([
      move(app, { status: 'approved' }),
      edit(app, { requestedAmount: 100 }),
    ]);
    assert.equal(approved.status, 200);
    const s = stored(app);
    // Whichever way the race went, approval and the amount it was based on agree.
    assert.equal(s.approvedAmount, s.requestedAmount === 100 ? 100 : 5000);
    assert.ok([200, 409].includes(edited.status));
  });

  test('approvedAmount is set only by the approve transition, capped by the requested amount', async () => {
    const app = seedApp({ status: 'verified', approvedAmount: undefined, requestedAmount: 1000 });
    const over = await move(app, { status: 'approved', approvedAmount: 1500 });
    assert.equal(over.status, 400);
    assert.equal(stored(app).status, 'verified');

    const ok = await move(app, { status: 'approved', approvedAmount: 800.5 });
    assert.equal(ok.status, 200);
    assert.equal(stored(app).approvedAmount, 800.5);
    assert.equal(stored(app).status, 'approved');
  });

  test('approving without an amount approves exactly what was requested', async () => {
    const app = seedApp({ status: 'verified', approvedAmount: undefined, requestedAmount: 1234.5 });
    assert.equal((await move(app, { status: 'approved' })).status, 200);
    assert.equal(stored(app).approvedAmount, 1234.5);
  });
});

describe('override must be the boolean true', () => {
  const verified = () => seedApp({ status: 'verified', approvedAmount: undefined, requestedAmount: 1000 });

  test('only a JSON true lets an approval exceed the request', async () => {
    for (const bad of ['false', 'true', 'yes', 1, '1', 0, null, {}, []]) {
      const app = verified();
      const result = await move(app, { status: 'approved', approvedAmount: 2000, override: bad });
      assert.equal(result.status, 400, `override ${JSON.stringify(bad)} must be refused`);
      assert.equal(stored(app).status, 'verified');
    }
    const app = verified();
    const ok = await move(app, { status: 'approved', approvedAmount: 2000, override: true });
    assert.equal(ok.status, 200);
    assert.equal(stored(app).approvedAmount, 2000);
  });

  test('override: false does not bypass the cap', async () => {
    const app = verified();
    const result = await move(app, { status: 'approved', approvedAmount: 2000, override: false });
    assert.equal(result.status, 400);
  });

  test('override never lifts the amount rules: zero, negative, 3 decimals and huge are refused', async () => {
    for (const bad of [0, -1, 10.999, 100_000_001, '1e3', 'abc', true]) {
      const app = verified();
      const result = await move(app, { status: 'approved', approvedAmount: bad, override: true });
      assert.equal(result.status, 400, `approvedAmount ${JSON.stringify(bad)}`);
      assert.equal(stored(app).status, 'verified');
    }
  });

  test('the wire-ready validator refuses a non-boolean override before the controller runs', async () => {
    const run = async (body: Record<string, any>) => {
      const req: any = { body, params: { id: String(oid()) }, query: {}, headers: {} };
      for (const chain of updateWelfareApplicationStatusValidation) await chain.run(req);
      const { validationResult } = await import('express-validator');
      return validationResult(req).array().map((e: any) => e.path);
    };
    assert.deepEqual(await run({ status: 'approved', override: true }), []);
    assert.deepEqual(await run({ status: 'approved', override: false }), []);
    for (const bad of ['false', 'true', 1, 0, 'yes', null]) {
      assert.ok((await run({ status: 'approved', override: bad })).includes('override'), JSON.stringify(bad));
    }
    assert.ok((await run({ status: 'approved', approvedAmount: 0 })).includes('approvedAmount'));
    assert.ok((await run({ status: 'approved', approvedAmount: 1.001 })).includes('approvedAmount'));
    assert.ok((await run({ status: 'disbursed', disbursedVia: 'cheque' })).includes('disbursedVia'));
    assert.ok((await run({ status: 'nope' })).includes('status'));
    assert.ok((await run({ status: 'verified', note: 'x'.repeat(2001) })).includes('note'));
    assert.deepEqual(await run({ status: 'disbursed', disbursedVia: 'ledger', disbursedDate: '2026-01-02' }), []);
  });

  test('the update validator no longer carries approvedAmount (the status endpoint owns it)', async () => {
    const req: any = { body: { approvedAmount: -5 }, params: { id: String(oid()) }, query: {}, headers: {} };
    for (const chain of updateWelfareApplicationValidation) await chain.run(req);
    const { validationResult } = await import('express-validator');
    assert.ok(!validationResult(req).array().some((e: any) => e.path === 'approvedAmount'));
  });
});

describe('status endpoint input, roles and lookups', () => {
  test('400 for bad input, 403 for a non-admin role, 404 for a missing application, 409 for an illegal move', async () => {
    const app = seedApp({ status: 'pending', approvedAmount: undefined });

    assert.equal((await move(app, { status: 'bogus' })).status, 400);
    assert.equal((await move(app, { status: 'verified', note: 'x'.repeat(2001) })).status, 400);
    assert.equal((await move(app, { status: 'disbursed', disbursedVia: 'cheque' })).status, 400);
    assert.equal((await move(app, { status: 'disbursed', disbursedDate: 'not a date' })).status, 409, 'illegal move wins over a later field check');

    const survey = await callHandler(
      updateApplicationStatus as any,
      asMahall({ user: { role: 'survey', _id: oid() }, params: { id: String(app._id) }, body: { status: 'verified' } })
    );
    assert.equal(survey.status, 403);
    assert.equal(stored(app).status, 'pending');

    const missing = await callHandler(
      updateApplicationStatus as any,
      asMahall({ params: { id: String(oid()) }, body: { status: 'verified' } })
    );
    assert.equal(missing.status, 404);

    const foreign = seedApp({ tenantId: String(oid()), status: 'pending' });
    assert.equal((await move(foreign, { status: 'verified' })).status, 404, "another Mahallu's application is invisible");

    assert.equal((await move(app, { status: 'approved' })).status, 409, 'pending cannot jump to approved');
  });

  test('a disbursed application cannot be deleted (409); an approved one can', async () => {
    const disbursed = seedApp({ status: 'disbursed' });
    const result = await callHandler(deleteApplication as any, asMahall({ params: { id: String(disbursed._id) } }));
    assert.equal(result.status, 409);
    assert.ok(apps.get(disbursed._id));

    const approved = seedApp({ status: 'approved' });
    const deleted = await callHandler(deleteApplication as any, asMahall({ params: { id: String(approved._id) } }));
    assert.equal(deleted.status, 200);
    assert.equal(apps.get(approved._id), undefined);
  });
});

describe('creating an application', () => {
  test('a new application is always pending, with no approval or disbursement fields from the body', async () => {
    const scheme = schemes.seed({ tenantId: TENANT, name: 'Scheme' })[0];
    const result = await callHandler(
      createApplication as any,
      asMahall({
        body: {
          schemeId: String(scheme._id),
          familyId: String(FAMILY),
          requestedAmount: 2500,
          reason: 'need',
          status: 'disbursed',
          approvedAmount: 9999,
          disbursedDate: '2026-01-01',
          disbursedVia: 'ledger',
          ledgerItemId: String(oid()),
          history: [{ status: 'disbursed' }],
          tenantId: String(oid()),
        },
      })
    );
    assert.equal(result.status, 201);
    const created = apps.rows[0];
    assert.equal(created.status, 'pending');
    assert.equal(created.approvedAmount, undefined);
    assert.equal(created.disbursedDate, undefined);
    assert.equal(created.disbursedVia, undefined);
    assert.equal(created.ledgerItemId, undefined);
    assert.equal(created.requestedAmount, 2500);
    assert.equal(String(created.tenantId), TENANT);
    assert.equal(created.history.length, 1);
    assert.equal(created.history[0].status, 'pending');
  });
});

void mongoose;

});
});
