import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import {
  verifyOtpRateLimiter,
  loginRateLimiter,
  sendOtpRateLimiter,
  publicVerifyRateLimiter,
  switchAccountRateLimiter,
  selectAccountRateLimiter,
} from '../middleware/rateLimit';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { getCurrentUser, selectAccount, setTwoFactor } from '../controllers/authController';
import { listCertificates, downloadCertificate } from '../controllers/certificateController';
import { signSessionToken, signImpersonationToken, toPublicUser } from '../utils/sessionToken';
import authRoutes from '../routes/authRoutes';
import certificateRoutes from '../routes/certificateRoutes';
import User from '../models/User';
import Tenant from '../models/Tenant';
import Certificate from '../models/Certificate';
import * as uploadService from '../services/uploadService';
import { invalidateTenantStatus } from '../services/tenantStatusService';
import { call, oid } from './support/fakeMongo';

// One root suite so stubs installed by this file's hooks never leak into other suites when every test
// file is imported into the single `npm test` process.
describe('[isolated] auth hardening', () => {
  const SECRET = 'auth-hardening-test-secret';
  let savedSecret: string | undefined;

  beforeEach(() => {
    savedSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = SECRET;
  });
  afterEach(() => {
    if (savedSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedSecret;
  });

  // ───────────────────────────── helpers ─────────────────────────────

  /** Run a limiter once; resolves to the status the client would see. */
  const hit = (limiter: any, req: Record<string, unknown>): number => {
    let status = 200;
    let passed = false;
    const res: any = {
      status(code: number) {
        status = code;
        return res;
      },
      json() {
        return res;
      },
    };
    limiter({ ip: '203.0.113.9', headers: {}, body: {}, ...req }, res, () => {
      passed = true;
    });
    return passed ? 200 : status;
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

  // Each test uses addresses/phones of its own: the limiter stores live for the whole process.
  let seq = 0;
  const unique = () => {
    seq += 1;
    return { ip: `198.51.100.${(seq % 250) + 1}`, phone: `90000${String(10000 + seq)}` };
  };

  // ───────────────────────── D1: limiter isolation ─────────────────────────

  describe('rate limiters are independent of each other', () => {
    it("login attempts for a number do not use up that number's send-otp or verify-otp budget", () => {
      const { ip, phone } = unique();
      for (let i = 0; i < 10; i += 1) assert.equal(hit(loginRateLimiter, { ip, body: { phone } }), 200);
      assert.equal(hit(loginRateLimiter, { ip, body: { phone } }), 429, 'login is blocked after its own 10');
      assert.equal(hit(sendOtpRateLimiter, { ip, body: { phone } }), 200);
      assert.equal(hit(verifyOtpRateLimiter, { ip, body: { phone } }), 200);
    });

    it('verify-otp attempts do not consume the send-otp or login budget', () => {
      const { ip, phone } = unique();
      for (let i = 0; i < 8; i += 1) assert.equal(hit(verifyOtpRateLimiter, { ip, body: { phone } }), 200);
      assert.equal(hit(verifyOtpRateLimiter, { ip, body: { phone } }), 429);
      for (let i = 0; i < 5; i += 1) assert.equal(hit(sendOtpRateLimiter, { ip, body: { phone } }), 200, `send-otp ${i + 1}`);
      for (let i = 0; i < 10; i += 1) assert.equal(hit(loginRateLimiter, { ip, body: { phone } }), 200, `login ${i + 1}`);
    });

    it('send-otp attempts do not consume the verify-otp budget', () => {
      const { ip, phone } = unique();
      for (let i = 0; i < 5; i += 1) assert.equal(hit(sendOtpRateLimiter, { ip, body: { phone } }), 200);
      assert.equal(hit(sendOtpRateLimiter, { ip, body: { phone } }), 429);
      for (let i = 0; i < 8; i += 1) assert.equal(hit(verifyOtpRateLimiter, { ip, body: { phone } }), 200, `verify ${i + 1}`);
    });

    it('each limiter still blocks at exactly its documented maximum', () => {
      const cases: Array<[string, any, number]> = [
        ['login', loginRateLimiter, 10],
        ['send-otp', sendOtpRateLimiter, 5],
        ['verify-otp', verifyOtpRateLimiter, 8],
      ];
      for (const [name, limiter, max] of cases) {
        const { ip, phone } = unique();
        for (let i = 1; i <= max; i += 1) assert.equal(hit(limiter, { ip, body: { phone } }), 200, `${name} attempt ${i}`);
        assert.equal(hit(limiter, { ip, body: { phone } }), 429, `${name} attempt ${max + 1}`);
      }
      // switch-account: 10 per authenticated user
      const user = { _id: oid() };
      for (let i = 1; i <= 10; i += 1) assert.equal(hit(switchAccountRateLimiter, { ip: '192.0.2.1', user }), 200, `switch ${i}`);
      assert.equal(hit(switchAccountRateLimiter, { ip: '192.0.2.1', user }), 429);
      assert.equal(hit(switchAccountRateLimiter, { ip: '192.0.2.1', user: { _id: oid() } }), 200, 'another user is unaffected');
    });

    it('a different phone, or a different address, has its own budget', () => {
      const a = unique();
      const b = unique();
      for (let i = 0; i < 11; i += 1) hit(loginRateLimiter, { ip: a.ip, body: { phone: a.phone } });
      assert.equal(hit(loginRateLimiter, { ip: a.ip, body: { phone: a.phone } }), 429);
      assert.equal(hit(loginRateLimiter, { ip: a.ip, body: { phone: b.phone } }), 200);
      assert.equal(hit(loginRateLimiter, { ip: b.ip, body: { phone: a.phone } }), 200);
    });

    it('the phone is normalised, so +91 / 0 / bare forms share one budget within a limiter', () => {
      const { ip, phone } = unique();
      for (let i = 0; i < 10; i += 1) hit(sendOtpRateLimiter, { ip, body: { phone } });
      assert.equal(hit(sendOtpRateLimiter, { ip, body: { phone: `+91${phone}` } }), 429);
    });

    it('a budget refills once its own window has passed', () => {
      const { ip, phone } = unique();
      const t0 = 1_800_000_000_000;
      const now = mock.method(Date, 'now', () => t0);
      try {
        for (let i = 0; i < 9; i += 1) hit(verifyOtpRateLimiter, { ip, body: { phone } });
        assert.equal(hit(verifyOtpRateLimiter, { ip, body: { phone } }), 429);
        now.mock.mockImplementation(() => t0 + 2 * 60 * 1000 + 1);
        assert.equal(hit(verifyOtpRateLimiter, { ip, body: { phone } }), 200);
      } finally {
        now.mock.restore();
      }
    });

    it("sweeping one limiter never deletes another limiter's live entries", () => {
      const { ip, phone } = unique();
      const t0 = 1_800_100_000_000;
      const now = mock.method(Date, 'now', () => t0);
      try {
        // A live send-otp entry (10 minute window).
        hit(sendOtpRateLimiter, { ip, body: { phone } });
        const sendStore = (sendOtpRateLimiter as any).storeSize();
        // Three minutes later verify-otp (2 minute window) writes enough to trigger several sweeps.
        now.mock.mockImplementation(() => t0 + 3 * 60 * 1000);
        for (let i = 0; i < 1100; i += 1) hit(verifyOtpRateLimiter, { ip: `10.1.${Math.floor(i / 250)}.${i % 250}`, body: { phone: `91${String(10000000 + i)}` } });
        assert.equal((sendOtpRateLimiter as any).storeSize(), sendStore, 'the send-otp store was untouched');
        // The send-otp entry still counts: 4 more are allowed (5 total), the 6th is refused.
        for (let i = 0; i < 4; i += 1) assert.equal(hit(sendOtpRateLimiter, { ip, body: { phone } }), 200);
        assert.equal(hit(sendOtpRateLimiter, { ip, body: { phone } }), 429);
      } finally {
        now.mock.restore();
      }
    });

    it('a limiter sweeps its own expired entries so the store does not grow without bound', () => {
      const t0 = 1_800_200_000_000;
      const now = mock.method(Date, 'now', () => t0);
      try {
        const before = (verifyOtpRateLimiter as any).storeSize();
        for (let i = 0; i < 400; i += 1) hit(verifyOtpRateLimiter, { ip: `10.2.${Math.floor(i / 250)}.${i % 250}`, body: { phone: `92${String(10000000 + i)}` } });
        now.mock.mockImplementation(() => t0 + 3 * 60 * 1000);
        for (let i = 0; i < 600; i += 1) hit(verifyOtpRateLimiter, { ip: `10.3.${Math.floor(i / 250)}.${i % 250}`, body: { phone: `93${String(10000000 + i)}` } });
        const after = (verifyOtpRateLimiter as any).storeSize();
        assert.ok(after < before + 1000, `expired entries were swept (grew by ${after - before})`);
      } finally {
        now.mock.restore();
      }
    });

    it('the exported limiters keep their names', () => {
      assert.equal((loginRateLimiter as any).limiterName, 'login');
      assert.equal((sendOtpRateLimiter as any).limiterName, 'send-otp');
      assert.equal((verifyOtpRateLimiter as any).limiterName, 'verify-otp');
      assert.equal((publicVerifyRateLimiter as any).limiterName, 'public-verify');
      assert.equal((switchAccountRateLimiter as any).limiterName, 'switch-account');
      assert.equal((selectAccountRateLimiter as any).limiterName, 'select-account');
    });
  });

  describe('public certificate verification limiter', () => {
    it('is per client address: 30 per minute for one address, and another address is not affected', () => {
      for (let i = 1; i <= 30; i += 1) assert.equal(hit(publicVerifyRateLimiter, { ip: '203.0.113.50' }), 200, `request ${i}`);
      assert.equal(hit(publicVerifyRateLimiter, { ip: '203.0.113.50' }), 429);
      assert.equal(hit(publicVerifyRateLimiter, { ip: '203.0.113.51' }), 200, 'a different visitor has their own bucket');
    });

    it('ignores X-Forwarded-For: only req.ip counts, so the header cannot dodge or share a bucket', () => {
      for (let i = 0; i < 30; i += 1) hit(publicVerifyRateLimiter, { ip: '203.0.113.60' });
      const spoofed = { ip: '203.0.113.60', headers: { 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' } };
      assert.equal(hit(publicVerifyRateLimiter, spoofed), 429, 'a spoofed header does not reset the budget');
      const other = { ip: '203.0.113.61', headers: { 'x-forwarded-for': '203.0.113.60' } };
      assert.equal(hit(publicVerifyRateLimiter, other), 200, "a header naming another address does not borrow that address's budget");
    });

    it('the limiter source reads req.ip and no proxy header', () => {
      const source = fs.readFileSync(path.resolve(__dirname, '..', 'middleware', 'rateLimit.ts'), 'utf8');
      assert.match(source, /req\.ip/);
      assert.doesNotMatch(source, /x-forwarded|x-real-ip/i);
    });
  });

  // ───────────────────────── D2: select-account ─────────────────────────

  describe('POST /auth/select-account', () => {
    const preAuth = (phone: string) => jwt.sign({ phone, purpose: 'role_selection' }, SECRET, { expiresIn: '5m', algorithm: 'HS256' });

    it('is rate limited: the route runs the select-account limiter after validation and before the handler', () => {
      const layer = (authRoutes as any).stack.find((l: any) => l.route?.path === '/select-account' && l.route.methods.post);
      assert.ok(layer, 'route exists');
      const handlers = layer.route.stack.map((l: any) => l.handle);
      const limiterAt = handlers.indexOf(selectAccountRateLimiter);
      assert.ok(limiterAt > 0, 'the limiter is on the route');
      assert.equal(handlers[handlers.length - 1], selectAccount, 'the handler is last');
      assert.ok(limiterAt < handlers.length - 1);
    });

    it('allows 10 attempts per phone and address in five minutes, then answers 429', () => {
      const { ip, phone } = unique();
      const body = { preAuthToken: preAuth(`91${phone.slice(0, 10)}`), userId: String(oid()) };
      for (let i = 1; i <= 10; i += 1) assert.equal(hit(selectAccountRateLimiter, { ip, body }), 200, `attempt ${i}`);
      assert.equal(hit(selectAccountRateLimiter, { ip, body }), 429);
      const other = unique();
      assert.equal(hit(selectAccountRateLimiter, { ip, body: { ...body, preAuthToken: preAuth(`91${other.phone.slice(0, 10)}`) } }), 200, 'another phone is unaffected');
    });

    it('does not share its budget with login, send-otp or verify-otp', () => {
      const { ip, phone } = unique();
      const normalized = `91${phone.slice(0, 10)}`;
      const body = { preAuthToken: preAuth(normalized), userId: String(oid()), phone };
      for (let i = 0; i < 11; i += 1) hit(selectAccountRateLimiter, { ip, body });
      assert.equal(hit(loginRateLimiter, { ip, body }), 200);
      assert.equal(hit(verifyOtpRateLimiter, { ip, body }), 200);
    });

    it('a missing or malformed token still gets a key (and is limited together), never a crash', () => {
      const ip = '198.18.0.7';
      assert.equal(hit(selectAccountRateLimiter, { ip, body: {} }), 200);
      assert.equal(hit(selectAccountRateLimiter, { ip, body: { preAuthToken: 'not-a-jwt' } }), 200);
      assert.equal(hit(selectAccountRateLimiter, { ip, body: { preAuthToken: 42 } }), 200);
    });

    it('a preAuth token signed with another algorithm is refused by the handler', async () => {
      const hs512 = jwt.sign({ phone: '919000000000', purpose: 'role_selection' }, SECRET, { expiresIn: '5m', algorithm: 'HS512' });
      const { res, out } = makeRes();
      await selectAccount({ body: { preAuthToken: hs512, userId: String(oid()) } } as any, res);
      assert.equal(out.status, 401);
      assert.equal(out.body.success, false);
    });
  });

  // ───────────────────────── D3: pinned algorithm ─────────────────────────

  describe('JWT algorithm is pinned to HS256', () => {
    const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const account = { _id: 'acct1', isSuperAdmin: false, status: 'active', role: 'mahall', tenantId: 'tenantA', tokenVersion: 0 };

    const runAuth = async (token: string) => {
      const originalUser = User.findById;
      const originalTenant = Tenant.findById;
      invalidateTenantStatus();
      (User as any).findById = () => ({ select: async () => account });
      (Tenant as any).findById = () => ({ select: async () => ({ status: 'active' }) });
      try {
        const { res, out } = makeRes();
        let nextCalled = false;
        await authMiddleware({ headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/families', method: 'GET' } as any, res, () => {
          nextCalled = true;
        });
        return { out, nextCalled };
      } finally {
        (User as any).findById = originalUser;
        (Tenant as any).findById = originalTenant;
        invalidateTenantStatus();
      }
    };

    it('accepts an HS256 session token', async () => {
      const token = signSessionToken({ _id: 'acct1', tokenVersion: 0 });
      assert.equal((jwt.decode(token, { complete: true }) as any).header.alg, 'HS256');
      assert.equal((await runAuth(token)).nextCalled, true);
    });

    it('rejects an alg:none token', async () => {
      const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: 'acct1', tv: 0 })}.`;
      const result = await runAuth(unsigned);
      assert.equal(result.nextCalled, false);
      assert.equal(result.out.status, 401);
    });

    it('rejects a token signed with HS512 and the right secret', async () => {
      const token = jwt.sign({ userId: 'acct1', tv: 0 }, SECRET, { algorithm: 'HS512', expiresIn: '5m' });
      const result = await runAuth(token);
      assert.equal(result.nextCalled, false);
      assert.equal(result.out.status, 401);
    });

    it('rejects a token signed with HS384 and the right secret', async () => {
      const token = jwt.sign({ userId: 'acct1', tv: 0 }, SECRET, { algorithm: 'HS384', expiresIn: '5m' });
      assert.equal((await runAuth(token)).nextCalled, false);
    });

    it('signs session and impersonation tokens as HS256 explicitly', () => {
      const session = signSessionToken({ _id: 'acct1', tokenVersion: 0 }, { provenPhone: '919000000000' });
      const imp = signImpersonationToken({ _id: 'super1', tokenVersion: 0 }, { role: 'mahall' });
      assert.equal((jwt.decode(session, { complete: true }) as any).header.alg, 'HS256');
      assert.equal((jwt.decode(imp, { complete: true }) as any).header.alg, 'HS256');
    });

    it('still verifies tokens issued before the change (HS256 was the default, so they are unchanged)', async () => {
      const legacy = jwt.sign({ userId: 'acct1', tv: 0 }, SECRET, { expiresIn: '5m' });
      assert.equal((await runAuth(legacy)).nextCalled, true);
    });
  });

  // ───────────────────────── D4: /auth/me ─────────────────────────

  describe('user payloads do not carry the server-side token version', () => {
    const stored = {
      _id: 'u1',
      name: 'A',
      phone: '919000000000',
      role: 'mahall',
      tokenVersion: 7,
      twoFactorEnabled: true,
      oneSignalPlayerId: 'p1',
    };
    const asDoc = () => ({ ...stored, toObject() { return { ...stored }; } });

    it('GET /auth/me drops tokenVersion and keeps what the CMS reads (twoFactorEnabled)', async () => {
      const original = User.findById;
      (User as any).findById = () => ({ select: async () => asDoc() });
      try {
        const { res, out } = makeRes();
        await getCurrentUser({ user: { _id: 'u1' } } as any, res);
        assert.equal(out.status, 200);
        assert.equal('tokenVersion' in out.body.data, false);
        assert.equal(out.body.data.twoFactorEnabled, true);
        assert.equal(out.body.data.role, 'mahall');
        assert.equal(out.body.data.phone, '919000000000');
      } finally {
        (User as any).findById = original;
      }
    });

    it('toPublicUser works on documents and plain objects, never mutates its input, and tolerates null', () => {
      const plain = { _id: 'x', tokenVersion: 2, name: 'n' };
      assert.deepEqual(toPublicUser(plain), { _id: 'x', name: 'n' });
      assert.equal(plain.tokenVersion, 2);
      assert.equal('tokenVersion' in toPublicUser(asDoc()), false);
      assert.equal(toPublicUser(null), null);
    });

    it('the select-account sign-in response drops it too', async () => {
      const originalUser = User.findById;
      const originalTenant = Tenant.findById;
      invalidateTenantStatus();
      const doc: any = { ...asDoc(), status: 'active', isSuperAdmin: false, tenantId: null, save: async () => undefined };
      (User as any).findById = () => ({ select: async () => doc });
      (Tenant as any).findById = () => ({ select: async () => ({ status: 'active' }) });
      try {
        const token = jwt.sign({ phone: '919000000000', purpose: 'role_selection' }, SECRET, { expiresIn: '5m', algorithm: 'HS256' });
        const { res, out } = makeRes();
        await selectAccount({ body: { preAuthToken: token, userId: 'u1' } } as any, res);
        assert.equal(out.status, 200, JSON.stringify(out.body));
        assert.equal('tokenVersion' in out.body.data.user, false);
        const claims: any = jwt.verify(out.body.data.token, SECRET);
        assert.equal(claims.tv, 7, 'the token itself still carries the version it was issued at');
      } finally {
        (User as any).findById = originalUser;
        (Tenant as any).findById = originalTenant;
        invalidateTenantStatus();
      }
    });
  });

  // ───────────────────────── D6: member access to certificates ─────────────────────────

  describe('members and /api/certificates', () => {
    const TENANT = oid();
    const OTHER_TENANT = oid();
    const ME = oid();
    const SOMEONE = oid();
    const CERT_MINE = oid();
    const CERT_SHARED = oid();
    const CERT_OTHER = oid();
    const CERT_FOREIGN_TENANT = oid();

    const member = { _id: 'memberUser', role: 'member', isSuperAdmin: false, status: 'active', tenantId: TENANT, memberId: ME, tokenVersion: 0 };
    const mahall = { _id: 'adminUser', role: 'mahall', isSuperAdmin: false, status: 'active', tenantId: TENANT, tokenVersion: 0 };
    const survey = { _id: 'surveyUser', role: 'survey', isSuperAdmin: false, status: 'active', tenantId: TENANT, tokenVersion: 0 };

    const runMiddleware = async (account: any, method: string | undefined, url: string, imp?: Record<string, unknown>) => {
      const originalUser = User.findById;
      const originalTenant = Tenant.findById;
      invalidateTenantStatus();
      (User as any).findById = () => ({ select: async () => account });
      (Tenant as any).findById = () => ({ select: async () => ({ status: 'active' }) });
      try {
        const token = imp
          ? signImpersonationToken({ _id: account._id, tokenVersion: 0 }, imp)
          : signSessionToken({ _id: account._id, tokenVersion: 0 });
        const { res, out } = makeRes();
        let nextCalled = false;
        const req: any = { headers: { authorization: `Bearer ${token}` }, originalUrl: url, method };
        await authMiddleware(req, res, () => {
          nextCalled = true;
        });
        return { out, nextCalled, req };
      } finally {
        (User as any).findById = originalUser;
        (Tenant as any).findById = originalTenant;
        invalidateTenantStatus();
      }
    };

    const id = String(CERT_MINE);

    it('lets a member through for GET /api/certificates and GET /api/certificates/:id/download only', async () => {
      for (const url of [
        '/api/certificates',
        '/api/certificates/',
        '/api/certificates?page=1&limit=10',
        `/api/certificates/${id}/download`,
        `/api/certificates/${id}/download/`,
        `/api/certificates/${id}/download?x=1`,
      ]) {
        const result = await runMiddleware(member, 'GET', url);
        assert.equal(result.nextCalled, true, `GET ${url}`);
      }
    });

    it('still refuses a member for issue, revoke and anything else under /api/certificates', async () => {
      const refused: Array<[string | undefined, string]> = [
        ['POST', '/api/certificates/issue'],
        ['POST', '/api/certificates'],
        ['PUT', `/api/certificates/${id}/revoke`],
        ['GET', `/api/certificates/${id}/revoke`],
        ['PUT', `/api/certificates/${id}/download`],
        ['DELETE', `/api/certificates/${id}/download`],
        ['GET', '/api/certificates/issue'],
        ['GET', '/api/certificates/not-an-id/download'],
        ['GET', `/api/certificates/${id}`],
        ['GET', `/api/certificates/${id}/download/extra`],
        ['GET', '/api/certificates/../families'],
        ['GET', '/api/certificatesx'],
        ['GET', '/api/certificates-admin'],
        ['HEAD', '/api/certificates'],
        [undefined, '/api/certificates'],
      ];
      for (const [method, url] of refused) {
        const result = await runMiddleware(member, method, url);
        assert.equal(result.nextCalled, false, `${method} ${url} must not pass`);
        assert.equal(result.out.status, 403, `${method} ${url}`);
      }
    });

    it('the same narrow rule applies to a View-As member session', async () => {
      const superAdmin = { _id: 'superUser', role: 'super_admin', isSuperAdmin: true, status: 'active', tenantId: null, tokenVersion: 0 };
      const imp = { role: 'member', tenantId: String(TENANT), memberId: String(ME) };
      assert.equal((await runMiddleware(superAdmin, 'GET', '/api/certificates', imp)).nextCalled, true);
      assert.equal((await runMiddleware(superAdmin, 'POST', '/api/certificates/issue', imp)).nextCalled, false);
      assert.equal((await runMiddleware(superAdmin, 'PUT', `/api/certificates/${id}/revoke`, imp)).nextCalled, false);
    });

    it('does not widen anything else for members (the other member-only checks still refuse)', async () => {
      for (const url of ['/api/families', '/api/members', '/api/zakat', '/api/export/members', '/api/reports/x']) {
        assert.equal((await runMiddleware(member, 'GET', url)).out.status, 403, url);
      }
    });

    it('staff behaviour is unchanged: admins reach issue and revoke, survey workers reach the routes', async () => {
      assert.equal((await runMiddleware(mahall, 'POST', '/api/certificates/issue')).nextCalled, true);
      assert.equal((await runMiddleware(mahall, 'PUT', `/api/certificates/${id}/revoke`)).nextCalled, true);
      assert.equal((await runMiddleware(survey, 'GET', '/api/certificates')).nextCalled, true);
    });

    it('issue and revoke are admin-guarded on the router itself', () => {
      const routeLayer = (routePath: string, method: string) =>
        (certificateRoutes as any).stack.find((l: any) => l.route?.path === routePath && l.route.methods[method]);
      for (const [routePath, method] of [['/issue', 'post'], ['/:id/revoke', 'put']] as const) {
        const layer = routeLayer(routePath, method);
        assert.ok(layer, `${method} ${routePath}`);
        const guard = layer.route.stack.map((l: any) => l.handle).find((h: any) => h.isRoleGuard);
        assert.ok(guard, `${routePath} has a role guard`);
        assert.deepEqual(guard.allowedRoles, ['super_admin', 'mahall']);
        let refused = 0;
        guard({ user: { role: 'member' }, isSuperAdmin: false }, { status: (c: number) => { refused = c; return { json: () => undefined }; } }, () => {
          refused = -1;
        });
        assert.equal(refused, 403, `${routePath} refuses a member at the guard`);
      }
    });

    describe('what the controller returns to a member', () => {
      let originalCert: Record<string, any>;
      let originalSigned: any;

      beforeEach(() => {
        const rows: any[] = [
          { _id: CERT_MINE, tenantId: TENANT, certificateNo: 'NIK-1', type: 'nikah', subjectMemberIds: [ME, SOMEONE], status: 'valid', pdfKey: 'k/mine.pdf', createdAt: new Date(3) },
          { _id: CERT_SHARED, tenantId: TENANT, certificateNo: 'DTH-1', type: 'death', subjectMemberIds: [ME], status: 'valid', pdfKey: 'k/shared.pdf', createdAt: new Date(2) },
          { _id: CERT_OTHER, tenantId: TENANT, certificateNo: 'NOC-1', type: 'noc', subjectMemberIds: [SOMEONE], status: 'valid', pdfKey: 'k/other.pdf', createdAt: new Date(1) },
          { _id: CERT_FOREIGN_TENANT, tenantId: OTHER_TENANT, certificateNo: 'NIK-9', type: 'nikah', subjectMemberIds: [ME], status: 'valid', pdfKey: 'k/foreign.pdf', createdAt: new Date(4) },
        ];
        // A minimal stand-in that understands the filters these controllers use, including MongoDB's
        // "array field equals a value" membership rule for subjectMemberIds.
        const same = (a: any, b: any) => String(a) === String(b);
        const select = (filter: Record<string, any>) =>
          rows.filter(
            (r) =>
              (filter._id === undefined || same(r._id, filter._id)) &&
              (filter.tenantId === undefined || same(r.tenantId, filter.tenantId)) &&
              (filter.type === undefined || r.type === filter.type) &&
              (filter.status === undefined || r.status === filter.status) &&
              (filter.subjectMemberIds === undefined || r.subjectMemberIds.some((id: any) => same(id, filter.subjectMemberIds)))
          );
        originalCert = { find: Certificate.find, findOne: Certificate.findOne, countDocuments: Certificate.countDocuments };
        (Certificate as any).find = (filter: Record<string, any>) => {
          const chain: any = { select: () => chain, sort: () => chain, skip: () => chain, limit: () => chain, then: (ok: any, bad: any) => Promise.resolve(select(filter)).then(ok, bad) };
          return chain;
        };
        (Certificate as any).findOne = async (filter: Record<string, any>) => select(filter)[0] ?? null;
        (Certificate as any).countDocuments = async (filter: Record<string, any>) => select(filter).length;
        originalSigned = (uploadService as any).getSignedDownloadUrl;
        (uploadService as any).getSignedDownloadUrl = async (key: string) => `https://files.example/${key}`;
      });
      afterEach(() => {
        (uploadService as any).getSignedDownloadUrl = originalSigned;
        Object.assign(Certificate, originalCert);
      });

      const asMember = { user: member, tenantId: String(TENANT) };

      it('lists only the certificates the member is a subject of, in the member\'s own Mahallu', async () => {
        const out = await call(listCertificates, { ...asMember, query: { page: '1', limit: '20' } });
        assert.equal(out.status, 200);
        const numbers = out.body.data.map((c: any) => c.certificateNo).sort();
        assert.deepEqual(numbers, ['DTH-1', 'NIK-1']);
      });

      it('a type/status filter in the query string cannot widen a member\'s list', async () => {
        const out = await call(listCertificates, { ...asMember, query: { type: 'noc', status: 'valid' } });
        assert.equal(out.status, 200);
        assert.deepEqual(out.body.data.map((c: any) => c.certificateNo).sort(), ['DTH-1', 'NIK-1']);
      });

      it('downloads a certificate the member is a subject of', async () => {
        const out = await call(downloadCertificate, { ...asMember, params: { id: String(CERT_MINE) } });
        assert.equal(out.status, 200);
        assert.equal(out.body.data.url, 'https://files.example/k/mine.pdf');
        assert.equal(out.body.data.fileName, 'NIK-1.pdf');
      });

      it("cannot download another member's certificate", async () => {
        const out = await call(downloadCertificate, { ...asMember, params: { id: String(CERT_OTHER) } });
        assert.equal(out.status, 403);
        assert.equal(out.body.data, undefined);
      });

      it("cannot download another Mahallu's certificate even when named as a subject there", async () => {
        const out = await call(downloadCertificate, { ...asMember, params: { id: String(CERT_FOREIGN_TENANT) } });
        assert.equal(out.status, 404);
      });

      it('a non-member non-admin account (survey) is refused by the controller', async () => {
        const list = await call(listCertificates, { user: survey, tenantId: String(TENANT) });
        assert.equal(list.status, 403);
        const download = await call(downloadCertificate, { user: survey, tenantId: String(TENANT), params: { id: String(CERT_MINE) } });
        assert.equal(download.status, 403);
      });

      it('staff behaviour is unchanged: an admin lists every certificate of the Mahallu and downloads any', async () => {
        const list = await call(listCertificates, { user: mahall, tenantId: String(TENANT), query: {} });
        assert.equal(list.body.data.length, 3);
        const download = await call(downloadCertificate, { user: mahall, tenantId: String(TENANT), params: { id: String(CERT_OTHER) } });
        assert.equal(download.status, 200);
      });
    });
  });

  // ───────────────────────── D7: session revocation ─────────────────────────

  describe('session revocation', () => {
    it('turning two-factor on or off ends every other session and returns a token at the new version', async () => {
      const original = User.findByIdAndUpdate;
      const calls: any[] = [];
      (User as any).findByIdAndUpdate = (id: any, update: any) => {
        calls.push({ id, update });
        return { select: async () => ({ _id: id, twoFactorEnabled: update.twoFactorEnabled, tokenVersion: 5, isSuperAdmin: false }) };
      };
      try {
        const { res, out } = makeRes();
        await setTwoFactor({ user: { _id: 'u1' }, provenPhone: '919000000000', body: { enabled: true } } as any, res);
        assert.equal(out.status, 200);
        assert.deepEqual(calls[0].update.$inc, { tokenVersion: 1 });
        const claims: any = jwt.verify(out.body.data.token, SECRET);
        assert.equal(claims.tv, 5);
        assert.equal(claims.pp, '919000000000');
      } finally {
        (User as any).findByIdAndUpdate = original;
      }
    });

    it('a deactivated account is refused on its very next request, even with an unexpired token', async () => {
      const original = User.findById;
      const token = signSessionToken({ _id: 'gone', tokenVersion: 0 });
      (User as any).findById = () => ({ select: async () => ({ _id: 'gone', status: 'inactive', role: 'mahall', tenantId: 'tenantA', isSuperAdmin: false, tokenVersion: 0 }) });
      try {
        const { res, out } = makeRes();
        let nextCalled = false;
        await authMiddleware({ headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/families', method: 'GET' } as any, res, () => {
          nextCalled = true;
        });
        assert.equal(nextCalled, false);
        assert.equal(out.status, 403);
      } finally {
        (User as any).findById = original;
      }
    });

    it('a View-As session is refused once the real super admin is deactivated', async () => {
      const original = User.findById;
      const token = signImpersonationToken({ _id: 'super1', tokenVersion: 0 }, { role: 'mahall', tenantId: String(oid()) });
      (User as any).findById = () => ({ select: async () => ({ _id: 'super1', status: 'inactive', role: 'super_admin', isSuperAdmin: true, tokenVersion: 0 }) });
      try {
        const { res, out } = makeRes();
        let nextCalled = false;
        await authMiddleware({ headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/families', method: 'GET' } as any, res, () => {
          nextCalled = true;
        });
        assert.equal(nextCalled, false);
        assert.equal(out.status, 403);
      } finally {
        (User as any).findById = original;
      }
    });
  });

  it('allowRoles is exported with its policy (sanity for the guards used above)', () => {
    assert.deepEqual((allowRoles(['super_admin', 'mahall']) as any).allowedRoles, ['super_admin', 'mahall']);
  });
});
