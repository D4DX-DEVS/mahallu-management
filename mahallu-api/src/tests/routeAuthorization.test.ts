import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  allowRoles,
  ROLE_GROUPS,
  requireAdmin,
  requireInstituteStaff,
  requireFieldStaff,
  superAdminOnly,
  memberUserOnly,
} from '../middleware/authMiddleware';
import { instituteFilter } from '../middleware/tenantMiddleware';

import salaryRoutes from '../routes/salaryRoutes';
import masterAccountRoutes from '../routes/masterAccountRoutes';
import accountingReportRoutes from '../routes/accountingReportRoutes';
import pettyCashRoutes from '../routes/pettyCashRoutes';
import employeeRoutes from '../routes/employeeRoutes';
import instituteRoutes from '../routes/instituteRoutes';
import registrationRoutes from '../routes/registrationRoutes';
import registerRoutes from '../routes/registerRoutes';
import reportRoutes from '../routes/reportRoutes';
import assetRoutes from '../routes/assetRoutes';
import committeeRoutes from '../routes/committeeRoutes';
import meetingRoutes from '../routes/meetingRoutes';
import programRoutes from '../routes/programRoutes';
import collectibleRoutes from '../routes/collectibleRoutes';
import socialRoutes from '../routes/socialRoutes';
import uploadRoutes from '../routes/uploadRoutes';
import welfareRoutes from '../routes/welfareRoutes';
import dashboardRoutes from '../routes/dashboardRoutes';
import notificationRoutes from '../routes/notificationRoutes';

/**
 * Server-side role enforcement, checked on the routers themselves.
 *
 * The CMS hides screens by role, but hiding is not authorization: a survey worker or an institute admin
 * can call any endpoint with their own token. These tests read each router's guard chain WITHOUT a
 * database or an HTTP server and answer "which roles get through to this endpoint?", then pin that
 * answer against an explicit policy table (taken from the CMS menu, which states the intended audience).
 *
 * How the introspection works (`inspectRoute`):
 *  - It walks `router.stack` in registration order, exactly the order Express runs it in.
 *  - A layer with `.route` is an endpoint: it is the one that handles the request when its method and
 *    path match, and the guards written on the endpoint itself (`router.get(path, requireAdmin, ...)`)
 *    run in the route's own stack.
 *  - A layer without `.route` is middleware. `router.use(fn)` applies to every path; `router.use('/x', fn)`
 *    applies only under `/x`; a nested router is entered with the matched prefix stripped.
 *  - Role guards are run for real (a fake req/res; nothing is mocked), once per role, so what is
 *    asserted is the behaviour of `allowRoles`, not a copy of its option list. A role that hits a guard
 *    that answers 403 is denied; Super Admin passes every role guard by design. `superAdminOnly` and
 *    `memberUserOnly` are recognised by identity and run the same way.
 *  - `sensitiveAccess` guards are recognised by what they do (they look at `permissions.sensitiveModules`)
 *    and probed to learn which module key they demand. They are reported separately (`sensitive`),
 *    because they depend on a per-user permission, not on the role.
 *  - Middleware that is neither (authMiddleware, tenantFilter, validators, controllers) is passed through.
 */

type StaffRole = 'super_admin' | 'mahall' | 'survey' | 'institute';
const STAFF_ROLES: readonly StaffRole[] = ['super_admin', 'mahall', 'survey', 'institute'];
const SENSITIVE_KEYS = ['counselling', 'maslahat', 'inheritance', 'health', 'welfare'] as const;

const ADMIN: StaffRole[] = ['super_admin', 'mahall'];
const INSTITUTE_STAFF: StaffRole[] = ['super_admin', 'mahall', 'institute'];
const FIELD_STAFF: StaffRole[] = ['super_admin', 'mahall', 'survey'];
const ALL_STAFF: StaffRole[] = ['super_admin', 'mahall', 'survey', 'institute'];

interface FakeResult {
  nextCalled: boolean;
  status?: number;
  body?: any;
}

/** Runs one middleware against a fake request/response. Throws if it neither answers nor continues. */
const runMiddleware = (handle: any, user: Record<string, any>, isSuperAdmin: boolean): FakeResult => {
  const result: FakeResult = { nextCalled: false };
  const res: any = {
    status(code: number) {
      result.status = code;
      return res;
    },
    json(body: any) {
      result.body = body;
      return res;
    },
  };
  const req: any = { user, isSuperAdmin };
  handle(req, res, () => {
    result.nextCalled = true;
  });
  return result;
};

const userForRole = (role: StaffRole) => ({
  role: role === 'super_admin' ? 'mahall' : role,
  isSuperAdmin: role === 'super_admin',
  permissions: {},
});

const isSensitiveGuard = (handle: any): boolean =>
  typeof handle === 'function' && !handle.isRoleGuard && handle.length === 3 && /sensitiveModules/.test(Function.prototype.toString.call(handle));

/** The module key a sensitiveAccess guard demands: the one key that lets a plain (non super) user through. */
const sensitiveKeyOf = (handle: any): string => {
  const keys = SENSITIVE_KEYS.filter((key) => {
    const r = runMiddleware(handle, { role: 'mahall', permissions: { sensitiveModules: [key] } }, false);
    return r.nextCalled;
  });
  assert.equal(keys.length, 1, 'a sensitiveAccess guard should demand exactly one module key');
  return keys[0];
};

interface Walk {
  guards: number;
  sensitive: Set<string>;
}

type Outcome = 'allowed' | 'denied' | 'nomatch';

