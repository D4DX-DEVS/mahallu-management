import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';
import { updateTenantValidation } from '../validations/tenantValidation';
import Tenant from '../models/Tenant';

/** A Mahallu publishes a phone and/or email for its members; either can be blank. */
async function run(body: Record<string, unknown>) {
  const req: any = { body, params: { id: '507f1f77bcf86cd799439011' }, query: {}, headers: {} };
  for (const chain of updateTenantValidation) await (chain as any).run(req);
  return validationResult(req).array().map((e: any) => e.msg as string);
}

describe('tenant contact', () => {
  test('a phone and an email are accepted', async () => {
    assert.deepEqual(await run({ contact: { phone: '+91 98765 43210', email: 'office@example.com' } }), []);
  });

  test('either one alone, or blanks to clear them, are accepted', async () => {
    assert.deepEqual(await run({ contact: { phone: '9876543210' } }), []);
    assert.deepEqual(await run({ contact: { email: 'office@example.com' } }), []);
    assert.deepEqual(await run({ contact: { phone: '', email: '' } }), []);
  });

  test('a bad phone or email is refused', async () => {
    assert.ok((await run({ contact: { phone: 'call me' } })).some((m) => m.includes('phone')));
    assert.ok((await run({ contact: { email: 'not-an-email' } })).some((m) => m.includes('email')));
  });

  test('the schema stores the contact', () => {
    const doc = new Tenant({ contact: { phone: '9876543210', email: 'Office@Example.com' } });
    assert.equal(doc.contact?.phone, '9876543210');
    assert.equal(doc.contact?.email, 'office@example.com');
  });
});
