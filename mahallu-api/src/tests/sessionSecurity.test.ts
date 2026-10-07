import { test } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/authMiddleware';
import { logout, changePassword, login } from '../controllers/authController';
import { verifyOTP, sendOTP } from '../controllers/otpController';
import { createUser } from '../controllers/userController';
import User from '../models/User';
import Tenant from '../models/Tenant';
import OTP from '../models/OTP';
import { invalidateTenantStatus } from '../services/tenantStatusService';
import { verifyAndConsumeOtp } from '../services/otpService';
import { randomUnusablePasswordHash } from '../utils/credentials';
import { isDevelopmentEnvironment } from '../utils/env';
import { canonicalPhone, samePhone, maskPhone } from '../utils/phone';
import * as dxing from '../services/dxingService';

/**
 * Session security: token revocation, tenant suspension, fail-closed OTP behaviour, atomic OTP
 * attempt limiting, and the removal of the shared default password. Models are stubbed directly
 * (no database), in this project's usual style.
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

const runAuth = async (token: string) => {
  const { res, out } = makeRes();
  const req: any = { headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/families' };
  let nextCalled = false;
  await authMiddleware(req, res, () => {
    nextCalled = true;
  });
  return { req, out, nextCalled };
};

const sign = (claims: Record<string, unknown>) => jwt.sign(claims, process.env.JWT_SECRET as string, { expiresIn: '5m' });

/** Stub User.findById (as used by authMiddleware) and Tenant.findById; always restored. */
const withAccount = async (
  user: Record<string, unknown>,
  tenantStatus: string | null,
  fn: (counters: { tenantLookups: number }) => Promise<void>
) => {
  const originalUser = User.findById;
  const originalTenant = Tenant.findById;
  const counters = { tenantLookups: 0 };
  invalidateTenantStatus();
  (User as any).findById = () => ({ select: async () => user });
  (Tenant as any).findById = () => ({
    select: async () => {
      counters.tenantLookups += 1;
      return tenantStatus === null ? null : { status: tenantStatus };
    },
  });
  try {
    await fn(counters);
  } finally {
    (User as any).findById = originalUser;
    (Tenant as any).findById = originalTenant;
    invalidateTenantStatus();
  }
};

const mahallAdmin = { _id: 'adminId', isSuperAdmin: false, status: 'active', role: 'mahall', tenantId: 'tenantA' };

// ───────────────────────────── token revocation ─────────────────────────────

test('REVOCATION: a token issued before the account\'s tokenVersion moved on is rejected', async () => {
  await withAccount({ ...mahallAdmin, tokenVersion: 4 }, 'active', async () => {
    const stale = await runAuth(sign({ userId: 'adminId', tv: 3 }));
    assert.equal(stale.nextCalled, false);
    assert.equal(stale.out.status, 401);

    const fresh = await runAuth(sign({ userId: 'adminId', tv: 4 }));
    assert.equal(fresh.nextCalled, true);
  });
});

test('REVOCATION: tokens minted before the field existed (no tv) keep working until the first security event', async () => {
  await withAccount({ ...mahallAdmin }, 'active', async () => {
    const legacy = await runAuth(sign({ userId: 'adminId' }));
    assert.equal(legacy.nextCalled, true);
  });
  await withAccount({ ...mahallAdmin, tokenVersion: 1 }, 'active', async () => {
    const legacyAfterEvent = await runAuth(sign({ userId: 'adminId' }));
    assert.equal(legacyAfterEvent.nextCalled, false);
    assert.equal(legacyAfterEvent.out.status, 401);
  });
});

test('REVOCATION: logout bumps the account\'s tokenVersion; a View-As session does not sign the real super admin out', async () => {
  const original = User.findByIdAndUpdate;
  const calls: any[] = [];
  (User as any).findByIdAndUpdate = async (id: any, update: any) => {
    calls.push({ id, update });
    return {};
  };
  try {
    const normal = makeRes();
    await logout({ user: { _id: 'adminId' } } as any, normal.res);
    assert.equal(normal.out.status, 200);
    assert.deepEqual(calls, [{ id: 'adminId', update: { $inc: { tokenVersion: 1 } } }]);

    calls.length = 0;
    const viewAs = makeRes();
    await logout({ user: { _id: 'superId' }, impersonation: { isImpersonating: true } } as any, viewAs.res);
    assert.equal(viewAs.out.status, 200);
    assert.deepEqual(calls, [], 'impersonation logout must not bump the real super admin\'s version');
  } finally {
    (User as any).findByIdAndUpdate = original;
  }
});

