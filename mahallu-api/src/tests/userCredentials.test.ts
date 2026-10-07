import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import User from '../models/User';
import { createUser } from '../controllers/userController';
import { login } from '../controllers/authController';
import { createUserValidation } from '../validations/userValidation';
import { call, installFake, oid, Installed } from './support/fakeMongo';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] userCredentials', () => {

/**
 * Staff accounts the CMS creates carry NO password: the backend gives them a random hash nobody
 * knows and the person signs in with an OTP to their own phone. The three create forms used to send
 * the shared default '123456', so anyone who knew a staff phone number could sign in with it.
 */

const TENANT = oid();
const ADMIN = { _id: oid(), tenantId: TENANT, phone: '9000000001', role: 'mahall' };

let users: Installed;
beforeEach(() => {
  users = installFake(User);
});
afterEach(() => users.restore());

const create = (body: Record<string, unknown>) =>
  call(createUser, { body, user: ADMIN, tenantId: String(TENANT), isSuperAdmin: false });

const signIn = (phone: string, password: string) => call(login, { body: { phone, password } });

const storedHash = (phone: string): string => {
  const doc = users.store.docs.find((d) => d.phone === phone);
  assert.ok(doc, 'the account was saved');
  return doc.password as string;
};

describe('a staff account created without a password', () => {
  for (const role of ['mahall', 'survey', 'institute']) {
    test(`${role}: is created, and the shared default '123456' cannot sign in`, async () => {
      const phone = '9111111111';
      const out = await create({
        name: 'New Staff',
        phone,
        role,
        ...(role === 'institute' ? { instituteId: String(oid()) } : {}),
        permissions: { view: true, add: false, edit: false, delete: false },
      });
      assert.equal(out.status, 201);

      // What the form sends must not matter: the stored value is an unusable hash.
      const hash = storedHash(phone);
      assert.match(hash, /^\$2[aby]\$/, 'a bcrypt hash is stored, never a plain value');
      assert.equal(await bcrypt.compare('123456', hash), false);

      const attempt = await signIn(phone, '123456');
      assert.equal(attempt.status, 401);
      assert.equal(attempt.body.token, undefined);
      assert.equal(attempt.body.data, undefined);
    });
  }

  test('two accounts created without a password do not share a hash', async () => {
    await create({ name: 'First Staff', phone: '9111111112', role: 'survey' });
    await create({ name: 'Second Staff', phone: '9111111113', role: 'survey' });
    assert.notEqual(storedHash('9111111112'), storedHash('9111111113'));
  });
});

describe('the backend contract is kept: a supplied password is still stored', () => {
  test('an explicit password signs in with its own value only', async () => {
    const phone = '9111111115';
    const out = await create({ name: 'Chosen Password', phone, role: 'survey', password: 'Chosen-pass-9' });
    assert.equal(out.status, 201);
    const hash = storedHash(phone);
    assert.equal(await bcrypt.compare('Chosen-pass-9', hash), true);
    assert.equal(await bcrypt.compare('123456', hash), false);
  });
});

describe('create-user validation', () => {
  const run = async (body: Record<string, unknown>): Promise<string[]> => {
    const req: any = { body, query: {}, params: {}, headers: {} };
    for (const chain of createUserValidation) await chain.run(req);
    return validationResult(req).array().map((e: any) => `${e.path}: ${e.msg}`);
  };

  test('a body with no password is accepted', async () => {
    assert.deepEqual(await run({ name: 'New Staff', phone: '9111111116', role: 'survey' }), []);
  });

  test('a password that is sent must still be 6 to 128 characters', async () => {
    assert.equal((await run({ name: 'New Staff', phone: '9111111116', password: '123' })).length, 1);
    assert.deepEqual(await run({ name: 'New Staff', phone: '9111111116', password: 'abcdef' }), []);
  });
});

describe('the CMS no longer sends a password when it creates a user', () => {
  const CMS_SRC = path.resolve(__dirname, '../../../mahallu-cms/src');
  const present = fs.existsSync(path.join(CMS_SRC, 'features', 'users'));

  const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });

  const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  test('no user form or service sets a `password` key or mentions a default password', { skip: !present }, () => {
    const files = [
      ...sourceFiles(path.join(CMS_SRC, 'features', 'users')),
      path.join(CMS_SRC, 'services', 'userService.ts'),
    ];
    assert.ok(files.length >= 12, 'the user screens were found');
    const offenders: string[] = [];
    for (const file of files) {
      const raw = fs.readFileSync(file, 'utf8');
      const code = stripComments(raw);
      if (/\bpassword\b\s*[:=]/i.test(code.replace(/password\?\s*:\s*string/g, ''))) offenders.push(`${path.basename(file)}: password key`);
      if (/default password/i.test(raw)) offenders.push(`${path.basename(file)}: "default password"`);
      if (raw.includes('123456')) offenders.push(`${path.basename(file)}: 123456`);
    }
    assert.deepEqual(offenders, []);
  });

  test('no CMS source anywhere sends a literal password string', { skip: !present }, () => {
    const offenders = sourceFiles(CMS_SRC)
      .filter((file) => /\bpassword\s*:\s*['"`]/.test(stripComments(fs.readFileSync(file, 'utf8'))))
      .map((file) => path.relative(CMS_SRC, file));
    assert.deepEqual(offenders, []);
  });
});
});
