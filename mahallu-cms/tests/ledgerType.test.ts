import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ENTRY_TYPE,
  ENTRY_TYPE_LABEL,
  UNTYPED_LEDGER_MESSAGE,
  categoryFitsType,
  entryTypeForLedger,
  entryTypeState,
  ledgerEntryType,
  type EntryType,
} from '../src/utils/ledgerType.ts';

// What GET /master-accounts/ledgers returns for the fields that matter here. Names are chosen to mislead on purpose.
const LEDGERS = [
  { id: 'l-donations', name: 'Donations', type: 'income' },
  { id: 'l-salary', name: 'Salary Income', type: 'expense' }, // the NAME says income; the type field says expense
  { id: 'l-rent', name: 'Rent expense', type: 'income' }, // the NAME says expense; the type field says income
  { id: 'l-electricity', name: 'Electricity', type: 'expense' },
  { id: 'l-legacy', name: 'Old expense ledger' }, // no type at all
  { id: 'l-odd', name: 'Transfers', type: 'transfer' }, // not a type this app knows
];

/** What the form does: each change of the ledger choice replaces the type shown. */
const choose = (ledgerId: string | null | undefined): EntryType => entryTypeForLedger(LEDGERS, ledgerId);

describe('ledgerEntryType: the type comes from the ledger\'s own field', () => {
  test('income and expense are read as they are', () => {
    assert.equal(ledgerEntryType({ id: 'a', type: 'income' }), 'income');
    assert.equal(ledgerEntryType({ id: 'a', type: 'expense' }), 'expense');
  });

  test('anything else is "no type": other words, other case, blank, missing, or no ledger at all', () => {
    for (const type of ['transfer', 'Income', 'EXPENSE', ' income', '', undefined]) {
      assert.equal(ledgerEntryType({ id: 'a', type }), null, JSON.stringify(type));
    }
    assert.equal(ledgerEntryType(null), null);
    assert.equal(ledgerEntryType(undefined), null);
  });

  test('the ledger\'s name is never used to work out the type', () => {
    assert.equal(ledgerEntryType({ id: 'a', name: 'Salary Income', type: 'expense' } as never), 'expense');
    assert.equal(ledgerEntryType({ id: 'a', name: 'Rent expense', type: 'income' } as never), 'income');
    assert.equal(ledgerEntryType({ id: 'a', name: 'Old expense ledger' } as never), null, 'a name that says "expense" is not a type');
  });
});

describe('entryTypeForLedger: choosing a ledger sets the type', () => {
  test('an income ledger gives income and an expense ledger gives expense', () => {
    assert.equal(choose('l-donations'), 'income');
    assert.equal(choose('l-electricity'), 'expense');
  });

  test('the type comes from the type field, even when the name says the opposite', () => {
    assert.equal(choose('l-salary'), 'expense');
    assert.equal(choose('l-rent'), 'income');
  });

  test('changing the ledger replaces the value from the previous ledger, in either direction', () => {
    const shown: EntryType[] = [];
    for (const ledgerId of ['l-electricity', 'l-donations', 'l-electricity', 'l-salary', 'l-rent', 'l-salary']) shown.push(choose(ledgerId));
    assert.deepEqual(shown, ['expense', 'income', 'expense', 'expense', 'income', 'expense']);
  });

  test('clearing the choice drops the previous ledger\'s type instead of leaving it behind', () => {
    assert.equal(choose('l-electricity'), 'expense');
    assert.equal(choose(''), DEFAULT_ENTRY_TYPE);
    assert.equal(choose(null), DEFAULT_ENTRY_TYPE);
    assert.equal(choose(undefined), DEFAULT_ENTRY_TYPE);
  });

  test('a ledger with no recognised type, or one that is not in the list, does not inherit the previous ledger\'s type', () => {
    // Previous choice was an expense ledger; none of these may keep "expense".
    for (const ledgerId of ['l-legacy', 'l-odd', 'l-not-in-the-list']) {
      assert.equal(choose('l-electricity'), 'expense');
      assert.equal(choose(ledgerId), DEFAULT_ENTRY_TYPE, ledgerId);
    }
  });

  test('an empty list of ledgers gives the default', () => {
    assert.equal(entryTypeForLedger([], 'l-electricity'), DEFAULT_ENTRY_TYPE);
  });

  test('the default is income, which is what both forms start with', () => {
    assert.equal(DEFAULT_ENTRY_TYPE, 'income');
  });
});