test('REVOCATION: changing the password ends other sessions and hands the caller a token at the new version', async () => {
  const original = User.findById;
  const hash = await bcrypt.hash('old-password-1', 4);
  const doc: any = { _id: 'adminId', password: hash, tokenVersion: 2, isSuperAdmin: false, save: async function () {} };
  (User as any).findById = () => ({ select: async () => doc });
  try {
    const { res, out } = makeRes();
    await changePassword({ user: { _id: 'adminId' }, provenPhone: '918000000000', body: { currentPassword: 'old-password-1', newPassword: 'brand-new-pass-2' } } as any, res);
    assert.equal(out.status, 200);
    assert.equal(doc.tokenVersion, 3);
    assert.ok(await bcrypt.compare('brand-new-pass-2', doc.password));
    const claims: any = jwt.verify(out.body.data.token, process.env.JWT_SECRET as string);
    assert.equal(claims.tv, 3);
    assert.equal(claims.pp, '918000000000', 'the caller keeps their proven phone');
  } finally {
    (User as any).findById = original;
  }
});

test('REVOCATION: a wrong current password changes nothing', async () => {
  const original = User.findById;
  const hash = await bcrypt.hash('old-password-1', 4);
  const doc: any = { _id: 'adminId', password: hash, tokenVersion: 2, save: async () => { throw new Error('must not save'); } };
  (User as any).findById = () => ({ select: async () => doc });
  try {
    const { res, out } = makeRes();
    await changePassword({ user: { _id: 'adminId' }, body: { currentPassword: 'nope', newPassword: 'brand-new-pass-2' } } as any, res);
    assert.equal(out.status, 401);
    assert.equal(doc.tokenVersion, 2);
  } finally {
    (User as any).findById = original;
  }
});

// ───────────────────────────── tenant suspension ─────────────────────────────

test('SUSPENSION: a suspended Mahallu\'s users are blocked on every request', async () => {
  await withAccount({ ...mahallAdmin }, 'suspended', async () => {
    const r = await runAuth(sign({ userId: 'adminId' }));
    assert.equal(r.nextCalled, false);
    assert.equal(r.out.status, 403);
    assert.equal(r.out.body.code, 'TENANT_SUSPENDED');
  });
});

test('SUSPENSION: an inactive or missing Mahallu is blocked too; an active one is not', async () => {
  await withAccount({ ...mahallAdmin }, 'inactive', async () => {
    assert.equal((await runAuth(sign({ userId: 'adminId' }))).out.status, 403);
  });
  await withAccount({ ...mahallAdmin }, null, async () => {
    assert.equal((await runAuth(sign({ userId: 'adminId' }))).out.status, 403);
  });
  await withAccount({ ...mahallAdmin }, 'active', async () => {
    assert.equal((await runAuth(sign({ userId: 'adminId' }))).nextCalled, true);
  });
});

test('SUSPENSION: a Super Admin is platform staff and is never blocked by a tenant\'s status', async () => {
  await withAccount({ _id: 'superId', isSuperAdmin: true, status: 'active', role: 'super_admin', tenantId: null }, 'suspended', async (c) => {
    const r = await runAuth(sign({ userId: 'superId' }));
    assert.equal(r.nextCalled, true);
    assert.equal(c.tenantLookups, 0);
  });
});

test('SUSPENSION: the status is cached briefly, and suspending invalidates the cache immediately', async () => {
  const originalUser = User.findById;
  const originalTenant = Tenant.findById;
  let status = 'active';
  let lookups = 0;
  invalidateTenantStatus();
  (User as any).findById = () => ({ select: async () => ({ ...mahallAdmin }) });
  (Tenant as any).findById = () => ({ select: async () => { lookups += 1; return { status }; } });
  try {
    assert.equal((await runAuth(sign({ userId: 'adminId' }))).nextCalled, true);
    assert.equal((await runAuth(sign({ userId: 'adminId' }))).nextCalled, true);
    assert.equal(lookups, 1, 'second request is served from the cache');

    status = 'suspended';
    assert.equal((await runAuth(sign({ userId: 'adminId' }))).nextCalled, true, 'still cached until invalidated');
    invalidateTenantStatus('tenantA'); // what suspendTenant() does
    assert.equal((await runAuth(sign({ userId: 'adminId' }))).out.status, 403);
  } finally {
    (User as any).findById = originalUser;
    (Tenant as any).findById = originalTenant;
    invalidateTenantStatus();
  }
});

