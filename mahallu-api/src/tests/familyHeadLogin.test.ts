/**
 * Among a Mahallu's members only the family head signs in: with their phone number and a password the
 * Mahallu generates, which the Mahallu admin can read out again, copy and reset.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

import Family from '../models/Family';
import Member from '../models/Member';
import User from '../models/User';
import Tenant from '../models/Tenant';
import Counter from '../models/Counter';
import { ActivityLog } from '../models/Social';
import { login, changePassword } from '../controllers/authController';
import { sendOTP, verifyOTP } from '../controllers/otpController';
import { createMember, updateMember, updateMemberStatus } from '../controllers/memberController';
import { getMemberCredentials, resetMemberPassword } from '../controllers/memberCredentialController';
import { authMiddleware } from '../middleware/authMiddleware';
import memberRoutes from '../routes/memberRoutes';
import { invalidateTenantStatus } from '../services/tenantStatusService';
import { generateHeadPassword, HEAD_PASSWORD_LENGTH, openPassword, sealPassword } from '../services/familyHeadLogin';
import { signSessionToken } from '../utils/sessionToken';
import { call, installFake, oid } from './support/fakeMongo';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const TENANT = oid();
const OTHER_TENANT = oid();
const FAMILY = oid();
const HEAD_PHONE = '9000000011';

const admin = (extra: Record<string, unknown> = {}) => ({
  tenantId: String(TENANT),
  user: { _id: oid(), role: 'mahall', tenantId: TENANT, name: 'Admin' },
  ...extra,
});

const withWorld = async (
  seed: { members?: any[]; users?: any[] },
  run: (w: { members: any; users: any; audit: any }) => Promise<void>
) => {
  invalidateTenantStatus();
  const fakes = [
    installFake(Tenant, [{ _id: TENANT, name: 'Beypore', code: 'B', status: 'active' }]),
    installFake(Family, [{ _id: FAMILY, tenantId: TENANT, houseName: 'Kallingal', mahallId: 'FID1', status: 'approved' }]),
    installFake(Counter),
  ];
  const members = installFake(Member, seed.members ?? []);
  const users = installFake(User, seed.users ?? []);
  const audit = installFake(ActivityLog);
  try {
    await run({ members, users, audit });
  } finally {
    [audit, users, members, ...fakes].forEach((f) => f.restore());
    invalidateTenantStatus();
  }
};

const headBody = (extra: Record<string, unknown> = {}) => ({
  name: 'Abdul Rahman',
  gender: 'male',
  familyId: String(FAMILY),
  familyName: 'Kallingal',
  isFamilyHead: true,
  phone: HEAD_PHONE,
  ...extra,
});

/** Creates a head through the real handler and returns the member, the account and the issued password. */
const createHead = async (w: { members: any; users: any }, extra: Record<string, unknown> = {}) => {
  const reply = await call(createMember, admin({ body: headBody(extra) }));
  assert.equal(reply.status, 201, JSON.stringify(reply.body));
  const member = w.members.store.find({ name: 'Abdul Rahman' })[0];
  const account = w.users.store.find({ memberId: member._id })[0];
  return { reply, member, account, password: openPassword(account.issuedPassword) as string };
};

const signIn = (body: Record<string, unknown>) => call(login, { body });

// ---------------------------------------------------------------- the password itself

test('the generated password is capitals and digits, at least 7 long, with no look-alike characters', () => {
  assert.ok(HEAD_PASSWORD_LENGTH >= 7);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    const password = generateHeadPassword();
    assert.match(password, /^[A-Z2-9]+$/);
    assert.doesNotMatch(password, /[IO01]/);
    assert.equal(password.length, HEAD_PASSWORD_LENGTH);
    assert.equal(password, password.toUpperCase());
    seen.add(password);
  }
  assert.ok(seen.size > 190, 'passwords are random, not a fixed value');
});

