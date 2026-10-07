import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Ledger, LedgerItem } from '../models/MasterAccount';
import {
  postLedgerEntry,
  reverseLedgerEntry,
  REVERSIBLE_SOURCES,
} from '../services/ledgerPostingService';
import { oid } from './support/fakeMongo';
import { makeWorld, World } from './support/collectiblesWorld';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] ledgerPosting', () => {

/**
 * Ledger posting: idempotent per (source, sourceId), pinned to the account it hit, reversible for every
 * source, and Mahallu-level lookups never match an institute's ledger.
 */

let world: World;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => world.restore());

const post = (over: Record<string, any> = {}) =>
  postLedgerEntry({
    tenantId: world.ids.tenantA,
    ledgerName: 'Varisangya Collections',
    ledgerType: 'income',
    amount: 100,
    description: 'test',
    date: new Date('2026-03-01'),
    source: 'varisangya',
    sourceId: oid(),
    ...over,
  } as any);

describe('postLedgerEntry is idempotent per (source, sourceId)', () => {
  test('posting the same source twice stores one entry and moves the balance once', async () => {
    const sourceId = oid();
    const first = await post({ sourceId });
    const second = await post({ sourceId });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.accountABalance(), 100);
  });

  test('10 parallel posts of one source: one entry, one balance change', async () => {
    const sourceId = oid();
    const results = await Promise.all(Array.from({ length: 10 }, () => post({ sourceId })));
    assert.equal(results.filter((r) => r.created).length, 1);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.accountABalance(), 100);
  });

  test('different source documents each post, and the expense sign is applied', async () => {
    await post({ sourceId: oid() });
    await post({ sourceId: oid(), ledgerType: 'expense', ledgerName: 'Zakat Distribution', source: 'zakat_distribution', amount: 30 });
    assert.equal(world.stores.ledgerItem.docs.length, 2);
    assert.equal(world.accountABalance(), 70);
  });

  test('the same sourceId under a different source is a different entry', async () => {
    const sourceId = oid();
    await post({ sourceId, source: 'varisangya' });
    await post({ sourceId, source: 'zakat', ledgerName: 'Zakat Collections' });
    assert.equal(world.stores.ledgerItem.docs.length, 2);
  });

  test('if the balance update fails the new entry is taken back, the error is thrown, and a retry posts cleanly', async () => {
    const sourceId = oid();
    world.stores.mahalluAccount.failOn('MahalluAccount.findOneAndUpdate', new Error('account update failed'));
    await assert.rejects(post({ sourceId }), /account update failed/);
    assert.equal(world.stores.ledgerItem.docs.length, 0);
    assert.equal(world.accountABalance(), 0);

    const retry = await post({ sourceId });
    assert.equal(retry.created, true);
    assert.equal(world.accountABalance(), 100);
  });

  test('a posting failure is NOT swallowed: the promise rejects', async () => {
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', new Error('db down'));
    await assert.rejects(post(), /db down/);
  });

  test('negative or non-numeric amounts are rejected before anything is written', async () => {
    for (const amount of [-1, NaN, Infinity]) await assert.rejects(post({ amount }));
    assert.equal(world.stores.ledgerItem.docs.length, 0);
    assert.equal(world.stores.ledger.docs.length, 0);
  });

  test('an entry for a tenant with no active account is still stored (balance untouched), as before', async () => {
    const other = oid();
    const result = await post({ tenantId: other });
    assert.equal(result.created, true);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.stores.ledgerItem.docs[0].accountId, undefined);
  });
});

