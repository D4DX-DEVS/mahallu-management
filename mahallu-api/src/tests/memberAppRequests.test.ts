import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { Banner, Feed } from '../models/Social';
import Member from '../models/Member';
import Certificate from '../models/Certificate';
import Tenant from '../models/Tenant';
import OTP from '../models/OTP';
import User from '../models/User';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import { getAllBanners, deleteFeed, getAllFeeds } from '../controllers/socialController';
import { getOwnCertificates, downloadOwnCertificate, getPublicFeeds } from '../controllers/memberUserController';
import { verifyOTP } from '../controllers/otpController';
import { getCurrentUser, selectAccount } from '../controllers/authController';
import { allowRoles, ROLE_GROUPS } from '../middleware/authMiddleware';
import { activeBannerFilter, startOfIstDay } from '../utils/bannerWindow';
import socialRoutes from '../routes/socialRoutes';
import memberUserRoutes from '../routes/memberUserRoutes';
import * as uploadService from '../services/uploadService';
import { installFake, oid, Installed } from './support/fakeMongo';

/**
 * The four requests the mobile app depends on:
 *   1. members read GET /social/banners (own Mahallu, active, inside the IST date window; no writes)
 *   2. DELETE /social/feeds/:id for the post's author or a Mahallu admin, scoped to their own Mahallu (soft delete)
 *   3. GET /member-user/certificates (+ /:id/download) for the issued certificates of a member and their family
 *   4. instituteId on every sign-in payload for the institute role
 * Collections are the in-memory fakes in support/fakeMongo.ts; no database is touched.
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

const T1 = oid();
const T2 = oid();
const DAY = 24 * 60 * 60 * 1000;

/** Guards (role guards only) a request passes through on a router, in the order Express runs them. */
const roleGuardsFor = (router: any, method: string, path: string): any[] => {
  const guards: any[] = [];
  for (const layer of router.stack) {
    if (layer.route) {
      if (layer.route.path === path && layer.route.methods[method]) {
        for (const l of layer.route.stack) if (l.handle.isRoleGuard) guards.push(l.handle);
        return guards;
      }
    } else if (layer.handle.isRoleGuard) {
      guards.push(layer.handle);
    }
  }
  throw new Error(`no route ${method} ${path}`);
};

const roleCanReach = (router: any, method: string, path: string, role: string, isSuperAdmin = false): boolean =>
  roleGuardsFor(router, method, path).every((guard) => {
    let passed = false;
    guard({ user: { role }, isSuperAdmin }, { status: () => ({ json: () => undefined }) }, () => {
      passed = true;
    });
    return passed;
  });

