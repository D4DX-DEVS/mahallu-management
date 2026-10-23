/**
 * A Family Head adds people to their own family: ownership, approval, duplicates, and all-or-nothing
 * creation of the member and their OTP-only login account.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';

import Family from '../models/Family';
import Member from '../models/Member';
import User from '../models/User';
import Counter from '../models/Counter';
import { MasterCategoryValue } from '../models/MasterCategory';
import { ActivityLog } from '../models/Social';
import { createFamilyMember } from '../controllers/familyHeadController';
import { getAllMembers } from '../controllers/memberController';
import { getOwnFamilyMembers } from '../controllers/memberUserController';
import { verifyOTP } from '../controllers/otpController';
import Tenant from '../models/Tenant';
import { invalidateTenantStatus } from '../services/tenantStatusService';
import memberUserRoutes from '../routes/memberUserRoutes';
import { memberUserOnly } from '../middleware/authMiddleware';
import { createFamilyMemberValidation } from '../validations/memberUserValidation';
import { call, installFake, oid } from './support/fakeMongo';

const TENANT = oid();
const OTHER_TENANT = oid();
const FAMILY = oid();
const OTHER_FAMILY = oid();
const HEAD = oid();
const OTHER_HEAD = oid();
const HEAD_USER = oid();

const family = (extra: Record<string, unknown> = {}) => ({
  _id: FAMILY,
  tenantId: TENANT,
  houseName: 'Kallingal',
  mahallId: 'FID1',
  status: 'approved',
  ...extra,
});

const member = (extra: Record<string, unknown> = {}) => ({
  _id: HEAD,
  tenantId: TENANT,
  familyId: FAMILY,
  familyName: 'Kallingal',
  mahallId: 'FID1-1',
  name: 'Head Person',
  isFamilyHead: true,
  status: 'active',
  phone: '9000000001',
  ...extra,
});

const accountOf = (m: any) => ({
  _id: HEAD_USER,
  name: m.name,
  phone: m.phone,
  role: 'member',
  tenantId: m.tenantId,
  memberId: m._id,
  status: 'active',
  password: 'x',
});

const asHead = (body: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  tenantId: String(TENANT),
  user: { _id: HEAD_USER, role: 'member', memberId: HEAD, tenantId: TENANT },
  body,
  ...extra,
});

const withWorld = async (
  seed: { families?: any[]; members?: any[]; users?: any[] },
  run: (w: { members: any; users: any; audit: any }) => Promise<void>
) => {
  const fakes = [
    installFake(Family, seed.families ?? [family()]),
    installFake(Member, seed.members ?? [member()]),
    installFake(User, seed.users ?? [accountOf(member())]),
    installFake(Counter),
  ];
  const audit = installFake(ActivityLog);
  try {
    await run({ members: fakes[1], users: fakes[2], audit });
  } finally {
    audit.restore();
    fakes.forEach((f) => f.restore());
  }
};

const person = { name: 'Aisha Kallingal', gender: 'female', dateOfBirth: '2012-05-01', relationship: 'daughter', phone: '9000000002' };

test('a Family Head adds a member to their own family and the member gets an OTP-only login account', async () => {
  await withWorld({}, async ({ members, users }) => {
    const reply = await call(createFamilyMember, asHead(person));
    assert.equal(reply.status, 201);
    assert.equal(reply.body.loginAccountCreated, true);

    const added = members.store.find({ name: 'Aisha Kallingal' })[0];
    assert.equal(String(added.familyId), String(FAMILY));
    assert.equal(String(added.tenantId), String(TENANT));
    assert.equal(added.familyName, 'Kallingal');
    assert.match(added.mahallId, /^FID1-\d+$/);
    assert.equal(added.isFamilyHead, false);
    assert.equal(added.status, 'active');

    const account = users.store.find({ phone: '9000000002' })[0];
    assert.equal(account.role, 'member');
    assert.equal(String(account.memberId), String(added._id));
    assert.equal(String(account.tenantId), String(TENANT));
    assert.equal(account.username, undefined, 'members have no username');
    assert.deepEqual({ ...account.permissions }, { view: true, add: false, edit: false, delete: false });
  });
});

test('no password is created, shown or returned for the new member', async () => {
  await withWorld({}, async ({ users }) => {
    const reply = await call(createFamilyMember, asHead(person));
    const text = JSON.stringify(reply.body);
    assert.doesNotMatch(text, /password/i);
    assert.doesNotMatch(reply.body.message, /password|sent/i);
    // the stored secret is a hash of a random value nobody was told
    assert.match(users.store.find({ phone: '9000000002' })[0].password, /^\$2[aby]\$/);
  });
});

test('a person without a phone number is added without a login account, and says so', async () => {
  await withWorld({}, async ({ users }) => {
    const reply = await call(createFamilyMember, asHead({ name: 'Little One' }));
    assert.equal(reply.status, 201);
    assert.equal(reply.body.loginAccountCreated, false);
    assert.match(reply.body.message, /no sign-in/i);
    assert.equal(users.store.find({}).length, 1);
  });
});

test('the body cannot choose the family, the Mahallu, the status or the head flag', async () => {
  await withWorld(
    {
      families: [family(), family({ _id: OTHER_FAMILY, tenantId: OTHER_TENANT, mahallId: 'FID9', houseName: 'Elsewhere' })],
    },
    async ({ members }) => {
      const reply = await call(
        createFamilyMember,
        asHead({ ...person, familyId: String(OTHER_FAMILY), tenantId: String(OTHER_TENANT), status: 'inactive', isFamilyHead: true })
      );
      assert.equal(reply.status, 201);
      const added = members.store.find({ name: 'Aisha Kallingal' })[0];
      assert.equal(String(added.familyId), String(FAMILY));
      assert.equal(String(added.tenantId), String(TENANT));
      assert.equal(added.status, 'active');
      assert.equal(added.isFamilyHead, false);
    }
  );
});

test('only the head of an approved family may add members', async () => {
  const ordinary = member({ _id: oid(), isFamilyHead: false, phone: '9000000005', mahallId: 'FID1-2' });
  const otherFamilyHead = member({ _id: OTHER_HEAD, familyId: OTHER_FAMILY, phone: '9000000006', mahallId: 'FID2-1' });
  await withWorld({ members: [member(), ordinary, otherFamilyHead], families: [family(), family({ _id: OTHER_FAMILY, status: 'pending', mahallId: 'FID2' })] }, async ({ members }) => {
    const as = (memberId: unknown) => asHead(person, { user: { _id: oid(), role: 'member', memberId, tenantId: TENANT } });

    const notHead = await call(createFamilyMember, as(ordinary._id));
    assert.equal(notHead.status, 403);

    const noMember = await call(createFamilyMember, as(undefined));
    assert.equal(noMember.status, 403);

    const unapproved = await call(createFamilyMember, as(OTHER_HEAD));
    assert.equal(unapproved.status, 409);
    assert.match(unapproved.body.message, /waiting for approval/);

    assert.equal(members.store.find({ name: 'Aisha Kallingal' }).length, 0);
  });
});

test('an inactive head, a head of another Mahallu and a View As session are refused', async () => {
  await withWorld({ members: [member({ status: 'inactive' })] }, async () => {
    assert.equal((await call(createFamilyMember, asHead(person))).status, 403);
  });
  await withWorld({}, async () => {
    const wrongTenant = asHead(person, { user: { _id: HEAD_USER, role: 'member', memberId: HEAD, tenantId: OTHER_TENANT } });
    assert.equal((await call(createFamilyMember, wrongTenant)).status, 403);
    assert.equal((await call(createFamilyMember, asHead(person, { impersonation: { isImpersonating: true } }))).status, 403);
  });
});

test('adding the same person twice, or retrying a request, creates one member and one account', async () => {
  await withWorld({}, async ({ members, users }) => {
    const first = await call(createFamilyMember, asHead(person));
    assert.equal(first.status, 201);
    const retry = await call(createFamilyMember, asHead(person));
    assert.equal(retry.status, 409);
    assert.match(retry.body.message, /already in your family/);
    // same name in a different case is the same person
    const shouted = await call(createFamilyMember, asHead({ ...person, name: 'AISHA KALLINGAL', phone: '9000000003' }));
    assert.equal(shouted.status, 409);

    assert.equal(members.store.find({ name: 'Aisha Kallingal' }).length, 1);
    assert.equal(users.store.find({ role: 'member' }).length, 2, 'head + one new member');
  });
});

test('two identical requests sent at once create exactly one member', async () => {
  await withWorld({}, async ({ members }) => {
    const replies = await Promise.all([call(createFamilyMember, asHead(person)), call(createFamilyMember, asHead(person))]);
    const created = replies.filter((r) => r.status === 201).length;
    assert.equal(created >= 1, true);
    // the unique phone rule is the backstop for a true race; whatever happened, no second person with that number exists
    assert.equal(members.store.find({ phone: '9000000002' }).length, 1);
  });
});

test('a phone number that already has a member account in this Mahallu is refused', async () => {
  await withWorld({}, async ({ members }) => {
    const reply = await call(createFamilyMember, asHead({ ...person, phone: '9000000001' }));
    assert.equal(reply.status, 409);
    assert.match(reply.body.message, /phone number already exists/);
    assert.equal(members.store.find({ name: 'Aisha Kallingal' }).length, 0);
  });
});

test('if the login account cannot be created, the member is not left behind', async () => {
  await withWorld({}, async ({ members, users }) => {
    users.store.failOn('User.save');
    const reply = await call(createFamilyMember, asHead(person));
    assert.equal(reply.status, 500);
    assert.equal(members.store.find({ name: 'Aisha Kallingal' }).length, 0, 'the member was rolled back');
    assert.equal(users.store.find({ phone: '9000000002' }).length, 0);

    // and the same request works once the fault is gone
    const retry = await call(createFamilyMember, asHead(person));
    assert.equal(retry.status, 201);
    assert.equal(members.store.find({ name: 'Aisha Kallingal' }).length, 1);
  });
});

test('adding a member is written to the audit log without secrets', async () => {
  await withWorld({}, async ({ audit }) => {
    await call(createFamilyMember, asHead(person));
    const [entry] = audit.store.find({});
    assert.equal(entry.action, 'family member created');
    assert.equal(String(entry.tenantId), String(TENANT));
    assert.equal(String(entry.userId), String(HEAD_USER));
    assert.doesNotMatch(JSON.stringify(entry), /password|\$2[aby]\$/i);
  });
});

// ---------------------------------------------------------------- validation and routing

const validate = async (body: any) => {
  const req: any = { body, params: {}, query: {}, headers: {} };
  for (const chain of createFamilyMemberValidation) await chain.run(req);
  return validationResult(req).array().map((e: any) => `${e.path}: ${e.msg}`);
};

test('the member form needs a name, and checks the phone number and date of birth', async () => {
  const cats = installFake(MasterCategoryValue, [
    { categoryKey: 'gender', code: 'female', categoryId: oid(), label: 'Female' },
    { categoryKey: 'relationship', code: 'daughter', categoryId: oid(), label: 'Daughter' },
  ]);
  try {
    assert.deepEqual(await validate({ name: 'Aisha K', gender: 'female', relationship: 'daughter', phone: '9000000002', dateOfBirth: '2012-05-01' }), []);
    assert.deepEqual(await validate({ name: 'Aisha K' }), []);
    assert.equal((await validate({})).length > 0, true, 'no name');
    assert.equal((await validate({ name: 'A' })).length > 0, true, 'name too short');
    assert.equal((await validate({ name: 'Aisha K', phone: '123' })).length > 0, true, 'bad phone');
    assert.equal((await validate({ name: 'Aisha K', dateOfBirth: '2999-01-01' })).length > 0, true, 'future date');
    assert.equal((await validate({ name: 'Aisha K', dateOfBirth: 'yesterday' })).length > 0, true, 'not a date');
    assert.equal((await validate({ name: 'Aisha K', gender: 'unknown-value' })).length > 0, true, 'unknown category value');
  } finally {
    cats.restore();
  }
});

test('the route is member-only and sits behind sign-in', () => {
  const layers: any[] = (memberUserRoutes as any).stack;
  const names = layers.filter((l) => !l.route).map((l) => l.handle);
  assert.ok(names.includes(memberUserOnly), 'router-level member guard');
  const route = layers.find((l) => l.route?.path === '/family-members');
  assert.ok(route, 'POST /family-members exists');
  assert.deepEqual(Object.keys(route.route.methods), ['post']);
  assert.ok(layers.indexOf(layers.find((l) => l.handle === memberUserOnly)) < layers.indexOf(route));
});

// ---------------------------------------------------------------- the whole flow, end to end

const otpService = require('../services/otpService');

/** Accept any code for the duration of one test: the OTP check itself is covered by its own suite. */
const withAcceptedOtp = async (run: () => Promise<void>) => {
  const original = otpService.verifyAndConsumeOtp;
  otpService.verifyAndConsumeOtp = async () => 'ok';
  try {
    await run();
  } finally {
    otpService.verifyAndConsumeOtp = original;
  }
};

