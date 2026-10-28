/*
 * The Trial Balance table: one definition of its columns, shared by the header, every data row and the footer rows,
 * so a heading and the figures under it cannot disagree about alignment. Also the totals, and the Total and
 * Difference rows laid out one cell per column.
 */

export type ColumnAlign = 'left' | 'right';

export interface TrialBalanceColumn {
  key: 'ledgerName' | 'type' | 'debit' | 'credit';
  label: string;
  align: ColumnAlign;
  /**
   * A fixed width, so the grid does not move with the figures. Null: the column takes whatever is left,
   * which is the Ledger column, where long names wrap.
   */
  width: string | null;
}

/**
 * Text columns read from the left; the two amount columns are right-aligned so the digits line up. The
 * amount columns are as wide as the largest figure the API accepts (₹100,000,000.00) plus the cell padding.
 */
export const TRIAL_BALANCE_COLUMNS: readonly TrialBalanceColumn[] = [
  { key: 'ledgerName', label: 'Ledger', align: 'left', width: null },
  { key: 'type', label: 'Type', align: 'left', width: '7rem' },
  { key: 'debit', label: 'Debit (₹)', align: 'right', width: '10rem' },
  { key: 'credit', label: 'Credit (₹)', align: 'right', width: '10rem' },
];

/** The table never gets narrower than this (the three fixed columns plus room for the ledger name); the card scrolls instead. */
export const TRIAL_BALANCE_MIN_WIDTH = '40rem';

interface Entry {
  debit?: number;
  credit?: number;
}

/** Same format the page has always used. */
export const formatRupees = (amount: number): string => `₹${amount.toLocaleString()}`;

export interface TrialBalanceSummary {
  totalDebit: number;
  totalCredit: number;
  /** Always positive: how far apart the two totals are. */
  difference: number;
  balanced: boolean;
  /**
   * The amount column that is short, i.e. the side the difference would have to be added to for the books to
   * balance: `credit` when debits exceed credits, `debit` when credits exceed debits. Null when balanced.
   */
  differenceSide: 'debit' | 'credit' | null;
}

export const summarizeTrialBalance = (entries: Entry[]): TrialBalanceSummary => {
  const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  const balanced = totalDebit - totalCredit === 0;
  return {
    totalDebit,
    totalCredit,
    difference: Math.abs(totalDebit - totalCredit),
    balanced,
    differenceSide: balanced ? null : totalDebit > totalCredit ? 'credit' : 'debit',
  };
};

/** One footer row, a cell for each column: the label spans the two text columns, then one cell per amount column. */
export interface FooterRow {
  label: string;
  /** What the label covers: the Ledger and Type columns. */
  labelSpan: 2;
  debit: string;
  credit: string;
  tone: 'neutral' | 'balanced' | 'unbalanced';
}

const NO_AMOUNT = '-';

export const trialBalanceFooter = (summary: TrialBalanceSummary): { total: FooterRow; difference: FooterRow } => ({
  total: {
    label: 'Total',
    labelSpan: 2,
    debit: formatRupees(summary.totalDebit),
    credit: formatRupees(summary.totalCredit),
    tone: 'neutral',
  },
  difference: {
    label: summary.balanced ? 'Difference (Balanced ✓)' : 'Difference',
    labelSpan: 2,
    // The difference sits under the column that is short, and nowhere else.
    debit: summary.differenceSide === 'debit' ? formatRupees(summary.difference) : NO_AMOUNT,
    credit: summary.differenceSide === 'credit' ? formatRupees(summary.difference) : NO_AMOUNT,
    tone: summary.balanced ? 'balanced' : 'unbalanced',
  },
});