describe('1. members read banners', () => {
  let banners: Installed;
  beforeEach(() => {
    const now = Date.now();
    const base = { image: 'x.png', createdAt: new Date(now) };
    banners = installFake(Banner, [
      { _id: oid(), tenantId: T1, title: 'live', status: 'active', ...base },
      { _id: oid(), tenantId: T1, title: 'inactive', status: 'inactive', ...base },
      { _id: oid(), tenantId: T1, title: 'not-yet', status: 'active', startDate: new Date(now + 2 * DAY), ...base },
      { _id: oid(), tenantId: T1, title: 'ended', status: 'active', endDate: new Date(startOfIstDay(new Date()).getTime() - 1), ...base },
      // endDate saved as midnight at the START of today (IST): the banner is still live all day
      { _id: oid(), tenantId: T1, title: 'last-day', status: 'active', endDate: startOfIstDay(new Date()), ...base },
      { _id: oid(), tenantId: T2, title: 'other-mahallu', status: 'active', ...base },
    ]);
  });
  afterEach(() => banners.restore());

  const titlesFor = async (req: any) => {
    const { res, out } = makeRes();
    await getAllBanners({ query: {}, ...req } as any, res);
    return { out, titles: (out.body.data as any[]).map((b) => b.title).sort() };
  };

  test('a member gets only active, in-window banners of their own Mahallu, in the same response shape', async () => {
    const { out, titles } = await titlesFor({ user: { role: 'member' }, tenantId: String(T1) });
    assert.deepEqual(titles, ['last-day', 'live']);
    assert.equal(out.body.success, true);
    assert.equal(out.body.pagination.total, 2);
  });

  test('a member cannot widen the result with ?status= or ?tenantId=', async () => {
    const { titles } = await titlesFor({
      user: { role: 'member' },
      tenantId: String(T1),
      query: { status: 'inactive', tenantId: String(T2) },
    });
    assert.deepEqual(titles, ['last-day', 'live']);
  });

  test('a member with no Mahallu on the account sees nothing (never an unscoped list)', async () => {
    const { titles } = await titlesFor({ user: { role: 'member' } });
    assert.deepEqual(titles, []);
  });

  test('the Mahallu admin still sees every banner of their Mahallu, including inactive and ended ones', async () => {
    const { titles } = await titlesFor({ user: { role: 'mahall' }, tenantId: String(T1) });
    assert.deepEqual(titles, ['ended', 'inactive', 'last-day', 'live', 'not-yet']);
  });

  test('members may read the list but never write (post / put / delete stay admin only)', () => {
    assert.equal(roleCanReach(socialRoutes, 'get', '/banners', 'member'), true);
    for (const [method, path] of [['post', '/banners'], ['put', '/banners/:id'], ['delete', '/banners/:id']]) {
      assert.equal(roleCanReach(socialRoutes, method, path, 'member'), false, `${method} ${path}`);
      assert.equal(roleCanReach(socialRoutes, method, path, 'survey'), false, `${method} ${path}`);
      assert.equal(roleCanReach(socialRoutes, method, path, 'mahall'), true, `${method} ${path}`);
    }
    // the rest of the router is untouched: a member still cannot read feeds or tickets here
    assert.equal(roleCanReach(socialRoutes, 'get', '/feeds', 'member'), false);
    assert.equal(roleCanReach(socialRoutes, 'get', '/support', 'member'), false);
  });

  test('the date window: a banner stays up through its whole last IST day, a missing date passes', () => {
    const now = new Date('2026-10-07T09:00:00+05:30');
    const filter = activeBannerFilter(now) as any;
    assert.equal(filter.status, 'active');
    const endClause = filter.$and[1].$or.find((c: any) => c.endDate && c.endDate.$gte);
    assert.equal(endClause.endDate.$gte.toISOString(), new Date('2026-10-07T00:00:00+05:30').toISOString());
    assert.ok(filter.$and[0].$or.some((c: any) => c.startDate === null), 'missing startDate passes');
    assert.ok(filter.$and[1].$or.some((c: any) => c.endDate === null), 'missing endDate passes');
  });
});

