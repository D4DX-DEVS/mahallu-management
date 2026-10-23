/**
 * Usernames, username + password sign-in, and who may reset whose sign-in details.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';

import User from '../models/User';
import Tenant from '../models/Tenant';
import { ActivityLog } from '../models/Social';
import { login, changePassword } from '../controllers/authController';
import { createUser, resetUserPassword, setUserUsername, updateUser } from '../controllers/userController';
import { decideCredentialAccess, widensPermissions } from '../utils/credentialAccess';
import {
  generateTemporaryPassword,
  isStrongPassword,
  isValidUsername,
  normalizeUsername,
} from '../utils/credentials';
import { loginValidation } from '../validations/authValidation';
import { createUserValidation, resetPasswordValidation, setUsernameValidation } from '../validations/userValidation';
import { loginRateLimiter } from '../middleware/rateLimit';
import { invalidateTenantStatus } from '../services/tenantStatusService';
import userRoutes from '../routes/userRoutes';
import { call, installFake, oid } from './support/fakeMongo';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const validate = async (chains: any[], body: any, params: any = {}) => {
  const req: any = { body, params, query: {}, headers: {} };
  for (const chain of chains) await chain.run(req);
  return validationResult(req)
    .array()
    .map((e: any) => `${e.path}: ${e.msg}`);
};

const TENANT_A = oid();
const TENANT_B = oid();
const PASSWORD = 'Correct1horse';

const hash = (password: string) => bcrypt.hashSync(password, 4);

const staff = (extra: Record<string, unknown> = {}) => ({
  _id: oid(),
  name: 'Staff',
  phone: '9000000001',
  role: 'survey',
  tenantId: TENANT_A,
  status: 'active',
  isSuperAdmin: false,
  tokenVersion: 0,
  permissions: { view: true, add: false, edit: false, delete: false },
  password: hash(PASSWORD),
  ...extra,
});

/** Fake users + tenants for one test. */
const withWorld = async (users: any[], run: (w: { users: any }) => Promise<void>) => {
  invalidateTenantStatus();
  const tenants = installFake(Tenant, [
    { _id: TENANT_A, name: 'A', code: 'A', status: 'active' },
    { _id: TENANT_B, name: 'B', code: 'B', status: 'active' },
  ]);
  const fakeUsers = installFake(User, users);
  const audit = installFake(ActivityLog);
  try {
    await run({ users: fakeUsers });
  } finally {
    fakeUsers.restore();
    tenants.restore();
    audit.restore();
  }
};

// ------------------------------------------------------------------ utilities

test('usernames are 4-30 lowercase characters with a letter, and never look like a phone number', () => {
  for (const ok of ['asha.admin', 'beypore-survey', 'user_01', 'a1b2', 'ABC.Def']) assert.equal(isValidUsername(ok), true, ok);
  for (const bad of ['abc', 'x'.repeat(31), '9876543210', '1234', '.leading', 'has space', 'semi;colon', 'ünï', '', null, 42]) {
    assert.equal(isValidUsername(bad), false, String(bad));
  }
  assert.equal(normalizeUsername('  Asha.Admin '), 'asha.admin');
  assert.equal(normalizeUsername(undefined), '');
});

test('a strong password has 8-128 characters with a letter and a number', () => {
  assert.equal(isStrongPassword('Passw0rdx'), true);
  for (const weak of ['short1A', 'allletters', '123456789', 'x'.repeat(129) + '1', '', null]) {
    assert.equal(isStrongPassword(weak), false, String(weak));
  }
});

test('generated temporary passwords are strong, unambiguous and different every time', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    const password = generateTemporaryPassword();
    assert.equal(password.length, 12);
    assert.equal(isStrongPassword(password), true, password);
    assert.doesNotMatch(password, /[0O1lI]/);
    seen.add(password);
  }
  assert.equal(seen.size, 200);
});

// ------------------------------------------------------------------ who may manage whose credentials

const mahallAdmin = { id: 'admin-a', role: 'mahall', tenantId: String(TENANT_A) };
const superAdmin = { id: 'root', role: 'super_admin', isSuperAdmin: true };
const target = (extra: Record<string, unknown> = {}) => ({ id: 'target', role: 'survey', tenantId: String(TENANT_A), ...extra });

