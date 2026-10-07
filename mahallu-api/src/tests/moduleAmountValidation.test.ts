import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult, ValidationChain } from 'express-validator';
import mongoose from 'mongoose';
import {
  createQardLoanValidation,
  updateQardLoanValidation,
  updateQardLoanStatusValidation,
  createQardRepaymentValidation,
  createWelfareApplicationValidation,
  updateWelfareApplicationValidation,
  updateWelfareApplicationStatusValidation,
  createReliefCaseValidation,
  updateReliefCaseValidation,
  updateReliefStatusValidation,
  createScholarshipValidation,
  updateScholarshipValidation,
  createAwardValidation,
  updateAwardValidation,
  updateAwardStatusValidation,
  createMarriageAssistanceValidation,
  updateMarriageAssistanceValidation,
  updateMarriageAssistanceStatusValidation,
  createZakatDistributionValidation,
  updateZakatDistributionValidation,
  createProjectValidation,
  updateProjectValidation,
  createPettyCashValidation,
  updatePettyCashValidation,
  createMahalluAccountValidation,
  updateMahalluAccountValidation,
} from '../validations/moduleValidation';

/**
 * Every money field in the module validators: zero / negative / huge / 3 decimals, on create AND on
 * update. The update case is the one that used to slip through: `optional({ values: 'falsy' })`
 * treats a provided 0 as "not sent", so a `min: 1` rule never ran when the PUT said `amount: 0`.
 */

const id = () => String(new mongoose.Types.ObjectId());

/** Paths with an error after running the chains against `body`. */
const errorPaths = async (chains: ValidationChain[], body: Record<string, any>): Promise<string[]> => {
  const req: any = { body: { ...body }, params: { id: id() }, query: {}, headers: {} };
  for (const chain of chains) await chain.run(req);
  return validationResult(req)
    .array()
    .map((e: any) => e.path);
};

interface MoneyField {
  name: string;
  field: string;
  /** Chains that apply on create / update (a status or repayment endpoint has just one). */
  chains: Array<{ mode: string; chains: ValidationChain[] }>;
  /** true: the value must be > 0 (zero is refused). false: zero is a valid amount. */
  positive: boolean;
  /** The smallest accepted value, for the "below minimum" check. */
  min: number;
}

const FIELDS: MoneyField[] = [
  { name: 'qard loan amount', field: 'amount', positive: true, min: 1, chains: [{ mode: 'create', chains: createQardLoanValidation }, { mode: 'update', chains: updateQardLoanValidation }] },
  { name: 'qard repayment amount', field: 'amount', positive: true, min: 0.01, chains: [{ mode: 'create', chains: createQardRepaymentValidation }] },
  { name: 'qard approved amount', field: 'approvedAmount', positive: true, min: 0.01, chains: [{ mode: 'status', chains: updateQardLoanStatusValidation }] },
  { name: 'welfare requested amount', field: 'requestedAmount', positive: true, min: 1, chains: [{ mode: 'create', chains: createWelfareApplicationValidation }, { mode: 'update', chains: updateWelfareApplicationValidation }] },
  { name: 'welfare approved amount', field: 'approvedAmount', positive: true, min: 0.01, chains: [{ mode: 'status', chains: updateWelfareApplicationStatusValidation }] },
  { name: 'relief amount', field: 'amount', positive: true, min: 0.01, chains: [{ mode: 'create', chains: createReliefCaseValidation }, { mode: 'update', chains: updateReliefCaseValidation }, { mode: 'status', chains: updateReliefStatusValidation }] },
  { name: 'scholarship amount', field: 'amount', positive: true, min: 1, chains: [{ mode: 'create', chains: createScholarshipValidation }, { mode: 'update', chains: updateScholarshipValidation }] },
  { name: 'award amount', field: 'amount', positive: true, min: 1, chains: [{ mode: 'create', chains: createAwardValidation }, { mode: 'update', chains: updateAwardValidation }] },
  { name: 'marriage assistance amount', field: 'amount', positive: false, min: 0, chains: [{ mode: 'create', chains: createMarriageAssistanceValidation }, { mode: 'update', chains: updateMarriageAssistanceValidation }] },
  { name: 'zakat distribution amount', field: 'amount', positive: true, min: 1, chains: [{ mode: 'create', chains: createZakatDistributionValidation }, { mode: 'update', chains: updateZakatDistributionValidation }] },
  { name: 'project estimated cost', field: 'estimatedCost', positive: false, min: 0, chains: [{ mode: 'create', chains: createProjectValidation }, { mode: 'update', chains: updateProjectValidation }] },
  { name: 'petty cash float', field: 'floatAmount', positive: false, min: 0, chains: [{ mode: 'create', chains: createPettyCashValidation }, { mode: 'update', chains: updatePettyCashValidation }] },
  { name: 'mahallu account balance', field: 'balance', positive: false, min: 0, chains: [{ mode: 'create', chains: createMahalluAccountValidation }, { mode: 'update', chains: updateMahalluAccountValidation }] },
];

