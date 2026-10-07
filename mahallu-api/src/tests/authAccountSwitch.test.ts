import { test } from 'node:test';
import assert from 'assert/strict';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { switchAccountValidation } from '../validations/authValidation';
import { getAvailableAccounts, switchAccount } from '../controllers/authController';
import User from '../models/User';
import Tenant from '../models/Tenant';
import { invalidateTenantStatus } from '../services/tenantStatusService';

/**
 * Account switching's security guarantee:
 *
 *   A session may switch only between accounts tied to the phone number its holder PROVED they
 *   own with an OTP during this sign-in (the JWT's `pp` claim, surfaced as `req.provenPhone`).
 *
 * "The target has the same phone as my current account" is NOT proof: tenant admins can create
 * accounts and edit users' phone numbers, so a phone number stored on an account says nothing about
 * who controls it. Super Admin accounts are never switch targets. role/tenantId/instituteId in the
 * request body are never read.
 *
 * These tests stub the Mongoose model calls directly (no live database, matching this project's
 * existing test style), so the guarantee is exercised as real handler behaviour.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

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

/** Run `fn` with User.findById / User.find / Tenant.findById stubbed, and restore them afterwards. */
const withModels = async (
  stubs: { findById?: (id: string) => any; find?: (query: any) => any; tenantStatus?: string },
  fn: () => Promise<void>
) => {
  const original = { findById: User.findById, find: User.find, tenantFindById: Tenant.findById };
  invalidateTenantStatus();
  if (stubs.findById) (User as any).findById = (id: string) => ({ select: async () => stubs.findById!(id) });
  if (stubs.find) (User as any).find = async (query: any) => stubs.find!(query);
  (Tenant as any).findById = () => ({ select: async () => ({ status: stubs.tenantStatus ?? 'active' }) });
  try {
    await fn();
  } finally {
    (User as any).findById = original.findById;
    (User as any).find = original.find;
    (Tenant as any).findById = original.tenantFindById;
    invalidateTenantStatus();
  }
};

const victim = { _id: 'victimId', phone: '919111111111', status: 'active', role: 'mahall', tenantId: null, isSuperAdmin: false, save: async () => {} };

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

test('getAvailableAccounts: a session without an OTP-proven phone is offered no accounts and nothing is queried', async () => {
  let queried = false;
  await withModels({ find: () => { queried = true; return []; } }, async () => {
    const { res, out } = makeRes();
    // A password-only session: the account carries a phone, but nobody proved they own it.
    await getAvailableAccounts({ user: { _id: 'callerId', phone: '919111111111' } } as any, res);
    assert.equal(out.body.success, true);
    assert.deepEqual(out.body.data.accounts, []);
    assert.equal(queried, false, 'must not look up siblings from the account\'s stored phone');
  });
});

test("getAvailableAccounts: looks up siblings by the PROVEN phone, never the current account's stored phone", async () => {
  let captured: any = null;
  await withModels(
    {
      find: (query) => {
        captured = query;
        return [
          { _id: 'callerId', phone: '918000000000', role: 'mahall', name: 'Caller', tenantId: null, instituteId: null },
          { _id: 'siblingId', phone: '+918000000000', role: 'member', name: 'Sibling', tenantId: null, instituteId: null },
        ];
      },
    },
    async () => {
      const { res, out } = makeRes();
      // The stored phone on the current account was edited to someone else's number; the proof is the original.
      const req: any = { user: { _id: 'callerId', phone: '919111111111' }, provenPhone: '918000000000' };
      await getAvailableAccounts(req, res);

      assert.equal(captured.status, 'active');
      assert.deepEqual(captured.isSuperAdmin, { $ne: true });
      assert.deepEqual(captured.role, { $ne: 'super_admin' });
      assert.ok(captured.phone.$in.includes('918000000000'));
      assert.ok(!captured.phone.$in.includes('919111111111'), 'the edited stored phone must not be searched');

      const accounts = out.body.data.accounts;
      assert.equal(accounts.length, 2);
      assert.equal(accounts.find((a: any) => a.userId === 'callerId').isCurrent, true);
      assert.equal(accounts.find((a: any) => a.userId === 'siblingId').isCurrent, false);
    }
  );
});

test('getAvailableAccounts: accounts of a suspended Mahallu are not offered', async () => {
  await withModels(
    {
      tenantStatus: 'suspended',
      find: () => [{ _id: 'siblingId', phone: '918000000000', role: 'mahall', name: 'S', tenantId: 'tenantX', instituteId: null }],
    },
    async () => {
      const { res, out } = makeRes();
      await getAvailableAccounts({ user: { _id: 'callerId', phone: '918000000000' }, provenPhone: '918000000000' } as any, res);
      assert.deepEqual(out.body.data.accounts, []);
    }
  );
});

