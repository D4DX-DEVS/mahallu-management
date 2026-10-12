/**
 * C2 tests. The aggregation needs a live DB, so what is pinned here is the
 * scoring maths and the dimension set — a clamp or divide-by-zero slip there
 * produces NaN scores or >100 bars on the radar chart.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { DIMENSIONS, TARGETS, score } from '../config/developmentIndex';

test('the twelve spec dimensions are present, in display order', () => {
  assert.deepEqual(
    DIMENSIONS.map((d) => d.key),
    [
      'familyData',
      'worship',
      'education',
      'welfare',
      'zakat',
      'economy',
      'youth',
      'women',
      'health',
      'finance',
      'governance',
      'community',
    ]
  );
});

test('score is a clamped percentage of target', () => {
  assert.equal(score(0, 10), 0);
  assert.equal(score(5, 10), 50);
  assert.equal(score(10, 10), 100);
});

test('exceeding the target still caps at 100', () => {
  assert.equal(score(80, 52), 100);
});

test('a zero or missing target scores 0 rather than NaN', () => {
  assert.equal(score(5, 0), 0);
  assert.equal(score(0, 0), 0);
  assert.ok(Number.isFinite(score(3, 0)));
});

test('negative inputs cannot drag a score below 0', () => {
  assert.equal(score(-5, 10), 0);
});

test('annual targets are positive numbers', () => {
  Object.entries(TARGETS).forEach(([key, value]) => {
    assert.ok(typeof value === 'number' && value > 0, `${key} must be a positive number`);
  });
});