test('a Mahallu admin manages survey and institute accounts of their own Mahallu', () => {
  for (const role of ['survey', 'institute']) {
    assert.deepEqual(decideCredentialAccess(mahallAdmin, target({ role })), { ok: true });
  }
});

test('a Mahallu admin cannot touch another Mahallu, another admin, themselves, a member or a platform admin', () => {
  const refused = (t: any, status: number) => {
    const decision = decideCredentialAccess(mahallAdmin, t) as any;
    assert.equal(decision.ok, false);
    assert.equal(decision.status, status);
    return decision.message as string;
  };
  // Another Mahallu is "not found": its users' existence is not revealed.
  assert.match(refused(target({ tenantId: String(TENANT_B) }), 404), /couldn't find/);
  assert.match(refused(target({ role: 'mahall' }), 403), /platform administrator/);
  assert.match(refused(target({ id: 'admin-a', role: 'mahall' }), 403), /Change password/);
  assert.match(refused(target({ role: 'member' }), 400), /OTP/);
  assert.match(refused(target({ role: 'super_admin', tenantId: null }), 404), /couldn't find/);
});

test('a Mahallu admin with no Mahallu on record is refused', () => {
  assert.equal((decideCredentialAccess({ ...mahallAdmin, tenantId: undefined }, target()) as any).status, 404);
});

test('a Super Admin manages any staff account, but not another Super Admin or themselves', () => {
  for (const t of [target({ role: 'mahall' }), target({ tenantId: String(TENANT_B) }), target({ role: 'institute' })]) {
    assert.deepEqual(decideCredentialAccess(superAdmin, t), { ok: true });
  }
  assert.equal((decideCredentialAccess(superAdmin, target({ role: 'super_admin', tenantId: null })) as any).status, 403);
  assert.equal((decideCredentialAccess(superAdmin, target({ id: 'root' })) as any).status, 403);
  assert.equal((decideCredentialAccess(superAdmin, target({ role: 'member' })) as any).status, 400);
});

test('survey, institute and member accounts cannot manage anyone, and View As never can', () => {
  for (const role of ['survey', 'institute', 'member']) {
    assert.equal((decideCredentialAccess({ id: 'x', role, tenantId: String(TENANT_A) }, target()) as any).status, 403, role);
  }
  assert.equal((decideCredentialAccess({ ...superAdmin, impersonating: true }, target()) as any).status, 403);
  assert.equal((decideCredentialAccess({ ...mahallAdmin, impersonating: true }, target()) as any).status, 403);
});

test('the credential routes sit behind the Super Admin / Mahallu admin role guard', () => {
  const layers: any[] = (userRoutes as any).stack;
  const guard = layers.find((l) => l.handle?.isRoleGuard);
  assert.ok(guard, 'the router has a role guard');
  assert.deepEqual(guard.handle.allowedRoles, ['super_admin', 'mahall']);
  const paths = layers.filter((l) => l.route).map((l) => `${Object.keys(l.route.methods)[0]} ${l.route.path}`);
  assert.ok(paths.includes('put /:id/username'));
  assert.ok(paths.includes('post /:id/reset-password'));
  // the guard is registered before any route
  assert.ok(layers.indexOf(guard) < layers.findIndex((l) => l.route));
});

// ------------------------------------------------------------------ validation

test('sign-in accepts a phone number or a username, and still needs a password', async () => {
  assert.deepEqual(await validate(loginValidation, { phone: '9876543210', password: 'x' }), []);
  assert.deepEqual(await validate(loginValidation, { username: 'asha.admin', password: 'x' }), []);
  assert.equal((await validate(loginValidation, { password: 'x' })).length > 0, true, 'neither given');
  assert.equal((await validate(loginValidation, { phone: '123', password: 'x' })).length > 0, true, 'bad phone');
  assert.equal((await validate(loginValidation, { username: 'asha.admin' })).length > 0, true, 'no password');
  assert.equal((await validate(loginValidation, { username: 'x'.repeat(31), password: 'x' })).length > 0, true, 'too long');
});

test('creating a user with a username needs a valid username and a strong password', async () => {
  const base = { name: 'Asha', phone: '9876543210', role: 'survey', tenantId: String(TENANT_A) };
  assert.deepEqual(await validate(createUserValidation, { ...base, username: 'asha.survey', password: PASSWORD }), []);
  assert.deepEqual(await validate(createUserValidation, base), [], 'the old phone-only create still validates');
  assert.deepEqual(await validate(createUserValidation, { ...base, password: 'abcdef' }), [], 'legacy 6-char password without a username');
  assert.equal((await validate(createUserValidation, { ...base, username: 'asha.survey' })).length > 0, true, 'username without password');
  assert.equal((await validate(createUserValidation, { ...base, username: 'asha.survey', password: 'weakpass' })).length > 0, true, 'no number');
  assert.equal((await validate(createUserValidation, { ...base, username: '9876543210', password: PASSWORD })).length > 0, true, 'looks like a phone');
});

test('changing a username accepts a valid one or an empty value, nothing else', async () => {
  const params = { id: String(oid()) };
  for (const username of ['new.name', '', null]) assert.deepEqual(await validate(setUsernameValidation, { username }, params), [], String(username));
  for (const username of ['no', 'Bad Name!', 12345678]) assert.equal((await validate(setUsernameValidation, { username }, params)).length > 0, true, String(username));
});

test('a password reset needs an explicit confirmation, and a chosen password must be strong and repeated', async () => {
  const params = { id: String(oid()) };
  assert.deepEqual(await validate(resetPasswordValidation, { confirm: true }, params), []);
  assert.deepEqual(await validate(resetPasswordValidation, { confirm: true, newPassword: PASSWORD, confirmPassword: PASSWORD }, params), []);
  assert.equal((await validate(resetPasswordValidation, {}, params)).length, 1, 'no confirmation');
  assert.equal((await validate(resetPasswordValidation, { confirm: 'yes' }, params)).length, 1, 'confirm must be true');
  assert.equal((await validate(resetPasswordValidation, { confirm: true, newPassword: 'weak', confirmPassword: 'weak' }, params)).length > 0, true);
  assert.equal((await validate(resetPasswordValidation, { confirm: true, newPassword: PASSWORD, confirmPassword: 'Different1x' }, params)).length > 0, true);
  assert.equal((await validate(resetPasswordValidation, { confirm: true }, { id: 'bad' })).length, 1, 'bad id');
});

// ------------------------------------------------------------------ sign-in

const signIn = (body: Record<string, unknown>) => call(login, { body });

test('a staff account signs in with its username and password', async () => {
  const user = staff({ username: 'asha.survey' });
  await withWorld([user], async () => {
    const reply = await signIn({ username: 'Asha.Survey', password: PASSWORD });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.success, true);
    const claims: any = jwt.verify(reply.body.data.token, process.env.JWT_SECRET!);
    assert.equal(String(claims.userId), String(user._id));
    assert.equal(reply.body.data.user.username, 'asha.survey');
    assert.equal(reply.body.data.user.role, 'survey');
    assert.equal(String(reply.body.data.user.tenantId), String(TENANT_A));
    assert.equal(reply.body.data.user.tokenVersion, undefined);
  });
});

test('no sign-in response ever carries a password or hash', async () => {
  await withWorld([staff({ username: 'asha.survey' })], async () => {
    for (const body of [{ username: 'asha.survey', password: PASSWORD }, { phone: '9000000001', password: PASSWORD }]) {
      const text = JSON.stringify((await signIn(body)).body);
      assert.doesNotMatch(text, /"password"/);
      assert.equal(text.includes(PASSWORD), false);
      assert.equal(text.includes('$2'), false, 'no bcrypt hash');
    }
  });
});

test('a wrong password and an unknown username get the same generic answer', async () => {
  await withWorld([staff({ username: 'asha.survey' })], async () => {
    const wrongPassword = await signIn({ username: 'asha.survey', password: 'Wrong1password' });
    const unknownName = await signIn({ username: 'nobody.here', password: PASSWORD });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownName.status, 401);
    assert.equal(wrongPassword.body.message, unknownName.body.message);
    assert.equal(wrongPassword.body.data, undefined);
  });
});

