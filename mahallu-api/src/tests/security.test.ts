import { test } from 'node:test';
import assert from 'assert/strict';
import { sensitiveAccess } from '../middleware/sensitiveAccess';
import User from '../models/User';

// Task C5 — denial tests for every sensitive module, plus the 2FA flag.

const SENSITIVE_MODULES = ['counselling', 'maslahat', 'inheritance', 'health', 'welfare'];

/** Minimal req/res doubles — the middleware only touches these fields. */
const run = (req: any) => {
  const out: any = { status: 200, body: null, nextCalled: false };
  const res: any = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: any) {
      out.body = body;
      return res;
    },
  };
  sensitiveAccess((req.__module as string) || 'counselling')(req, res, () => {
    out.nextCalled = true;
  });
  return out;
};

SENSITIVE_MODULES.forEach((mod) => {
  test(`${mod}: denied when the user has no sensitiveModules at all`, () => {
    const out = run({ __module: mod, user: { permissions: { view: true } } });
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 403);
    assert.equal(out.body.success, false);
  });

  test(`${mod}: denied when the user holds a different sensitive module`, () => {
    const other = SENSITIVE_MODULES.find((m) => m !== mod)!;
    const out = run({ __module: mod, user: { permissions: { sensitiveModules: [other] } } });
    assert.equal(out.nextCalled, false);
    assert.equal(out.status, 403);
  });

  test(`${mod}: allowed when explicitly granted`, () => {
    const out = run({ __module: mod, user: { permissions: { sensitiveModules: [mod] } } });
    assert.equal(out.nextCalled, true);
  });

  test(`${mod}: super admin passes`, () => {
    const out = run({ __module: mod, isSuperAdmin: true });
    assert.equal(out.nextCalled, true);
  });
});

test('an unauthenticated request is denied, not crashed', () => {
  const out = run({ __module: 'welfare' });
  assert.equal(out.nextCalled, false);
  assert.equal(out.status, 403);
});

test('sensitiveModules is a closed enum', () => {
  const path: any = User.schema.path('permissions.sensitiveModules');
  assert.deepEqual([...path.caster.enumValues].sort(), [...SENSITIVE_MODULES].sort());
});

test('two-factor is off unless a user opts in', () => {
  const path: any = User.schema.path('twoFactorEnabled');
  assert.ok(path, 'twoFactorEnabled is missing from the User schema');
  assert.equal(path.options.default, false);
});