const stripPrefix = (p: string, matched: string): string => {
  const rest = p.slice(matched.length);
  return rest.startsWith('/') ? rest : `/${rest}`;
};

/** Guards that are not built by `allowRoles` but are role checks all the same; they are run for real too. */
const isNamedRoleGuard = (handle: any): boolean => handle === superAdminOnly || handle === memberUserOnly;

/** `any` is the probe pass: it lets every guard through so the whole chain can be seen. */
const applyHandler = (handle: any, role: StaffRole | 'any', acc: Walk): 'pass' | 'deny' => {
  if (handle && (handle.isRoleGuard || isNamedRoleGuard(handle))) {
    acc.guards += 1;
    if (role === 'any') return 'pass';
    const r = runMiddleware(handle, userForRole(role), role === 'super_admin');
    if (r.nextCalled) return 'pass';
    assert.equal(r.status, 403, 'a role guard that refuses must answer 403');
    return 'deny';
  }
  if (isSensitiveGuard(handle)) {
    acc.guards += 1;
    acc.sensitive.add(sensitiveKeyOf(handle));
  }
  return 'pass';
};

const walk = (stack: any[], p: string, method: string, role: StaffRole | 'any', acc: Walk): Outcome => {
  for (const layer of stack) {
    if (layer.route) {
      const route = layer.route;
      if (!route.methods[method] && !route.methods._all) continue;
      if (!layer.regexp.test(p)) continue;
      for (const l of route.stack) {
        if (l.method && l.method !== method) continue;
        if (applyHandler(l.handle, role, acc) === 'deny') return 'denied';
      }
      return 'allowed';
    }
    const fastSlash = Boolean(layer.regexp.fast_slash);
    const m = fastSlash ? null : layer.regexp.exec(p);
    if (!fastSlash && !m) continue;
    const remaining = fastSlash || !m ? p : stripPrefix(p, m[0]);
    if (layer.handle && Array.isArray(layer.handle.stack)) {
      const nested = walk(layer.handle.stack, remaining, method, role, acc);
      if (nested !== 'nomatch') return nested;
      continue;
    }
    if (applyHandler(layer.handle, role, acc) === 'deny') return 'denied';
  }
  return 'nomatch';
};

interface RouteAccess {
  /** Roles that get through every role guard on the way to the endpoint. */
  roles: StaffRole[];
  /** Sensitive-module keys a non-super-admin must additionally hold. */
  sensitive: string[];
  /** Number of role / sensitive guards between the request and the controller. */
  guards: number;
}

const inspectRoute = (router: any, method: string, routePath: string): RouteAccess => {
  const verb = method.toLowerCase();
  const probe: Walk = { guards: 0, sensitive: new Set() };
  // The probe pass lets every role guard through, so it reaches the endpoint (if there is one) and sees every guard.
  const reach = walk(router.stack, routePath, verb, 'any', probe);
  assert.equal(reach, 'allowed', `no ${method} ${routePath} endpoint on this router`);
  const roles = STAFF_ROLES.filter((role) => walk(router.stack, routePath, verb, role, { guards: 0, sensitive: new Set() }) === 'allowed');
  return { roles: [...roles], sensitive: [...probe.sensitive].sort(), guards: probe.guards };
};

/** Every verb route on the router's own stack, with `:params` replaced by a concrete value. */
const listRoutes = (router: any): Array<{ method: string; path: string }> => {
  const out: Array<{ method: string; path: string }> = [];
  for (const layer of router.stack) {
    if (!layer.route || typeof layer.route.path !== 'string') continue;
    for (const method of Object.keys(layer.route.methods)) {
      if (layer.route.methods[method]) out.push({ method, path: layer.route.path.replace(/:[A-Za-z0-9_]+/g, 'x1') });
    }
  }
  return out;
};

const sorted = (roles: readonly string[]) => [...roles].sort();

const expectRoles = (router: any, method: string, routePath: string, expected: readonly StaffRole[], sensitive: string[] = []) => {
  const access = inspectRoute(router, method, routePath);
  assert.deepEqual(sorted(access.roles), sorted(expected), `${method} ${routePath}: roles that get through`);
  assert.deepEqual(access.sensitive, sensitive, `${method} ${routePath}: sensitive modules demanded`);
};

const expectAll = (
  router: any,
  expected: readonly StaffRole[],
  routes: Array<[method: string, path: string]>,
  sensitive: string[] = []
) => {
  for (const [method, routePath] of routes) expectRoles(router, method, routePath, expected, sensitive);
};

/** True when the router applies `middleware` anywhere on its own stack (router-level or path-scoped). */
const usesMiddleware = (router: any, middleware: unknown) => router.stack.some((layer: any) => !layer.route && layer.handle === middleware);

const CRUD_ID: Array<[string, string]> = [
  ['get', '/'],
  ['get', '/x1'],
  ['post', '/'],
  ['put', '/x1'],
  ['delete', '/x1'],
];

