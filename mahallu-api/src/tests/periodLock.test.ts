/**
 * Period lock, budget and zakat approval schema checks (no database needed).
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PeriodLockedError, assertPeriodOpen } from '../utils/periodLock';
import { FinancialPeriod } from '../models/FinancialPeriod';
import { Budget } from '../models/Budget';
import { ZakatDistribution, ASNAF_CATEGORIES } from '../models/Zakat';

test('PeriodLockedError is a 423 with a stable code', () => {
  const err = new PeriodLockedError('closed');
  assert.equal(err.statusCode, 423);
  assert.equal(err.code, 'PERIOD_CLOSED');
});

test('assertPeriodOpen allows missing tenant or date without touching the database', async () => {
  await assertPeriodOpen(undefined, new Date());
  await assertPeriodOpen('6acc7c3c5fdebdc0588d6d48', undefined);
  await assertPeriodOpen('6acc7c3c5fdebdc0588d6d48', 'not a date');
});

test('a period defaults to open and needs a name and dates', () => {
  const doc = new FinancialPeriod({});
  assert.equal(doc.status, 'open');
  const err = doc.validateSync();
  assert.ok(err?.errors.name && err.errors.startDate && err.errors.endDate);
});

test('budget lines need a type and a non-negative amount', () => {
  const doc = new Budget({ tenantId: new (require('mongoose').Types.ObjectId)(), periodId: new (require('mongoose').Types.ObjectId)(), lines: [{ name: 'x', type: 'bogus', amount: -1 }] });
  const err = doc.validateSync();
  assert.ok(err);
  assert.equal(doc.status, 'draft');
});

test('legacy distributions without a status default to approved; asnaf excludes other', () => {
  const d = new ZakatDistribution({ tenantId: new (require('mongoose').Types.ObjectId)(), beneficiaryId: new (require('mongoose').Types.ObjectId)(), amount: 10 });
  assert.equal(d.status, 'approved');
  assert.ok(!(ASNAF_CATEGORIES as readonly string[]).includes('other'));
  assert.equal(ASNAF_CATEGORIES.length, 8);
});
