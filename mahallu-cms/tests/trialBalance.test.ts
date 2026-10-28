import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRIAL_BALANCE_COLUMNS,
  TRIAL_BALANCE_MIN_WIDTH,
  formatRupees,
  summarizeTrialBalance,
  trialBalanceFooter,
} from '../src/utils/trialBalance.ts';

const entries = [
  { debit: 0, credit: 1000 },
  { debit: 250.5, credit: 0 },
  { debit: 100, credit: 0 },
];

describe('Trial Balance columns', () => {
  test('Ledger and Type read from the left; Debit and Credit are right-aligned', () => {
    assert.deepEqual(
      TRIAL_BALANCE_COLUMNS.map((c) => [c.label, c.align]),
      [
        ['Ledger', 'left'],
        ['Type', 'left'],
        ['Debit (₹)', 'right'],
        ['Credit (₹)', 'right'],
      ]
    );
  });

  test('the grid is fixed: Debit and Credit share one width, Type has its own, Ledger takes the rest', () => {
    const width = Object.fromEntries(TRIAL_BALANCE_COLUMNS.map((c) => [c.key, c.width]));
    assert.equal(width.ledgerName, null);
    assert.ok(width.type);
    assert.equal(width.debit, width.credit);
    assert.ok(width.debit);
    // wide enough for the largest figure the API accepts (₹100,000,000.00 is 14 characters) at 16px per ch with the cell padding
    assert.ok(parseFloat(width.debit!) >= 9, width.debit!);
    // the table's floor is the three fixed columns plus room for a ledger name
    const fixed = TRIAL_BALANCE_COLUMNS.reduce((sum, c) => sum + (c.width ? parseFloat(c.width) : 0), 0);
    assert.ok(parseFloat(TRIAL_BALANCE_MIN_WIDTH) > fixed + 10, `${TRIAL_BALANCE_MIN_WIDTH} vs fixed ${fixed}rem`);
  });

  test('the page lays the table out from that grid, header, rows and footer alike', () => {
    const source = readFileSync(new URL('../src/features/accounting/pages/TrialBalance.tsx', import.meta.url), 'utf8');
    assert.match(source, /tableLayout: 'fixed'/);
    assert.match(source, /minWidth: TRIAL_BALANCE_MIN_WIDTH/);
    assert.match(source, /<colgroup>[\s\S]*TRIAL_BALANCE_COLUMNS\.map[\s\S]*<\/colgroup>/);
    // every amount cell, in the body and the footer, uses the one right-aligned cell style
    assert.equal((source.match(/\$\{AMOUNT_CELL\}/g) ?? []).length, 4);
    assert.match(source, /overflow-x-auto/, 'overflow stays inside the card');
  });

  test('the page draws its headings from the column list and aligns them inline (the table CSS forces th left)', () => {
    const source = readFileSync(new URL('../src/features/accounting/pages/TrialBalance.tsx', import.meta.url), 'utf8');
    assert.match(source, /TRIAL_BALANCE_COLUMNS\.map/);
    assert.match(source, /style=\{\{ textAlign: column\.align \}\}/);
    const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
    assert.match(css, /\.data-table th\s*\{[^}]*text-align:\s*left/, 'documents why a class cannot be used');
  });
});

describe('summarizeTrialBalance', () => {
  test('totals and difference', () => {
    const s = summarizeTrialBalance(entries);
    assert.equal(s.totalDebit, 350.5);
    assert.equal(s.totalCredit, 1000);
    assert.equal(s.difference, 649.5);
    assert.equal(s.balanced, false);
  });

  test('missing debit/credit values count as zero', () => {
    const s = summarizeTrialBalance([{ debit: 5 }, { credit: 5 }, {}]);
    assert.deepEqual([s.totalDebit, s.totalCredit, s.balanced], [5, 5, true]);
  });

  test('the difference is on the short side, and nowhere when balanced', () => {
    assert.equal(summarizeTrialBalance(entries).differenceSide, 'debit');
    assert.equal(summarizeTrialBalance([{ debit: 9 }, { credit: 2 }]).differenceSide, 'credit');
    assert.equal(summarizeTrialBalance([{ debit: 2 }, { credit: 2 }]).differenceSide, null);
  });
});

describe('trialBalanceFooter: one cell per amount column', () => {
  test('Total puts each total under its own column, formatted as currency', () => {
    const { total } = trialBalanceFooter(summarizeTrialBalance(entries));
    assert.deepEqual([total.label, total.labelSpan, total.debit, total.credit], ['Total', 2, formatRupees(350.5), formatRupees(1000)]);
  });

  test('Difference sits under only the short column; the other shows "-"', () => {
    const { difference } = trialBalanceFooter(summarizeTrialBalance(entries));
    assert.equal(difference.debit, formatRupees(649.5));
    assert.equal(difference.credit, '-');
    assert.equal(difference.tone, 'unbalanced');

    const credit = trialBalanceFooter(summarizeTrialBalance([{ debit: 9 }, { credit: 2 }])).difference;
    assert.deepEqual([credit.debit, credit.credit], ['-', formatRupees(7)]);
  });

  test('balanced books say so and are shown as balanced', () => {
    const { difference } = trialBalanceFooter(summarizeTrialBalance([{ debit: 2 }, { credit: 2 }]));
    assert.equal(difference.label, 'Difference (Balanced ✓)');
    assert.equal(difference.tone, 'balanced');
    assert.deepEqual([difference.debit, difference.credit], ['-', '-']);
  });

  test('the label spans exactly the two text columns, so amounts start at the Debit column', () => {
    const text = TRIAL_BALANCE_COLUMNS.filter((c) => c.align === 'left').length;
    const { total, difference } = trialBalanceFooter(summarizeTrialBalance(entries));
    assert.equal(total.labelSpan, text);
    assert.equal(difference.labelSpan, text);
  });

  test('currency format is unchanged', () => {
    assert.equal(formatRupees(1234567), `₹${(1234567).toLocaleString()}`);
  });
});