test('the readable copy is encrypted, opens to the same password, and a damaged one opens to nothing', () => {
  const sealed = sealPassword('ABCD2345');
  assert.equal(sealed.includes('ABCD2345'), false);
  assert.notEqual(sealed, sealPassword('ABCD2345'), 'a fresh nonce every time');
  assert.equal(openPassword(sealed), 'ABCD2345');
  assert.equal(openPassword(sealed.slice(0, -4) + 'AAAA'), null);
  assert.equal(openPassword(undefined), null);
  assert.equal(openPassword('not-a-sealed-value'), null);
});

// ---------------------------------------------------------------- who gets a sign-in

test('creating a family head creates their sign-in: phone number as the name, a generated password', async () => {
  await withWorld({}, async (w) => {
    const { reply, member, account, password } = await createHead(w);
    assert.equal(reply.body.memberUserCreated, true);
    assert.equal(account.role, 'member');
    assert.equal(account.phone, HEAD_PHONE);
    assert.equal(account.status, 'active');
    assert.equal(String(account.tenantId), String(TENANT));
    assert.equal(String(account.memberId), String(member._id));
    assert.match(password, /^[A-Z2-9]{7,}$/);
    assert.equal(await bcrypt.compare(password, account.password), true, 'the stored hash is of the issued password');
    assert.equal(JSON.stringify(reply.body).includes(password), false, 'the create answer does not carry the password');
  });
});

test('a family head must have a phone number', async () => {
  await withWorld({}, async (w) => {
    const reply = await call(createMember, admin({ body: headBody({ phone: undefined }) }));
    assert.equal(reply.status, 400);
    assert.match(reply.body.message, /phone number/i);
    assert.equal(w.members.store.find({}).length, 0);
    assert.equal(w.users.store.find({}).length, 0);
  });
});

test('an ordinary member gets no sign-in, with or without a phone number', async () => {
  await withWorld({}, async (w) => {
    const withPhone = await call(createMember, admin({ body: headBody({ name: 'Aisha', isFamilyHead: false, phone: '9000000012' }) }));
    const withoutPhone = await call(createMember, admin({ body: headBody({ name: 'Little One', isFamilyHead: false, phone: undefined }) }));
    assert.equal(withPhone.status, 201);
    assert.equal(withoutPhone.status, 201);
    assert.equal(withPhone.body.memberUserCreated, false);
    assert.equal(w.users.store.find({}).length, 0);
  });
});

test("a head's phone number cannot be another head's sign-in name in the same Mahallu", async () => {
  await withWorld({}, async (w) => {
    await createHead(w);
    const other = oid();
    w.members.store.insert({ _id: other, tenantId: TENANT, name: 'Other Head', phone: '9000000013', status: 'active', isFamilyHead: true });
    const reply = await call(updateMember, admin({ params: { id: String(other) }, body: { phone: HEAD_PHONE } }));
    assert.equal(reply.status, 400);
    assert.match(reply.body.message, /already exists/);
  });
});

// ---------------------------------------------------------------- signing in

test('the head signs in with phone number + issued password; a wrong password is refused', async () => {
  await withWorld({}, async (w) => {
    const { member, password } = await createHead(w);
    const ok = await signIn({ phone: HEAD_PHONE, password });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.data.user.role, 'member');
    assert.equal(String(ok.body.data.user.memberId), String(member._id));
    assert.ok(ok.body.data.token);
    assert.equal(JSON.stringify(ok.body).includes('issuedPassword'), false);

    assert.equal((await signIn({ phone: HEAD_PHONE, password: 'WRONGPWD' })).status, 401);

    // the phone number typed into the username box is the same sign-in
    const asUsername = await signIn({ username: HEAD_PHONE, password });
    assert.equal(asUsername.status, 200, JSON.stringify(asUsername.body));
    assert.equal(String(asUsername.body.data.user.memberId), String(member._id));
  });
});