describe('allowRoles (no HTTP, no database)', () => {
  const next = () => undefined;

  test('answers 403 for a role that is not on the list and does not call next', () => {
    const guard = allowRoles(['mahall']);
    const r = runMiddleware(guard, { role: 'survey' }, false);
    assert.equal(r.nextCalled, false);
    assert.equal(r.status, 403);
    assert.equal(r.body.success, false);
  });

  test('calls next for a role that is on the list', () => {
    const r = runMiddleware(allowRoles(['mahall', 'institute']), { role: 'institute' }, false);
    assert.equal(r.nextCalled, true);
    assert.equal(r.status, undefined);
  });

  test('always lets a Super Admin through, even when the list does not name super_admin', () => {
    const r = runMiddleware(allowRoles(['institute']), { role: 'mahall' }, true);
    assert.equal(r.nextCalled, true);
  });

  test('denies a request with no user or no role', () => {
    const noUser = runMiddleware(allowRoles(['mahall']), undefined as any, false);
    assert.equal(noUser.nextCalled, false);
    assert.equal(noUser.status, 403);
    const noRole = runMiddleware(allowRoles(['mahall']), {}, false);
    assert.equal(noRole.nextCalled, false);
    assert.equal(noRole.status, 403);
  });

  test('a member is denied by every staff group, so a member token never reaches a guarded route', () => {
    for (const guard of [requireAdmin, requireInstituteStaff, requireFieldStaff, allowRoles(ROLE_GROUPS.ALL_STAFF)]) {
      const r = runMiddleware(guard, { role: 'member' }, false);
      assert.equal(r.nextCalled, false);
      assert.equal(r.status, 403);
    }
  });

  test('carries its policy for tooling', () => {
    const guard: any = allowRoles(['mahall', 'survey']);
    assert.equal(guard.isRoleGuard, true);
    assert.deepEqual(guard.allowedRoles, ['mahall', 'survey']);
    assert.deepEqual(sorted((requireAdmin as any).allowedRoles), sorted(ROLE_GROUPS.ADMIN));
    assert.deepEqual(sorted((requireInstituteStaff as any).allowedRoles), sorted(ROLE_GROUPS.INSTITUTE_STAFF));
    assert.deepEqual(sorted((requireFieldStaff as any).allowedRoles), sorted(ROLE_GROUPS.FIELD_STAFF));
    void next;
  });
});

describe('route introspection helper', () => {
  const buildRouter = () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const express = require('express');
    const router = express.Router();
    router.use(allowRoles(['mahall', 'survey', 'institute']));
    router.use('/admin', requireAdmin);
    router.get('/admin/panel', (_req: any, res: any) => res.json({}));
    router.get('/open', (_req: any, res: any) => res.json({}));
    router.post('/narrow', requireInstituteStaff, (_req: any, res: any) => res.json({}));
    const nested = express.Router();
    nested.use(requireFieldStaff);
    nested.get('/list', (_req: any, res: any) => res.json({}));
    router.use('/field', nested);
    return router;
  };

  test('applies router-level, path-scoped, route-level and nested guards in order', () => {
    const router = buildRouter();
    assert.deepEqual(sorted(inspectRoute(router, 'get', '/open').roles), sorted(ALL_STAFF));
    assert.deepEqual(sorted(inspectRoute(router, 'get', '/admin/panel').roles), sorted(ADMIN));
    assert.deepEqual(sorted(inspectRoute(router, 'post', '/narrow').roles), sorted(INSTITUTE_STAFF));
    assert.deepEqual(sorted(inspectRoute(router, 'get', '/field/list').roles), sorted(FIELD_STAFF));
  });

  test('a path-scoped guard does not leak onto other paths, and an unknown endpoint is an error', () => {
    const router = buildRouter();
    assert.ok(inspectRoute(router, 'get', '/open').roles.includes('institute'));
    assert.throws(() => inspectRoute(router, 'get', '/nothing-here'));
    assert.throws(() => inspectRoute(router, 'delete', '/open'));
  });
});

describe('salary', () => {
  test('institute staff only, bound to their own institute', () => {
    expectAll(salaryRoutes, INSTITUTE_STAFF, [
      ['get', '/'],
      ['get', '/summary'],
      ['get', '/employee/x1'],
      ['get', '/x1'],
      ['post', '/'],
      ['put', '/x1'],
      ['delete', '/x1'],
    ]);
    assert.ok(usesMiddleware(salaryRoutes, instituteFilter), 'salary must apply instituteFilter');
  });

  test('a survey worker is refused on every salary route', () => {
    for (const { method, path: p } of listRoutes(salaryRoutes)) {
      assert.ok(!inspectRoute(salaryRoutes, method, p).roles.includes('survey'), `${method} ${p}`);
    }
  });
});

describe('master accounts', () => {
  test('institute books are open to institute staff, never to survey', () => {
    for (const base of ['/institute', '/categories', '/ledgers', '/ledger-items']) {
      expectAll(masterAccountRoutes, INSTITUTE_STAFF, [
        ['get', base],
        ['post', base],
        ['put', `${base}/x1`],
        ['delete', `${base}/x1`],
      ]);
    }
    assert.ok(usesMiddleware(masterAccountRoutes, instituteFilter), 'master accounts must apply instituteFilter');
  });

  test('Mahallu bank accounts are Mahallu admin only', () => {
    expectAll(masterAccountRoutes, ADMIN, [
      ['get', '/mahallu-accounts'],
      ['post', '/mahallu-accounts'],
      ['put', '/mahallu-accounts/x1'],
      ['delete', '/mahallu-accounts/x1'],
    ]);
  });

  test('wallets are tenant-wide and have no institute scoping, so they are Mahallu admin only', () => {
    expectAll(masterAccountRoutes, ADMIN, [
      ['get', '/wallets'],
      ['post', '/wallets'],
      ['put', '/wallets/x1'],
      ['delete', '/wallets/x1'],
    ]);
  });

  test('an institute admin cannot widen the scope of a list with scope=mahallu', () => {
    // The scope-stripping middleware sits before the controllers and removes `scope` for the institute role only.
    const strip = masterAccountRoutes.stack.find(
      (layer: any) => !layer.route && layer.regexp.fast_slash && !layer.handle.isRoleGuard && layer.handle.length === 3 && /delete req\.query\.scope/.test(layer.handle.toString())
    );
    assert.ok(strip, 'scope-stripping middleware is registered');
    const run = (role: string) => {
      const req: any = { user: { role }, query: { scope: 'mahallu', type: 'income' } };
      strip.handle(req, {} as any, () => undefined);
      return req.query;
    };
    assert.deepEqual(run('institute'), { type: 'income' });
    assert.deepEqual(run('mahall'), { scope: 'mahallu', type: 'income' });
  });
});

