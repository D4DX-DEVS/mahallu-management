import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';
import { amountField, intField, MAX_AMOUNT } from '../validations/common';
import { parseMoney, parseAmountInRange, round2 } from '../utils/money';
import {
  createSalaryPaymentValidation,
  updateSalaryPaymentValidation,
} from '../validations/salaryValidation';
import {
  createInstituteAccountValidation,
  updateInstituteAccountValidation,
  createWalletValidation,
  createLedgerItemValidation,
  updateLedgerItemValidation,
} from '../validations/masterAccountValidation';
import { createEmployeeValidation, updateEmployeeValidation } from '../validations/employeeValidation';
import {
  createPettyCashValidation,
  updatePettyCashValidation,
  recordExpenseValidation,
} from '../validations/pettyCashValidation';
import { createAssetValidation, updateAssetValidation, createMaintenanceValidation } from '../validations/assetValidation';

/**
 * Money validation. The old helpers used `optional({ values: 'falsy' })`, so on an update a numeric 0 counted
 * as "not sent" and `min: 1` never ran; none had an upper bound and any number of decimals passed.
 * These run the real express-validator chains against request-shaped objects.
 */

const OID = '507f1f77bcf86cd799439011';

const run = async (chains: any[], body: Record<string, unknown>, params: Record<string, string> = {}) => {
  const req: any = { body, params, query: {}, headers: {} };
  for (const chain of chains) await chain.run(req);
  return { req, errors: validationResult(req).array() as any[] };
};

const errorsFor = (errors: any[], path: string) => errors.filter((e) => e.path === path).map((e) => e.msg as string);

/** [label, value] pairs that must never be accepted as money. */
const NEVER_MONEY: Array<[string, unknown]> = [
  ['negative', -1],
  ['negative decimal', -0.01],
  ['three decimals', 0.001],
  ['10.999', 10.999],
  ['above the maximum', MAX_AMOUNT + 0.01],
  ['1e300', 1e300],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['-Infinity', -Infinity],
  ['a word', 'abc'],
  ['exponent string', '1e3'],
  ['hex string', '0x10'],
  ['signed string', '+5'],
  ['comma', '1,000'],
  ['string 10.999', '10.999'],
  ['boolean', true],
  ['array', [5]],
  ['object', { amount: 5 }],
];

const FINE_MONEY: Array<[string, unknown, number]> = [
  ['0.01', 0.01, 0.01],
  ['10', 10, 10],
  ['10.5', 10.5, 10.5],
  ['10.55', 10.55, 10.55],
  ['the maximum', MAX_AMOUNT, MAX_AMOUNT],
  ["'10.50'", '10.50', 10.5],
  ["' 7 '", ' 7 ', 7],
];

describe('parseMoney / round2', () => {
  test('accepts plain decimals with at most two places', () => {
    for (const [label, value, expected] of FINE_MONEY) assert.equal(parseMoney(value), expected, label);
    assert.equal(parseMoney(0), 0);
    assert.equal(parseMoney('0'), 0);
    assert.equal(parseMoney('0.0'), 0);
  });

  test('refuses everything that is not money', () => {
    for (const [label, value] of NEVER_MONEY.filter(([l]) => l !== 'above the maximum')) {
      assert.equal(parseMoney(value), null, label);
    }
    assert.equal(parseMoney(null), null);
    assert.equal(parseMoney(undefined), null);
    assert.equal(parseMoney(''), null);
  });

  test('parseAmountInRange applies the minimum and the maximum', () => {
    assert.equal(parseAmountInRange(0, 0.01), null);
    assert.equal(parseAmountInRange(0, 0), 0);
    assert.equal(parseAmountInRange(MAX_AMOUNT + 0.01), null);
    assert.equal(parseAmountInRange(MAX_AMOUNT), MAX_AMOUNT);
  });

  test('round2 removes binary noise', () => {
    assert.equal(round2(0.1 + 0.2), 0.3);
    assert.equal(round2(1.005), 1.01);
    assert.equal(round2(100), 100);
  });
});