describe('2. delete feed posts', () => {
  let feeds: Installed;
  let members: Installed;
  const MINE = oid();
  const SUPER_FEED = oid();
  const OTHER = oid();
  const SURVEY_POST = oid();
  const SURVEYOR = oid();
  const MEMBER = oid();
  beforeEach(() => {
    feeds = installFake(Feed, [
      { _id: MINE, tenantId: T1, title: 'mine', content: 'c', isSuperFeed: false, status: 'published', authorId: oid() },
      { _id: SUPER_FEED, tenantId: T2, title: 'super', content: 'c', isSuperFeed: true, status: 'published', authorId: oid() },
      { _id: OTHER, tenantId: T2, title: 'theirs', content: 'c', isSuperFeed: false, status: 'published', authorId: oid() },
      { _id: SURVEY_POST, tenantId: T1, title: 'by surveyor', content: 'c', isSuperFeed: false, status: 'published', authorId: SURVEYOR },
    ]);
    members = installFake(Member, [{ _id: MEMBER, tenantId: T1 }]);
  });
  afterEach(() => {
    feeds.restore();
    members.restore();
  });

  const deleted = (id: any) => feeds.store.docs.find((d: any) => String(d._id) === String(id))?.isDeleted === true;
  const listed = async (req: any, fn: any = getAllFeeds) => {
    const { res, out } = makeRes();
    await fn({ query: {}, ...req } as any, res);
    return (out.body.data as any[]).map((f) => String(f._id));
  };

  test('the Mahallu admin deletes a post: 200, soft-deleted, and gone from every feed list', async () => {
    const ADMIN = oid();
    const { res, out } = makeRes();
    await deleteFeed({ params: { id: String(MINE) }, user: { _id: ADMIN, role: 'mahall' }, tenantId: String(T1) } as any, res);
    assert.equal(out.status, 200);
    assert.deepEqual(out.body, { success: true, message: 'Feed deleted' });
    const doc = feeds.store.docs.find((d: any) => String(d._id) === String(MINE));
    assert.equal(doc.isDeleted, true, 'the post is kept, flagged deleted');
    assert.ok(doc.deletedAt instanceof Date);
    assert.equal(String(doc.deletedBy), String(ADMIN));

    assert.ok(!(await listed({ tenantId: String(T1), user: { role: 'mahall' } })).includes(String(MINE)), 'admin list');
    assert.ok(!(await listed({ user: { role: 'member', memberId: MEMBER } }, getPublicFeeds)).includes(String(MINE)), 'member feed');
    assert.ok((await listed({ user: { role: 'member', memberId: MEMBER } }, getPublicFeeds)).includes(String(SURVEY_POST)));
  });

  test('deleting it again is a 404', async () => {
    for (const expected of [200, 404]) {
      const { res, out } = makeRes();
      await deleteFeed({ params: { id: String(MINE) }, user: { role: 'mahall' }, tenantId: String(T1) } as any, res);
      assert.equal(out.status, expected);
    }
  });

  test("a Mahallu admin cannot reach another Mahallu's post or a super feed: 404, nothing deleted", async () => {
    for (const id of [OTHER, SUPER_FEED]) {
      const { res, out } = makeRes();
      await deleteFeed({ params: { id: String(id) }, user: { role: 'mahall' }, tenantId: String(T1) } as any, res);
      assert.equal(out.status, 404);
      assert.equal(deleted(id), false);
    }
  });

  test('a post that does not exist is a 404', async () => {
    const { res, out } = makeRes();
    await deleteFeed({ params: { id: String(oid()) }, user: { role: 'mahall' }, tenantId: String(T1) } as any, res);
    assert.equal(out.status, 404);
  });

  test('an admin account with no Mahallu cannot delete anything (no unscoped delete)', async () => {
    const { res, out } = makeRes();
    await deleteFeed({ params: { id: String(MINE) }, user: { role: 'mahall' } } as any, res);
    assert.equal(out.status, 404);
    assert.equal(deleted(MINE), false);
  });

  test('the Super Admin can delete a super feed', async () => {
    const { res, out } = makeRes();
    await deleteFeed({ params: { id: String(SUPER_FEED) }, user: { role: 'mahall' }, isSuperAdmin: true } as any, res);
    assert.equal(out.status, 200);
    assert.equal(deleted(SUPER_FEED), true);
  });

  test("the author may delete their own post; another non-admin may not (403)", async () => {
    const other = makeRes();
    await deleteFeed({ params: { id: String(SURVEY_POST) }, user: { _id: oid(), role: 'survey' }, tenantId: String(T1) } as any, other.res);
    assert.equal(other.out.status, 403);
    assert.equal(deleted(SURVEY_POST), false);

    const author = makeRes();
    await deleteFeed({ params: { id: String(SURVEY_POST) }, user: { _id: SURVEYOR, role: 'survey' }, tenantId: String(T1) } as any, author.res);
    assert.equal(author.out.status, 200);
    assert.equal(deleted(SURVEY_POST), true);
  });

  test('staff roles reach the route (the author check is in the handler); members are refused (403)', () => {
    assert.equal(roleCanReach(socialRoutes, 'delete', '/feeds/:id', 'mahall'), true);
    assert.equal(roleCanReach(socialRoutes, 'delete', '/feeds/:id', 'mahall', true), true);
    for (const role of ['survey', 'institute']) {
      assert.equal(roleCanReach(socialRoutes, 'delete', '/feeds/:id', role), true, role);
    }
    assert.equal(roleCanReach(socialRoutes, 'delete', '/feeds/:id', 'member'), false);
  });
});