test('a member who is not the family head cannot sign in by password or request an OTP', async () => {
  const member = { _id: oid(), tenantId: TENANT, name: 'Ordinary', phone: '9000000014', status: 'active', isFamilyHead: false };
  // an account left over from when every member had one
  const account = { _id: oid(), name: 'Ordinary', phone: '9000000014', role: 'member', tenantId: TENANT, memberId: member._id, status: 'active', tokenVersion: 0, password: bcrypt.hashSync('LEFTOVER', 4) };
  await withWorld({ members: [member], users: [account] }, async () => {
    const byPassword = await signIn({ phone: '9000000014', password: 'LEFTOVER' });
    assert.equal(byPassword.status, 403);
    assert.match(byPassword.body.message, /family head/i);
    assert.equal(byPassword.body.data, undefined);

    const otp = await call(sendOTP, { body: { phone: '9000000014' } });
    assert.equal(otp.status, 403);
    assert.match(otp.body.message, /family head/i);
  });
});

test('a family head cannot sign in with an OTP: the password is the only way in', async () => {
  const otpService = require('../services/otpService');
  const original = otpService.verifyAndConsumeOtp;
  otpService.verifyAndConsumeOtp = async () => 'ok';
  try {
    await withWorld({}, async (w) => {
      const { password } = await createHead(w);

      const requested = await call(sendOTP, { body: { phone: HEAD_PHONE } });
      assert.equal(requested.status, 403);
      assert.match(requested.body.message, /password/i);

      // even holding a valid code for the number
      const verified = await call(verifyOTP, { body: { phone: HEAD_PHONE, otp: '123456' } });
      assert.equal(verified.status, 403);
      assert.equal(verified.body.data, undefined);

      // the same phone with a staff account: the OTP opens the staff account and never lists the head's
      w.users.store.insert({ _id: oid(), name: 'Abdul (office)', phone: HEAD_PHONE, role: 'mahall', tenantId: TENANT, status: 'active', tokenVersion: 0, isSuperAdmin: false, password: 'x' });
      const staff = await call(verifyOTP, { body: { phone: HEAD_PHONE, otp: '123456' } });
      assert.equal(staff.status, 200, JSON.stringify(staff.body));
      assert.equal(staff.body.data.requiresRoleSelection, undefined);
      assert.equal(staff.body.data.user.role, 'mahall');

      assert.equal((await signIn({ phone: HEAD_PHONE, password })).body.data.user.role, 'member');
    });
  } finally {
    otpService.verifyAndConsumeOtp = original;
  }
});

test('two-factor on a family head account does not send them to an OTP step', async () => {
  await withWorld({}, async (w) => {
    const { account, password } = await createHead(w);
    w.users.store.find({ _id: account._id })[0].twoFactorEnabled = true;
    const reply = await signIn({ phone: HEAD_PHONE, password });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.data.requiresOtp, undefined);
    assert.ok(reply.body.data.token);
  });
});

test('a session of a member who is not the family head is refused on every request', async () => {
  const member = { _id: oid(), tenantId: TENANT, name: 'Ordinary', phone: '9000000014', status: 'active', isFamilyHead: false };
  const account = { _id: oid(), name: 'Ordinary', phone: '9000000014', role: 'member', tenantId: TENANT, memberId: member._id, status: 'active', tokenVersion: 0, password: 'x' };
  await withWorld({ members: [member], users: [account] }, async (w) => {
    const run = async () => {
      const out: any = { status: 200, body: null, next: false };
      const res: any = { status: (code: number) => ((out.status = code), res), json: (body: any) => ((out.body = body), res) };
      const req: any = { headers: { authorization: `Bearer ${signSessionToken(account as any)}` }, originalUrl: '/api/member-user/profile', method: 'GET' };
      await authMiddleware(req, res, () => {
        out.next = true;
      });
      return out;
    };
    const refused = await run();
    assert.equal(refused.next, false);
    assert.equal(refused.status, 403);
    assert.equal(refused.body.code, 'HEAD_ONLY');

    // the same account once the member is made the head
    w.members.store.find({ _id: member._id })[0].isFamilyHead = true;
    assert.equal((await run()).next, true);
  });
});