test('switchAccount: a password-only session (no proven phone) cannot switch, even to an account with the same stored phone', async () => {
  await withModels({ findById: () => ({ ...victim, phone: '918000000000' }) }, async () => {
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'callerId', phone: '918000000000' }, // same phone as the target...
      body: { targetUserId: '507f1f77bcf86cd799439011' }, // ...but never OTP-proven on this session
    };
    await switchAccount(req, res);
    assert.equal(out.status, 403);
    assert.equal(out.body.code, 'OTP_REQUIRED');
    assert.equal(out.body.data, undefined);
  });
});

test('TAKEOVER REGRESSION: an admin who puts a victim\'s number on an account they control cannot switch into the victim', async () => {
  // The attack: the attacker signed in (OTP) with THEIR OWN phone, so the session proves 918000000000.
  // Then they edited their account's stored phone to the victim's number 919111111111 and asked to
  // switch into the victim's account, hoping "same phone" would be accepted.
  await withModels({ findById: () => victim }, async () => {
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'attackerAccountId', phone: '919111111111' }, // edited to the victim's number
      provenPhone: '918000000000', // what the attacker actually proved
      body: { targetUserId: '507f1f77bcf86cd799439011' },
    };
    await switchAccount(req, res);
    assert.equal(out.status, 403);
    assert.equal(out.body.success, false);
    assert.equal(out.body.data, undefined, 'no token for the victim');
  });
});

test('TAKEOVER REGRESSION: a Super Admin account is never a switch target, even with a matching proven phone', async () => {
  await withModels(
    { findById: () => ({ _id: 'superId', phone: '918000000000', status: 'active', role: 'super_admin', isSuperAdmin: true, tenantId: null, save: async () => {} }) },
    async () => {
      const { res, out } = makeRes();
      const req: any = {
        user: { _id: 'callerId', phone: '918000000000' },
        provenPhone: '918000000000',
        body: { targetUserId: '507f1f77bcf86cd799439011' },
      };
      await switchAccount(req, res);
      assert.equal(out.status, 403);
      assert.equal(out.body.data, undefined);
    }
  );
});

test('switchAccount: rejects an inactive target even when the phone matches', async () => {
  await withModels({ findById: () => ({ ...victim, phone: '918000000000', status: 'inactive' }) }, async () => {
    const { res, out } = makeRes();
    await switchAccount({ user: { _id: 'callerId' }, provenPhone: '918000000000', body: { targetUserId: '507f1f77bcf86cd799439011' } } as any, res);
    assert.equal(out.status, 403);
  });
});

test('switchAccount: target not found is rejected', async () => {
  await withModels({ findById: () => null }, async () => {
    const { res, out } = makeRes();
    await switchAccount({ user: { _id: 'callerId' }, provenPhone: '918000000000', body: { targetUserId: '507f1f77bcf86cd799439011' } } as any, res);
    assert.equal(out.status, 404);
  });
});

test('switchAccount: a target of a suspended Mahallu is refused', async () => {
  await withModels(
    { tenantStatus: 'suspended', findById: () => ({ ...victim, phone: '918000000000', tenantId: 'tenantX' }) },
    async () => {
      const { res, out } = makeRes();
      await switchAccount({ user: { _id: 'callerId' }, provenPhone: '918000000000', body: { targetUserId: '507f1f77bcf86cd799439011' } } as any, res);
      assert.equal(out.status, 403);
      assert.equal(out.body.code, 'TENANT_SUSPENDED');
    }
  );
});

test('LEGITIMATE multi-role switch: the person who proved their phone can move between their own accounts', async () => {
  const targetDoc: any = {
    _id: 'siblingId',
    phone: '+918000000000', // stored in a different format than the proof: still the same number
    status: 'active',
    role: 'mahall',
    tenantId: 'realTenantId',
    instituteId: null,
    isSuperAdmin: false,
    tokenVersion: 3,
    save: async () => {},
  };
  await withModels({ findById: () => targetDoc }, async () => {
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'callerId', phone: '918000000000' },
      provenPhone: '918000000000',
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
    assert.equal(out.body.data.user.role, 'mahall');
    assert.equal(out.body.data.user.tenantId, 'realTenantId');
    assert.notEqual(out.body.data.user.role, 'super_admin');

    const claims: any = jwt.verify(out.body.data.token, process.env.JWT_SECRET as string);
    assert.equal(claims.userId, 'siblingId');
    assert.equal(claims.pp, '918000000000', 'the proven phone follows the person to the new session');
    assert.equal(claims.tv, 3, 'the token carries the target account\'s current token version');
  });
});
