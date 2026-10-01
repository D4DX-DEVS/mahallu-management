import { test } from 'node:test';
import assert from 'assert/strict';
import jwt from 'jsonwebtoken';
import { verifyOTP } from '../controllers/otpController';
import { selectAccount } from '../controllers/authController';
import OTP from '../models/OTP';
import User from '../models/User';

/**
 * Multi-role LOGIN: a phone number may have several active User documents
 * (one per role). verifyOTP must offer a role-selection step only when more
 * than one ACTIVE account exists for that phone — never for a single
 * account, and never counting an inactive sibling. selectAccount then
 * completes the chosen role, authorized purely by the preAuthToken's own
 * phone claim (never a role/tenantId the client could otherwise supply).
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

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

const stubOtpRecord = () => ({
  code: '123456',
  attempts: 0,
  isUsed: false,
  save: async function (this: any) {},
});

test('verifyOTP: a single active account logs in directly, no role selection', async () => {
  const originalOtpFindOne = OTP.findOne;
  const originalUserFind = User.find;
  const record = stubOtpRecord();
  (OTP as any).findOne = () => ({ sort: async () => record });
  (User as any).find = async () => [
    { _id: 'onlyUserId', phone: '918000000000', status: 'active', role: 'mahall', isSuperAdmin: false, save: async () => {} },
  ];
  (User as any).findById = () => ({ select: async () => ({ _id: 'onlyUserId', phone: '918000000000', role: 'mahall' }) });
  try {
    const { res, out } = makeRes();
    const req: any = { body: { phone: '8000000000', otp: '123456' } };
    await verifyOTP(req, res);

    assert.equal(out.status, 200);
    assert.equal(out.body.success, true);
    assert.equal(out.body.data.requiresRoleSelection, undefined);
    assert.ok(out.body.data.token, 'expected a token for the single-account path');
  } finally {
    (OTP as any).findOne = originalOtpFindOne;
    (User as any).find = originalUserFind;
  }
});

test('verifyOTP: multiple active accounts return requiresRoleSelection with the account list', async () => {
  const originalOtpFindOne = OTP.findOne;
  const originalUserFind = User.find;
  const record = stubOtpRecord();
  (OTP as any).findOne = () => ({ sort: async () => record });
  (User as any).find = async () => [
    { _id: 'mahallUserId', phone: '918000000000', status: 'active', role: 'mahall', tenantId: null, instituteId: null },
    { _id: 'memberUserId', phone: '918000000000', status: 'active', role: 'member', tenantId: null, instituteId: null },
  ];
  try {
    const { res, out } = makeRes();
    const req: any = { body: { phone: '8000000000', otp: '123456' } };
    await verifyOTP(req, res);

    assert.equal(out.status, 200);
    assert.equal(out.body.data.requiresRoleSelection, true);
    assert.ok(out.body.data.preAuthToken);
    const roles = out.body.data.accounts.map((a: any) => a.role).sort();
    assert.deepEqual(roles, ['mahall', 'member']);
  } finally {
    (OTP as any).findOne = originalOtpFindOne;
    (User as any).find = originalUserFind;
  }
});

test('verifyOTP: an inactive sibling is excluded, leaving a single active account (no role selection)', async () => {
  const originalOtpFindOne = OTP.findOne;
  const originalUserFind = User.find;
  const record = stubOtpRecord();
  (OTP as any).findOne = () => ({ sort: async () => record });
  (User as any).find = async () => [
    { _id: 'activeUserId', phone: '918000000000', status: 'active', role: 'mahall', isSuperAdmin: false, save: async () => {} },
    { _id: 'inactiveUserId', phone: '918000000000', status: 'inactive', role: 'member' },
  ];
  (User as any).findById = () => ({ select: async () => ({ _id: 'activeUserId', phone: '918000000000', role: 'mahall' }) });
  try {
    const { res, out } = makeRes();
    const req: any = { body: { phone: '8000000000', otp: '123456' } };
    await verifyOTP(req, res);

    assert.equal(out.status, 200);
    assert.equal(out.body.data.requiresRoleSelection, undefined);
    assert.ok(out.body.data.token);
  } finally {
    (OTP as any).findOne = originalOtpFindOne;
    (User as any).find = originalUserFind;
  }
});

test('verifyOTP: every sibling inactive is rejected rather than offered as a choice', async () => {
  const originalOtpFindOne = OTP.findOne;
  const originalUserFind = User.find;
  const record = stubOtpRecord();
  (OTP as any).findOne = () => ({ sort: async () => record });
  (User as any).find = async () => [
    { _id: 'inactiveUserId', phone: '918000000000', status: 'inactive', role: 'mahall' },
  ];
  try {
    const { res, out } = makeRes();
    const req: any = { body: { phone: '8000000000', otp: '123456' } };
    await verifyOTP(req, res);

    assert.equal(out.status, 403);
    assert.equal(out.body.success, false);
  } finally {
    (OTP as any).findOne = originalOtpFindOne;
    (User as any).find = originalUserFind;
  }
});

test('selectAccount: a valid preAuthToken plus a matching, active account succeeds', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'mahallUserId', phone: '918000000000', status: 'active', role: 'mahall', save: async () => {} }),
  });
  try {
    const preAuthToken = jwt.sign(
      { phone: '918000000000', purpose: 'role_selection' },
      process.env.JWT_SECRET as string,
      { expiresIn: '5m' }
    );
    const { res, out } = makeRes();
    const req: any = { body: { preAuthToken, userId: 'mahallUserId' } };
    await selectAccount(req, res);

    assert.equal(out.status, 200);
    assert.equal(out.body.success, true);
    assert.ok(out.body.data.token);
    assert.equal(out.body.data.user.role, 'mahall');
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('selectAccount: a userId whose phone does not match the preAuthToken is rejected', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'unrelatedUserId', phone: '919999999999', status: 'active', role: 'mahall' }),
  });
  try {
    const preAuthToken = jwt.sign(
      { phone: '918000000000', purpose: 'role_selection' },
      process.env.JWT_SECRET as string,
      { expiresIn: '5m' }
    );
    const { res, out } = makeRes();
    const req: any = { body: { preAuthToken, userId: 'unrelatedUserId' } };
    await selectAccount(req, res);

    assert.equal(out.status, 401);
    assert.equal(out.body.success, false);
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('selectAccount: an inactive target account is rejected even with a matching phone', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'mahallUserId', phone: '918000000000', status: 'inactive', role: 'mahall' }),
  });
  try {
    const preAuthToken = jwt.sign(
      { phone: '918000000000', purpose: 'role_selection' },
      process.env.JWT_SECRET as string,
      { expiresIn: '5m' }
    );
    const { res, out } = makeRes();
    const req: any = { body: { preAuthToken, userId: 'mahallUserId' } };
    await selectAccount(req, res);

    assert.equal(out.status, 403);
    assert.equal(out.body.success, false);
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('selectAccount: a tampered/garbage preAuthToken is rejected', async () => {
  const { res, out } = makeRes();
  const req: any = { body: { preAuthToken: 'not-a-real-token', userId: 'mahallUserId' } };
  await selectAccount(req, res);
  assert.equal(out.status, 401);
  assert.equal(out.body.success, false);
});

test('selectAccount: a token minted for a different purpose (not role_selection) is rejected', async () => {
  const preAuthToken = jwt.sign(
    { phone: '918000000000', purpose: 'something_else' },
    process.env.JWT_SECRET as string,
    { expiresIn: '5m' }
  );
  const { res, out } = makeRes();
  const req: any = { body: { preAuthToken, userId: 'mahallUserId' } };
  await selectAccount(req, res);
  assert.equal(out.status, 401);
  assert.equal(out.body.success, false);
});