describe('accounting reports', () => {
  test('statements are open to institute staff, never to survey', () => {
    expectAll(accountingReportRoutes, INSTITUTE_STAFF, [
      ['get', '/day-book'],
      ['get', '/trial-balance'],
      ['get', '/balance-sheet'],
      ['get', '/ledger-report'],
      ['get', '/income-expenditure'],
    ]);
    assert.ok(usesMiddleware(accountingReportRoutes, instituteFilter), 'accounting reports must apply instituteFilter');
  });

  test('the consolidated (Mahallu-wide) report is Mahallu admin only', () => {
    expectRoles(accountingReportRoutes, 'get', '/consolidated', ADMIN);
  });

  test('an institute admin cannot widen the scope of a statement with scope / includeEntities', () => {
    const strip = accountingReportRoutes.stack.find(
      (layer: any) => !layer.route && layer.regexp.fast_slash && !layer.handle.isRoleGuard && layer.handle.length === 3 && /delete req\.query\.scope/.test(layer.handle.toString())
    );
    assert.ok(strip, 'scope-stripping middleware is registered');
    const run = (role: string) => {
      const req: any = { user: { role }, query: { scope: 'combined', includeEntities: 'mahallu', startDate: '2026-01-01' } };
      strip.handle(req, {} as any, () => undefined);
      return req.query;
    };
    assert.deepEqual(run('institute'), { startDate: '2026-01-01' });
    assert.deepEqual(run('mahall'), { scope: 'combined', includeEntities: 'mahallu', startDate: '2026-01-01' });
  });
});

describe('petty cash, employees, institutes', () => {
  test('petty cash is institute staff only and institute-bound', () => {
    expectAll(pettyCashRoutes, INSTITUTE_STAFF, [
      ['get', '/'],
      ['get', '/x1'],
      ['post', '/'],
      ['put', '/x1'],
      ['get', '/x1/transactions'],
      ['post', '/x1/expense'],
      ['post', '/x1/replenish'],
    ]);
    assert.ok(usesMiddleware(pettyCashRoutes, instituteFilter));
  });

  test('employees are institute staff only and institute-bound', () => {
    expectAll(employeeRoutes, INSTITUTE_STAFF, CRUD_ID);
    assert.ok(usesMiddleware(employeeRoutes, instituteFilter));
  });

  test('institutes are institute staff only (survey excluded)', () => {
    expectAll(instituteRoutes, INSTITUTE_STAFF, CRUD_ID);
  });
});

describe('registrations and registers', () => {
  test('nikah, death and NOC registrations are Mahallu admin only', () => {
    for (const kind of ['nikah', 'death', 'noc']) {
      expectAll(registrationRoutes, ADMIN, [
        ['get', `/${kind}`],
        ['get', `/${kind}/x1`],
        ['post', `/${kind}`],
        ['put', `/${kind}/x1`],
      ]);
    }
  });

  test('field registers are open to survey workers (the CMS menu lists them) but not to institute admins', () => {
    expectAll(registerRoutes, FIELD_STAFF, [
      ['get', '/summary'],
      ['get', '/x1'],
    ]);
  });
});

describe('reports', () => {
  test('welfare, community, annual, data quality and duplicates are Mahallu admin only', () => {
    expectAll(reportRoutes, ADMIN, [
      ['get', '/welfare'],
      ['get', '/community'],
      ['get', '/annual'],
      ['get', '/data-quality'],
      ['get', '/duplicates'],
    ]);
  });

  test('area, blood bank, orphans and demographics are field reports (survey allowed, institute not)', () => {
    expectAll(reportRoutes, FIELD_STAFF, [
      ['get', '/area'],
      ['get', '/blood-bank'],
      ['get', '/orphans'],
      ['get', '/demographics'],
    ]);
  });

  test('the education report is open to institute staff (the CMS lists it for them), not to survey', () => {
    expectRoles(reportRoutes, 'get', '/education', INSTITUTE_STAFF);
  });
});

describe('Mahallu content: assets, committees, meetings, programs', () => {
  test('assets and maintenance records are Mahallu admin only', () => {
    expectAll(assetRoutes, ADMIN, [
      ...CRUD_ID,
      ['get', '/x1/maintenance'],
      ['post', '/x1/maintenance'],
      ['put', '/x1/maintenance/x1'],
      ['delete', '/x1/maintenance/x1'],
    ]);
  });

  test('committees are Mahallu admin only', () => {
    expectAll(committeeRoutes, ADMIN, [...CRUD_ID, ['get', '/x1/meetings']]);
  });

  test('meetings are Mahallu admin only', () => {
    expectAll(meetingRoutes, ADMIN, CRUD_ID);
  });

  test('programs and their registrations are Mahallu admin only (programs have no institute link)', () => {
    expectAll(programRoutes, ADMIN, [
      ...CRUD_ID,
      ['get', '/x1/registrations'],
      ['post', '/x1/registrations'],
      ['put', '/x1/registrations/x1'],
      ['delete', '/x1/registrations/x1'],
    ]);
  });
});