test('SUSPENSION: password sign-in is refused for a suspended Mahallu', async () => {
  const originalFindOne = User.findOne;
  const originalTenant = Tenant.findById;
  invalidateTenantStatus();
  const hash = await bcrypt.hash('some-password-1', 4);
  (User as any).findOne = () => ({
    select: async () => ({ _id: 'adminId', phone: '918000000000', password: hash, status: 'active', role: 'mahall', tenantId: 'tenantA', isSuperAdmin: false, twoFactorEnabled: false, save: async () => {} }),
  });
  (Tenant as any).findById = () => ({ select: async () => ({ status: 'suspended' }) });
  try {
    const { res, out } = makeRes();
    await login({ body: { phone: '8000000000', password: 'some-password-1' } } as any, res);
    assert.equal(out.status, 403);
    assert.equal(out.body.code, 'TENANT_SUSPENDED');
    assert.equal(out.body.data, undefined);
  } finally {
    (User as any).findOne = originalFindOne;
    (Tenant as any).findById = originalTenant;
    invalidateTenantStatus();
  }
});

test('PASSWORD SESSIONS carry no proven phone (they cannot be used to switch accounts)', async () => {
  const originalFindOne = User.findOne;
  const originalFindById = User.findById;
  const hash = await bcrypt.hash('some-password-1', 4);
  (User as any).findOne = () => ({
    select: async () => ({ _id: 'adminId', phone: '918000000000', password: hash, status: 'active', role: 'mahall', tenantId: null, isSuperAdmin: false, twoFactorEnabled: false, tokenVersion: 5, save: async () => {} }),
  });
  (User as any).findById = () => ({ select: async () => ({ _id: 'adminId' }) });
  try {
    const { res, out } = makeRes();
    await login({ body: { phone: '8000000000', password: 'some-password-1' } } as any, res);
    assert.equal(out.status, 200);
    const claims: any = jwt.verify(out.body.data.token, process.env.JWT_SECRET as string);
    assert.equal(claims.pp, undefined);
    assert.equal(claims.tv, 5);
  } finally {
    (User as any).findOne = originalFindOne;
    (User as any).findById = originalFindById;
  }
});

// ───────────────────────────── OTP: fail closed, no logging, atomic attempts ─────────────────────────────

/** Capture everything written to console while `fn` runs. */
const captureConsole = async (fn: () => Promise<void>): Promise<string> => {
  const lines: string[] = [];
  const originals = { info: console.info, error: console.error, warn: console.warn, log: console.log };
  const grab = (...args: unknown[]) => lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  console.info = grab;
  console.error = grab;
  console.warn = grab;
  console.log = grab;
  try {
    await fn();
  } finally {
    Object.assign(console, originals);
  }
  return lines.join('\n');
};

const PROVIDER_CODE = '654321';

