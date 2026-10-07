import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

// Wrapped in one root suite, like every other file in the aggregate run.
describe('[isolated] permissionFlagsNotEnforced', () => {

/**
 * `User.permissions.view|add|edit|delete` are stored and shown, but nothing authorizes with them (see
 * docs/AUTHORIZATION_POLICY.md section 4 / decision D1). Most staff are stored with add=edit=delete=false,
 * so ENFORCING one flag on one route would lock those accounts out of that route while every other route
 * stays open: an inconsistent half-enforcement nobody decided on.
 *
 * This fails when a router, middleware or controller starts reading a flag. If enforcement is approved,
 * do it everywhere at once (a `requirePermission` guard plus a data migration and new form defaults),
 * and then update this test on purpose.
 */

const SRC = path.resolve(__dirname, '..');
const DIRS = ['routes', 'controllers', 'middleware'];

/** Files that read a flag without authorizing anything. */
const NOT_AUTHORIZATION: Record<string, string> = {
  'memberUserController.ts': "echoes the member's own flags back as `assignedOptions`",
};

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });

const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** `permissions.add`, `permissions?.edit`, `permissions['delete']`, `permissions?.['view']` */
const FLAG_READ = /\bpermissions\s*(?:\?\.\s*\[?|\.|\[)\s*['"]?(view|add|edit|delete)\b/;
/** `const { add, edit } = req.user.permissions` and friends */
const FLAG_DESTRUCTURE = /\{[^}]*\b(view|add|edit|delete)\b[^}]*\}\s*=\s*[\w.?]*permissions\b/;

test('no router, middleware or controller reads permissions.view/add/edit/delete to allow or deny', () => {
  const offenders: string[] = [];
  for (const dir of DIRS) {
    for (const file of files(path.join(SRC, dir))) {
      const name = path.basename(file);
      if (NOT_AUTHORIZATION[name]) continue;
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      if (FLAG_READ.test(code) || FLAG_DESTRUCTURE.test(code)) offenders.push(`${dir}/${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the one allow-listed reader only echoes the flags and does not decide access', () => {
  const code = stripComments(fs.readFileSync(path.join(SRC, 'controllers', 'memberUserController.ts'), 'utf8'));
  const lines = code.split('\n').filter((line) => FLAG_READ.test(line));
  assert.ok(lines.length > 0, 'the echo is still there (update this test if it moved)');
  for (const line of lines) {
    assert.match(line, /\b(view|add|edit|delete)\s*:\s*req\.user\.permissions\?\.\w+\s*\?\?\s*false/, line.trim());
  }
});

test('the guard patterns catch the shapes a half-enforcement would use', () => {
  for (const sample of [
    'if (!req.user.permissions.edit) return deny();',
    'if (!req.user?.permissions?.delete) return deny();',
    "if (!user.permissions['add']) return deny();",
    'const { add } = req.user.permissions;',
  ]) {
    assert.ok(FLAG_READ.test(sample) || FLAG_DESTRUCTURE.test(sample), sample);
  }
});
});
