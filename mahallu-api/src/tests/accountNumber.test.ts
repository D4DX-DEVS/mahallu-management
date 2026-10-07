import { test } from 'node:test';
import assert from 'assert/strict';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import {
  createInstituteAccountValidation,
  updateInstituteAccountValidation,
} from '../validations/masterAccountValidation';
import {
  createMahalluAccountValidation,
  updateMahalluAccountValidation,
} from '../validations/moduleValidation';
import { InstituteAccount, MahalluAccount } from '../models/MasterAccount';

/**
 * A bank account number is an identifier: digits only, kept as text so that a
 * leading zero survives. These cover the create and update rules for both kinds
 * of account, and the schema behind them.
 */

const OID = '507f1f77bcf86cd799439011';

const run = async (chains: any[], body: Record<string, unknown>, params: Record<string, string> = {}) => {
  const req: any = { body, params, query: {}, headers: {} };
  for (const chain of chains) await chain.run(req);
  return { req, errors: validationResult(req).array() as any[] };
};

const accountNumberErrors = (errors: any[]) =>
  errors.filter((e) => e.path === 'accountNumber').map((e) => e.msg as string);

const INVALID = ['dsssss', '123ABC', '123-456', '123 456', '@123', '12.34', '１２３', '12\n34'];
const VALID = ['123456789', '65443456787', '0012345678'];

const suites: Array<[string, any[], Record<string, unknown>, Record<string, string>]> = [
  ['institute create', createInstituteAccountValidation, { instituteId: OID, accountName: 'Main Account' }, {}],
  ['institute update', updateInstituteAccountValidation, {}, { id: OID }],
  ['mahallu create', createMahalluAccountValidation, { accountName: 'Main Account' }, {}],
  ['mahallu update', updateMahalluAccountValidation, {}, { id: OID }],
];

for (const [name, chains, base, params] of suites) {
  test(`${name}: rejects an account number that is not all digits`, async () => {
    for (const accountNumber of INVALID) {
      const { errors } = await run(chains, { ...base, accountNumber }, params);
      assert.deepEqual(
        accountNumberErrors(errors),
        ['Please enter the account number using digits only.'],
        `"${accountNumber}" should be rejected`
      );
    }
  });

  test(`${name}: accepts digits and keeps leading zeros`, async () => {
    for (const accountNumber of VALID) {
      const { req, errors } = await run(chains, { ...base, accountNumber }, params);
      assert.deepEqual(accountNumberErrors(errors), [], `"${accountNumber}" should pass`);
      assert.equal(req.body.accountNumber, accountNumber);
      assert.equal(typeof req.body.accountNumber, 'string');
    }
  });

  test(`${name}: an empty or absent account number is still optional`, async () => {
    for (const body of [{ ...base }, { ...base, accountNumber: '' }]) {
      const { errors } = await run(chains, body, params);
      assert.deepEqual(accountNumberErrors(errors), []);
    }
  });

  test(`${name}: refuses a JSON number, whose leading zeros are already gone`, async () => {
    const { errors } = await run(chains, { ...base, accountNumber: 12345678 }, params);
    assert.equal(accountNumberErrors(errors).length, 1);
  });

  test(`${name}: trims surrounding spaces rather than rejecting a pasted value`, async () => {
    const { req, errors } = await run(chains, { ...base, accountNumber: '  0012345678 ' }, params);
    assert.deepEqual(accountNumberErrors(errors), []);
    assert.equal(req.body.accountNumber, '0012345678');
  });
}

test('mahallu account keeps its existing 34 character ceiling', async () => {
  const { errors } = await run(createMahalluAccountValidation, { accountName: 'Main', accountNumber: '1'.repeat(35) });
  assert.deepEqual(accountNumberErrors(errors), ['Please keep the account number to 34 characters or less.']);
});

for (const [name, Model, extra] of [
  ['InstituteAccount', InstituteAccount, { instituteId: new mongoose.Types.ObjectId() }],
  ['MahalluAccount', MahalluAccount, {}],
] as const) {
  test(`${name} schema refuses a non-digit account number and stores digits as text`, () => {
    const base = { tenantId: new mongoose.Types.ObjectId(), accountName: 'Main', ...extra };
    const bad = new (Model as any)({ ...base, accountNumber: 'dsssss' });
    assert.ok(bad.validateSync()?.errors.accountNumber);

    const good = new (Model as any)({ ...base, accountNumber: '0012345678' });
    assert.equal(good.validateSync()?.errors.accountNumber, undefined);
    assert.equal(good.accountNumber, '0012345678');

    const blank = new (Model as any)({ ...base, accountNumber: '' });
    assert.equal(blank.validateSync()?.errors.accountNumber, undefined);
  });
}
