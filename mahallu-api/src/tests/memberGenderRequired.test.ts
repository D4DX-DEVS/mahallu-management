import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';
import Member from '../models/Member';
import { createMemberValidation } from '../validations/memberValidation';
import { createFamilyMemberValidation } from '../validations/memberUserValidation';

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

  test('a family head adding a family member must give a gender too', async () => {
    const chain = createFamilyMemberValidation.find((c: any) =>
      (c.builder?.build?.().fields ?? []).includes('gender'),
    ) as any;
    const req: any = { body: { name: 'A B' }, query: {}, params: {}, headers: {} };
    await chain.run(req);
    assert.ok(validationResult(req).array().some((e: any) => e.msg === 'Please choose the gender.'));
  });

  test('the model refuses a new member with no gender, and keeps old ones saveable', async () => {
    const fresh = new Member({ name: 'No Gender', familyName: 'X' } as any);
    const err: any = fresh.validateSync();
    assert.ok(err?.errors?.gender, 'a new member needs a gender');

    const withGender = new Member({ name: 'Has Gender', familyName: 'X', gender: 'male' } as any);
    assert.equal(withGender.validateSync()?.errors?.gender, undefined);

    // A member that already exists (not new) without a gender can still be saved.
    const legacy = new Member({ name: 'Old One', familyName: 'X' } as any);
    legacy.isNew = false;
    assert.equal(legacy.validateSync()?.errors?.gender, undefined);
  });
});