test('one phone number with a staff account and a head account: the password picks the account', async () => {
  await withWorld({}, async (w) => {
    const { password } = await createHead(w);
    w.users.store.insert({ _id: oid(), name: 'Abdul (office)', phone: HEAD_PHONE, role: 'mahall', tenantId: TENANT, status: 'active', tokenVersion: 0, isSuperAdmin: false, password: bcrypt.hashSync('Office1password', 4) });

    assert.equal((await signIn({ phone: HEAD_PHONE, password })).body.data.user.role, 'member');
    assert.equal((await signIn({ phone: HEAD_PHONE, password: 'Office1password' })).body.data.user.role, 'mahall');
    assert.equal((await signIn({ phone: HEAD_PHONE, password: 'Neither1one' })).status, 401);
  });
});

// ---------------------------------------------------------------- the admin's view: see, copy, reset

test('the Mahallu admin can read the sign-in name and password, and the view is logged without the password', async () => {
  await withWorld({}, async (w) => {
    const { member, password } = await createHead(w);
    const reply = await call(getMemberCredentials, admin({ params: { id: String(member._id) } }));
    assert.equal(reply.status, 200);
    assert.deepEqual(reply.body.data, { username: HEAD_PHONE, password });

    const [entry] = w.audit.store.find({ action: 'family head password viewed' });
    assert.ok(entry, 'the view is in the security log');
    assert.equal(JSON.stringify(entry).includes(password), false);
  });
});

test('resetting issues a new password: the old one stops working and open sessions end', async () => {
  await withWorld({}, async (w) => {
    const { member, account, password } = await createHead(w);
    const versionBefore = account.tokenVersion ?? 0;

    const reply = await call(resetMemberPassword, admin({ params: { id: String(member._id) } }));
    assert.equal(reply.status, 200);
    const fresh = reply.body.data.password;
    assert.match(fresh, /^[A-Z2-9]{7,}$/);
    assert.notEqual(fresh, password);

    assert.equal((await signIn({ phone: HEAD_PHONE, password })).status, 401);
    assert.equal((await signIn({ phone: HEAD_PHONE, password: fresh })).status, 200);
    assert.equal(w.users.store.find({ memberId: member._id })[0].tokenVersion, versionBefore + 1);
    assert.equal((await call(getMemberCredentials, admin({ params: { id: String(member._id) } }))).body.data.password, fresh);
    assert.ok(w.audit.store.find({ action: 'family head password reset' })[0]);
  });
});

test('a head from before sign-ins existed has no password on record until the admin resets it', async () => {
  const member = { _id: oid(), tenantId: TENANT, name: 'Old Head', phone: '9000000015', status: 'active', isFamilyHead: true };
  await withWorld({ members: [member] }, async (w) => {
    const before = await call(getMemberCredentials, admin({ params: { id: String(member._id) } }));
    assert.deepEqual(before.body.data, { username: '9000000015', password: null });

    const reset = await call(resetMemberPassword, admin({ params: { id: String(member._id) } }));
    assert.equal(reset.status, 200);
    assert.equal(w.users.store.find({ memberId: member._id }).length, 1, 'the account was created');
    assert.equal((await signIn({ phone: '9000000015', password: reset.body.data.password })).status, 200);
  });
});

test('sign-in details exist only for a family head, and only inside the caller\'s own Mahallu', async () => {
  const ordinary = { _id: oid(), tenantId: TENANT, name: 'Ordinary', phone: '9000000014', status: 'active', isFamilyHead: false };
  const elsewhere = { _id: oid(), tenantId: OTHER_TENANT, name: 'Elsewhere', phone: '9000000016', status: 'active', isFamilyHead: true };
  await withWorld({ members: [ordinary, elsewhere] }, async (w) => {
    for (const handler of [getMemberCredentials, resetMemberPassword]) {
      assert.equal((await call(handler, admin({ params: { id: String(ordinary._id) } }))).status, 400);
      assert.equal((await call(handler, admin({ params: { id: String(elsewhere._id) } }))).status, 403);
      assert.equal((await call(handler, admin({ params: { id: String(oid()) } }))).status, 404);
    }
    assert.equal(w.users.store.find({}).length, 0);
  });
});