describe('collectibles', () => {
  test('varisangya, zakat and wallet are Mahallu admin only, including create / edit / delete / verify', () => {
    expectAll(collectibleRoutes, ADMIN, [
      ['get', '/varisangya'],
      ['get', '/receipt-next'],
      ['get', '/dues'],
      ['post', '/varisangya'],
      ['put', '/varisangya/x1'],
      ['put', '/varisangya/x1/verify'],
      ['delete', '/varisangya/x1'],
      ['get', '/zakat'],
      ['post', '/zakat'],
      ['put', '/zakat/x1'],
      ['put', '/zakat/x1/verify'],
      ['delete', '/zakat/x1'],
      ['get', '/wallet'],
      ['get', '/wallet/x1/transactions'],
    ]);
  });
});

describe('social and uploads', () => {
  test('banners, feeds and support tickets can be changed by the Mahallu admin only', () => {
    expectAll(socialRoutes, ADMIN, [
      ['post', '/banners'],
      ['put', '/banners/x1'],
      ['delete', '/banners/x1'],
      ['post', '/feeds'],
      ['put', '/support/x1'],
    ]);
  });

  test('reading banners and feeds, and raising or listing a support ticket, stay available to every staff role', () => {
    expectAll(socialRoutes, ALL_STAFF, [
      ['get', '/banners'],
      ['get', '/banners/x1'],
      ['get', '/feeds'],
      ['get', '/support'],
      ['post', '/support'],
    ]);
  });

  test('activity logs are Mahallu admin only', () => {
    expectRoles(socialRoutes, 'get', '/activity-logs', ADMIN);
  });

  test('banner and notification image uploads (public CDN) are Mahallu admin only', () => {
    expectAll(uploadRoutes, ADMIN, [
      ['post', '/notification-image'],
      ['post', '/banner-image'],
    ]);
  });
});

describe('welfare', () => {
  const RECORD_ROUTES: Array<[string, string]> = [
    ['get', '/summary'],
    ['get', '/applications'],
    ['get', '/applications/x1'],
    ['post', '/applications'],
  ];

  test('welfare records demand the welfare sensitive module and exclude institute admins', () => {
    expectAll(welfareRoutes, FIELD_STAFF, RECORD_ROUTES, ['welfare']);
  });

  test('the scheme catalogue is not sensitive: field staff read it without the welfare module', () => {
    expectAll(welfareRoutes, FIELD_STAFF, [['get', '/schemes'], ['get', '/schemes/x1']]);
  });

  test('scheme changes stay Mahallu admin only, without the welfare module', () => {
    expectAll(welfareRoutes, ADMIN, [['post', '/schemes'], ['put', '/schemes/x1'], ['delete', '/schemes/x1']]);
  });

  test('application edits, workflow moves and deletes stay Mahallu admin only on top of the sensitive module', () => {
    expectAll(
      welfareRoutes,
      ADMIN,
      [
        ['put', '/applications/x1'],
        ['put', '/applications/x1/status'],
        ['delete', '/applications/x1'],
      ],
      ['welfare']
    );
  });

  test('the sensitive guard refuses a non-super-admin who lacks the module and admits one who holds it', () => {
    const probe = (user: any, isSuperAdmin: boolean) => {
      const layer: any = welfareRoutes.stack.find((l: any) => l.route?.path === '/applications' && l.route.methods.get);
      const guards = layer.route.stack.map((l: any) => l.handle).filter((h: any) => isSensitiveGuard(h));
      assert.equal(guards.length, 1);
      return runMiddleware(guards[0], user, isSuperAdmin);
    };
    assert.equal(probe({ role: 'mahall', permissions: {} }, false).status, 403);
    assert.equal(probe({ role: 'mahall', permissions: { sensitiveModules: ['health'] } }, false).status, 403);
    assert.equal(probe({ role: 'mahall', permissions: { sensitiveModules: ['welfare'] } }, false).nextCalled, true);
    assert.equal(probe({ role: 'mahall', permissions: {} }, true).nextCalled, true);
  });
});


describe('dashboard and notifications', () => {
  test('the financial summary is Mahallu admin only', () => {
    expectRoles(dashboardRoutes, 'get', '/financial-summary', ADMIN);
  });

  test('the other dashboard widgets stay open to every staff role', () => {
    expectAll(dashboardRoutes, ALL_STAFF, [
      ['get', '/stats'],
      ['get', '/recent-families'],
      ['get', '/activity-timeline'],
    ]);
  });

  test('notifications: reading and marking read are open, sending is Mahallu admin only', () => {
    expectRoles(notificationRoutes, 'get', '/', ALL_STAFF);
    expectRoles(notificationRoutes, 'put', '/x1/read', ALL_STAFF);
    expectRoles(notificationRoutes, 'put', '/read-all', ALL_STAFF);
    expectRoles(notificationRoutes, 'post', '/', ADMIN);
  });
});

/**
 * A router added to (or edited in) this list without a role guard fails here, which is the point: money,
 * payroll, civil records and Mahallu-wide content must never ship reachable by whoever holds any valid token.
 */
