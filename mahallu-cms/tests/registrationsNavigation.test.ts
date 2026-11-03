import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

/*
 * Registrations (Nikah, Death, NOC, Marriage assistance, Certificates, Change requests) are for the platform Super
 * Admin only: the Mahallu admin ("mahall") does not see those pages, and cannot open them by typing the URL. Change
 * requests (a member's own profile edits) are the exception: the Mahallu admin reviews them for their own Mahallu.
 *
 * The menu half runs the REAL menu definition (constants/menuItems.ts) through the REAL access rule
 * (utils/menuAccess.ts) for every role. The route half reads every route file, because a hidden tab alone is not
 * protection: each registration page must be declared with `superAdminRoute`, which the route guard enforces.
 */

const SRC = new URL('../src/', import.meta.url);

// ---- load a real source file: transpiled to CommonJS, with the icon package (not needed here) stubbed out
const icons = new Proxy({}, { get: (_target, name) => (name === '__esModule' ? false : () => null) });
const cache = new Map<string, unknown>();
const load = (relative: string): Record<string, unknown> => {
  if (cache.has(relative)) return cache.get(relative) as Record<string, unknown>;
  const source = fs.readFileSync(new URL(relative, SRC), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  const stubRequire = (specifier: string) => {
    if (specifier.startsWith('react-icons/')) return icons;
    throw new Error(`unexpected import "${specifier}" in ${relative}: this file must stay loadable without the app's other modules`);
  };
  new Function('module', 'exports', 'require', js)(module, module.exports, stubRequire);
  cache.set(relative, module.exports);
  return module.exports;
};

type Role = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';
interface MenuNode {
  id: string;
  label: string;
  path?: string;
  allowedRoles?: Role[];
  superAdminOnly?: boolean;
  children?: MenuNode[];
}
interface FlatNode extends MenuNode {
  path: string;
}
const { menuItems } = load('constants/menuItems.ts') as { menuItems: MenuNode[] };
const { isMenuItemAccessible, flattenMenuItems } = load('utils/menuAccess.ts') as {
  isMenuItemAccessible: (item: MenuNode, role: Role | null, isSuperAdmin: boolean, sensitive: string[]) => boolean;
  flattenMenuItems: (items: MenuNode[]) => FlatNode[];
};
const { ROUTES } = load('constants/routes.ts') as { ROUTES: Record<string, unknown> };

const ROLES: Role[] = ['super_admin', 'mahall', 'survey', 'institute', 'member'];
const NOT_SUPER_ADMIN_ROLES = ROLES.filter((role) => role !== 'super_admin');
/** What the sidebar and the command palette ask for each signed-in account. */
const canSee = (item: MenuNode, role: Role) => isMenuItemAccessible(item, role, role === 'super_admin', []);

/** The five pages only the Super Admin may open. */
const SUPER_ADMIN_ITEMS: Record<string, string> = {
  nikah: '/registrations/nikah',
  death: '/registrations/death',
  'nikah-noc': '/registrations/noc/nikah',
  'marriage-assistance': '/registrations/marriage-assistance',
  certificates: '/admin/certificates',
};
/**
 * A member's own profile edits: the Mahallu admin reviews them for their own Mahallu, next to the Super Admin. The
 * menu item lives in the Services group, not in the Super Admin-only Registrations group.
 */
const CHANGE_REQUESTS_ID = 'change-requests';
const group = menuItems.find((item) => item.id === 'registrations') as MenuNode;
/** A page only the Super Admin may open: everything under /registrations, plus the certificates page. */
const isRegistrationPath = (path: string) =>
  path.startsWith('/registrations') || path === String((ROUTES.CERTIFICATES as { LIST: string }).LIST);
const CHANGE_REQUESTS_PATH = String(ROUTES.CHANGE_REQUESTS);

describe('navigation: the Registrations tab', () => {
  test('the menu has a Registrations group with the five pages the Super Admin uses', () => {
    assert.ok(group, 'found the group');
    assert.deepEqual(
      (group.children ?? []).map((child) => [child.id, child.path]),
      Object.entries(SUPER_ADMIN_ITEMS)
    );
  });

  test('the Super Admin sees the tab and every page in it', () => {
    assert.equal(canSee(group, 'super_admin'), true);
    for (const child of group.children ?? []) assert.equal(canSee(child, 'super_admin'), true, child.id);
  });

  test('the Mahallu admin does not see the tab or any page in it', () => {
    assert.equal(canSee(group, 'mahall'), false, 'the tab itself');
    for (const child of group.children ?? []) assert.equal(canSee(child, 'mahall'), false, child.id);
  });

  test('no other role sees it either: survey, institute and member accounts', () => {
    for (const role of ['survey', 'institute', 'member'] as Role[]) {
      assert.equal(canSee(group, role), false, `${role}: the tab`);
      for (const child of group.children ?? []) assert.equal(canSee(child, role), false, `${role}: ${child.id}`);
    }
  });

  test('no menu entry anywhere (not only in the group) leads a non-Super-Admin to a registration page', () => {
    for (const role of NOT_SUPER_ADMIN_ROLES) {
      const reachable = flattenMenuItems(menuItems)
        .filter((item) => canSee(item, role) && isRegistrationPath(item.path))
        .map((item) => item.path);
      assert.deepEqual(reachable, [], role);
    }
    const asSuperAdmin = flattenMenuItems(menuItems).filter((item) => canSee(item, 'super_admin') && isRegistrationPath(item.path));
    assert.equal(asSuperAdmin.length, 5, 'the Super Admin still reaches all five');
  });

  test('Change requests sits outside the Registrations group, and the Mahallu admin and the Super Admin (no other role) reach it from the menu', () => {
    assert.ok(!(group.children ?? []).some((child) => child.id === CHANGE_REQUESTS_ID), 'not in the Registrations group');
    const owner = menuItems.find((item) => (item.children ?? []).some((child) => child.id === CHANGE_REQUESTS_ID)) as MenuNode;
    assert.ok(owner, 'it is in another menu group');
    assert.notEqual(owner.id, 'registrations');
    const item = (owner.children ?? []).find((child) => child.id === CHANGE_REQUESTS_ID) as MenuNode;
    assert.equal(item.path, CHANGE_REQUESTS_PATH);
    for (const role of ROLES) {
      const reaches = canSee(owner, role) && canSee(item, role);
      assert.equal(reaches, role === 'super_admin' || role === 'mahall', role);
    }
  });

  test('a Super Admin "viewing as" a Mahallu admin gets the Mahallu admin\'s menu: no Registrations tab, Change requests still there', () => {
    // View As keeps the role of the account being viewed and clears the Super Admin flag.
    assert.equal(isMenuItemAccessible(group, 'mahall', false, []), false);
    const item = flattenMenuItems(menuItems).find((entry) => entry.path === CHANGE_REQUESTS_PATH) as MenuNode;
    assert.equal(isMenuItemAccessible(item, 'mahall', false, []), true);
    // Viewing a Mahallu while staying Super Admin (the tenant picker) keeps full access.
    assert.equal(isMenuItemAccessible(group, 'super_admin', true, []), true);
  });

  test('the Mahallu admin\'s other pages are untouched', () => {
    const visible = flattenMenuItems(menuItems).filter((item) => canSee(item, 'mahall')).map((item) => item.path);
    for (const path of ['/families', '/members', '/collectibles/varisangya']) assert.ok(visible.includes(path), `still visible: ${path}`);
    assert.ok(visible.length > 20, `the Mahallu admin still has a full menu (${visible.length} pages)`);
  });
});

describe('route access: typing the URL does not open a registration page', () => {
  const routeFiles = fs.readdirSync(new URL('routes/', SRC)).filter((file) => file.endsWith('.tsx') && file !== 'routeHelpers.tsx');
  interface Declared {
    file: string;
    helper: 'route' | 'superAdminRoute';
    path: string;
  }
  // `route(ROUTES.X.Y, ...)` / `superAdminRoute('/literal', ...)` - the first argument is a quoted path or a ROUTES expression.
  const DECLARATION = /^\s*(route|superAdminRoute)\(\s*('[^']*'|"[^"]*"|ROUTES(?:\.[A-Za-z_]+|\([^)]*\))+)\s*,/;
  const declared: Declared[] = routeFiles.flatMap((file) =>
    fs
      .readFileSync(new URL(`routes/${file}`, SRC), 'utf8')
      .split(/\r?\n/)
      .flatMap((line): Declared[] => {
        const match = DECLARATION.exec(line);
        if (!match) return [];
        const expression = match[2];
        const path = /^['"]/.test(expression) ? expression.slice(1, -1) : String(new Function('ROUTES', `return ${expression}`)(ROUTES));
        return [{ file, helper: match[1] as Declared['helper'], path }];
      })
  );
  const registrationRoutes = declared.filter((entry) => isRegistrationPath(entry.path));

  test('the scan sees all 16 registration pages (so it cannot pass by finding nothing)', () => {
    const expected = [
      '/registrations/nikah', '/registrations/nikah/create', '/registrations/nikah/:id', '/registrations/nikah/:id/edit',
      '/registrations/death', '/registrations/death/create', '/registrations/death/:id', '/registrations/death/:id/edit',
      '/registrations/noc/common', '/registrations/noc/nikah', '/registrations/noc/create', '/registrations/noc/:id', '/registrations/noc/:id/edit',
      '/registrations/marriage-assistance', '/registrations/marriage-assistance/create',
      '/admin/certificates',
    ];
    assert.deepEqual([...new Set(registrationRoutes.map((entry) => entry.path))].sort(), [...expected].sort());
  });

  test('every registration page is a Super Admin route, in whichever route file it is declared', () => {
    const open = registrationRoutes.filter((entry) => entry.helper !== 'superAdminRoute').map((entry) => `${entry.file}: ${entry.path}`);
    assert.deepEqual(open, [], 'a registration page declared with plain route() would open for the Mahallu admin');
  });

  test('superAdminRoute really applies the Super Admin guard, and the guard sends everyone else away', () => {
    const helpers = fs.readFileSync(new URL('routes/routeHelpers.tsx', SRC), 'utf8');
    assert.match(helpers, /export const superAdminRoute = [\s\S]*?superAdminOnly: true/);
    const guard = fs.readFileSync(new URL('components/ui/ProtectedRoute.tsx', SRC), 'utf8');
    assert.match(guard, /if \(superAdminOnly && !isSuperAdmin\) \{\s*return <Navigate to="\/dashboard" replace \/>;/);
  });

  test('the Change requests page is open to the Mahallu admin and the Super Admin, and the guard sends every other role away', () => {
    const entry = declared.filter((declaration) => declaration.path === CHANGE_REQUESTS_PATH);
    assert.equal(entry.length, 1, 'declared once');
    assert.equal(entry[0].helper, 'route');
    const line = fs
      .readFileSync(new URL(`routes/${entry[0].file}`, SRC), 'utf8')
      .split(/\r?\n/)
      .find((text) => text.includes('ROUTES.CHANGE_REQUESTS')) as string;
    assert.match(line, /\{ allowedRoles: \['super_admin', 'mahall'\] \}/);
    const guard = fs.readFileSync(new URL('components/ui/ProtectedRoute.tsx', SRC), 'utf8');
    assert.match(guard, /if \(allowedRoles && !isSuperAdmin && !allowedRoles\.includes\(user\.role\)\) \{/);
  });

  test('the member portal\'s own certificate page is a different workflow and stays open to members', () => {
    const memberCertificates = declared.find((entry) => entry.path === String((ROUTES.MEMBER as { CERTIFICATES: string }).CERTIFICATES));
    assert.ok(memberCertificates, 'found /member/certificates');
    assert.equal(memberCertificates.helper, 'route');
    assert.equal(isRegistrationPath(memberCertificates.path), false);
  });
});

describe('Data Quality page: the export buttons match the server', () => {
  // The server refuses the nikah, death and noc CSV exports to everyone but the Super Admin (exportRoutes), so the
  // page must not offer them to a Mahallu admin: a button that can only answer 403 is misleading.
  const page = fs.readFileSync(new URL('features/admin/pages/DataQualityPage.tsx', SRC), 'utf8').replace(/\r\n/g, '\n');

  test('the registration exports are listed once, and only the Super Admin is shown them', () => {
    assert.match(page, /const REGISTRATION_EXPORTS = \['nikah', 'death', 'noc'\];/);
    assert.match(page, /const EXPORT_ENTITIES = \['families', 'members', 'varisangya', 'zakat', \.\.\.REGISTRATION_EXPORTS\];/);
    assert.match(page, /EXPORT_ENTITIES\.filter\(\(entity\) => isSuperAdmin \|\| !REGISTRATION_EXPORTS\.includes\(entity\)\)\.map\(/);
    assert.match(page, /const \{ isSuperAdmin \} = useAuthStore\(\);/);
  });

  test('there is no second, unfiltered list of export entities in the page', () => {
    assert.ok(!/\['families', 'members', 'varisangya', 'zakat', 'nikah'/.test(page), 'no second, unfiltered list of entities');
  });
});