const runSendOtp = async (nodeEnv: string | undefined) => {
  const saved = {
    env: process.env.NODE_ENV,
    find: User.find,
    otpFindOne: OTP.findOne,
    updateMany: OTP.updateMany,
    save: OTP.prototype.save,
    send: (dxing as any).sendWhatsAppMessage,
  };
  let providerCalls = 0;
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  (User as any).find = async () => [{ _id: 'u1', status: 'active', phone: '919000000001', role: 'mahall' }];
  (OTP as any).findOne = async () => null;
  (OTP as any).updateMany = async () => ({});
  (OTP.prototype as any).save = async function () {
    return this;
  };
  (dxing as any).sendWhatsAppMessage = async () => {
    providerCalls += 1;
    return { status: 200, data: { otp: Number(PROVIDER_CODE), messageId: 'm-1' } };
  };
  const { res, out } = makeRes();
  let logs = '';
  try {
    logs = await captureConsole(async () => {
      await sendOTP({ body: { phone: '9000000001' } } as any, res);
    });
  } finally {
    if (saved.env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved.env;
    (User as any).find = saved.find;
    (OTP as any).findOne = saved.otpFindOne;
    (OTP as any).updateMany = saved.updateMany;
    (OTP.prototype as any).save = saved.save;
    (dxing as any).sendWhatsAppMessage = saved.send;
  }
  return { out, logs, providerCalls };
};

test('OTP FAIL-CLOSED: production-like or unrecognised NODE_ENV values never return or log the OTP', async () => {
  for (const env of ['production', 'Production', 'PRODUCTION', 'prod', 'staging', 'live', 'dev', 'production ', '', undefined]) {
    const { out, logs, providerCalls } = await runSendOtp(env);
    assert.equal(out.status, 200, `NODE_ENV=${JSON.stringify(env)}`);
    assert.equal(out.body.otp, undefined, `NODE_ENV=${JSON.stringify(env)} must not echo the OTP`);
    assert.equal(providerCalls, 1, `NODE_ENV=${JSON.stringify(env)} must send through the provider`);
    assert.ok(!logs.includes(PROVIDER_CODE), `NODE_ENV=${JSON.stringify(env)} must not log the OTP`);
    assert.ok(!logs.includes('9000000001'), 'phone numbers are masked in logs');
  }
});

test('OTP in an explicit development environment is returned in the response but still never logged', async () => {
  for (const env of ['development', 'test']) {
    const { out, logs, providerCalls } = await runSendOtp(env);
    assert.equal(out.status, 200);
    assert.match(String(out.body.otp), /^\d{6}$/);
    assert.equal(providerCalls, 0, 'development generates the code locally');
    assert.ok(!logs.includes(String(out.body.otp)), 'the development OTP is not written to the log');
  }
});

test('isDevelopmentEnvironment is an exact allow-list', () => {
  const saved = process.env.NODE_ENV;
  try {
    const expectations: Array<[string | undefined, boolean]> = [
      ['development', true], ['test', true], ['production', false], ['Development', false], ['dev', false],
      ['staging', false], ['', false], [undefined, false], [' development', false],
    ];
    for (const [value, expected] of expectations) {
      if (value === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = value;
      assert.equal(isDevelopmentEnvironment(), expected, `NODE_ENV=${JSON.stringify(value)}`);
    }
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
});

test('LOG HYGIENE: the OTP and DXING code paths contain no statement that logs codes, secrets or raw provider bodies', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const dxingSrc = read('services/dxingService.ts');
  assert.ok(!/otp:\s*response\.data/.test(dxingSrc), 'DXING success log must not include the code');
  assert.ok(!/dataPreview/.test(dxingSrc), 'response previews contain the code');
  assert.ok(!/secretSuffix|secretPrefix/.test(dxingSrc), 'no secret fragments in logs');
  assert.ok(!/config:\s*error\.config/.test(dxingSrc), 'error.config carries the request body (secret + message)');
  assert.ok(!/responseData:\s*error/.test(dxingSrc), 'provider error bodies are not logged');
  assert.ok(!/fullResponse|Full Response/.test(dxingSrc.replace(/Response shape/g, '')), 'no full-response dumps');
  const otpSrc = read('controllers/otpController.ts');
  assert.ok(!/OTP=\$\{otpCode\}/.test(otpSrc), 'the development OTP must not be logged');
  assert.ok(!/JSON\.stringify\(deliveryResult\)/.test(otpSrc), 'the provider response must not be embedded in an error');
  assert.ok(!/Math\.random/.test(otpSrc), 'OTPs come from a CSPRNG');
});

/** A tiny in-memory OTP collection that honours the conditional updates otpService relies on. */
const installFakeOtpStore = (record: any) => {
  const original = { findOne: OTP.findOne, findOneAndUpdate: OTP.findOneAndUpdate };
  (OTP as any).findOne = () => ({ sort: () => ({ select: async () => (record.isUsed ? null : record) }) });
  (OTP as any).findOneAndUpdate = async (filter: any, update: any) => {
    if (filter.isUsed === false && record.isUsed) return null;
    if (update.$inc) {
      const limit = filter.attempts?.$lt;
      if (limit !== undefined && !(record.attempts < limit)) return null;
      record.attempts += 1;
      return { ...record };
    }
    if (update.isUsed) {
      record.isUsed = true;
      return { ...record };
    }
    return record;
  };
  return () => Object.assign(OTP, original);
};

test('OTP ATTEMPTS: a code locks after five wrong guesses even when the right code arrives afterwards', async () => {
  const record = { _id: 'o1', code: '111111', attempts: 0, isUsed: false };
  const restore = installFakeOtpStore(record);
  try {
    const results: string[] = [];
    for (let i = 0; i < 5; i++) results.push(await verifyAndConsumeOtp('919000000001', '000000'));
    assert.deepEqual(results, ['invalid', 'invalid', 'invalid', 'invalid', 'locked']);
    assert.equal(await verifyAndConsumeOtp('919000000001', '111111'), 'locked', 'the correct code no longer works once locked');
  } finally {
    restore();
  }
});

test('OTP ATTEMPTS: a burst of parallel guesses can never exceed the attempt limit', async () => {
  const record = { _id: 'o1', code: '111111', attempts: 0, isUsed: false };
  const restore = installFakeOtpStore(record);
  try {
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => verifyAndConsumeOtp('919000000001', String(100000 + i))));
    assert.ok(record.attempts <= 5, `attempts=${record.attempts}`);
    assert.equal(results.filter((r) => r === 'invalid' || r === 'locked').length, 50);
  } finally {
    restore();
  }
});

