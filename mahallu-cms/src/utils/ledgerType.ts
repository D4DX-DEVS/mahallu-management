/*
 * A ledger entry is income or expense according to its LEDGER. `Ledger.type` is required on the server, and the
 * API refuses an entry whose type differs from its ledger's ("This entry is an income but the ledger you chose is
 * for expenses"). So the entry forms take the type from the chosen ledger's own `type` field. Nothing here reads
 * the ledger's name, and a type the server did not send is never guessed.
 */
export type EntryType = 'income' | 'expense';

/** What the entry forms start with, and fall back to when there is no ledger to take a type from. */
export const DEFAULT_ENTRY_TYPE: EntryType = 'income';

interface LedgerLike {
  id: string;
  type?: string;
}

/** The ledger's own type, or null when it has none we recognise. */
export const ledgerEntryType = (ledger: LedgerLike | null | undefined): EntryType | null =>
  ledger?.type === 'income' || ledger?.type === 'expense' ? ledger.type : null;

/**
 * The entry type to show after the ledger choice changes to `ledgerId`.
 *  - a ledger with a known type: that type, replacing whatever the previous ledger (or the person) had set;
 *  - no ledger chosen (the choice was cleared): the default, so the previous ledger's type does not linger;
 *  - a ledger that is missing from the list or carries no recognised type: also the default, never the previous
 *    ledger's type, because that value no longer belongs to anything the person has chosen.
 */
export const entryTypeForLedger = (ledgers: LedgerLike[], ledgerId: string | null | undefined): EntryType => {
  if (!ledgerId) return DEFAULT_ENTRY_TYPE;
  return ledgerEntryType(ledgers.find((ledger) => ledger.id === ledgerId)) ?? DEFAULT_ENTRY_TYPE;
};

/** What the read-only Type field shows, and whether an entry can be saved against the chosen ledger. */
export type EntryTypeState =
  | { status: 'none' }
  | { status: 'untyped' }
  | { status: 'typed'; type: EntryType };

/**
 * The single answer both entry forms act on. `typed`: the ledger's own type, which is what is shown and what is
 * saved. `none`: no ledger chosen yet. `untyped`: a ledger is chosen but carries no income/expense type (or is not in
 * the list); the type is then NOT guessed, so the form says so and refuses to save.
 */
export const entryTypeState = (ledgers: LedgerLike[], ledgerId: string | null | undefined): EntryTypeState => {
  if (!ledgerId) return { status: 'none' };
  const type = ledgerEntryType(ledgers.find((ledger) => ledger.id === ledgerId));
  return type ? { status: 'typed', type } : { status: 'untyped' };
};

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = { income: 'Income', expense: 'Expense' };

export const UNTYPED_LEDGER_MESSAGE =
  "This ledger has no income or expense type, so an entry can't be added to it. Please choose another ledger.";

/**
 * Whether the chosen category still fits the entry type. Categories are listed by type, so when a ledger flips the
 * type a category picked for the old type must be cleared, not submitted under the new one. No category is fine.
 */
export const categoryFitsType = (
  categories: Array<{ id: string; type?: string }>,
  categoryId: string | null | undefined,
  type: EntryType
): boolean => !categoryId || categories.find((category) => category.id === categoryId)?.type === type;