describe('3. member certificates', () => {
  const FAMILY_1 = oid();
  const FAMILY_2 = oid();
  const M1 = oid();
  const M1_SPOUSE = oid(); // same house as M1
  const M2 = oid(); // another house
  const M_OTHER_TENANT = oid();
  const N1 = oid(); // M1 is the groom
  const N1B = oid(); // M1 submitted it (revoked certificate)
  const D2 = oid(); // M2's death registration
  const NOC1 = oid(); // M1's NOC
  const certIds = { own: oid(), revoked: oid(), others: oid(), noc: oid(), crossTenant: oid() };
  const stubs: Installed[] = [];
  const realSigner = uploadService.getSignedDownloadUrl;
  const day = (n: number) => new Date(Date.UTC(2026, 0, n));

  beforeEach(() => {
    stubs.push(
      installFake(Member, [
        { _id: M1, tenantId: T1, familyId: FAMILY_1 },
        { _id: M1_SPOUSE, tenantId: T1, familyId: FAMILY_1 },
        { _id: M2, tenantId: T1, familyId: FAMILY_2 },
        { _id: M_OTHER_TENANT, tenantId: T2 },
      ]),
      installFake(NikahRegistration, [
        { _id: N1, tenantId: T1, groomId: M1, groomName: 'Ali', brideName: 'Sara' },
        { _id: N1B, tenantId: T1, submittedByMemberId: M1, groomName: 'Ali', brideName: 'Sana' },
      ]),
      installFake(DeathRegistration, [{ _id: D2, tenantId: T1, deceasedId: M2, deceasedName: 'Hamza' }]),
      installFake(NOC, [{ _id: NOC1, tenantId: T1, applicantId: M1, applicantName: 'Ali' }]),
      installFake(Certificate, [
        { _id: certIds.own, tenantId: T1, certificateNo: 'NK-1', type: 'nikah', registrationId: N1, subjectMemberIds: [M1], status: 'valid', issuedBy: 'Admin', issueDate: day(3), pdfKey: 'k1' },
        { _id: certIds.revoked, tenantId: T1, certificateNo: 'NK-2', type: 'nikah', registrationId: N1B, subjectMemberIds: [M1], status: 'revoked', revokedReason: 'wrong name', issuedBy: 'Admin', issueDate: day(2), pdfKey: 'k2' },
        { _id: certIds.others, tenantId: T1, certificateNo: 'DT-1', type: 'death', registrationId: D2, subjectMemberIds: [M2], status: 'valid', issuedBy: 'Admin', issueDate: day(1), pdfKey: 'k3' },
        { _id: certIds.noc, tenantId: T1, certificateNo: 'NC-1', type: 'noc', registrationId: NOC1, subjectMemberIds: [M1], status: 'valid', issuedBy: 'Admin', issueDate: day(4), pdfKey: 'k4' },
        // same registration id as M1's nikah but a different Mahallu: must never show
        { _id: certIds.crossTenant, tenantId: T2, certificateNo: 'NK-9', type: 'nikah', registrationId: N1, subjectMemberIds: [M1], status: 'valid', issuedBy: 'Admin', issueDate: day(5), pdfKey: 'k5' },
      ])
    );
    (uploadService as any).getSignedDownloadUrl = async (key: string) => `https://signed.example/${key}`;
  });
  afterEach(() => {
    stubs.splice(0).forEach((s) => s.restore());
    (uploadService as any).getSignedDownloadUrl = realSigner;
  });

  const listAs = async (memberId: any, query: any = {}) => {
    const { res, out } = makeRes();
    await getOwnCertificates({ user: { role: 'member', memberId }, query } as any, res);
    return out;
  };
  const downloadAs = async (memberId: any, id: any) => {
    const { res, out } = makeRes();
    await downloadOwnCertificate({ user: { role: 'member', memberId }, params: { id: String(id) } } as any, res);
    return out;
  };

  test('lists the issued certificates only (no revoked), newest first, in the app shape', async () => {
    const out = await listAs(M1);
    assert.equal(out.status, 200);
    assert.equal(out.body.pagination.total, 2);
    assert.deepEqual(out.body.data.map((c: any) => ({ ...c, _id: String(c._id) })), [
      { _id: String(certIds.noc), type: 'noc', certificateNo: 'NC-1', issuedAt: day(4), subjectName: 'Ali', status: 'issued' },
      { _id: String(certIds.own), type: 'nikah', certificateNo: 'NK-1', issuedAt: day(3), subjectName: 'Ali & Sara', status: 'issued' },
    ]);
  });

  test("the family/house sees each other's certificates; another house never does; type narrows the list", async () => {
    assert.deepEqual(((await listAs(M1_SPOUSE)).body.data as any[]).map((c) => c.certificateNo), ['NC-1', 'NK-1']);
    assert.deepEqual(((await listAs(M2)).body.data as any[]).map((c) => c.certificateNo), ['DT-1']);
    assert.deepEqual(((await listAs(M2)).body.data as any[])[0].subjectName, 'Hamza');
    assert.deepEqual(((await listAs(M1, { type: 'noc' })).body.data as any[]).map((c) => c.certificateNo), ['NC-1']);
    assert.deepEqual(((await listAs(M1, { type: 'death' })).body.data as any[]), []);
  });

  test('a member with no certificates gets an empty page; an unlinked account gets 404', async () => {
    const empty = await listAs(M_OTHER_TENANT);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.data, []);
    assert.equal((await listAs(undefined)).status, 404);
  });

  test('download: own (or own family) valid certificate returns { data: { url } }', async () => {
    const out = await downloadAs(M1, certIds.own);
    assert.equal(out.status, 200);
    assert.equal(out.body.data.url, 'https://signed.example/k1');
    assert.equal((await downloadAs(M1_SPOUSE, certIds.noc)).body.data.url, 'https://signed.example/k4');
  });

  test("download: another family's certificate and another Mahallu's certificate are 404", async () => {
    assert.equal((await downloadAs(M1, certIds.others)).status, 404);
    assert.equal((await downloadAs(M2, certIds.own)).status, 404);
    assert.equal((await downloadAs(M1, certIds.crossTenant)).status, 404);
    assert.equal((await downloadAs(M1, oid())).status, 404);
  });

  test('download: a revoked certificate is 410', async () => {
    const out = await downloadAs(M1, certIds.revoked);
    assert.equal(out.status, 410);
    assert.equal(out.body.data, undefined);
  });

  test('the member routes are member-only and /api/certificates stays unchanged', () => {
    // memberUserRoutes applies memberUserOnly router-wide; just prove the two routes are registered on it
    const paths = memberUserRoutes.stack.filter((l: any) => l.route).map((l: any) => `${Object.keys(l.route.methods)[0]} ${l.route.path}`);
    assert.ok(paths.includes('get /certificates'));
    assert.ok(paths.includes('get /certificates/:id/download'));
    assert.ok(typeof allowRoles === 'function' && ROLE_GROUPS.ADMIN.length === 2);
  });
});