describe('amountField', () => {
  const positive = (required: boolean) => [amountField('amount', 'amount', { required, min: 0.01 })];
  const zeroOk = (required: boolean) => [amountField('amount', 'amount', { required, min: 0 })];

  for (const required of [true, false]) {
    const mode = required ? 'required' : 'optional';

    test(`${mode}, must be greater than zero: rejects zero in every spelling`, async () => {
      for (const value of [0, 0.0, '0', '0.0', '0.00', -0]) {
        const { errors } = await run(positive(required), { amount: value });
        assert.equal(errorsFor(errors, 'amount').length, 1, `${JSON.stringify(value)} must be rejected`);
        assert.match(errorsFor(errors, 'amount')[0], /greater than zero/);
      }
    });

    test(`${mode}: rejects everything that is not money`, async () => {
      for (const [label, value] of NEVER_MONEY) {
        const { errors } = await run(positive(required), { amount: value });
        assert.equal(errorsFor(errors, 'amount').length, 1, `${label} must be rejected`);
      }
    });

    test(`${mode}: accepts 0.01, 10, 10.5, 10.55, the maximum and numeric strings, as numbers`, async () => {
      for (const [label, value, expected] of FINE_MONEY) {
        const { req, errors } = await run(positive(required), { amount: value });
        assert.deepEqual(errorsFor(errors, 'amount'), [], label);
        assert.equal(req.body.amount, expected, `${label} reaches the handler as a number`);
        assert.equal(typeof req.body.amount, 'number');
      }
    });

    test(`${mode}, zero allowed: accepts 0 but still enforces the maximum and two decimals`, async () => {
      for (const value of [0, '0', 0.0, '0.00']) {
        const { req, errors } = await run(zeroOk(required), { amount: value });
        assert.deepEqual(errorsFor(errors, 'amount'), [], JSON.stringify(value));
        assert.equal(req.body.amount, 0);
      }
      for (const value of [-1, 0.005, 10.999, MAX_AMOUNT + 1, 1e300, 'abc']) {
        const { errors } = await run(zeroOk(required), { amount: value });
        assert.equal(errorsFor(errors, 'amount').length, 1, JSON.stringify(value));
      }
    });
  }

  test('create vs update: a provided 0 is validated on an optional field (it used to count as "not sent")', async () => {
    const update = [amountField('amount', 'amount', { min: 1 })];
    const { errors } = await run(update, { amount: 0 });
    assert.equal(errorsFor(errors, 'amount').length, 1);
    assert.match(errorsFor(errors, 'amount')[0], /at least 1/);
    assert.equal(errorsFor((await run(update, { amount: 0.5 })).errors, 'amount').length, 1);
    assert.deepEqual(errorsFor((await run(update, { amount: 1 })).errors, 'amount'), []);
  });

  test('optional: absent, null and empty are "not sent" and are cleared to undefined; required: they are an error', async () => {
    for (const value of [undefined, null, '', '   ']) {
      const optional = await run(positive(false), { amount: value });
      assert.deepEqual(errorsFor(optional.errors, 'amount'), [], `optional ${JSON.stringify(value)}`);
      assert.equal(optional.req.body.amount, undefined, 'a blank never reaches the database as ""');

      const required = await run(positive(true), { amount: value });
      assert.deepEqual(errorsFor(required.errors, 'amount'), ['Please enter the amount.'], `required ${JSON.stringify(value)}`);
    }
    assert.equal(errorsFor((await run(positive(true), {})).errors, 'amount').length, 1);
    assert.deepEqual(errorsFor((await run(positive(false), {})).errors, 'amount'), []);
  });

  test('a custom maximum is honoured, and the messages say what is wrong', async () => {
    const capped = [amountField('amount', 'fee', { max: 500 })];
    assert.deepEqual(errorsFor((await run(capped, { amount: 500 })).errors, 'amount'), []);
    const over = errorsFor((await run(capped, { amount: 500.5 })).errors, 'amount');
    assert.match(over[0], /cannot be more than 500/);
    const places = errorsFor((await run(capped, { amount: 1.234 })).errors, 'amount');
    assert.match(places[0], /2 decimal places/);
  });
});