test('an inactive account and a suspended Mahallu cannot sign in by username', async () => {
  await withWorld([staff({ username: 'off.user', status: 'inactive' })], async () => {
    const reply = await signIn({ username: 'off.user', password: PASSWORD });
    assert.equal(reply.status, 403);
    assert.equal(reply.body.data, undefined);
  });

  invalidateTenantStatus();
  const tenants = installFake(Tenant, [{ _id: TENANT_A, name: 'A', code: 'A', status: 'suspended' }]);
  const users = installFake(User, [staff({ username: 'asha.survey' })]);
  try {
    const reply = await signIn({ username: 'asha.survey', password: PASSWORD });
    assert.equal(reply.status, 403);
    assert.equal(reply.body.code, 'TENANT_SUSPENDED');
  } finally {
    users.restore();
    tenants.restore();
    invalidateTenantStatus();
  }
});

test('a member account cannot use a username to get around OTP-only sign-in', async () => {
  await withWorld([staff({ role: 'member', username: 'sneaky.member', memberId: oid() })], async () => {
    const reply = await signIn({ username: 'sneaky.member', password: PASSWORD });
    assert.equal(reply.status, 403);
    assert.equal(reply.body.data, undefined);
  });
});

test('phone + password sign-in is unchanged', async () => {
  await withWorld([staff({ username: undefined })], async () => {
    assert.equal((await signIn({ phone: '9000000001', password: PASSWORD })).status, 200);
    const wrong = await signIn({ phone: '9000000001', password: 'nope' });
    assert.equal(wrong.status, 401);
    assert.match(wrong.body.message, /phone number or password/);
  });
});