const MAX = 100_000_000;

for (const spec of FIELDS) {
  for (const { mode, chains } of spec.chains) {
    describe(`${spec.name} (${mode})`, () => {
      const bad = async (value: unknown) => (await errorPaths(chains, { [spec.field]: value })).includes(spec.field);

      test('negative amounts are refused', async () => {
        for (const value of [-1, -0.01, '-5', -1e9]) assert.equal(await bad(value), true, JSON.stringify(value));
      });

      test('a third decimal is refused', async () => {
        for (const value of [10.999, '10.999', 0.001, 1000.123, '5.005']) {
          assert.equal(await bad(value), true, JSON.stringify(value));
        }
      });

      test('values above the maximum are refused, the maximum itself is fine', async () => {
        for (const value of [MAX + 1, MAX + 0.01, 1e9, 1e21, '1e3', 'Infinity', Infinity, NaN]) {
          assert.equal(await bad(value), true, JSON.stringify(value));
        }
        assert.equal(await bad(MAX), false, 'the maximum is a valid amount');
      });

      test('non-numeric shapes are refused', async () => {
        for (const value of ['abc', '12abc', true, false, [], [5], {}, { $gt: 0 }]) {
          assert.equal(await bad(value), true, JSON.stringify(value));
        }
      });

      test(spec.positive ? 'zero is refused (numeric 0 and the string "0")' : 'zero is a valid amount', async () => {
        for (const zero of [0, '0', '0.00', 0.0]) {
          assert.equal(await bad(zero), spec.positive, `${JSON.stringify(zero)} must ${spec.positive ? '' : 'not '}be refused`);
        }
      });

      if (spec.min > 0) {
        test(`values below the minimum (${spec.min}) are refused`, async () => {
          const below = spec.min === 1 ? 0.5 : 0.001;
          assert.equal(await bad(below), true);
          if (spec.min === 1) assert.equal(await bad(0.99), true);
        });
      }

      test('normal amounts are accepted (numbers and numeric strings, 0-2 decimals)', async () => {
        const good = [spec.min || 1, 1, 10, 10.5, '10.55', '250', 1234567.89];
        for (const value of good) assert.equal(await bad(value), false, JSON.stringify(value));
      });

      if (mode !== 'create') {
        test('an empty value means "not sent" and is skipped', async () => {
          for (const value of ['', null, undefined]) assert.equal(await bad(value), false, String(value));
        });
      }
    });
  }
}

describe('required money fields on create', () => {
  const required: Array<[string, ValidationChain[], string]> = [
    ['qard loan amount', createQardLoanValidation, 'amount'],
    ['qard repayment amount', createQardRepaymentValidation, 'amount'],
    ['welfare requested amount', createWelfareApplicationValidation, 'requestedAmount'],
    ['scholarship amount', createScholarshipValidation, 'amount'],
    ['award amount', createAwardValidation, 'amount'],
    ['zakat distribution amount', createZakatDistributionValidation, 'amount'],
  ];
  for (const [name, chains, field] of required) {
    test(`${name} must be present`, async () => {
      for (const value of [undefined, null, '', '   ']) {
        const paths = await errorPaths(chains, value === undefined ? {} : { [field]: value });
        assert.ok(paths.includes(field), `${name} with ${JSON.stringify(value)}`);
      }
    });
  }
});

