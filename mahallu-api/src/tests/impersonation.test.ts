import { test } from 'node:test';
import assert from 'assert/strict';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { startImpersonationValidation } from '../validations/authValidation';
import { startImpersonation, exitImpersonation } from '../controllers/authController';
import { authMiddleware, superAdminOnly } from '../middleware/authMiddleware';
import User from '../models/User';
import Tenant from '../models/Tenant';
import Institute from '../models/Institute';
import Member from '../models/Member';

/**
 * Super Admin "View As" is a genuinely privileged capability, so these tests
 * exercise both layers that make it safe:
 *   1. startImpersonation/exitImpersonation — the controllers that decide
 *      WHETHER a role/tenant/institute/member combination is valid.
 *   2. authMiddleware — the part that reconstructs req.user/req.isSuperAdmin/
 *      req.tenantId/req.instituteId from an impersonation token on every
 *      later request, which is what actually enforces the impersonated
 *      scope against every existing RBAC/tenant/institute check untouched
 *      elsewhere in the codebase.
 * All DB calls are stubbed directly on the models (no live database),
 * matching this project's existing test style, and restored in `finally`.
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

test('startImpersonationValidation rejects an unsupported targetRole (e.g. super_admin)', async () => {
  const errors = await runChain(startImpersonationValidation, {
    body: { targetRole: 'super_admin', tenantId: '507f1f77bcf86cd799439011' },
  });
  assert.ok(errors.length > 0);
});

test('startImpersonationValidation accepts a valid mahall request', async () => {
  const errors = await runChain(startImpersonationValidation, {
    body: { targetRole: 'mahall', tenantId: '507f1f77bcf86cd799439011' },
  });
  assert.equal(errors.length, 0);
});

test('superAdminOnly denies a non-super-admin caller (req.isSuperAdmin false)', () => {
  const { res, out } = makeRes();
  let nextCalled = false;
  superAdminOnly({ isSuperAdmin: false } as any, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(out.status, 403);
});

test('superAdminOnly allows a genuine super admin caller', () => {
  const { res } = makeRes();
  let nextCalled = false;
  superAdminOnly({ isSuperAdmin: true } as any, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('startImpersonation rejects a missing/inactive tenant', async () => {
  const originalFindById = Tenant.findById;
  (Tenant as any).findById = async () => null;
  try {
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'superAdminId', name: 'SA', phone: '8000000000' },
      body: { targetRole: 'mahall', tenantId: '507f1f77bcf86cd799439011' },
    };
    await startImpersonation(req, res);
    assert.equal(out.status, 400);
    assert.equal(out.body.success, false);
  } finally {
    (Tenant as any).findById = originalFindById;
  }
});

test('startImpersonation rejects an institute belonging to a different tenant', async () => {
  const originalTenantFindById = Tenant.findById;
  const originalInstituteFindOne = Institute.findOne;
  (Tenant as any).findById = async () => ({ _id: 'tenantA', status: 'active', name: 'Tenant A' });
  // Simulate the real query behaviour: findOne({_id, tenantId}) returns null
  // when the institute doesn't actually belong to that tenant.
  (Institute as any).findOne = async () => null;
  try {
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'superAdminId', name: 'SA', phone: '8000000000' },
      body: { targetRole: 'institute', tenantId: '507f1f77bcf86cd799439011', instituteId: '507f1f77bcf86cd799439099' },
    };
    await startImpersonation(req, res);
    assert.equal(out.status, 400);
    assert.equal(out.body.success, false);
  } finally {
    (Tenant as any).findById = originalTenantFindById;
    (Institute as any).findOne = originalInstituteFindOne;
  }
});

test('startImpersonation rejects a member belonging to a different tenant', async () => {
  const originalTenantFindById = Tenant.findById;
  const originalMemberFindOne = Member.findOne;
  (Tenant as any).findById = async () => ({ _id: 'tenantA', status: 'active', name: 'Tenant A' });
  (Member as any).findOne = async () => null;
  try {
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'superAdminId', name: 'SA', phone: '8000000000' },
      body: { targetRole: 'member', tenantId: '507f1f77bcf86cd799439011', memberId: '507f1f77bcf86cd799439098' },
    };
    await startImpersonation(req, res);
    assert.equal(out.status, 400);
    assert.equal(out.body.success, false);
  } finally {
    (Tenant as any).findById = originalTenantFindById;
    (Member as any).findOne = originalMemberFindOne;
  }
});

test('startImpersonation succeeds for mahall and mints a token carrying the ORIGINAL super admin id plus imp claims', async () => {
  const originalTenantFindById = Tenant.findById;
  (Tenant as any).findById = async () => ({ _id: 'tenantA123456789012345678', status: 'active', name: 'Tenant A' });
  try {
    const { res, out } = makeRes();
    const req: any = {
      user: { _id: 'realSuperAdminId', name: 'Real SA', phone: '8000000000' },
      body: { targetRole: 'mahall', tenantId: '507f1f77bcf86cd799439011' },
    };
    await startImpersonation(req, res);

    assert.equal(out.status, 200);
    assert.equal(out.body.success, true);
    assert.equal(out.body.data.user.role, 'mahall');
    assert.equal(out.body.data.user.isSuperAdmin, false);

    const decoded: any = jwt.verify(out.body.data.token, process.env.JWT_SECRET as string);
    assert.equal(decoded.userId, 'realSuperAdminId');
    assert.equal(decoded.imp.role, 'mahall');
    assert.equal(decoded.imp.tenantId, 'tenantA123456789012345678');
  } finally {
    (Tenant as any).findById = originalTenantFindById;
  }
});

test('exitImpersonation refuses to run when the session is not currently impersonating', async () => {
  const { res, out } = makeRes();
  await exitImpersonation({ impersonation: undefined } as any, res);
  assert.equal(out.status, 400);
  assert.equal(out.body.success, false);
});

test('exitImpersonation refuses to restore an account that is no longer super admin', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({ select: async () => ({ _id: 'x', isSuperAdmin: false, status: 'active' }) });
  try {
    const { res, out } = makeRes();
    const req: any = {
      impersonation: { isImpersonating: true, originalUserId: 'x', role: 'mahall', tenantId: 'y' },
    };
    await exitImpersonation(req, res);
    assert.equal(out.status, 403);
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('exitImpersonation restores a valid original super admin with a fresh, un-marked token', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'realSuperAdminId', isSuperAdmin: true, status: 'active', role: 'super_admin' }),
  });
  try {
    const { res, out } = makeRes();
    const req: any = {
      impersonation: { isImpersonating: true, originalUserId: 'realSuperAdminId', role: 'mahall', tenantId: 'y' },
    };
    await exitImpersonation(req, res);
    assert.equal(out.status, 200);
    assert.equal(out.body.success, true);
    const decoded: any = jwt.verify(out.body.data.token, process.env.JWT_SECRET as string);
    assert.equal(decoded.userId, 'realSuperAdminId');
    assert.equal(decoded.imp, undefined);
  } finally {
    (User as any).findById = originalFindById;
  }
});

// ─── authMiddleware: does an impersonation token actually reshape the
// request the way every downstream RBAC/tenant/institute check expects? ────

const runAuthMiddleware = (token: string) => {
  const { res, out } = makeRes();
  const req: any = { headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/families' };
  let nextCalled = false;
  return authMiddleware(req, res, () => {
    nextCalled = true;
  }).then(() => ({ req, out, nextCalled }));
};

test('authMiddleware reconstructs req.user/isSuperAdmin/tenantId for an institute impersonation token', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'realSuperAdminId', isSuperAdmin: true, status: 'active', role: 'super_admin' }),
  });
  try {
    const token = jwt.sign(
      {
        userId: 'realSuperAdminId',
        isSuperAdmin: true,
        imp: { role: 'institute', tenantId: '507f1f77bcf86cd799439011', instituteId: '507f1f77bcf86cd799439022' },
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '5m' }
    );
    const { req, nextCalled } = await runAuthMiddleware(token);
    assert.equal(nextCalled, true);
    assert.equal(req.isSuperAdmin, false);
    assert.equal(req.user.role, 'institute');
    assert.equal(req.tenantId, '507f1f77bcf86cd799439011');
    assert.equal(req.instituteId, '507f1f77bcf86cd799439022');
    assert.equal(req.impersonation.originalUserId, 'realSuperAdminId');
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('authMiddleware blocks an impersonated member session from a non-member-allowed path, exactly like a real member', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'realSuperAdminId', isSuperAdmin: true, status: 'active', role: 'super_admin' }),
  });
  try {
    const token = jwt.sign(
      {
        userId: 'realSuperAdminId',
        isSuperAdmin: true,
        imp: { role: 'member', tenantId: '507f1f77bcf86cd799439011', memberId: '507f1f77bcf86cd799439033' },
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '5m' }
    );
    const { out, nextCalled } = await runAuthMiddleware(token); // originalUrl = /api/families, not member-allowed
    assert.equal(nextCalled, false);
    assert.equal(out.status, 403);
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('authMiddleware rejects an impersonation token whose real account is no longer super admin (revoked mid-session)', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'demotedId', isSuperAdmin: false, status: 'active', role: 'mahall' }),
  });
  try {
    const token = jwt.sign(
      { userId: 'demotedId', isSuperAdmin: true, imp: { role: 'mahall', tenantId: 'tenantA' } },
      process.env.JWT_SECRET as string,
      { expiresIn: '5m' }
    );
    const { out, nextCalled } = await runAuthMiddleware(token);
    assert.equal(nextCalled, false);
    assert.equal(out.status, 403);
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('authMiddleware rejects a tampered/invalid imp.role value', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'realSuperAdminId', isSuperAdmin: true, status: 'active', role: 'super_admin' }),
  });
  try {
    const token = jwt.sign(
      { userId: 'realSuperAdminId', isSuperAdmin: true, imp: { role: 'super_admin', tenantId: 'tenantA' } },
      process.env.JWT_SECRET as string,
      { expiresIn: '5m' }
    );
    const { out, nextCalled } = await runAuthMiddleware(token);
    assert.equal(nextCalled, false);
    assert.equal(out.status, 401);
  } finally {
    (User as any).findById = originalFindById;
  }
});

test('a normal (non-impersonation) token still authenticates exactly as before', async () => {
  const originalFindById = User.findById;
  (User as any).findById = () => ({
    select: async () => ({ _id: 'normalUserId', isSuperAdmin: false, status: 'active', role: 'mahall', tenantId: 'tenantA' }),
  });
  try {
    const token = jwt.sign({ userId: 'normalUserId', isSuperAdmin: false }, process.env.JWT_SECRET as string, {
      expiresIn: '5m',
    });
    const { req, nextCalled } = await runAuthMiddleware(token);
    assert.equal(nextCalled, true);
    assert.equal(req.isSuperAdmin, false);
    assert.equal(req.user.role, 'mahall');
    assert.equal(req.impersonation, undefined);
  } finally {
    (User as any).findById = originalFindById;
  }
});