describe('the account an entry hit is pinned', () => {
  test('the item records its account and a reversal uses it even if the "first active account" changed since', async () => {
    const sourceId = oid();
    await post({ sourceId });
    const item = world.stores.ledgerItem.docs[0];
    assert.equal(String(item.accountId), String(world.ids.accountA));
    assert.equal(item.accountType, 'mahallu');

    // an older, active account appears afterwards: the old lookup would now pick it
    const older = oid();
    world.stores.mahalluAccount.insert({ _id: older, tenantId: world.ids.tenantA, accountName: 'Older', status: 'active', balance: 0, createdAt: new Date(2000, 0, 1) });

    await reverseLedgerEntry('varisangya', sourceId);
    assert.equal(world.accountABalance(), 0, 'the pinned account was restored');
    assert.equal(world.stores.mahalluAccount.docs.find((a) => String(a._id) === String(older)).balance, 0, 'the other account is untouched');
  });

  test('a reversal still reaches the pinned account after it was deactivated', async () => {
    const sourceId = oid();
    await post({ sourceId });
    world.stores.mahalluAccount.docs.find((a) => String(a._id) === String(world.ids.accountA)).status = 'inactive';
    await reverseLedgerEntry('varisangya', sourceId);
    assert.equal(world.accountABalance(), 0);
  });

  test('an older entry without a pinned account falls back to the first active account', async () => {
    const sourceId = oid();
    world.stores.ledgerItem.insert({
      _id: oid(), tenantId: world.ids.tenantA, instituteId: null, ledgerId: oid(), date: new Date(), amount: 40, type: 'income',
      description: 'legacy', source: 'zakat', sourceId,
    });
    world.stores.mahalluAccount.docs.find((a) => String(a._id) === String(world.ids.accountA)).balance = 40;
    await reverseLedgerEntry('zakat', sourceId);
    assert.equal(world.accountABalance(), 0);
    assert.equal(world.stores.ledgerItem.docs.length, 0);
  });

  test('institute-level entries move the institute account, not the Mahallu one', async () => {
    const instituteId = oid();
    const instAccount = oid();
    world.stores.instituteAccount.insert({ _id: instAccount, tenantId: world.ids.tenantA, instituteId, accountName: 'Inst', status: 'active', balance: 0 });
    const sourceId = oid();
    await post({ sourceId, instituteId, source: 'salary', ledgerType: 'expense', ledgerName: 'Salary Payments', amount: 60 });
    assert.equal(world.stores.instituteAccount.docs[0].balance, -60);
    assert.equal(world.accountABalance(), 0);
    await reverseLedgerEntry('salary', sourceId);
    assert.equal(world.stores.instituteAccount.docs[0].balance, 0);
  });
});

describe('reversal works for every source', () => {
  for (const source of REVERSIBLE_SOURCES) {
    test(`${source}: entry removed and balance restored (income and expense)`, async () => {
      for (const ledgerType of ['income', 'expense'] as const) {
        const sourceId = oid();
        await post({ sourceId, source, ledgerType, amount: 25, ledgerName: `${source} ledger` });
        const expected = ledgerType === 'income' ? 25 : -25;
        assert.equal(world.accountABalance(), expected);
        const removed = await reverseLedgerEntry(source, sourceId);
        assert.equal(removed.length, 1);
        assert.equal(world.accountABalance(), 0);
        assert.equal(world.stores.ledgerItem.docs.filter((d) => String(d.sourceId) === String(sourceId)).length, 0);
      }
    });
  }

  test('reversing something that was never posted is a harmless no-op', async () => {
    assert.deepEqual(await reverseLedgerEntry('welfare', oid()), []);
    assert.equal(world.accountABalance(), 0);
  });

  test('an unknown source is refused', async () => {
    await assert.rejects(reverseLedgerEntry('manual' as any, oid()), /cannot be reversed/);
    await assert.rejects(reverseLedgerEntry('nonsense' as any, oid()));
  });

  test('reversal scoped to a tenant does not touch another Mahallu\'s entry', async () => {
    const sourceId = oid();
    await post({ sourceId, tenantId: world.ids.tenantB });
    const removed = await reverseLedgerEntry('varisangya', sourceId, { tenantId: world.ids.tenantA });
    assert.equal(removed.length, 0);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
  });

  test('5 concurrent reversals apply the balance change once', async () => {
    const sourceId = oid();
    await post({ sourceId });
    const results = await Promise.all(Array.from({ length: 5 }, () => reverseLedgerEntry('varisangya', sourceId)));
    assert.equal(results.reduce((n, r) => n + r.length, 0), 1);
    assert.equal(world.accountABalance(), 0);
  });

  test('if the balance update fails during a reversal the entry is put back and the error thrown', async () => {
    const sourceId = oid();
    await post({ sourceId });
    world.stores.mahalluAccount.failOn('MahalluAccount.findOneAndUpdate', new Error('account update failed'));
    await assert.rejects(reverseLedgerEntry('varisangya', sourceId), /account update failed/);
    assert.equal(world.stores.ledgerItem.docs.length, 1, 'entry restored');
    assert.equal(world.accountABalance(), 100);
    // retry works
    assert.equal((await reverseLedgerEntry('varisangya', sourceId)).length, 1);
    assert.equal(world.accountABalance(), 0);
  });
});