test('end to end: the head adds a member, the admin and the head both see them, and they sign in by OTP', async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const tenants = installFake(Tenant, [{ _id: TENANT, name: 'Beypore', code: 'B', status: 'active' }]);
  invalidateTenantStatus();
  try {
    await withWorld({}, async ({ members, users }) => {
      // 1. the head adds the member
      const created = await call(createFamilyMember, asHead(person));
      assert.equal(created.status, 201);
      const added = members.store.find({ name: 'Aisha Kallingal' })[0];

      // 2. the Mahallu admin's member list shows them, inside the Mahallu
      const adminList = await call(getAllMembers, { tenantId: String(TENANT), user: { _id: oid(), role: 'mahall' }, query: {} });
      assert.equal(adminList.status, 200);
      assert.ok(adminList.body.data.some((m: any) => String(m._id) === String(added._id)));

      // 3. the head's own family list shows them
      const headList = await call(getOwnFamilyMembers, { user: { _id: HEAD_USER, role: 'member', memberId: HEAD, tenantId: TENANT }, query: {} });
      assert.equal(headList.status, 200);
      assert.ok(headList.body.data.some((m: any) => String(m._id) === String(added._id)));

      // 4. the new member signs in with an OTP to their own number and lands on THEIR account
      await withAcceptedOtp(async () => {
        const signedIn = await call(verifyOTP, { body: { phone: '9000000002', otp: '123456' } });
        assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
        const user = signedIn.body.data.user;
        assert.equal(user.role, 'member');
        assert.equal(String(user.memberId), String(added._id));
        assert.equal(String(user.tenantId), String(TENANT));
        assert.ok(signedIn.body.data.token);
        assert.equal(users.store.find({ memberId: added._id }).length, 1, 'exactly one account for the member');
      });
    });
  } finally {
    tenants.restore();
    invalidateTenantStatus();
  }
});

