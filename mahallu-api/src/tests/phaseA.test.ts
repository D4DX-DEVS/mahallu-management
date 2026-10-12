/**
 * Phase A definition-of-done tests: smoke, tenant isolation, role denial and
 * workflow rejection.
 *
 * Runs on the Node built-in test runner, so the API gets a harness without a
 * new dependency. Every case is pure logic or middleware driven by fake
 * req/res objects - no database, no HTTP server, no fixtures to maintain.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { allowRoles } from '../middleware/authMiddleware';
import { tenantFilter } from '../middleware/tenantMiddleware';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';
import { WELFARE_TRANSITIONS, WELFARE_STATUSES, WelfareStatus } from '../models/Welfare';
import {
  defaultFeaturesFor,
  DEFAULT_FEATURES,
  TENANT_CLASSIFICATIONS,
  MODULE_KEYS,
} from '../config/moduleFeatures';

const TENANT_A = '507f1f77bcf86cd799439011';
const TENANT_B = '507f1f77bcf86cd799439012';
const SOME_REF = '507f1f77bcf86cd799439099';

/** Minimal Express response double: records whatever a guard writes to it. */
const fakeRes = () => {
  const res: any = { statusCode: 0, body: undefined, sent: false };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: any) => {
    res.body = payload;
    res.sent = true;
    return res;
  };
  return res;
};

