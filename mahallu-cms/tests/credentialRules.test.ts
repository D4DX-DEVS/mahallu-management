import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canManageCredentials, isStrongPassword } from '../src/features/users/credentialRules.ts';

// Only id and role are read, so a partial account is enough.
const account = (id: string, role: string) => ({ id, role }) as never;

describe('canManageCredentials (button visibility; the API still decides)', () => {
  test('a Super Admin is offered Reset password for Mahallu admin, survey and institute accounts', () => {
    const root = account('root', 'super_admin');
    for (const role of ['mahall', 'survey', 'institute']) {
      assert.equal(canManageCredentials(root, true, false, account('t', role)), true, role);
    }
  });

  test('a Mahallu admin is offered it for survey and institute accounts only', () => {
    const admin = account('a', 'mahall');
    assert.equal(canManageCredentials(admin, false, false, account('t', 'survey')), true);
    assert.equal(canManageCredentials(admin, false, false, account('t', 'institute')), true);
    assert.equal(canManageCredentials(admin, false, false, account('t', 'mahall')), false, 'another admin');
    assert.equal(canManageCredentials(admin, false, false, account('t', 'super_admin')), false);
  });

  test('nobody is offered it for a member, a platform admin, themselves, or while viewing as another account', () => {
    const root = account('root', 'super_admin');
    assert.equal(canManageCredentials(root, true, false, account('t', 'member')), false);
    assert.equal(canManageCredentials(root, true, false, account('other-root', 'super_admin')), false);
    assert.equal(canManageCredentials(root, true, false, account('root', 'super_admin')), false, 'self');
    assert.equal(canManageCredentials(root, true, true, account('t', 'survey')), false, 'View As');
    assert.equal(canManageCredentials(null, false, false, account('t', 'survey')), false, 'signed out');
  });

  test('survey and institute accounts are never offered it', () => {
    for (const role of ['survey', 'institute', 'member']) {
      assert.equal(canManageCredentials(account('a', role), false, false, account('t', 'survey')), false, role);
    }
  });
});

describe('isStrongPassword mirrors the API rule', () => {
  test('8-128 characters with a letter and a number', () => {
    assert.equal(isStrongPassword('Correct1horse'), true);
    assert.equal(isStrongPassword('short1'), false);
    assert.equal(isStrongPassword('onlyletters'), false);
    assert.equal(isStrongPassword('12345678'), false);
    assert.equal(isStrongPassword('a1'.repeat(65)), false, 'over 128');
  });
});
