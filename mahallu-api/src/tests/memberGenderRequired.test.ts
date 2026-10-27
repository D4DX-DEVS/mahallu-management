import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';
import Member from '../models/Member';
import Family from '../models/Family';
import { bulkImportMembers } from '../controllers/memberController';
import { createMemberValidation } from '../validations/memberValidation';
import { createFamilyMemberValidation } from '../validations/memberUserValidation';
import { call, installFake, oid } from './support/fakeMongo';

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

  describe('bulk import', () => {
    const TENANT = oid();
    const FAMILY = oid();

    const importRows = async (rows: Array<Record<string, unknown>>) => {
      const families = installFake(Family, [{ _id: FAMILY, tenantId: TENANT, mahallId: 'FID7', houseName: 'House', status: 'approved' }]);
      const members = installFake(Member, []);
      try {
        const reply = await call(bulkImportMembers, {
          user: { _id: oid(), role: 'mahall', tenantId: TENANT },
          tenantId: String(TENANT),
          isSuperAdmin: false,
          body: { familyId: String(FAMILY), members: rows },
        });
        return { reply, saved: members.store.docs.length };
      } finally {
        families.restore();
        members.restore();
      }
    };

    test('a row without a gender is refused, naming the row, and nothing is saved', async () => {
      const { reply, saved } = await importRows([{ name: 'No Gender' }]);
      assert.equal(reply.status, 400);
      assert.deepEqual(reply.body.errors, [{ row: 1, message: 'Please choose the gender (male or female).' }]);
      assert.equal(saved, 0);
    });

    test('one bad row stops the whole import: valid rows around it are not saved either', async () => {
      const { reply, saved } = await importRows([
        { name: 'Ok One', gender: 'male' },
        { name: 'Blank', gender: '' },
        { name: 'Ok Two', gender: 'female' },
      ]);
      assert.equal(reply.status, 400);
      assert.deepEqual(reply.body.errors.map((e: { row: number }) => e.row), [2]);
      assert.equal(saved, 0);
    });

    test('a gender that is not exactly male or female is refused (the API does not guess)', async () => {
      for (const gender of ['Male', 'M', 'other', ' male']) {
        const { reply, saved } = await importRows([{ name: 'Odd', gender }]);
        assert.equal(reply.status, 400, `"${gender}"`);
        assert.equal(saved, 0, `"${gender}"`);
      }
    });
  });
});