test('a user from one Mahallu signs in as that Mahallu, never as another', async () => {
  const a = staff({ username: 'user.a', tenantId: TENANT_A, phone: '9000000001' });
  const b = staff({ username: 'user.b', tenantId: TENANT_B, phone: '9000000002' });
  await withWorld([a, b], async () => {
    const replyA = await signIn({ username: 'user.a', password: PASSWORD });
    const replyB = await signIn({ username: 'user.b', password: PASSWORD });
    assert.equal(String(replyA.body.data.user.tenantId), String(TENANT_A));
    assert.equal(String(replyB.body.data.user.tenantId), String(TENANT_B));
  });
});

test('username attempts are rate limited per username, not for the whole address', () => {
  const attempt = (username: string) => {
    let status = 200;
    let nexted = false;
    const res: any = { status: (c: number) => ((status = c), res), json: () => res };
    loginRateLimiter({ ip: '203.0.113.9', body: { username } } as any, res, () => (nexted = true));
    return nexted ? 200 : status;
  };
  for (let i = 0; i < 10; i += 1) assert.equal(attempt('target.user'), 200);
  assert.equal(attempt('target.user'), 429, 'the 11th guess at one username is stopped');
  assert.equal(attempt('someone.else'), 200, 'a different username from the same address still works');
  assert.equal(attempt('TARGET.USER'), 429, 'case does not give extra guesses');
});

// ------------------------------------------------------------------ creating users with credentials

const admin = (extra: Record<string, unknown> = {}) => ({
  tenantId: String(TENANT_A),
  user: { _id: oid(), role: 'mahall' },
  ...extra,
});

test('a Mahallu admin creates a user with a username and a hashed password', async () => {
  await withWorld([], async ({ users }) => {
    const reply = await call(createUser, {
      ...admin(),
      body: { name: 'Asha', phone: '9876543210', role: 'survey', username: 'Asha.Survey', password: PASSWORD },
    });
    assert.equal(reply.status, 201);
    const [row] = users.store.find({});
    assert.equal(row.username, 'asha.survey');
    assert.equal(String(row.tenantId), String(TENANT_A), 'linked to the creating admin\'s Mahallu');
    assert.equal(await bcrypt.compare(PASSWORD, row.password), true);
    assert.notEqual(row.password, PASSWORD);
    assert.equal(row.passwordResetRequired, true);
    assert.equal(JSON.stringify(reply.body).includes(PASSWORD), false);
    assert.equal(reply.body.data.password, undefined);
  });
});

test('a username already in use anywhere is refused, whatever its case', async () => {
  await withWorld([staff({ username: 'taken.name', tenantId: TENANT_B })], async ({ users }) => {
    const reply = await call(createUser, {
      ...admin(),
      body: { name: 'Asha', phone: '9876543210', role: 'survey', username: 'TAKEN.NAME', password: PASSWORD },
    });
    assert.equal(reply.status, 409);
    assert.match(reply.body.message, /already taken/);
    assert.equal(users.store.find({}).length, 1);
  });
});