const runGuard = (guard: any, req: any) => {
  const res = fakeRes();
  let nextCalled = false;
  guard(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
};

/** Stands in for a Mongoose model, matching the findById().select().lean() chain. */
const fakeModel = (doc: any): any => ({
  findById: () => ({ select: () => ({ lean: async () => doc }) }),
});

// --- role denial -----------------------------------------------------------

test('allowRoles denies a role outside the allow-list', () => {
  const { res, nextCalled } = runGuard(allowRoles(['mahall']), { user: { role: 'member' } });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});

test('allowRoles admits a listed role', () => {
  const { res, nextCalled } = runGuard(allowRoles(['mahall', 'survey']), { user: { role: 'survey' } });
  assert.equal(nextCalled, true);
  assert.equal(res.sent, false);
});

test('allowRoles denies a request carrying no user', () => {
  const { res, nextCalled } = runGuard(allowRoles(['mahall']), {});
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('allowRoles lets a super admin past any list', () => {
  const { nextCalled } = runGuard(allowRoles(['institute']), {
    isSuperAdmin: true,
    user: { role: 'super_admin' },
  });
  assert.equal(nextCalled, true);
});

// --- tenant isolation ------------------------------------------------------

test('stripImmutable drops a client-supplied tenantId but keeps real fields', () => {
  const clean = stripImmutable({ name: 'Masjid Fund', balance: 500, tenantId: TENANT_B });
  assert.equal('tenantId' in clean, false);
  assert.equal(clean.name, 'Masjid Fund');
  assert.equal(clean.balance, 500);
});

test('stripImmutable drops every immutable field and leaves the caller body alone', () => {
  const body: Record<string, any> = {
    tenantId: TENANT_B,
    _id: 'x',
    id: 'y',
    createdAt: 1,
    updatedAt: 2,
    __v: 3,
    keep: 'me',
  };
  const clean = stripImmutable(body);
  assert.deepEqual(clean, { keep: 'me' });
  assert.equal(body.tenantId, TENANT_B, 'input body must not be mutated');
});

test('tenantFilter leaves a supplied tenantId in place - the gap stripImmutable closes', () => {
  const req: any = { tenantId: TENANT_A, query: {}, body: { tenantId: TENANT_B } };
  tenantFilter(req, fakeRes(), () => undefined);
  assert.equal(req.body.tenantId, TENANT_B, 'tenantFilter only fills in a missing tenantId');
  assert.equal(stripImmutable(req.body).tenantId, undefined);
});

test('tenantFilter still scopes the query for a non-super-admin', () => {
  const req: any = { tenantId: TENANT_A, query: {}, body: {} };
  tenantFilter(req, fakeRes(), () => undefined);
  assert.equal(req.query.tenantId, TENANT_A);
  assert.equal(req.body.tenantId, TENANT_A);
});

test('refBelongsToTenant rejects a reference owned by another tenant', async () => {
  const model = fakeModel({ tenantId: TENANT_B });
  assert.equal(await refBelongsToTenant(model, SOME_REF, TENANT_A), false);
});

test('refBelongsToTenant accepts a reference in the caller tenant', async () => {
  const model = fakeModel({ tenantId: TENANT_A });
  assert.equal(await refBelongsToTenant(model, SOME_REF, TENANT_A), true);
});

test('refBelongsToTenant rejects a missing document and a malformed id', async () => {
  assert.equal(await refBelongsToTenant(fakeModel(null), SOME_REF, TENANT_A), false);
  assert.equal(await refBelongsToTenant(fakeModel({ tenantId: TENANT_A }), 'not-an-id', TENANT_A), false);
});

test('refBelongsToTenant treats an absent ref as nothing to check', async () => {
  assert.equal(await refBelongsToTenant(fakeModel(null), undefined, TENANT_A), true);
});

test('refBelongsToTenant refuses when the caller has no tenant', async () => {
  assert.equal(await refBelongsToTenant(fakeModel({ tenantId: TENANT_A }), SOME_REF, undefined), false);
});

// --- welfare workflow rejection --------------------------------------------

const canMove = (from: WelfareStatus, to: WelfareStatus) => WELFARE_TRANSITIONS[from].includes(to);

test('welfare workflow permits the documented forward path', () => {
  assert.ok(canMove('pending', 'verified'));
  assert.ok(canMove('verified', 'approved'));
  assert.ok(canMove('approved', 'disbursed'));
  assert.ok(canMove('disbursed', 'closed'));
});

test('welfare workflow refuses skipped stages', () => {
  assert.equal(canMove('pending', 'approved'), false);
  assert.equal(canMove('pending', 'disbursed'), false);
  assert.equal(canMove('verified', 'disbursed'), false);
});

test('welfare workflow allows rejection only before disbursement', () => {
  assert.ok(canMove('pending', 'rejected'));
  assert.ok(canMove('verified', 'rejected'));
  assert.ok(canMove('approved', 'rejected'));
  assert.equal(canMove('disbursed', 'rejected'), false);
});

test('welfare workflow has no way back out of a terminal state', () => {
  assert.deepEqual(WELFARE_TRANSITIONS.rejected, []);
  assert.deepEqual(WELFARE_TRANSITIONS.closed, []);
});

test('welfare workflow defines a transition list for every status', () => {
  WELFARE_STATUSES.forEach((status) => {
    assert.ok(Array.isArray(WELFARE_TRANSITIONS[status]), `missing transitions for ${status}`);
  });
});

// --- module gating smoke ---------------------------------------------------

test('every classification defines every module key', () => {
  TENANT_CLASSIFICATIONS.forEach((classification) => {
    const features = DEFAULT_FEATURES[classification];
    MODULE_KEYS.forEach((key) => {
      assert.equal(typeof features[key], 'boolean', `${classification} is missing ${key}`);
    });
  });
});

test('defaultFeaturesFor falls back to the full feature set', () => {
  assert.deepEqual(defaultFeaturesFor(undefined), DEFAULT_FEATURES.fully_functional);
  assert.deepEqual(defaultFeaturesFor('not-a-classification'), DEFAULT_FEATURES.fully_functional);
});

test('an urban mosque starts without the household survey wings', () => {
  const features = defaultFeaturesFor('urban_mosque');
  assert.equal(features.survey, false);
  assert.equal(features.welfare, false);
  assert.equal(features.finance, true);
});

test('a musalla starts minimal', () => {
  const features = defaultFeaturesFor('musalla');
  assert.equal(features.members, true);
  assert.equal(features.mosque, true);
  assert.equal(features.survey, false);
  assert.equal(features.registers, false);
});