describe('findOrCreateLedger', () => {
  test('a Mahallu-level post never lands in an institute ledger of the same name', async () => {
    const instituteId = oid();
    const instituteLedger = oid();
    world.stores.ledger.insert({ _id: instituteLedger, tenantId: world.ids.tenantA, instituteId, name: 'Varisangya Collections', type: 'income' });
    await post({ sourceId: oid() });
    const item = world.stores.ledgerItem.docs[0];
    assert.notEqual(String(item.ledgerId), String(instituteLedger));
    const ledger = world.stores.ledger.docs.find((l) => String(l._id) === String(item.ledgerId));
    assert.equal(ledger.instituteId, null);
    assert.equal(ledger.auto, true);
  });

  test('a Mahallu-level post reuses the existing Mahallu ledger (created by hand or by an earlier post)', async () => {
    const manual = oid();
    world.stores.ledger.insert({ _id: manual, tenantId: world.ids.tenantA, instituteId: null, name: 'Varisangya Collections', type: 'income' });
    await post({ sourceId: oid() });
    await post({ sourceId: oid() });
    assert.equal(world.stores.ledger.docs.length, 1);
    assert.ok(world.stores.ledgerItem.docs.every((i) => String(i.ledgerId) === String(manual)));
  });

  test('an institute post uses the institute ledger, separate from the Mahallu one', async () => {
    const instituteId = oid();
    await post({ sourceId: oid() });
    await post({ sourceId: oid(), instituteId });
    assert.equal(world.stores.ledger.docs.length, 2);
  });

  test('20 concurrent posts that need the same new ledger create it once', async () => {
    await Promise.all(Array.from({ length: 20 }, () => post({ sourceId: oid() })));
    assert.equal(world.stores.ledger.docs.length, 1);
    assert.equal(world.stores.ledgerItem.docs.length, 20);
    assert.equal(world.accountABalance(), 2000);
  });

  test('income and expense ledgers with the same name are separate', async () => {
    await post({ sourceId: oid(), ledgerName: 'Same', ledgerType: 'income' });
    await post({ sourceId: oid(), ledgerName: 'Same', ledgerType: 'expense' });
    assert.equal(world.stores.ledger.docs.length, 2);
  });

  test('another Mahallu gets its own ledger', async () => {
    await post({ sourceId: oid() });
    await post({ sourceId: oid(), tenantId: world.ids.tenantB });
    assert.equal(world.stores.ledger.docs.length, 2);
  });
});

describe('indexes declared on the models', () => {
  const idx = (Model: any) => Model.schema.indexes() as Array<[Record<string, number>, Record<string, any>]>;

  test('LedgerItem: unique partial (source, sourceId), plus (source, sourceId, tenantId) and (tenantId, date)', () => {
    const indexes = idx(LedgerItem);
    const unique = indexes.find(([f, o]) => f.source === 1 && f.sourceId === 1 && Object.keys(f).length === 2 && o.unique);
    assert.ok(unique, 'unique (source, sourceId)');
    assert.deepEqual(unique![1].partialFilterExpression, { source: { $type: 'string' }, sourceId: { $type: 'objectId' } });
    assert.ok(indexes.some(([f, o]) => f.source === 1 && f.sourceId === 1 && f.tenantId === 1 && !o.unique));
    assert.ok(indexes.some(([f]) => f.tenantId === 1 && f.date === -1));
  });

  test('Ledger: unique (tenantId, instituteId, name, type) only for auto-created ledgers, so manual ledgers and old data cannot block it', () => {
    const unique = idx(Ledger).find(([f, o]) => f.tenantId === 1 && f.instituteId === 1 && f.name === 1 && f.type === 1 && o.unique);
    assert.ok(unique);
    assert.deepEqual(unique![1].partialFilterExpression, { auto: true });
  });

  test('the item stores the account it moved', () => {
    assert.ok(LedgerItem.schema.path('accountId'));
    assert.ok(LedgerItem.schema.path('accountType'));
    assert.ok(mongoose.Types.ObjectId.isValid(String(world.ids.accountA)));
  });
});
});
