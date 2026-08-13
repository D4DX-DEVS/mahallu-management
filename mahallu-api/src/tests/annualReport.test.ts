/**
 * C1 tests. The aggregation needs a live DB, so what is pinned here is the
 * calendar-year window every sub-query filters on — an off-by-one there silently
 * pulls a neighbouring year's finance/zakat totals into the report.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { yearRange } from '../controllers/annualReportController';

test('year window is [Jan 1 UTC, Jan 1 next year UTC)', () => {
  const { start, end } = yearRange(2026);
  assert.equal(start.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(end.toISOString(), '2027-01-01T00:00:00.000Z');
});

test('Dec 31 of the year is inside the window, Jan 1 next year is not', () => {
  const { start, end } = yearRange(2026);
  const dec31 = new Date('2026-12-31T23:59:59.999Z');
  const jan1 = new Date('2027-01-01T00:00:00.000Z');
  assert.ok(dec31 >= start && dec31 < end);
  assert.ok(!(jan1 < end));
});

test('leap year window still spans exactly one year', () => {
  const { start, end } = yearRange(2024);
  assert.equal(start.getUTCFullYear(), 2024);
  assert.equal(end.getUTCFullYear(), 2025);
  assert.equal((end.getTime() - start.getTime()) / 86400000, 366);
});
