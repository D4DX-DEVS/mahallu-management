/**
 * Registrations are handled by the platform Super Admin only. A Mahallu admin ('mahall') does not see those
 * pages in the menu, cannot open them by URL, and is refused by the API - hiding the menu is not the only
 * control. The one exception is the member profile-change queue, which the Mahallu admin reviews for their own
 * Mahallu.
 *
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

import ChangeRequest from '../models/ChangeRequest';
import Member from '../models/Member';
import Family from '../models/Family';
import {
  createChangeRequest,
  deleteChangeRequest,
  listChangeRequests,
  reviewChangeRequest,
  updateChangeRequest,
} from '../controllers/changeRequestController';
import changeRequestRoutes from '../routes/changeRequestRoutes';
import registrationRoutes from '../routes/registrationRoutes';
import marriageAssistanceRoutes from '../routes/marriageAssistanceRoutes';
import { call, installFake, oid } from './support/fakeMongo';

const TENANT = oid();

/*
 * Change requests are a member's own profile edits, not registrations: the Mahallu admin keeps the queue and the
 * review for their OWN Mahallu, next to the Super Admin. Raising, editing, cancelling and viewing one's own stay
 * with the member.
 */
describe('change requests (member profile edits)', () => {
  const OTHER = oid();
  const MEMBER_HERE = oid();
  const MEMBER_THERE = oid();
  const REQUESTER = oid();
  const REQ_HERE = oid();
  const REQ_THERE = oid();

  const world = () => {
    const requests = installFake(ChangeRequest, [
      { _id: REQ_HERE, tenantId: TENANT, targetType: 'member', targetId: MEMBER_HERE, requestedByMemberId: REQUESTER, status: 'pending', changes: [{ field: 'name', oldValue: 'Old Here', newValue: 'New Here' }] },
      { _id: REQ_THERE, tenantId: OTHER, targetType: 'member', targetId: MEMBER_THERE, requestedByMemberId: oid(), status: 'pending', changes: [{ field: 'name', oldValue: 'Old There', newValue: 'New There' }] },
    ]);
    const members = installFake(Member, [
      { _id: MEMBER_HERE, tenantId: TENANT, name: 'Old Here' },
      { _id: MEMBER_THERE, tenantId: OTHER, name: 'Old There' },
      { _id: REQUESTER, tenantId: TENANT, name: 'Requester', isFamilyHead: false, familyId: oid() },
    ]);
    const families = installFake(Family, []);
    return {
      requests,
      members,
      restore: () => [families, members, requests].forEach((fake) => fake.restore()),
    };
  };
  const nameOf = (w: ReturnType<typeof world>, id: any) => w.members.store.docs.find((d: any) => String(d._id) === String(id))?.name;
  const statusOf = (w: ReturnType<typeof world>, id: any) => w.requests.store.docs.find((d: any) => String(d._id) === String(id))?.status;

  const mahallAdmin = () => ({ tenantId: String(TENANT) as string | undefined, user: { _id: oid(), name: 'Admin', role: 'mahall' } });
  const superAdmin = (tenant?: string) => ({ tenantId: tenant, isSuperAdmin: true, user: { _id: oid(), name: 'Super', role: 'super_admin' } });

  test('queue: a Mahallu admin sees their own Mahallu\'s requests and no other Mahallu\'s; the Super Admin sees the Mahallu they pick', async () => {
    const w = world();
    try {
      const mine = await call(listChangeRequests, { ...mahallAdmin(), query: {} });
      assert.equal(mine.status, 200);
      assert.deepEqual(mine.body.data.map((r: any) => String(r._id)), [String(REQ_HERE)]);

      // Asking for another Mahallu does not widen a Mahallu admin's scope: the tenant comes from their account.
      const sneaky = await call(listChangeRequests, { ...mahallAdmin(), query: { tenantId: String(OTHER) } });
      assert.deepEqual(sneaky.body.data.map((r: any) => String(r._id)), [String(REQ_HERE)]);

      const asSuperHere = await call(listChangeRequests, { ...superAdmin(String(TENANT)), query: {} });
      assert.deepEqual(asSuperHere.body.data.map((r: any) => String(r._id)), [String(REQ_HERE)]);
      const asSuperThere = await call(listChangeRequests, { ...superAdmin(String(OTHER)), query: {} });
      assert.deepEqual(asSuperThere.body.data.map((r: any) => String(r._id)), [String(REQ_THERE)]);
    } finally {
      w.restore();
    }
  });

  test('queue: a member still sees only the requests they raised; survey and institute accounts get 403', async () => {
    const w = world();
    try {
      const requester = await call(listChangeRequests, { tenantId: String(TENANT), user: { _id: oid(), role: 'member', memberId: REQUESTER }, query: {} });
      assert.equal(requester.status, 200);
      assert.deepEqual(requester.body.data.map((r: any) => String(r._id)), [String(REQ_HERE)]);

      const otherMember = await call(listChangeRequests, { tenantId: String(TENANT), user: { _id: oid(), role: 'member', memberId: oid() }, query: {} });
      assert.equal(otherMember.body.data.length, 0, 'a member sees only requests they raised');

      for (const role of ['survey', 'institute']) {
        const reply = await call(listChangeRequests, { tenantId: String(TENANT), user: { _id: oid(), role }, query: {} });
        assert.equal(reply.status, 403, role);
      }
    } finally {
      w.restore();
    }
  });

  test('review: a Mahallu admin approves a request of their own Mahallu, and it is applied to the member', async () => {
    const w = world();
    try {
      const reply = await call(reviewChangeRequest, { ...mahallAdmin(), params: { id: String(REQ_HERE) }, body: { status: 'approved', remarks: 'ok' } });
      assert.equal(reply.status, 200);
      assert.equal(statusOf(w, REQ_HERE), 'approved');
      assert.equal(nameOf(w, MEMBER_HERE), 'New Here');
      const row = w.requests.store.docs.find((d: any) => String(d._id) === String(REQ_HERE));
      assert.equal(row?.reviewedBy, 'Admin');
    } finally {
      w.restore();
    }
  });

  test('review: a rejection changes the request only, never the member', async () => {
    const w = world();
    try {
      const reply = await call(reviewChangeRequest, { ...mahallAdmin(), params: { id: String(REQ_HERE) }, body: { status: 'rejected' } });
      assert.equal(reply.status, 200);
      assert.equal(statusOf(w, REQ_HERE), 'rejected');
      assert.equal(nameOf(w, MEMBER_HERE), 'Old Here');
    } finally {
      w.restore();
    }
  });

  test('review: a Mahallu admin cannot review another Mahallu\'s request - 404, nothing changes', async () => {
    const w = world();
    try {
      for (const status of ['approved', 'rejected']) {
        const reply = await call(reviewChangeRequest, { ...mahallAdmin(), params: { id: String(REQ_THERE) }, body: { status } });
        assert.equal(reply.status, 404, status);
      }
      assert.equal(statusOf(w, REQ_THERE), 'pending');
      assert.equal(nameOf(w, MEMBER_THERE), 'Old There');
    } finally {
      w.restore();
    }
  });

  test('review: the Super Admin reviews inside the Mahallu they picked, and only there', async () => {
    const w = world();
    try {
      const wrongTenant = await call(reviewChangeRequest, { ...superAdmin(String(TENANT)), params: { id: String(REQ_THERE) }, body: { status: 'approved' } });
      assert.equal(wrongTenant.status, 404);
      assert.equal(statusOf(w, REQ_THERE), 'pending');

      const rightTenant = await call(reviewChangeRequest, { ...superAdmin(String(OTHER)), params: { id: String(REQ_THERE) }, body: { status: 'approved' } });
      assert.equal(rightTenant.status, 200);
      assert.equal(nameOf(w, MEMBER_THERE), 'New There');
    } finally {
      w.restore();
    }
  });

  test('an admin account with no Mahallu in scope is refused rather than left unscoped', async () => {
    const w = world();
    try {
      const list = await call(listChangeRequests, { ...mahallAdmin(), tenantId: undefined, query: {} });
      assert.equal(list.status, 403);
      const review = await call(reviewChangeRequest, { ...mahallAdmin(), tenantId: undefined, params: { id: String(REQ_HERE) }, body: { status: 'approved' } });
      assert.equal(review.status, 403);
      assert.equal(statusOf(w, REQ_HERE), 'pending');
      assert.equal(nameOf(w, MEMBER_HERE), 'Old Here');
    } finally {
      w.restore();
    }
  });

  test('the review route: Mahallu admin and Super Admin pass its guard; survey, institute and member get 403', () => {
    const layer = (changeRequestRoutes as any).stack.find((l: any) => l.route?.path === '/:id/review');
    const guard = layer.route.stack.map((l: any) => l.handle).find((h: any) => h.isRoleGuard);
    assert.ok(guard, 'the review route has a role guard');
    assert.deepEqual(guard.allowedRoles, ['super_admin', 'mahall']);
    const passes = (role: string, isSuperAdmin = false) => {
      let status = 0;
      let nexted = false;
      guard({ user: { role }, isSuperAdmin }, { status: (code: number) => ((status = code), { json: () => undefined }) }, () => (nexted = true));
      if (!nexted) assert.equal(status, 403, role);
      return nexted;
    };
    assert.equal(passes('mahall'), true);
    assert.equal(passes('super_admin', true), true);
    for (const role of ['survey', 'institute', 'member']) assert.equal(passes(role), false, role);
  });

  test('members keep raising, editing and cancelling their own requests; an admin account without a member cannot', async () => {
    const w = world();
    try {
      const raised = await call(createChangeRequest, {
        tenantId: String(TENANT),
        user: { _id: oid(), role: 'member', memberId: REQUESTER },
        body: { targetType: 'member', targetId: String(REQUESTER), changes: [{ field: 'name', newValue: 'Renamed' }] },
      });
      assert.equal(raised.status, 201);
      assert.equal(String(raised.body.data.tenantId), String(TENANT), 'stored against the member\'s own Mahallu');
      const newId = raised.body.data._id;

      const edited = await call(updateChangeRequest, {
        user: { _id: oid(), role: 'member', memberId: REQUESTER },
        params: { id: String(newId) },
        body: { field: 'occupation', newValue: 'Teacher' },
      });
      assert.equal(edited.status, 200);

      // Someone else's request is not theirs to edit or cancel.
      const notTheirs = await call(deleteChangeRequest, { user: { _id: oid(), role: 'member', memberId: oid() }, params: { id: String(newId) } });
      assert.equal(notTheirs.status, 404);

      // A Mahallu admin account with no member behind it cannot raise, edit or cancel requests.
      const asAdmin = { ...mahallAdmin(), params: { id: String(newId) }, body: { field: 'occupation', newValue: 'x' } };
      assert.equal((await call(createChangeRequest, asAdmin)).status, 403);
      assert.equal((await call(updateChangeRequest, asAdmin)).status, 403);
      assert.equal((await call(deleteChangeRequest, asAdmin)).status, 403);

      const cancelled = await call(deleteChangeRequest, { user: { _id: oid(), role: 'member', memberId: REQUESTER }, params: { id: String(newId) } });
      assert.equal(cancelled.status, 200);
    } finally {
      w.restore();
    }
  });
});