describe('entryTypeState: what the read-only Type field shows, and whether an entry can be saved', () => {
  const stateFor = (ledgerId: string | null | undefined) => entryTypeState(LEDGERS, ledgerId);

  test('no ledger chosen yet: nothing to show and nothing to save', () => {
    for (const none of ['', null, undefined]) assert.deepEqual(stateFor(none), { status: 'none' }, String(none));
  });

  test('a ledger with a type: that type is the value shown AND the value saved', () => {
    assert.deepEqual(stateFor('l-donations'), { status: 'typed', type: 'income' });
    assert.deepEqual(stateFor('l-electricity'), { status: 'typed', type: 'expense' });
  });

  test('the ledger\'s type field wins over a misleading name', () => {
    assert.deepEqual(stateFor('l-salary'), { status: 'typed', type: 'expense' });
    assert.deepEqual(stateFor('l-rent'), { status: 'typed', type: 'income' });
  });

  test('a ledger with no usable type, or one that is not in the list, is "untyped": the type is not guessed', () => {
    for (const id of ['l-legacy', 'l-odd', 'l-not-in-the-list']) assert.deepEqual(stateFor(id), { status: 'untyped' }, id);
    assert.deepEqual(entryTypeState([], 'l-donations'), { status: 'untyped' }, 'an empty list cannot vouch for any ledger');
  });

  test('changing or clearing the ledger never carries the previous ledger\'s type forward', () => {
    // The sequence the form goes through; each answer depends only on the CURRENT ledger.
    const seen = ['l-electricity', 'l-donations', '', 'l-electricity', 'l-legacy', 'l-donations', null].map(stateFor);
    assert.deepEqual(seen, [
      { status: 'typed', type: 'expense' },
      { status: 'typed', type: 'income' },
      { status: 'none' },
      { status: 'typed', type: 'expense' },
      { status: 'untyped' },
      { status: 'typed', type: 'income' },
      { status: 'none' },
    ]);
  });

  test('the type that is saved always equals the type that is shown, for every ledger in the list', () => {
    for (const ledger of LEDGERS) {
      const state = stateFor(ledger.id);
      if (state.status === 'typed') assert.equal(state.type, ledgerEntryType(ledger), ledger.id);
      else assert.equal(ledgerEntryType(ledger), null, `${ledger.id} has no usable type`);
    }
  });

  test('the words shown, and the message for a ledger without a type', () => {
    assert.deepEqual(ENTRY_TYPE_LABEL, { income: 'Income', expense: 'Expense' });
    assert.match(UNTYPED_LEDGER_MESSAGE, /no income or expense type/);
    assert.match(UNTYPED_LEDGER_MESSAGE, /choose another ledger/i);
  });
});

describe('categoryFitsType: a category picked for the old type is not kept under the new one', () => {
  const categories = [
    { id: 'c-zakat', type: 'income' },
    { id: 'c-repairs', type: 'expense' },
    { id: 'c-untyped' },
  ];

  test('no category chosen is always fine', () => {
    for (const none of ['', undefined, null]) assert.equal(categoryFitsType(categories, none, 'expense'), true, String(none));
  });

  test('a category of the same type fits; one of the other type does not', () => {
    assert.equal(categoryFitsType(categories, 'c-zakat', 'income'), true);
    assert.equal(categoryFitsType(categories, 'c-zakat', 'expense'), false);
    assert.equal(categoryFitsType(categories, 'c-repairs', 'expense'), true);
    assert.equal(categoryFitsType(categories, 'c-repairs', 'income'), false);
  });

  test('a category that is missing from the list, or has no type, does not fit', () => {
    assert.equal(categoryFitsType(categories, 'c-gone', 'income'), false);
    assert.equal(categoryFitsType(categories, 'c-untyped', 'income'), false);
  });

  test('switching an income entry to an expense ledger clears its income category (the whole flow)', () => {
    let type: EntryType = DEFAULT_ENTRY_TYPE;
    let categoryId: string | undefined = 'c-zakat';           // picked while the entry was income
    type = choose('l-electricity');                             // ledger changed to an expense ledger
    if (!categoryFitsType(categories, categoryId, type)) categoryId = '';
    assert.equal(type, 'expense');
    assert.equal(categoryId, '');
    // and choosing an income ledger again keeps nothing stale either
    categoryId = 'c-repairs';
    type = choose('l-donations');
    if (!categoryFitsType(categories, categoryId, type)) categoryId = '';
    assert.deepEqual({ type, categoryId }, { type: 'income', categoryId: '' });
  });
});