test('a member account cannot be given a username, and the Mahallu cannot be chosen by a Mahallu admin', async () => {
  await withWorld([], async ({ users }) => {
    const member = await call(createUser, {
      ...admin(),
      body: { name: 'M', phone: '9876543210', role: 'member', memberId: String(oid()), username: 'member.user', password: PASSWORD },
    });
    assert.equal(member.status, 400);

    // A Mahallu admin naming another Mahallu in the body still creates inside their own.
    const reply = await call(createUser, {
      ...admin(),
      body: { name: 'Asha', phone: '9876543210', role: 'survey', tenantId: String(TENANT_B), username: 'asha.survey', password: PASSWORD },
    });
    assert.equal(reply.status, 201);
    assert.equal(String(users.store.find({})[0].tenantId), String(TENANT_A));
  });
});

// ------------------------------------------------------------------ resetting passwords

const ctx = (target: any, extra: Record<string, unknown> = {}) => ({
  ...admin(),
  params: { id: String(target._id) },
  ...extra,
});

test('resetting a password issues a one-time password once, stores only its hash and ends the old sessions', async () => {
  const target = staff({ username: 'asha.survey', tokenVersion: 3 });
  await withWorld([target], async ({ users }) => {
    const reply = await call(resetUserPassword, ctx(target, { body: { confirm: true } }));
    assert.equal(reply.status, 200);
    assert.equal(reply.headers['Cache-Control'], 'no-store');
    const temporary: string = reply.body.data.temporaryPassword;
    assert.equal(isStrongPassword(temporary), true);

    const [row] = users.store.find({});
    assert.equal(await bcrypt.compare(temporary, row.password), true, 'the new password works');
    assert.equal(await bcrypt.compare(PASSWORD, row.password), false, 'the old one no longer does');
    assert.equal(row.password.includes(temporary), false);
    assert.equal(row.tokenVersion, 4, 'sessions are invalidated');
    assert.equal(row.passwordResetRequired, true);
    assert.doesNotMatch(reply.body.message, /sent|messag(ed|e)? (to )?them on/i, 'it must not claim delivery');

    // and the new password signs in
    const signedIn = await signIn({ username: 'asha.survey', password: temporary });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.body.data.user.passwordResetRequired, true);
  });
});

test('an administrator can set a specific password instead; it is not echoed back', async () => {
  const target = staff();
  await withWorld([target], async ({ users }) => {
    const chosen = 'Chosen1password';
    const reply = await call(resetUserPassword, ctx(target, { body: { confirm: true, newPassword: chosen, confirmPassword: chosen } }));
    assert.equal(reply.status, 200);
    assert.equal(reply.body.data.temporaryPassword, undefined);
    assert.equal(JSON.stringify(reply.body).includes(chosen), false);
    assert.equal(await bcrypt.compare(chosen, users.store.find({})[0].password), true);
  });
});

test('the reset is written to the audit log without any secret', async () => {
  const target = staff({ username: 'asha.survey' });
  const tenants = installFake(Tenant, [{ _id: TENANT_A, name: 'A', code: 'A', status: 'active' }]);
  const users = installFake(User, [target]);
  const audit = installFake(ActivityLog);
  try {
    const reply = await call(resetUserPassword, ctx(target, { body: { confirm: true } }));
    const entries = audit.store.find({});
    assert.equal(entries.length, 1);
    assert.equal(entries[0].action, 'reset user password');
    assert.equal(String(entries[0].entityId), String(target._id));
    assert.equal(String(entries[0].tenantId), String(TENANT_A));
    const text = JSON.stringify(entries[0]);
    assert.equal(text.includes(reply.body.data.temporaryPassword), false);
    assert.equal(text.includes('$2'), false);
  } finally {
    audit.restore();
    users.restore();
    tenants.restore();
  }
});

