import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';
import { createMemberValidation } from '../validations/memberValidation';

/** A new member must have a gender, so Male + Female add up to the total. */
describe('[isolated] memberGenderRequired', () => {
  const genderChains = () =>
    createMemberValidation.filter((c: any) =>
      (c.builder?.build?.().fields ?? []).includes('gender'),
    );

  const messages = async (body: Record<string, unknown>) => {
    const req: any = { body, query: {}, params: {}, headers: {} };
    // Only the required-check (first) chain: the category lookup after it needs a database.
    await genderChains()[0].run(req);
    return validationResult(req).array().map((e: any) => e.msg as string);
  };

  test('a new member without a gender is refused', async () => {
    assert.ok((await messages({ name: 'A B' })).includes('Please choose the gender.'));
    assert.ok((await messages({ name: 'A B', gender: '   ' })).includes('Please choose the gender.'));
  });

  test('a new member with a gender passes the required check', async () => {
    assert.ok(!(await messages({ name: 'A B', gender: 'male' })).includes('Please choose the gender.'));
  });
});
