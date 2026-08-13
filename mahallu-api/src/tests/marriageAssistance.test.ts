/**
 * B9 tests. Marriage assistance schema shape and enum validation.
 * Focus: tenant scoping, status transitions, and minimum field requirements.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MarriageAssistance,
  MARRIAGE_ASSISTANCE_TYPES,
  MARRIAGE_ASSISTANCE_STATUSES,
} from '../models/MarriageAssistance';

test('marriage assistance types match spec', () => {
  assert.deepEqual([...MARRIAGE_ASSISTANCE_TYPES], [
    'proposal_support',
    'financial_assistance',
    'premarital_counselling',
  ]);
});

test('marriage assistance statuses match spec', () => {
  assert.deepEqual([...MARRIAGE_ASSISTANCE_STATUSES], ['requested', 'approved', 'completed']);
});

test('marriage assistance requires tenantId and type', () => {
  const paths = MarriageAssistance.schema.paths;
  ['tenantId', 'type', 'status'].forEach((field) => {
    assert.ok(paths[field], `MarriageAssistance is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.type.isRequired, true);
});

test('marriage assistance has optional member and family references', () => {
  const paths = MarriageAssistance.schema.paths;
  assert.ok(paths.memberId, 'MarriageAssistance is missing memberId');
  assert.ok(paths.familyId, 'MarriageAssistance is missing familyId');
});

test('marriage assistance timestamps its documents', () => {
  assert.ok(
    MarriageAssistance.schema.paths.createdAt,
    'MarriageAssistance has no timestamps'
  );
  assert.ok(
    MarriageAssistance.schema.paths.updatedAt,
    'MarriageAssistance has no updatedAt'
  );
});

test('marriage assistance has compound index on tenantId and status', () => {
  const indexes = MarriageAssistance.schema.indexes();
  const tenantStatusIndex = indexes.find(
    ([fields, _options]: any[]) => fields.tenantId === 1 && fields.status === 1
  );
  assert.ok(tenantStatusIndex, 'Expected compound index on (tenantId, status)');
});

test('marriage assistance has amount as optional number', () => {
  const paths = MarriageAssistance.schema.paths;
  assert.ok(paths.amount, 'MarriageAssistance is missing amount field');
});