test('a Mahallu admin cannot reset a user of another Mahallu, another admin, themselves or a member', async () => {
  const otherTenant = staff({ tenantId: TENANT_B, phone: '9000000011' });
  const otherAdmin = staff({ role: 'mahall', phone: '9000000012' });
  const member = staff({ role: 'member', memberId: oid(), phone: '9000000013' });
  const self = staff({ role: 'mahall', phone: '9000000014' });
  await withWorld([otherTenant, otherAdmin, member, self], async ({ users }) => {
    const before = users.store.find({}).map((r: any) => r.password);
    const cases: Array<[any, number]> = [[otherTenant, 404], [otherAdmin, 403], [member, 400]];
    for (const [t, status] of cases) {
      const reply = await call(resetUserPassword, ctx(t, { body: { confirm: true } }));
      assert.equal(reply.status, status);
      assert.equal(reply.body.data, undefined);
    }
    const own = await call(resetUserPassword, { ...ctx(self, { body: { confirm: true } }), user: { _id: self._id, role: 'mahall' } });
    assert.equal(own.status, 403);
    assert.deepEqual(users.store.find({}).map((r: any) => r.password), before, 'nothing changed');
  });
});

test('survey and institute users cannot reset anything, and an unknown user answers 404', async () => {
  const target = staff();
  await withWorld([target], async () => {
    for (const role of ['survey', 'institute', 'member']) {
      const reply = await call(resetUserPassword, ctx(target, { body: { confirm: true }, user: { _id: oid(), role } }));
      assert.equal(reply.status, 403, role);
    }
    const missing = await call(resetUserPassword, { ...admin(), params: { id: String(oid()) }, body: { confirm: true } });
    assert.equal(missing.status, 404);
  });
});

test('a Super Admin can reset a Mahallu admin in any Mahallu, but not another Super Admin', async () => {
  const mahall = staff({ role: 'mahall', tenantId: TENANT_B });
  const root = staff({ role: 'super_admin', tenantId: null, isSuperAdmin: true });
  await withWorld([mahall, root], async () => {
    const actor = { isSuperAdmin: true, tenantId: undefined, user: { _id: oid(), role: 'super_admin' } };
    assert.equal((await call(resetUserPassword, { ...actor, params: { id: String(mahall._id) }, body: { confirm: true } })).status, 200);
    assert.equal((await call(resetUserPassword, { ...actor, params: { id: String(root._id) }, body: { confirm: true } })).status, 403);
  });
});

test('a View As session cannot reset a password', async () => {
  const target = staff();
  await withWorld([target], async () => {
    const reply = await call(resetUserPassword, {
      ...ctx(target, { body: { confirm: true } }),
      isSuperAdmin: false,
      impersonation: { isImpersonating: true },
    });
    assert.equal(reply.status, 403);
  });
});

// ------------------------------------------------------------------ changing usernames

test('an administrator changes a username; it is stored lowercase and the old one stops working', async () => {
  const target = staff({ username: 'old.name' });
  await withWorld([target], async ({ users }) => {
    const reply = await call(setUserUsername, ctx(target, { body: { username: 'New.Name' } }));
    assert.equal(reply.status, 200);
    assert.equal(users.store.find({})[0].username, 'new.name');
    assert.equal(reply.body.data.password, undefined);
    assert.equal((await signIn({ username: 'old.name', password: PASSWORD })).status, 401);
    assert.equal((await signIn({ username: 'new.name', password: PASSWORD })).status, 200);
  });
});

test('a username taken by someone else is refused, but keeping your own is fine', async () => {
  const target = staff({ username: 'mine.name' });
  const other = staff({ username: 'theirs.name', phone: '9000000009' });
  await withWorld([target, other], async () => {
    const taken = await call(setUserUsername, ctx(target, { body: { username: 'Theirs.Name' } }));
    assert.equal(taken.status, 409);
    assert.match(taken.body.message, /already taken/);
    assert.equal((await call(setUserUsername, ctx(target, { body: { username: 'mine.name' } }))).status, 200);
  });
});

test('an empty username removes it, and the phone number still signs in', async () => {
  const target = staff({ username: 'asha.survey' });
  await withWorld([target], async ({ users }) => {
    const reply = await call(setUserUsername, ctx(target, { body: { username: '' } }));
    assert.equal(reply.status, 200);
    assert.equal(users.store.find({})[0].username, undefined);
    assert.equal((await signIn({ phone: '9000000001', password: PASSWORD })).status, 200);
  });
});