test("a head of another family does not see, and cannot add into, this family", async () => {
  const otherHead = member({ _id: OTHER_HEAD, familyId: OTHER_FAMILY, phone: '9000000006', mahallId: 'FID2-1', name: 'Other Head' });
  const otherUser = { ...accountOf(otherHead), _id: oid(), phone: '9000000006' };
  await withWorld(
    {
      families: [family(), family({ _id: OTHER_FAMILY, mahallId: 'FID2', houseName: 'Elsewhere' })],
      members: [member(), otherHead],
      users: [accountOf(member()), otherUser],
    },
    async ({ members }) => {
      await call(createFamilyMember, asHead(person));
      const added = members.store.find({ name: 'Aisha Kallingal' })[0];

      const otherList = await call(getOwnFamilyMembers, { user: { _id: otherUser._id, role: 'member', memberId: OTHER_HEAD, tenantId: TENANT }, query: {} });
      assert.equal(otherList.body.data.some((m: any) => String(m._id) === String(added._id)), false, 'not visible to the other family');

      // the other head adding a person puts them in THEIR family, never in the first one
      const theirs = await call(
        createFamilyMember,
        asHead({ name: 'Their Child' }, { user: { _id: otherUser._id, role: 'member', memberId: OTHER_HEAD, tenantId: TENANT } })
      );
      assert.equal(theirs.status, 201);
      assert.equal(String(members.store.find({ name: 'Their Child' })[0].familyId), String(OTHER_FAMILY));
    }
  );
});