test('OTP ATTEMPTS: a correct code is accepted exactly once, even under parallel use', async () => {
  const record = { _id: 'o1', code: '111111', attempts: 0, isUsed: false };
  const restore = installFakeOtpStore(record);
  try {
    const results = await Promise.all(Array.from({ length: 10 }, () => verifyAndConsumeOtp('919000000001', '111111')));
    assert.equal(results.filter((r) => r === 'ok').length, 1);
  } finally {
    restore();
  }
});

test('OTP ATTEMPTS: no matching code, non-string input and wrong-length input are all plain failures', async () => {
  const record = { _id: 'o1', code: '111111', attempts: 0, isUsed: false };
  const restore = installFakeOtpStore(record);
  try {
    assert.equal(await verifyAndConsumeOtp('919000000001', undefined), 'invalid');
    assert.equal(await verifyAndConsumeOtp('919000000001', 111111), 'invalid');
    assert.equal(await verifyAndConsumeOtp('919000000001', '11111'), 'invalid');
    assert.equal(await verifyAndConsumeOtp('919000000001', '111111'), 'ok');
    assert.equal(await verifyAndConsumeOtp('919000000001', '111111'), 'none', 'a used code is gone');
  } finally {
    restore();
  }
});

test('verifyOTP: a successful single-account sign-in carries the OTP-proven phone and the account\'s token version', async () => {
  const saved = { find: User.find, findById: User.findById, store: installFakeOtpStore({ _id: 'o1', code: '111111', attempts: 0, isUsed: false }) };
  invalidateTenantStatus();
  (User as any).find = async () => [{ _id: 'u1', phone: '919000000001', status: 'active', role: 'mahall', tenantId: null, isSuperAdmin: false, tokenVersion: 7, save: async () => {} }];
  (User as any).findById = () => ({ select: async () => ({ _id: 'u1', role: 'mahall' }) });
  try {
    const { res, out } = makeRes();
    await verifyOTP({ body: { phone: '9000000001', otp: '111111' } } as any, res);
    assert.equal(out.status, 200);
    const claims: any = jwt.verify(out.body.data.token, process.env.JWT_SECRET as string);
    assert.equal(claims.userId, 'u1');
    assert.equal(claims.tv, 7);
    assert.equal(claims.pp, '919000000001');
  } finally {
    saved.store();
    (User as any).find = saved.find;
    (User as any).findById = saved.findById;
  }
});

test('verifyOTP: a wrong code is a 401 and a locked code is a 429, never a token', async () => {
  const record = { _id: 'o1', code: '111111', attempts: 0, isUsed: false };
  const restore = installFakeOtpStore(record);
  try {
    for (let i = 0; i < 4; i++) {
      const { res, out } = makeRes();
      await verifyOTP({ body: { phone: '9000000001', otp: '000000' } } as any, res);
      assert.equal(out.status, 401);
      assert.equal(out.body.data, undefined);
    }
    const { res, out } = makeRes();
    await verifyOTP({ body: { phone: '9000000001', otp: '000000' } } as any, res);
    assert.equal(out.status, 429);
  } finally {
    restore();
  }
});

test('verifyOTP: a suspended Mahallu cannot sign in', async () => {
  const saved = { find: User.find, tenant: Tenant.findById, store: installFakeOtpStore({ _id: 'o1', code: '111111', attempts: 0, isUsed: false }) };
  invalidateTenantStatus();
  (User as any).find = async () => [{ _id: 'u1', phone: '919000000001', status: 'active', role: 'mahall', tenantId: 'tenantA', isSuperAdmin: false, save: async () => {} }];
  (Tenant as any).findById = () => ({ select: async () => ({ status: 'suspended' }) });
  try {
    const { res, out } = makeRes();
    await verifyOTP({ body: { phone: '9000000001', otp: '111111' } } as any, res);
    assert.equal(out.status, 403);
    assert.equal(out.body.code, 'TENANT_SUSPENDED');
    assert.equal(out.body.data, undefined);
  } finally {
    saved.store();
    (User as any).find = saved.find;
    (Tenant as any).findById = saved.tenant;
    invalidateTenantStatus();
  }
});