test('username changes follow the same permissions as password resets', async () => {
  const otherTenant = staff({ tenantId: TENANT_B });
  const otherAdmin = staff({ role: 'mahall' });
  await withWorld([otherTenant, otherAdmin], async ({ users }) => {
    assert.equal((await call(setUserUsername, ctx(otherTenant, { body: { username: 'hijack.name' } }))).status, 404);
    assert.equal((await call(setUserUsername, ctx(otherAdmin, { body: { username: 'hijack.name' } }))).status, 403);
    assert.equal(users.store.find({ username: 'hijack.name' }).length, 0);
  });
});

// ------------------------------------------------------------------ changing your own password

test('choosing your own password clears the "administrator issued this" flag', async () => {
  const target = staff({ username: 'asha.survey', passwordResetRequired: true });
  await withWorld([target], async ({ users }) => {
    // changePassword reads the user with findById(...).select('+password') then save()
    const reply = await call(changePassword, {
      user: { _id: target._id, role: 'survey' },
      body: { currentPassword: PASSWORD, newPassword: 'Another1password' },
    });
    assert.equal(reply.status, 200);
    const row = users.store.find({})[0];
    assert.notEqual(row.passwordResetRequired, true);
    assert.equal(await bcrypt.compare('Another1password', row.password), true);
  });
});

// ------------------------------------------------------------------ no self-promotion

test('widensPermissions flags only new access, never a reduction', () => {
  const held = { view: true, add: false, edit: false, delete: false, sensitiveModules: ['health'] };
  assert.equal(widensPermissions(held, { view: true, add: false }), false, 'unchanged');
  assert.equal(widensPermissions(held, { view: false, sensitiveModules: [] }), false, 'lowered');
  assert.equal(widensPermissions(held, { add: true }), true, 'a flag switched on');
  assert.equal(widensPermissions(held, { sensitiveModules: ['health', 'welfare'] }), true, 'a module added');
  assert.equal(widensPermissions(undefined, { delete: true }), true, 'from nothing');
  assert.equal(widensPermissions(held, undefined), false);
  assert.equal(widensPermissions(held, 'everything'), false);
});

test('an admin editing their own record cannot grant themselves restricted modules, but can edit their details', async () => {
  const self = staff({ role: 'mahall', permissions: { view: true, add: false, edit: false, delete: false } });
  await withWorld([self], async ({ users }) => {
    const as = { tenantId: String(TENANT_A), user: { _id: self._id, role: 'mahall' }, params: { id: String(self._id) } };

    const grab = await call(updateUser, { ...as, body: { permissions: { sensitiveModules: ['counselling', 'welfare'] } } });
    assert.equal(grab.status, 403);
    assert.match(grab.body.message, /more access/);
    const flag = await call(updateUser, { ...as, body: { permissions: { delete: true } } });
    assert.equal(flag.status, 403);
    assert.equal(users.store.find({})[0].permissions.sensitiveModules, undefined, 'nothing was written');

    const rename = await call(updateUser, { ...as, body: { name: 'New Name', permissions: { view: true, add: false } } });
    assert.equal(rename.status, 200);
    assert.equal(users.store.find({})[0].name, 'New Name');
  });
});

test('a Super Admin can grant access, and a Mahallu admin can grant it to someone else', async () => {
  const admin1 = staff({ role: 'mahall', phone: '9000000021' });
  const worker = staff({ role: 'survey', phone: '9000000022' });
  await withWorld([admin1, worker], async ({ users }) => {
    const byAdmin = await call(updateUser, {
      tenantId: String(TENANT_A),
      user: { _id: admin1._id, role: 'mahall' },
      params: { id: String(worker._id) },
      body: { permissions: { sensitiveModules: ['health'] } },
    });
    assert.equal(byAdmin.status, 200);

    const bySuper = await call(updateUser, {
      isSuperAdmin: true,
      user: { _id: oid(), role: 'super_admin' },
      params: { id: String(admin1._id) },
      body: { permissions: { sensitiveModules: ['welfare'] } },
    });
    assert.equal(bySuper.status, 200);
    const row = users.store.find({ _id: admin1._id })[0];
    // the fake keeps a dotted  path as written
    assert.deepEqual([...(row.permissions?.sensitiveModules ?? row['permissions.sensitiveModules'])], ['welfare']);
  });
});