describe('intField', () => {
  test('a provided 0 is validated against the minimum (it used to count as "not sent")', async () => {
    const chain = [intField('months', 'months', { min: 1, max: 600 })];
    assert.equal(errorsFor((await run(chain, { months: 0 })).errors, 'months').length, 1);
    assert.equal(errorsFor((await run(chain, { months: '0' })).errors, 'months').length, 1);
    assert.equal(errorsFor((await run(chain, { months: 601 })).errors, 'months').length, 1);
    assert.equal(errorsFor((await run(chain, { months: 1.5 })).errors, 'months').length, 1);
    assert.equal(errorsFor((await run(chain, { months: '1e2' })).errors, 'months').length, 1);
    assert.equal(errorsFor((await run(chain, { months: true })).errors, 'months').length, 1);
    assert.deepEqual(errorsFor((await run(chain, { months: 12 })).errors, 'months'), []);
    assert.deepEqual(errorsFor((await run(chain, { months: '12' })).errors, 'months'), []);
    assert.deepEqual(errorsFor((await run(chain, {})).errors, 'months'), []);
    assert.deepEqual(errorsFor((await run(chain, { months: '' })).errors, 'months'), []);
  });

  test('required: absent is an error, and 0 is accepted when the minimum is 0', async () => {
    const chain = [intField('count', 'count', { required: true, min: 0, max: 10 })];
    assert.equal(errorsFor((await run(chain, {})).errors, 'count').length, 1);
    assert.deepEqual(errorsFor((await run(chain, { count: 0 })).errors, 'count'), []);
  });
});

describe('salary payment', () => {
  const base = {
    instituteId: OID,
    employeeId: OID,
    month: 3,
    year: 2025,
    baseSalary: 5000,
    paymentDate: '2025-03-31',
    paymentMethod: 'cash',
  };

  test('a valid payment passes; allowances and deductions may be 0; amounts arrive as numbers', async () => {
    const { req, errors } = await run(createSalaryPaymentValidation, { ...base, allowances: 0, deductions: '0', status: 'paid' });
    assert.deepEqual(errors, []);
    assert.equal(req.body.allowances, 0);
    assert.equal(req.body.deductions, 0);
    assert.equal(req.body.baseSalary, 5000);
  });

  test('the base salary must be greater than zero, on create and on update', async () => {
    for (const baseSalary of [0, '0', -5, 0.001, 10.999, MAX_AMOUNT + 1, 1e300, NaN, 'abc', null]) {
      const created = await run(createSalaryPaymentValidation, { ...base, baseSalary });
      assert.equal(errorsFor(created.errors, 'baseSalary').length, 1, `create ${JSON.stringify(baseSalary)}`);
    }
    for (const baseSalary of [0, '0', -5, 0.001, 10.999, MAX_AMOUNT + 1, 1e300, NaN, 'abc']) {
      const updated = await run(updateSalaryPaymentValidation, { baseSalary }, { id: OID });
      assert.equal(errorsFor(updated.errors, 'baseSalary').length, 1, `update ${JSON.stringify(baseSalary)}`);
    }
    assert.deepEqual((await run(updateSalaryPaymentValidation, {}, { id: OID })).errors, []);
  });

  test('allowances and deductions: negative, three decimals and too large are refused', async () => {
    for (const field of ['allowances', 'deductions']) {
      for (const value of [-1, 0.001, 10.999, MAX_AMOUNT + 1, 1e300, 'abc']) {
        const { errors } = await run(createSalaryPaymentValidation, { ...base, [field]: value });
        assert.ok(errorsFor(errors, field).length >= 1, `${field} ${JSON.stringify(value)}`);
      }
    }
  });

  test('deductions larger than base + allowances (negative net) are refused', async () => {
    const { errors } = await run(createSalaryPaymentValidation, { ...base, allowances: 500, deductions: 5501 });
    assert.match(errorsFor(errors, 'deductions').join(' '), /cannot be more than/);
    assert.deepEqual((await run(createSalaryPaymentValidation, { ...base, allowances: 500, deductions: 5500 })).errors, []);
  });

  test('netAmount is not a field: whatever a client sends raises no error here (the controller ignores it)', async () => {
    for (const netAmount of [1, -1, 'abc', 1e300]) {
      const { errors } = await run(createSalaryPaymentValidation, { ...base, netAmount });
      assert.deepEqual(errorsFor(errors, 'netAmount'), []);
    }
  });

  test('a new payment is pending or paid; an update may name any of the three (the controller decides the move)', async () => {
    assert.equal(errorsFor((await run(createSalaryPaymentValidation, { ...base, status: 'cancelled' })).errors, 'status').length, 1);
    assert.deepEqual(errorsFor((await run(createSalaryPaymentValidation, { ...base, status: 'pending' })).errors, 'status'), []);
    assert.deepEqual(errorsFor((await run(updateSalaryPaymentValidation, { status: 'cancelled' }, { id: OID })).errors, 'status'), []);
    assert.equal(errorsFor((await run(updateSalaryPaymentValidation, { status: 'refunded' }, { id: OID })).errors, 'status').length, 1);
  });
});

