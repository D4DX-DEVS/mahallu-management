import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';
import { updateNikahRegistrationValidation } from '../validations/registrationValidation';
import { createUserValidation } from '../validations/userValidation';

const run = async (chains: any[], body: any) => {
  const req: any = { body, params: {}, query: {} };
  for (const c of chains) await c.run(req);
  return { errors: validationResult(req).array().map((e: any) => e.msg), body: req.body };
};

test('the admin edit form can set a registration to "correction required"', async () => {
  // Every admin edit page offers this status and the member portal resubmit flow depends on it.
  const { errors } = await run(updateNikahRegistrationValidation, { status: 'correction_required' });
  assert.ok(!errors.some((m: string) => /valid status/i.test(m)), errors.join('|'));
});

test('an unknown registration status is still refused', async () => {
  const { errors } = await run(updateNikahRegistrationValidation, { status: 'banana' });
  assert.ok(errors.some((m: string) => /valid status/i.test(m)));
});

test('an email address is saved the way it was typed (no Gmail dot or +tag stripping)', async () => {
  const { body } = await run(createUserValidation, { name: 'Test', phone: '9876543210', email: 'First.Last+mahallu@gmail.com', role: 'mahall' });
  assert.equal(body.email, 'first.last+mahallu@gmail.com');
});