describe('4. instituteId on sign-in', () => {
  const INSTITUTE_ID = oid();
  const instituteUser = () => ({
    _id: 'instUser',
    phone: '918000000000',
    status: 'active',
    role: 'institute',
    isSuperAdmin: false,
    tenantId: T1,
    instituteId: INSTITUTE_ID,
    save: async () => {},
    toObject() {
      const { save, toObject, ...rest } = this as any;
      return rest;
    },
  });

  let originals: Array<[any, string, any]> = [];
  const stub = (target: any, key: string, impl: any) => {
    originals.push([target, key, target[key]]);
    target[key] = impl;
  };
  beforeEach(() => {
    // the sign-in paths check that the account's Mahallu is not suspended
    stub(Tenant, 'findById', () => ({ select: async () => ({ status: 'active' }) }));
  });
  afterEach(() => {
    originals.reverse().forEach(([t, k, v]) => (t[k] = v));
    originals = [];
  });

  test('verify-otp (a phone with one account) returns instituteId for the institute role', async () => {
    const record: any = { code: '123456', attempts: 0, isUsed: false };
    stub(OTP, 'findOne', () => ({ sort: () => ({ select: async () => record }) }));
    stub(OTP, 'findOneAndUpdate', async (_f: any, update: any) => {
      if (update.$inc) record.attempts += 1;
      else record.isUsed = true;
      return record;
    });
    stub(User, 'find', async () => [instituteUser()]);
    stub(User, 'findById', () => ({ select: async () => instituteUser() }));

    const { res, out } = makeRes();
    await verifyOTP({ body: { phone: '8000000000', otp: '123456' } } as any, res);
    assert.equal(out.status, 200);
    assert.equal(out.body.data.requiresRoleSelection, undefined);
    assert.equal(out.body.data.user.instituteId, String(INSTITUTE_ID));
    assert.equal((jwt.decode(out.body.data.token) as any).instituteId, String(INSTITUTE_ID), 'claim in the session token');
  });

  test('select-account and auth/me return instituteId too', async () => {
    stub(User, 'findById', () => ({ select: async () => instituteUser() }));

    const preAuthToken = jwt.sign({ phone: '918000000000', purpose: 'role_selection' }, process.env.JWT_SECRET as string, { expiresIn: '5m' });
    const selected = makeRes();
    await selectAccount({ body: { preAuthToken, userId: 'instUser' } } as any, selected.res);
    assert.equal(selected.out.status, 200);
    assert.equal(selected.out.body.data.user.instituteId, String(INSTITUTE_ID));
    assert.equal((jwt.decode(selected.out.body.data.token) as any).instituteId, String(INSTITUTE_ID), 'claim in the session token');

    const me = makeRes();
    await getCurrentUser({ user: { _id: 'instUser' } } as any, me.res);
    assert.equal(String(me.out.body.data.instituteId), String(INSTITUTE_ID));
  });
});
