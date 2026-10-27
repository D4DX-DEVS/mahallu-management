import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { GENDER_REQUIRED_MESSAGE, normalizeGenderCell, requiredGenderSchema } from '../src/features/members/memberGender.ts';

// The create forms (CreateMember, QuickAddMember) build their schema around requiredGenderSchema, so the
// same object shape is enough to pin what they accept.
const formSchema = z.object({ name: z.string().min(1), gender: requiredGenderSchema });
const messageFor = (input: unknown) => {
  const result = formSchema.safeParse(input);
  return result.success ? null : result.error.issues.map((issue) => issue.message);
};

describe('requiredGenderSchema (create forms)', () => {
  test('male and female are accepted and come out unchanged, so the payload carries what was chosen', () => {
    assert.deepEqual(formSchema.parse({ name: 'A', gender: 'male' }), { name: 'A', gender: 'male' });
    assert.deepEqual(formSchema.parse({ name: 'A', gender: 'female' }), { name: 'A', gender: 'female' });
  });

  test('a blank, missing or unknown gender is refused with the same clear message', () => {
    for (const gender of ['', undefined, null, 'other', 'Male', ' male']) {
      assert.deepEqual(messageFor({ name: 'A', gender }), [GENDER_REQUIRED_MESSAGE], JSON.stringify(gender));
    }
    assert.deepEqual(messageFor({ name: 'A' }), [GENDER_REQUIRED_MESSAGE], 'field absent');
  });

  test('the message tells the person what to do', () => {
    assert.equal(GENDER_REQUIRED_MESSAGE, 'Please choose the gender.');
  });
});

describe('normalizeGenderCell (CSV import)', () => {
  test('trims whitespace and ignores case', () => {
    assert.deepEqual(normalizeGenderCell('male'), { value: 'male' });
    assert.deepEqual(normalizeGenderCell('  MALE '), { value: 'male' });
    assert.deepEqual(normalizeGenderCell('Female'), { value: 'female' });
    assert.deepEqual(normalizeGenderCell('\tfEmAlE\t'), { value: 'female' });
  });

  test('never guesses: abbreviations, other words and blanks are errors that quote what was found', () => {
    for (const bad of ['M', 'f', 'boy', 'girl', 'other', 'male female', 'm/f', '']) {
      const result = normalizeGenderCell(bad);
      assert.ok('error' in result, `"${bad}" must be refused`);
    }
    assert.deepEqual(normalizeGenderCell('  Boy '), { error: 'Gender must be "male" or "female" (found "Boy").' });
  });
});
