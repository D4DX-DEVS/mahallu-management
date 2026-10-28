import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AMOUNT_INVALID_MESSAGE,
  AMOUNT_NEGATIVE_MESSAGE,
  AMOUNT_REQUIRED_MESSAGE,
  AMOUNT_TOO_LARGE_MESSAGE,
  AMOUNT_ZERO_MESSAGE,
  MARRIAGE_ASSISTANCE_TYPES,
  amountError,
  buildMarriageAssistancePayload,
  marriageAssistanceSchema,
  requiresAmount,
} from '../src/features/registrations/marriageAssistanceForm.ts';

const base = { personType: 'member' as const, memberId: 'm1', familyId: '', notes: '' };

/** Field -> message, as the form would show it. */
const check = (input: Record<string, unknown>) => {
  const result = marriageAssistanceSchema.safeParse({ ...base, ...input });
  if (result.success) return { ok: true as const, data: result.data, errors: {} as Record<string, string> };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  return { ok: false as const, errors };
};

describe('which types need an amount', () => {
  test('only Financial Assistance', () => {
    assert.deepEqual(
      MARRIAGE_ASSISTANCE_TYPES.map((t) => [t, requiresAmount(t)]),
      [
        ['proposal_support', false],
        ['financial_assistance', true],
        ['premarital_counselling', false],
      ]
    );
  });
});

describe('Financial Assistance', () => {
  const type = 'financial_assistance';

  test('a missing or blank amount is refused with a message on the amount field', () => {
    for (const amount of [undefined, '', '   ']) {
      const r = check({ type, amount });
      assert.equal(r.ok, false, JSON.stringify(amount));
      assert.equal(r.errors.amount, AMOUNT_REQUIRED_MESSAGE);
    }
  });

  test('invalid amounts are refused, each with its own message', () => {
    assert.equal(check({ type, amount: 'abc' }).errors.amount, AMOUNT_INVALID_MESSAGE);
    assert.equal(check({ type, amount: '12abc' }).errors.amount, AMOUNT_INVALID_MESSAGE);
    assert.equal(check({ type, amount: '1e3' }).errors.amount, AMOUNT_INVALID_MESSAGE);
    assert.equal(check({ type, amount: '10.999' }).errors.amount, AMOUNT_INVALID_MESSAGE);
    assert.equal(check({ type, amount: '1,000' }).errors.amount, AMOUNT_INVALID_MESSAGE);
    assert.equal(check({ type, amount: '-5' }).errors.amount, AMOUNT_NEGATIVE_MESSAGE);
    for (const zero of ['0', '0.0', '0.00', '000']) assert.equal(check({ type, amount: zero }).errors.amount, AMOUNT_ZERO_MESSAGE, zero);
    assert.equal(check({ type, amount: '100000001' }).errors.amount, AMOUNT_TOO_LARGE_MESSAGE);
  });

  test('valid amounts pass (above 0 up to the maximum, up to 2 decimals) and are sent as a number under `amount`', () => {
    for (const [typed, expected] of [['25000', 25000], ['250.5', 250.5], ['1234.56', 1234.56], [' 99 ', 99], ['0.01', 0.01], ['100000000', 100_000_000]] as const) {
      const r = check({ type, amount: typed });
      assert.equal(r.ok, true, typed);
      if (r.ok) assert.deepEqual(buildMarriageAssistancePayload(r.data), { type, memberId: 'm1', familyId: undefined, notes: '', amount: expected });
    }
  });

  test('the error is on the amount field only, next to any other field error', () => {
    const r = check({ type, amount: '', memberId: '' });
    assert.deepEqual(Object.keys(r.errors).sort(), ['amount', 'memberId']);
  });
});

describe('Proposal Support and Premarital Counselling', () => {
  for (const type of ['proposal_support', 'premarital_counselling'] as const) {
    test(`${type}: can be submitted without an amount, and the request has no amount property at all`, () => {
      for (const amount of [undefined, '']) {
        const r = check({ type, amount });
        assert.equal(r.ok, true, JSON.stringify(amount));
        if (r.ok) {
          const payload = buildMarriageAssistancePayload(r.data);
          assert.equal('amount' in payload, false, 'no fabricated zero, no empty amount');
          assert.equal(payload.type, type);
        }
      }
    });

    test(`${type}: an amount left over from Financial Assistance is not validated and not sent`, () => {
      for (const leftover of ['500', 'abc', '-1', '10.999']) {
        const r = check({ type, amount: leftover });
        assert.equal(r.ok, true, leftover);
        if (r.ok) assert.equal('amount' in buildMarriageAssistancePayload(r.data), false, leftover);
      }
    });
  }

  test('switching type: the same typed text is checked for Financial Assistance and ignored otherwise', () => {
    assert.equal(check({ type: 'financial_assistance', amount: 'abc' }).ok, false);
    assert.equal(check({ type: 'proposal_support', amount: 'abc' }).ok, true);
    assert.equal(check({ type: 'financial_assistance', amount: '' }).ok, false);
  });
});

describe('who the request is for', () => {
  test('a member is required when "Member" is chosen, a family when "Family" is chosen', () => {
    assert.equal(check({ type: 'proposal_support', memberId: '' }).errors.memberId, 'Please select a member.');
    assert.equal(check({ type: 'proposal_support', personType: 'family', memberId: '', familyId: '' }).errors.familyId, 'Please select a family.');
  });

  test('the payload carries only the chosen kind of person', () => {
    const member = check({ type: 'proposal_support', memberId: 'm1', familyId: 'f1' });
    const family = check({ type: 'proposal_support', personType: 'family', memberId: 'm1', familyId: 'f1' });
    if (member.ok) assert.deepEqual([buildMarriageAssistancePayload(member.data).memberId, buildMarriageAssistancePayload(member.data).familyId], ['m1', undefined]);
    if (family.ok) assert.deepEqual([buildMarriageAssistancePayload(family.data).memberId, buildMarriageAssistancePayload(family.data).familyId], [undefined, 'f1']);
  });
});

describe('amountError', () => {
  test('null for a good amount', () => {
    for (const ok of ['0.01', '1', '10.5', '10.55', '100000000']) assert.equal(amountError(ok), null, ok);
    assert.equal(amountError('0'), AMOUNT_ZERO_MESSAGE);
  });
});

describe('the form uses it', () => {
  const source = readFileSync(new URL('../src/features/registrations/pages/CreateMarriageAssistance.tsx', import.meta.url), 'utf8');

  test('Amount (₹) is shown for Financial Assistance only, required, with its inline error', () => {
    assert.match(source, /\{needsAmount && \(/);
    assert.match(source, /label="Amount \(₹\)"/);
    assert.match(source, /register\('amount'\)/);
    assert.match(source, /errors\.amount\?\.message/);
    assert.match(source, /required\b/);
  });

  test('the request is built by the shared payload builder, and leaving Financial Assistance clears the amount', () => {
    assert.match(source, /marriageAssistanceService\.create\(buildMarriageAssistancePayload\(data\)\)/);
    assert.match(source, /setValue\('amount', ''\)/);
    assert.match(source, /clearErrors\('amount'\)/);
  });
});