describe('finance and civil-record routers always sit behind a role guard', () => {
  const GUARDED: Array<[name: string, router: any]> = [
    ['salary', salaryRoutes],
    ['masterAccount', masterAccountRoutes],
    ['accountingReport', accountingReportRoutes],
    ['pettyCash', pettyCashRoutes],
    ['employee', employeeRoutes],
    ['institute', instituteRoutes],
    ['registration', registrationRoutes],
    ['collectible', collectibleRoutes],
    ['asset', assetRoutes],
    ['committee', committeeRoutes],
    ['meeting', meetingRoutes],
    ['program', programRoutes],
    ['report', reportRoutes],
    ['upload', uploadRoutes],
    ['welfare', welfareRoutes],
    ['register', registerRoutes],
  ];

  for (const [name, router] of GUARDED) {
    test(`${name}: every endpoint has at least one role guard that actually narrows the audience`, () => {
      const routes = listRoutes(router);
      assert.ok(routes.length > 0, `${name} lists no routes`);
      for (const { method, path: p } of routes) {
        const access = inspectRoute(router, method, p);
        assert.ok(access.guards >= 1, `${name}: ${method.toUpperCase()} ${p} has no role guard`);
        // A guard that lists all four staff roles (allowRoles(ROLE_GROUPS.ALL_STAFF)) is a no-op for this purpose.
        assert.ok(access.roles.length < ALL_STAFF.length, `${name}: ${method.toUpperCase()} ${p} is open to every staff role`);
      }
    });
  }

  const NEVER_SURVEY = [
    ['salary', salaryRoutes],
    ['masterAccount', masterAccountRoutes],
    ['accountingReport', accountingReportRoutes],
    ['pettyCash', pettyCashRoutes],
    ['employee', employeeRoutes],
    ['institute', instituteRoutes],
    ['registration', registrationRoutes],
    ['collectible', collectibleRoutes],
    ['asset', assetRoutes],
    ['committee', committeeRoutes],
    ['meeting', meetingRoutes],
    ['program', programRoutes],
    ['upload', uploadRoutes],
  ] as Array<[string, any]>;

  for (const [name, router] of NEVER_SURVEY) {
    test(`${name}: no endpoint is reachable by a survey worker`, () => {
      for (const { method, path: p } of listRoutes(router)) {
        assert.ok(!inspectRoute(router, method, p).roles.includes('survey'), `${name}: ${method.toUpperCase()} ${p}`);
      }
    });
  }

  const NEVER_INSTITUTE = [
    ['registration', registrationRoutes],
    ['collectible', collectibleRoutes],
    ['asset', assetRoutes],
    ['committee', committeeRoutes],
    ['meeting', meetingRoutes],
    ['program', programRoutes],
    ['upload', uploadRoutes],
    ['register', registerRoutes],
    ['welfare', welfareRoutes],
  ] as Array<[string, any]>;

  for (const [name, router] of NEVER_INSTITUTE) {
    test(`${name}: no endpoint is reachable by an institute admin`, () => {
      for (const { method, path: p } of listRoutes(router)) {
        assert.ok(!inspectRoute(router, method, p).roles.includes('institute'), `${name}: ${method.toUpperCase()} ${p}`);
      }
    });
  }

  test('the guarded routers are the ones the app actually mounts', () => {
    const index = fs.readFileSync(path.join(__dirname, '..', 'app.ts'), 'utf8');
    for (const file of [
      'salaryRoutes',
      'masterAccountRoutes',
      'accountingReportRoutes',
      'pettyCashRoutes',
      'employeeRoutes',
      'instituteRoutes',
      'registrationRoutes',
      'collectibleRoutes',
      'assetRoutes',
      'committeeRoutes',
      'meetingRoutes',
      'programRoutes',
      'reportRoutes',
      'uploadRoutes',
      'welfareRoutes',
      'registerRoutes',
      'socialRoutes',
      'dashboardRoutes',
      'notificationRoutes',
    ]) {
      assert.match(index, new RegExp(`import ${file} from './routes/${file}'`), `${file} is imported in app.ts`);
      assert.match(index, new RegExp(`app\\.use\\('/api/[a-z-]+', ${file}\\)`), `${file} is mounted in app.ts`);
    }
  });
});

/**
 * Sweep of EVERY router module under src/routes.
 *
 * Each module is classified below with the widest audience any of its endpoints may have (its ceiling). The
 * test fails when
 *  - a router file exists that is not classified (so a new router cannot ship without someone choosing its
 *    audience),
 *  - an endpoint is reachable by a role wider than its router's ceiling, or
 *  - a classified file no longer exists.
 * An endpoint that additionally demands a sensitive-module grant (`sensitiveAccess`) is exempt from the
 * ceiling: that grant is an explicit, per-user gate (counselling, maslahat, inheritance, health).
 * Set ROUTE_AUTH_AUDIT=1 to print the per-router table.
 */