// ───────────────────────────── default passwords ─────────────────────────────

test('DEFAULT PASSWORD: generated credentials are unique and match no guessable value', async () => {
  const a = await randomUnusablePasswordHash();
  const b = await randomUnusablePasswordHash();
  assert.notEqual(a, b);
  for (const guess of ['123456', 'admin123', 'password', '000000', '']) {
    assert.equal(await bcrypt.compare(guess, a), false, `must not match ${JSON.stringify(guess)}`);
  }
});

test('DEFAULT PASSWORD: an admin-created account without a password does not get 123456, and nothing secret is returned', async () => {
  const saved = { findOne: User.findOne, findById: User.findById, save: User.prototype.save };
  let storedHash = '';
  (User as any).findOne = async () => null;
  (User.prototype as any).save = async function (this: any) {
    storedHash = this.password;
    return this;
  };
  const chain: any = { select: () => chain, populate: () => chain, then: (resolve: any) => resolve({ _id: 'new', name: 'Staff', role: 'survey' }) };
  (User as any).findById = () => chain;
  try {
    const { res, out } = makeRes();
    await createUser({ isSuperAdmin: false, tenantId: 'tenantA', body: { name: 'Staff', phone: '9000000099', role: 'survey' } } as any, res);
    assert.equal(out.status, 201);
    assert.ok(storedHash.startsWith('$2'), 'a bcrypt hash is stored');
    assert.equal(await bcrypt.compare('123456', storedHash), false);
    assert.ok(!JSON.stringify(out.body).includes(storedHash));
    assert.equal(JSON.stringify(out.body).includes('password'), false);
  } finally {
    (User as any).findOne = saved.findOne;
    (User as any).findById = saved.findById;
    (User.prototype as any).save = saved.save;
  }
});

test('DEFAULT PASSWORD: an explicitly chosen password is still honoured', async () => {
  const saved = { findOne: User.findOne, findById: User.findById, save: User.prototype.save };
  let storedHash = '';
  (User as any).findOne = async () => null;
  (User.prototype as any).save = async function (this: any) {
    storedHash = this.password;
    return this;
  };
  const chain: any = { select: () => chain, populate: () => chain, then: (resolve: any) => resolve({ _id: 'new' }) };
  (User as any).findById = () => chain;
  try {
    const { res } = makeRes();
    await createUser({ isSuperAdmin: false, tenantId: 'tenantA', body: { name: 'Staff', phone: '9000000099', role: 'survey', password: 'chosen-password-9' } } as any, res);
    assert.equal(await bcrypt.compare('chosen-password-9', storedHash), true);
  } finally {
    (User as any).findOne = saved.findOne;
    (User as any).findById = saved.findById;
    (User.prototype as any).save = saved.save;
  }
});

test('DEFAULT PASSWORD: no non-script code path still hashes the shared default or reads DEFAULT_MEMBER_PASSWORD', () => {
  const root = path.join(__dirname, '..');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['tests', 'scripts', 'config'].includes(entry.name)) continue;
        walk(full);
      } else if (entry.name.endsWith('.ts')) {
        const text = fs.readFileSync(full, 'utf8');
        if (/DEFAULT_MEMBER_PASSWORD/.test(text) || /bcrypt\.hash\(\s*[^,)]*\|\|\s*'/.test(text)) offenders.push(path.relative(root, full));
      }
    }
  };
  walk(root);
  // controllers/otpController.ts still contains the intentionally retained App Store review account
  // (a separate, explicitly out-of-scope item); it hashes a literal rather than using a fallback.
  assert.deepEqual(offenders, []);
});

// ───────────────────────────── phone helpers ─────────────────────────────

test('phone helpers compare numbers regardless of format and mask them for logs', () => {
  assert.equal(canonicalPhone('+91 98765 43210'), '9876543210');
  assert.ok(samePhone('9876543210', '+919876543210'));
  assert.ok(samePhone('919876543210', '9876543210'));
  assert.ok(!samePhone('9876543210', '9876543211'));
  assert.ok(!samePhone('', ''));
  assert.ok(!samePhone('123', '123'), 'too short to identify anyone');
  const masked = maskPhone('919876543210');
  assert.ok(!masked.includes('987654'));
  assert.equal(masked.length, 12);
});