describe('the routers that serve the Registrations group', () => {
  const guardOf = (router: any) => router.stack.find((layer: any) => layer.handle?.isRoleGuard)?.handle;

  test('the registrations and marriage-assistance routers are Super Admin only at router level', () => {
    for (const router of [registrationRoutes, marriageAssistanceRoutes]) {
      const guard = guardOf(router);
      assert.ok(guard, 'has a role guard');
      assert.deepEqual(guard.allowedRoles, ['super_admin']);
    }
  });

  test('that guard answers 403 to a Mahallu admin, a survey worker, an institute admin and a member', () => {
    const guard = guardOf(registrationRoutes);
    for (const role of ['mahall', 'survey', 'institute', 'member']) {
      let status = 0;
      let nexted = false;
      guard(
        { user: { role }, isSuperAdmin: false },
        { status: (code: number) => ((status = code), { json: () => undefined }) },
        () => (nexted = true)
      );
      assert.equal(nexted, false, role);
      assert.equal(status, 403, role);
    }
    let allowed = false;
    guard({ user: { role: 'super_admin' }, isSuperAdmin: true }, {}, () => (allowed = true));
    assert.equal(allowed, true, 'the Super Admin passes');
  });
});

describe('the CMS: menu and routes', () => {
  const CMS_SRC = path.resolve(__dirname, '../../../mahallu-cms/src');
  const present = fs.existsSync(path.join(CMS_SRC, 'constants', 'menuItems.ts'));
  const read = (...parts: string[]) => fs.readFileSync(path.join(CMS_SRC, ...parts), 'utf8').replace(/\r\n/g, '\n');

  test('the Registrations menu group and every item in it are for the Super Admin only', { skip: !present }, () => {
    const menu = read('constants', 'menuItems.ts');
    assert.match(menu, /const REGISTRATION_ROLES: MenuItem\['allowedRoles'\] = \['super_admin'\];/);
    const start = menu.indexOf("id: 'registrations'");
    const end = menu.indexOf("id: 'collections'");
    assert.ok(start > 0 && end > start, 'found the group');
    const block = menu.slice(start, end);
    const roleLists = block.match(/allowedRoles: [A-Z_]+/g) ?? [];
    assert.equal(roleLists.length, 6, 'the group and its five items');
    assert.ok(roleLists.every((entry) => entry === 'allowedRoles: REGISTRATION_ROLES'), 'no item falls back to a wider role list');
    for (const child of ['nikah', 'death', 'nikah-noc', 'marriage-assistance', 'certificates']) {
      assert.ok(block.includes(`id: '${child}'`), `${child} is in the group`);
    }
    assert.ok(!block.includes("id: 'change-requests'"), 'Change requests is not in the Super Admin-only group');
  });

  test('Change requests is a Services menu item for the Mahallu admin and the Super Admin', { skip: !present }, () => {
    const menu = read('constants', 'menuItems.ts');
    assert.match(menu, /const ADMIN_ROLES: MenuItem\['allowedRoles'\] = \['super_admin', 'mahall'\];/);
    const start = menu.indexOf("id: 'services'");
    const end = menu.indexOf("id: 'registrations'");
    assert.ok(start > 0 && end > start, 'found the Services group');
    const block = menu.slice(start, end);
    const at = block.indexOf("id: 'change-requests'");
    assert.ok(at > 0, 'Change requests is in the Services group');
    const item = block.slice(at, block.indexOf('},', at));
    assert.match(item, /path: '\/admin\/change-requests'/);
    assert.match(item, /allowedRoles: ADMIN_ROLES/);
    assert.match(item, /moduleKey: 'registrations'/, 'it keeps the Registrations module switch');
  });

  test('the Registrations menu: Common NOC stays out of it', { skip: !present }, () => {
    const menu = read('constants', 'menuItems.ts');
    const block = menu.slice(menu.indexOf("id: 'registrations'"), menu.indexOf("id: 'collections'"));
    // "Common NOC" was retired from the menu. Its page is still routed (create/edit/detail return to it), so
    // this only pins that nobody can reach it from the menu.
    assert.ok(!block.includes("id: 'common-noc'") && !block.includes('Common NOC'), 'Common NOC is not in the menu');
  });

  test('every registration page is a Super Admin route, so typing the URL does not open it', { skip: !present }, () => {
    const routes = [read('routes', 'communityRoutes.tsx'), read('routes', 'adminRoutes.tsx'), read('routes', 'phaseBRoutes.tsx')].join('\n');
    const lines = routes.split('\n').filter((line) => /(\/registrations\/|REGISTRATIONS\.|CERTIFICATES\.LIST)/.test(line) && /\broute\(|superAdminRoute\(/.test(line));
    assert.ok(lines.length >= 15, `found the registration routes (${lines.length})`);
    const open = lines.filter((line) => !/superAdminRoute\(/.test(line));
    assert.deepEqual(open, [], 'no registration route is open to the Mahallu admin');
  });

  test('the Change requests page is open to the Mahallu admin and the Super Admin only', { skip: !present }, () => {
    const admin = read('routes', 'adminRoutes.tsx');
    const lines = admin.split('\n').filter((line) => /ROUTES\.CHANGE_REQUESTS/.test(line) && /\broute\(|superAdminRoute\(/.test(line));
    assert.equal(lines.length, 1, 'declared once');
    assert.match(lines[0], /^\s*route\(ROUTES\.CHANGE_REQUESTS, <ChangeRequestsList \/>, \{ allowedRoles: \['super_admin', 'mahall'\] \}\),/);
  });
});