describe('master accounts', () => {
  test('opening balance: 0 is fine; negative, 3 decimals, too large and strings with exponents are refused', async () => {
    for (const chains of [createInstituteAccountValidation, createWalletValidation]) {
      const body = { instituteId: OID, accountName: 'Main', name: 'Main', type: 'main' };
      assert.deepEqual(errorsFor((await run(chains, { ...body, balance: 0 })).errors, 'balance'), []);
      assert.deepEqual(errorsFor((await run(chains, { ...body, balance: '250.50' })).errors, 'balance'), []);
      assert.deepEqual(errorsFor((await run(chains, body)).errors, 'balance'), []);
      for (const balance of [-1, 0.001, 10.999, MAX_AMOUNT + 1, 1e300, '1e3', NaN, 'abc']) {
        assert.equal(errorsFor((await run(chains, { ...body, balance })).errors, 'balance').length, 1, JSON.stringify(balance));
      }
    }
  });

  test('a ledger item amount must be greater than zero, on create and on update', async () => {
    const item = { ledgerId: OID, date: '2025-01-01', type: 'income', description: 'Fees' };
    for (const amount of [0, '0', -1, 0.001, MAX_AMOUNT + 1, 1e300, NaN, 'abc']) {
      assert.equal(errorsFor((await run(createLedgerItemValidation, { ...item, amount })).errors, 'amount').length, 1, `create ${JSON.stringify(amount)}`);
      assert.equal(errorsFor((await run(updateLedgerItemValidation, { amount }, { id: OID })).errors, 'amount').length, 1, `update ${JSON.stringify(amount)}`);
    }
    assert.deepEqual(errorsFor((await run(createLedgerItemValidation, { ...item, amount: 0.01 })).errors, 'amount'), []);
    assert.deepEqual(errorsFor((await run(updateLedgerItemValidation, { amount: 250.75 }, { id: OID })).errors, 'amount'), []);
    assert.equal(errorsFor((await run(createLedgerItemValidation, item)).errors, 'amount').length, 1, 'required on create');
  });

  test('balance is not an update rule (the controller drops it): a bad one raises nothing here', async () => {
    const { errors } = await run(updateInstituteAccountValidation, { balance: 'abc' }, { id: OID });
    assert.deepEqual(errorsFor(errors, 'balance'), []);
  });
});