test('the credential routes are for the Mahallu admin and super admin only', () => {
  const layers: any[] = (memberRoutes as any).stack;
  for (const [path, method] of [['/:id/credentials', 'get'], ['/:id/credentials/reset', 'post']]) {
    const layer = layers.find((l) => l.route?.path === path && l.route.methods[method]);
    assert.ok(layer, `${method.toUpperCase()} ${path} exists`);
    const guards = layer.route.stack.map((s: any) => s.handle);
    const refusedFor = (role: string) => {
      let refused = false;
      for (const guard of guards) {
        if (guard.length !== 3) continue;
        const res: any = { status: () => ({ json: () => { refused = true; } }) };
        try {
          guard({ user: { role }, isSuperAdmin: false, params: { id: String(oid()) }, body: {}, query: {} }, res, () => undefined);
        } catch {
          // a validator that needs more of a real request: not the role guard
        }
      }
      return refused;
    };
    assert.equal(refusedFor('survey'), true, 'a survey user is refused');
    assert.equal(refusedFor('institute'), true, 'an institute user is refused');
    assert.equal(refusedFor('mahall'), false, 'the Mahallu admin passes');
  }
});

// ---------------------------------------------------------------- the sign-in follows the member

test("editing the head's phone number moves the sign-in to the new number and ends old sessions", async () => {
  await withWorld({}, async (w) => {
    const { member, account, password } = await createHead(w);
    const versionBefore = account.tokenVersion ?? 0;
    const reply = await call(updateMember, admin({ params: { id: String(member._id) }, body: { phone: '9000000017' } }));
    assert.equal(reply.status, 200, JSON.stringify(reply.body));

    const moved = w.users.store.find({ memberId: member._id })[0];
    assert.equal(moved.phone, '9000000017');
    assert.equal(moved.tokenVersion, versionBefore + 1);
    assert.equal((await signIn({ phone: '9000000017', password })).status, 200);
    assert.equal((await signIn({ phone: HEAD_PHONE, password })).status, 401);
  });
});

test("a head's phone number cannot be removed", async () => {
  await withWorld({}, async (w) => {
    const { member } = await createHead(w);
    const reply = await call(updateMember, admin({ params: { id: String(member._id) }, body: { phone: '' } }));
    assert.equal(reply.status, 400);
    assert.equal(w.members.store.find({ _id: member._id })[0].phone, HEAD_PHONE);
  });
});

test('an inactive head cannot sign in, and can again once active', async () => {
  await withWorld({}, async (w) => {
    const { member, password } = await createHead(w);
    await call(updateMemberStatus, admin({ params: { id: String(member._id) }, body: { status: 'inactive' } }));
    assert.equal(w.users.store.find({ memberId: member._id })[0].status, 'inactive');
    assert.equal((await signIn({ phone: HEAD_PHONE, password })).status, 403);

    await call(updateMemberStatus, admin({ params: { id: String(member._id) }, body: { status: 'active' } }));
    assert.equal((await signIn({ phone: HEAD_PHONE, password })).status, 200);
  });
});

test('a head who sets their own password leaves nothing for the admin to read', async () => {
  await withWorld({}, async (w) => {
    const { member, account, password } = await createHead(w);
    const changed = await call(changePassword, { user: { _id: account._id }, body: { currentPassword: password, newPassword: 'Mine1password' } });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));

    const view = await call(getMemberCredentials, admin({ params: { id: String(member._id) } }));
    assert.deepEqual(view.body.data, { username: HEAD_PHONE, password: null });
    assert.equal((await signIn({ phone: HEAD_PHONE, password: 'Mine1password' })).status, 200);
  });
});
