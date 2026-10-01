import { test } from 'node:test';
import assert from 'assert/strict';
import { validationResult } from 'express-validator';
import { switchAccountValidation } from '../validations/authValidation';
import { getAvailableAccounts, switchAccount } from '../controllers/authController';
import User from '../models/User';

/**
 * Account switching's entire security guarantee is: the target account must
 * share the CURRENT authenticated user's own phone number, and role/tenantId/
 * instituteId are never read from the request body. These tests stub the
 * Mongoose model calls directly (no live database, matching this project's
 * existing test style) so that guarantee is exercised as real handler
 * behaviour, not just read off the source.
 */

const runChain = async (chains: any[], req: any): Promise<string[]> => {
  req.body = req.body ?? {};
  for (const chain of chains) await chain.run(req);
  return validationResult(req).array().map((e: any) => e.msg);
};

const makeRes = () => {
  const out: any = { status: 200, body: null };
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
  return { res, out };
};

test('switchAccountValidation rejects a non-ObjectId targetUserId', async () => {
  const errors = await runChain(switchAccountValidation, { body: { targetUserId: 'not-an-id' } });
  assert.ok(errors.length > 0);
});

test('switchAccountValidation accepts a valid ObjectId targetUserId', async () => {
  const errors = await runChain(switchAccountValidation, { body: { targetUserId: '507f1f77bcf86cd799439011' } });
  assert.equal(errors.length, 0);
});

test('getAvailableAccounts: unauthenticated request is denied, not crashed', async () => {
  const { res, out } = makeRes();
  await getAvailableAccounts({ user: undefined } as any, res);
  assert.equal(out.status, 401);
  assert.equal(out.body.success, false);
});

test('getAvailableAccounts: queries only active accounts for the caller\'s own phone, marks isCurrent', async () => {
  const originalFind = User.find;
  let capturedQuery: any = null;
  (User as any).find = async (query: any) => {
    capturedQuery = query;
    return [
      { _id: 'callerId', phone: '8000000000', role: 'super_admin', name: 'Caller', tenantId: null, instituteId: null },
      { _id: 'siblingId', phone: '918000000000', role: 'mahall', name: 'Sibling', tenantId: null, instituteId: null },
    ];
  };
  try {
    const { res, out } = makeRes();
    const req: any = { user: { _id: 'callerId', phone: '8000000000' } };
    await getAvailableAccounts(req, res);

    assert.equal(capturedQuery.status, 'active');
    assert.ok(Array.isArray(capturedQuery.phone.$in));

    assert.equal(out.body.success, true);
    const accounts = out.body.data.accounts;
    assert.equal(accounts.length, 2);
    assert.equal(accounts.find((a: any) => a.userId === 'callerId').isCurrent, true);
    assert.equal(accounts.find((a: any) => a.userId === 'siblingId').isCurrent, false);
  } finally {
    (User as any).find = originalFind;
  }
});

test('switchAccount: rejects a target whose phone does not match the caller (unrelated account)', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'unrelatedId', phone: '9111111111', status: 'active' }),
  });
  try {
    process.env.JWT_SECRET = 'test-secret';
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'callerId', phone: '8000000000' },
      body: { targetUserId: '507f1f77bcf86cd799439011' },
    };
    await switchAccount(req, res);
    assert.equal(out.status, 403);
    assert.equal(out.body.success, false);
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('switchAccount: rejects an inactive target even when the phone matches', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'siblingId', phone: '918000000000', status: 'inactive' }),
  });
  try {
    process.env.JWT_SECRET = 'test-secret';
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'callerId', phone: '8000000000' },
      body: { targetUserId: '507f1f77bcf86cd799439011' },
    };
    await switchAccount(req, res);
    assert.equal(out.status, 403);
    assert.equal(out.body.success, false);
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('switchAccount: target not found is rejected', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({ select: async () => null });
  try {
    process.env.JWT_SECRET = 'test-secret';
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'callerId', phone: '8000000000' },
      body: { targetUserId: '507f1f77bcf86cd799439011' },
    };
    await switchAccount(req, res);
    assert.equal(out.status, 404);
    assert.equal(out.body.success, false);
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('switchAccount: successful switch mints a token for the TARGET account, ignoring role/tenantId/instituteId sent in the body', async () => {
  const originalFindById = User.findById;
  const targetDoc: any = {
    _id: 'siblingId',
    phone: '918000000000',
    status: 'active',
    role: 'mahall',
    tenantId: 'realTenantId',
    instituteId: null,
    isSuperAdmin: false,
    save: async () => {},
  };
  (User as any).findById = () => ({ select: async () => targetDoc });
  try {
    process.env.JWT_SECRET = 'test-secret';
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'callerId', phone: '8000000000' },
      // A caller could send these, but the handler must never read them.
      body: {
        targetUserId: '507f1f77bcf86cd799439011',
        role: 'super_admin',
        tenantId: 'attackerSuppliedTenantId',
        instituteId: 'attackerSuppliedInstituteId',
      },
    };
    await switchAccount(req, res);

    assert.equal(out.status, 200);
    assert.equal(out.body.success, true);
    assert.ok(out.body.data.token, 'expected a token in the response');
    assert.equal(out.body.data.user.role, 'mahall');
    assert.equal(out.body.data.user.tenantId, 'realTenantId');
    assert.notEqual(out.body.data.user.role, 'super_admin');
    assert.notEqual(out.body.data.user.tenantId, 'attackerSuppliedTenantId');
  } finally {
    (User as any).findById = originalFindById;
  }
});