describe('employee salary', () => {
  const base = { name: 'Ali', instituteId: OID, designation: 'Imam' };

  test('0 is allowed (it is a rate); negative, 3 decimals, too large and exponent forms are refused', async () => {
    assert.deepEqual(errorsFor((await run(createEmployeeValidation, { ...base, salary: 0 })).errors, 'salary'), []);
    assert.deepEqual(errorsFor((await run(createEmployeeValidation, { ...base, salary: '12000.50' })).errors, 'salary'), []);
    for (const salary of [-1, 0.001, 10.999, MAX_AMOUNT + 1, 1e300, '1e3', NaN, 'abc', null]) {
      assert.equal(errorsFor((await run(createEmployeeValidation, { ...base, salary })).errors, 'salary').length, 1, `create ${JSON.stringify(salary)}`);
    }
    for (const salary of [-1, 0.001, 10.999, MAX_AMOUNT + 1, 1e300, '1e3', NaN, 'abc']) {
      assert.equal(errorsFor((await run(updateEmployeeValidation, { salary }, { id: OID })).errors, 'salary').length, 1, `update ${JSON.stringify(salary)}`);
    }
    assert.deepEqual(errorsFor((await run(updateEmployeeValidation, { salary: 0 }, { id: OID })).errors, 'salary'), []);
    assert.equal(errorsFor((await run(createEmployeeValidation, base)).errors, 'salary').length, 1, 'required on create');
  });
});

describe('petty cash', () => {
  test('the float must be greater than zero; update takes no float at all', async () => {
    const base = { custodianName: 'Custodian' };
    for (const floatAmount of [0, '0', -1, 0.001, 10.999, MAX_AMOUNT + 1, 1e300, NaN, 'abc', null]) {
      assert.equal(errorsFor((await run(createPettyCashValidation, { ...base, floatAmount })).errors, 'floatAmount').length, 1, JSON.stringify(floatAmount));
    }
    assert.deepEqual((await run(createPettyCashValidation, { ...base, floatAmount: 5000 })).errors, []);
    assert.deepEqual((await run(createPettyCashValidation, { ...base, floatAmount: '2500.25' })).errors, []);
    // update: only custodian and status
    assert.deepEqual(errorsFor((await run(updatePettyCashValidation, { floatAmount: 'abc', currentBalance: -1 }, { id: OID })).errors, 'floatAmount'), []);
    assert.equal(errorsFor((await run(updatePettyCashValidation, { status: 'deleted' }, { id: OID })).errors, 'status').length, 1);
  });

  test('an expense: amount greater than zero, description required', async () => {
    const base = { description: 'Stationery' };
    for (const amount of [0, '0', -1, 0.001, 10.999, MAX_AMOUNT + 1, 1e300, NaN, 'abc', null, undefined]) {
      assert.equal(errorsFor((await run(recordExpenseValidation, { ...base, amount }, { id: OID })).errors, 'amount').length, 1, JSON.stringify(amount));
    }
    assert.deepEqual((await run(recordExpenseValidation, { ...base, amount: 12.5 }, { id: OID })).errors, []);
    assert.equal(errorsFor((await run(recordExpenseValidation, { amount: 5 }, { id: OID })).errors, 'description').length, 1);
  });
});

describe('assets', () => {
  const asset = { name: 'Fan', purchaseDate: '2024-01-01', category: 'electronics' };

  test('estimated value and maintenance cost: 0 is allowed; negative, 3 decimals, too large, NaN are refused', async () => {
    assert.deepEqual(errorsFor((await run(createAssetValidation, { ...asset, estimatedValue: 0 })).errors, 'estimatedValue'), []);
    for (const value of [-1, 0.001, MAX_AMOUNT + 1, 1e300, NaN, 'abc', '1e3']) {
      assert.equal(errorsFor((await run(createAssetValidation, { ...asset, estimatedValue: value })).errors, 'estimatedValue').length, 1, JSON.stringify(value));
      assert.equal(errorsFor((await run(updateAssetValidation, { estimatedValue: value }, { id: OID })).errors, 'estimatedValue').length, 1);
      assert.equal(
        errorsFor((await run(createMaintenanceValidation, { maintenanceDate: '2025-01-01', description: 'Service', cost: value }, { id: OID })).errors, 'cost').length,
        1
      );
    }
    assert.equal(errorsFor((await run(createAssetValidation, asset)).errors, 'estimatedValue').length, 1, 'required on create');
  });
});