describe('sweep of every router module', () => {
  type Ceiling = 'ADMIN' | 'INSTITUTE_STAFF' | 'FIELD_STAFF' | 'ALL_STAFF' | 'NONE';
  const CEILING_ROLES: Record<Ceiling, readonly StaffRole[]> = {
    NONE: [],
    ADMIN,
    INSTITUTE_STAFF,
    FIELD_STAFF,
    ALL_STAFF,
  };

  /** [ceiling, why a wider audience than the CMS menu shows is intentional, when it is] */
  const CLASSIFICATION: Record<string, [Ceiling, string?]> = {
    // Mahallu admin only
    academicSupportRoutes: ['ADMIN'],
    announcementRoutes: ['ADMIN'],
    assetRoutes: ['ADMIN'],
    assistantRoutes: ['ADMIN'],
    cemeteryRoutes: ['ADMIN'],
    collectibleRoutes: ['ADMIN'],
    committeeRoutes: ['ADMIN'],
    counsellingRoutes: ['ADMIN', 'reads additionally need the per-user sensitive-module grant'],
    developmentIndexRoutes: ['ADMIN'],
    developmentRoutes: ['ADMIN'],
    employmentRoutes: ['ADMIN'],
    exportRoutes: ['ADMIN'],
    healthRoutes: ['ADMIN', 'the sensitive listing additionally needs the per-user sensitive-module grant'],
    khutbahRoutes: ['ADMIN'],
    libraryRoutes: ['ADMIN'],
    marriageAssistanceRoutes: ['ADMIN'],
    meetingRoutes: ['ADMIN'],
    programRoutes: ['ADMIN'],
    qardRoutes: ['ADMIN'],
    registrationRoutes: ['ADMIN'],
    scholarshipRoutes: ['ADMIN'],
    skillTrainingRoutes: ['ADMIN'],
    uploadRoutes: ['ADMIN'],
    reconciliationRoutes: ['ADMIN'],
    userRoutes: ['ADMIN'],
    volunteerRoutes: ['ADMIN'],
    zakatDistributionRoutes: ['ADMIN'],
    // Mahallu admin and institute admin
    accountingReportRoutes: ['INSTITUTE_STAFF'],
    attendanceRoutes: ['INSTITUTE_STAFF'],
    employeeRoutes: ['INSTITUTE_STAFF'],
    examRoutes: ['INSTITUTE_STAFF'],
    instituteRoutes: ['INSTITUTE_STAFF'],
    madrasaRoutes: ['INSTITUTE_STAFF'],
    masterAccountRoutes: ['INSTITUTE_STAFF'],
    pettyCashRoutes: ['INSTITUTE_STAFF'],
    salaryRoutes: ['INSTITUTE_STAFF'],
    // Mahallu admin and survey worker
    clusterRoutes: ['FIELD_STAFF'],
    clusterVisitRoutes: ['FIELD_STAFF'],
    localityFacilityRoutes: ['FIELD_STAFF'],
    registerRoutes: ['FIELD_STAFF'],
    reliefRoutes: ['FIELD_STAFF', 'a survey worker may log a relief case (the POST names survey); everything else is admin'],
    surveyRoutes: ['FIELD_STAFF'],
    welfareRoutes: ['FIELD_STAFF', 'survey workers take welfare applications; needs the welfare sensitive module'],
    // Every staff role, on purpose
    authRoutes: ['ALL_STAFF', 'login, OTP, session and account switching are reachable by whoever signs in'],
    categoryRoutes: ['ALL_STAFF', 'only /by-key (shared reference data for dropdowns) is open; the rest is superAdminOnly'],
    certificateRoutes: ['ALL_STAFF', 'issuing and revoking are admin guarded; reading is scoped in the controller'],
    changeRequestRoutes: ['ALL_STAFF', 'raising is scoped to the requester in the controller; review is admin guarded'],
    dashboardRoutes: ['ALL_STAFF', 'stats, recent families and timeline are for every staff role; financial-summary is admin'],
    demoRequestRoutes: ['ALL_STAFF', 'POST is the public landing-page form, open to anyone and rate limited; the GET inbox is superAdminOnly'],
    documentRoutes: ['ALL_STAFF', 'uploads are scoped to the uploader in the controller; status changes are admin guarded'],
    familyRoutes: ['ALL_STAFF', 'router-level allowRoles(ALL_STAFF); scoped in the controller. NEEDS A PRODUCT DECISION for institute'],
    memberRoutes: ['ALL_STAFF', 'router-level allowRoles(ALL_STAFF); scoped in the controller. NEEDS A PRODUCT DECISION for institute'],
    mosqueRoutes: ['ALL_STAFF', 'the CMS menu lists Mosque for every staff role; writes are admin guarded'],
    notificationRoutes: ['ALL_STAFF', 'a staff user reads and marks their own notifications; sending is admin guarded'],
    reportRoutes: ['ALL_STAFF', 'union of the field reports (survey) and the education report (institute); each is pinned above'],
    socialRoutes: ['ALL_STAFF', 'every staff role may read banners/feeds and raise a support ticket; changes are admin guarded'],
    tenantRoutes: ['ALL_STAFF', 'a staff user reads their own Mahallu (GET /:id, /:id/stats), scoped in the controller; the rest is superAdminOnly'],
    // No staff role at all
    memberUserRoutes: ['NONE', 'member self-service, behind memberUserOnly'],
  };

  const routesDir = path.join(__dirname, '..', 'routes');
  const files = fs
    .readdirSync(routesDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();
  const modules: Array<{ file: string; exportName: string; router: any }> = [];
  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(path.join(routesDir, file));
    for (const [exportName, value] of Object.entries(mod)) {
      if (typeof value === 'function' && Array.isArray((value as any).stack)) {
        modules.push({ file, exportName, router: value });
      }
    }
  }

  test('every router file is classified, and every classification names a real file', () => {
    assert.deepEqual(
      files.filter((f) => !(f in CLASSIFICATION)),
      [],
      'a router file has no audience ceiling: add it to CLASSIFICATION after deciding who may use it'
    );
    assert.deepEqual(
      Object.keys(CLASSIFICATION).filter((f) => !files.includes(f)),
      []
    );
  });

  test('every router file exports at least one router', () => {
    for (const file of files) assert.ok(modules.some((m) => m.file === file), `${file} exports no router`);
  });

  if (process.env.ROUTE_AUTH_AUDIT) {
    test('audit table', () => {
      const lines: string[] = [];
      for (const { file, exportName, router } of modules) {
        const summary = new Map<string, number>();
        for (const { method, path: p } of listRoutes(router)) {
          const a = inspectRoute(router, method, p);
          const who = a.roles.length === 4 ? 'ALL' : a.roles.filter((r) => r !== 'super_admin').join('+') || (a.roles.length === 0 ? 'NONE' : 'SUPER');
          const key = `${who}${a.sensitive.length ? ` [sensitive:${a.sensitive.join(',')}]` : ''}${a.guards === 0 ? ' (no guard)' : ''}`;
          summary.set(key, (summary.get(key) || 0) + 1);
        }
        lines.push(`${file}${exportName === 'default' ? '' : `:${exportName}`}  ${[...summary.entries()].map(([k, n]) => `${n}x ${k}`).join(' | ')}`);
      }
      // eslint-disable-next-line no-console
      console.log(`\n${lines.join('\n')}\n`);
    });
  }

  test('no endpoint is reachable by a role wider than its router ceiling', () => {
    const offenders: string[] = [];
    for (const { file, exportName, router } of modules) {
      const [ceiling] = CLASSIFICATION[file] ?? ['NONE'];
      const allowed = CEILING_ROLES[ceiling];
      for (const { method, path: p } of listRoutes(router)) {
        const access = inspectRoute(router, method, p);
        if (access.sensitive.length > 0) continue;
        const extra = access.roles.filter((r) => !allowed.includes(r));
        if (extra.length > 0) offenders.push(`${file}:${exportName} ${method.toUpperCase()} ${p} reachable by ${extra.join(', ')} (ceiling ${ceiling})`);
      }
    }
    assert.deepEqual(offenders, [], `endpoints wider than their router's ceiling:\n${offenders.join('\n')}`);
  });

  test('routers whose ceiling is ADMIN, INSTITUTE_STAFF or FIELD_STAFF have no unguarded endpoint', () => {
    const offenders: string[] = [];
    for (const { file, exportName, router } of modules) {
      const [ceiling] = CLASSIFICATION[file] ?? ['NONE'];
      if (ceiling === 'ALL_STAFF' || ceiling === 'NONE') continue;
      for (const { method, path: p } of listRoutes(router)) {
        if (inspectRoute(router, method, p).guards === 0) offenders.push(`${file}:${exportName} ${method.toUpperCase()} ${p}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  test('member routes are closed to every staff role', () => {
    const member = modules.filter((m) => m.file === 'memberUserRoutes');
    assert.ok(member.length > 0);
    for (const { router } of member) {
      for (const { method, path: p } of listRoutes(router)) assert.deepEqual(inspectRoute(router, method, p).roles, [], `${method} ${p}`);
    }
  });

  test('tenant management (create, delete, suspend, activate, list) is Super Admin only', () => {
    const tenant = modules.find((m) => m.file === 'tenantRoutes')!.router;
    expectRoles(tenant, 'get', '/', ['super_admin']);
    expectRoles(tenant, 'post', '/', ['super_admin']);
    expectRoles(tenant, 'delete', '/x1', ['super_admin']);
    expectRoles(tenant, 'post', '/x1/suspend', ['super_admin']);
    expectRoles(tenant, 'post', '/x1/activate', ['super_admin']);
  });

  const routersOf = (file: string) => modules.filter((m) => m.file === file);

  test('modules guarded in the second pass: Mahallu admin only', () => {
    for (const file of [
      'announcementRoutes',
      'developmentRoutes',
      'marriageAssistanceRoutes',
      'qardRoutes',
      'zakatDistributionRoutes',
      'cemeteryRoutes',
      'employmentRoutes',
      'scholarshipRoutes',
      'volunteerRoutes',
      'academicSupportRoutes',
      'skillTrainingRoutes',
      'libraryRoutes',
      'khutbahRoutes',
      'healthRoutes',
    ]) {
      assert.ok(routersOf(file).length > 0, `${file} exports a router`);
      for (const { exportName, router } of routersOf(file)) {
        for (const { method, path: p } of listRoutes(router)) {
          const access = inspectRoute(router, method, p);
          if (access.sensitive.length > 0) continue;
          assert.deepEqual(sorted(access.roles), sorted(ADMIN), `${file}:${exportName} ${method.toUpperCase()} ${p}`);
        }
      }
    }
  });

  test('education modules (classes, attendance, exams): reads open to institute admins, never to survey workers', () => {
    for (const file of ['madrasaRoutes', 'attendanceRoutes', 'examRoutes']) {
      for (const { router } of routersOf(file)) {
        for (const { method, path: p } of listRoutes(router)) {
          const roles = inspectRoute(router, method, p).roles;
          assert.ok(!roles.includes('survey'), `${file}: ${method.toUpperCase()} ${p} -> ${roles.join(',')}`);
          if (method === 'get') assert.ok(roles.includes('institute'), `${file}: ${method.toUpperCase()} ${p} -> ${roles.join(',')}`);
        }
      }
    }
  });

  test('field modules (clusters, cluster visits, locality facilities, surveys, relief): reads open to survey workers, never to institute admins', () => {
    for (const file of ['clusterRoutes', 'clusterVisitRoutes', 'localityFacilityRoutes', 'surveyRoutes', 'reliefRoutes']) {
      for (const { router } of routersOf(file)) {
        for (const { method, path: p } of listRoutes(router)) {
          const roles = inspectRoute(router, method, p).roles;
          assert.ok(!roles.includes('institute'), `${file}: ${method.toUpperCase()} ${p} -> ${roles.join(',')}`);
          if (method === 'get') assert.ok(roles.includes('survey'), `${file}: ${method.toUpperCase()} ${p} -> ${roles.join(',')}`);
        }
      }
    }
  });
});