describe('the status endpoint validators', () => {
  const run = errorPaths;

  test('qard: allowOverApproval is a real boolean; status, dates and notes are checked', async () => {
    const chains = updateQardLoanStatusValidation;
    assert.deepEqual(await run(chains, { status: 'approved', allowOverApproval: true }), []);
    assert.deepEqual(await run(chains, { status: 'approved', allowOverApproval: false }), []);
    for (const bad of ['false', 'true', 'yes', 1, 0, '1', null, {}]) {
      assert.ok((await run(chains, { status: 'approved', allowOverApproval: bad })).includes('allowOverApproval'), JSON.stringify(bad));
    }
    assert.ok((await run(chains, { status: 'nope' })).includes('status'));
    assert.ok((await run(chains, {})).includes('status'), 'status is required');
    assert.ok((await run(chains, { status: 'disbursed', disbursedDate: 'yesterday' })).includes('disbursedDate'));
    assert.ok((await run(chains, { status: 'closed', notes: 'x'.repeat(2001) })).includes('notes'));
    assert.deepEqual(await run(chains, { status: 'disbursed', disbursedDate: '2026-01-15', notes: 'ok' }), []);
  });

  test('qard repayment: clientRequestId has a fixed shape', async () => {
    const chains = createQardRepaymentValidation;
    const base = { loanId: id(), amount: 100 };
    assert.deepEqual(await run(chains, { ...base, clientRequestId: 'req-0001-abcd' }), []);
    assert.deepEqual(await run(chains, base), []);
    for (const bad of ['short', 'has space in it', 'x'.repeat(101), 'bad/slash/id!', 123456789012]) {
      assert.ok((await run(chains, { ...base, clientRequestId: bad })).includes('clientRequestId'), JSON.stringify(bad));
    }
  });

  test('relief, award and marriage status bodies: enum required, text bounded', async () => {
    assert.ok((await run(updateReliefStatusValidation, { status: 'paid' })).includes('status'));
    assert.ok((await run(updateReliefStatusValidation, { status: 'assisted', notes: 'x'.repeat(2001) })).includes('notes'));
    assert.ok((await run(updateReliefStatusValidation, { status: 'assisted', assistanceGiven: 'x'.repeat(501) })).includes('assistanceGiven'));
    assert.deepEqual(await run(updateReliefStatusValidation, { status: 'assisted', assistanceGiven: 'food', amount: 100.5 }), []);

    assert.ok((await run(updateAwardStatusValidation, { status: 'completed' })).includes('status'));
    assert.ok((await run(updateAwardStatusValidation, { status: 'paid', remarks: 'x'.repeat(501) })).includes('remarks'));
    assert.deepEqual(await run(updateAwardStatusValidation, { status: 'paid' }), []);

    assert.ok((await run(updateMarriageAssistanceStatusValidation, { status: 'paid' })).includes('status'));
    assert.ok((await run(updateMarriageAssistanceStatusValidation, { status: 'approved', notes: 'x'.repeat(2001) })).includes('notes'));
    assert.deepEqual(await run(updateMarriageAssistanceStatusValidation, { status: 'completed', notes: 'done' }), []);
  });

  test('a status endpoint validator also checks the :id path', async () => {
    const req: any = { body: { status: 'approved' }, params: { id: 'not-an-id' }, query: {}, headers: {} };
    for (const chain of updateMarriageAssistanceStatusValidation) await chain.run(req);
    assert.ok(validationResult(req).array().some((e: any) => e.path === 'id'));
  });
});

describe('IFSC on the Mahallu account validator', () => {
  const create = createMahalluAccountValidation;
  test('a malformed IFSC is refused on create and update', async () => {
    for (const chains of [create, updateMahalluAccountValidation]) {
      for (const bad of ['BAD', 'SBIN1001234', 'SBIN000123', '1234ABCDEFG', 'SBIN0001234X', 12345678901]) {
        assert.ok((await errorPaths(chains, { ifscCode: bad })).includes('ifscCode'), JSON.stringify(bad));
      }
    }
  });

  test('a valid IFSC (any case, padded) is accepted and normalised; empty means none', async () => {
    for (const ok of ['SBIN0001234', 'sbin0001234', ' hdfc0ABC123 ', '', undefined]) {
      assert.ok(!(await errorPaths(create, { ifscCode: ok })).includes('ifscCode'), JSON.stringify(ok));
    }
    const req: any = { body: { ifscCode: ' sbin0001234 ' }, params: { id: id() }, query: {}, headers: {} };
    for (const chain of create) await chain.run(req);
    assert.equal(req.body.ifscCode, 'SBIN0001234');
  });
});
