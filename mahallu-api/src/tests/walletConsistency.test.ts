import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Wallet, Transaction } from '../models/Collectible';
import {
  createVarisangya,
  deleteVarisangya,
  getWallet,
  getWalletTransactions,
} from '../controllers/collectibleController';
import { getOwnWallet } from '../controllers/memberUserController';
import {
  creditWallet,
  debitWallet,
  findOrCreateWallet,
  findWallet,
  hasPaymentCredit,
  recordTransaction,
  walletKeyFor,
} from '../services/walletService';
import { call, oid } from './support/fakeMongo';
import { makeWorld, World } from './support/collectiblesWorld';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] walletConsistency', () => {

/**
 * Wallet balance and journal consistency: only atomic $inc, never negative, one wallet per owner, the
 * admin side and the member side resolve the same wallet, and wallet reads are tenant-checked.
 */

let world: World;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => world.restore());

const seedWallet = (over: Record<string, any> = {}) => {
  const wallet = { _id: oid(), tenantId: world.ids.tenantA, memberId: world.ids.memberA1, balance: 0, ...over };
  world.stores.wallet.insert(wallet);
  return wallet;
};

describe('balance changes are atomic and guarded', () => {
  test('20 parallel credits all land (no lost update)', async () => {
    const wallet = await findOrCreateWallet({ tenantId: world.ids.tenantA, memberId: world.ids.memberA1 });
    await Promise.all(Array.from({ length: 20 }, () => creditWallet(wallet._id, 25)));
    assert.equal(world.stores.wallet.docs[0].balance, 500);
  });

  test('parallel debits can never take the balance below zero', async () => {
    const wallet = seedWallet({ balance: 100 });
    const results = await Promise.all(Array.from({ length: 10 }, () => debitWallet(wallet._id, 30)));
    assert.equal(results.filter(Boolean).length, 3, 'only three 30s fit in 100');
    assert.equal(world.stores.wallet.docs[0].balance, 10);
  });

  test('a debit larger than the balance changes nothing and reports it', async () => {
    const wallet = seedWallet({ balance: 50 });
    assert.equal(await debitWallet(wallet._id, 50.01), null);
    assert.equal(world.stores.wallet.docs[0].balance, 50);
    assert.ok(await debitWallet(wallet._id, 50));
    assert.equal(world.stores.wallet.docs[0].balance, 0);
  });

  test('zero, negative and non-numeric amounts are refused before touching the wallet', async () => {
    const wallet = seedWallet({ balance: 10 });
    for (const amount of [0, -5, NaN, Infinity]) {
      await assert.rejects(creditWallet(wallet._id, amount as number));
      await assert.rejects(debitWallet(wallet._id, amount as number));
    }
    assert.equal(world.stores.wallet.docs[0].balance, 10);
  });
});

describe('one wallet per owner', () => {
  test('a member payer and a family payer map to different, stable keys', () => {
    const member = walletKeyFor({ tenantId: world.ids.tenantA, memberId: world.ids.memberA1, familyId: world.ids.familyA });
    const family = walletKeyFor({ tenantId: world.ids.tenantA, familyId: world.ids.familyA });
    assert.equal(member!.key, `m:${world.ids.memberA1}`, 'a member wins even when the family is also named');
    assert.equal(family!.key, `f:${world.ids.familyA}`);
    assert.equal(walletKeyFor({ tenantId: world.ids.tenantA }), null);
  });

  test('20 concurrent find-or-create calls end with exactly one wallet', async () => {
    const owner = { tenantId: world.ids.tenantA, memberId: world.ids.memberA1 };
    const wallets = await Promise.all(Array.from({ length: 20 }, () => findOrCreateWallet(owner)));
    assert.equal(world.stores.wallet.docs.length, 1);
    assert.equal(new Set(wallets.map((w) => String(w._id))).size, 1);
  });

  test('the unique index that backs it exists on the model (tenantId + key, partial)', () => {
    const has = (Wallet.schema.indexes() as any[]).some(
      ([fields, opts]) => fields.tenantId === 1 && fields.key === 1 && opts.unique && opts.partialFilterExpression?.key
    );
    assert.ok(has, 'unique partial (tenantId, key) index on Wallet');
    const txn = (Transaction.schema.indexes() as any[]).some(
      ([fields, opts]) => fields.tenantId === 1 && fields.entryKey === 1 && opts.unique && opts.partialFilterExpression?.entryKey
    );
    assert.ok(txn, 'unique partial (tenantId, entryKey) index on Transaction');
  });

  test('a wallet created by older code (no key; familyId and memberId both set) is reused, not duplicated', async () => {
    const legacy = seedWallet({ familyId: world.ids.familyA, balance: 70 });
    const found = await findOrCreateWallet({ tenantId: world.ids.tenantA, memberId: world.ids.memberA1, familyId: world.ids.familyA });
    assert.equal(String(found._id), String(legacy._id));
    assert.equal(world.stores.wallet.docs.length, 1);
    // and the member's own view resolves the same one
    const own = await call(getOwnWallet, { user: { role: 'user', memberId: world.ids.memberA1 } });
    assert.equal(String(own.body.data._id), String(legacy._id));
    assert.equal(own.body.data.balance, 70);
  });

  test('a legacy FAMILY wallet (no memberId field) is found by a family-only lookup, and never mistaken for a member wallet', async () => {
    const legacyFamily = seedWallet({ memberId: undefined, familyId: world.ids.familyA, balance: 40 });
    assert.equal(String((await findWallet({ tenantId: world.ids.tenantA, familyId: world.ids.familyA }))._id), String(legacyFamily._id));
    assert.equal(await findWallet({ tenantId: world.ids.tenantA, memberId: world.ids.memberA1 }), null);
  });

  test('the same owner in two Mahallus gets two wallets', async () => {
    await findOrCreateWallet({ tenantId: world.ids.tenantA, familyId: world.ids.familyA });
    await findOrCreateWallet({ tenantId: world.ids.tenantB, familyId: world.ids.familyA });
    assert.equal(world.stores.wallet.docs.length, 2);
  });

  test('family-level and member-level payments credit different wallets, and getWallet keeps them apart', async () => {
    const pay = (extra: Record<string, any>) =>
      call(createVarisangya, { ...world.asAdmin(), body: { amount: 300, paymentDate: '2026-03-02', ...extra } });
    assert.equal((await pay({ familyId: String(world.ids.familyA) })).status, 201);
    assert.equal((await pay({ memberId: String(world.ids.memberA1) })).status, 201);
    assert.equal((await pay({ memberId: String(world.ids.memberA1) })).status, 201);
    assert.equal(world.stores.wallet.docs.length, 2);

    const family = await call(getWallet, { ...world.asAdmin(), query: { familyId: String(world.ids.familyA) } });
    const member = await call(getWallet, { ...world.asAdmin(), query: { memberId: String(world.ids.memberA1) } });
    const other = await call(getWallet, { ...world.asAdmin(), query: { memberId: String(world.ids.memberA2) } });
    assert.equal(family.body.data.balance, 300);
    assert.equal(member.body.data.balance, 600);
    assert.equal(other.body.data.balance, 0, 'no wallet yet: an empty balance, nothing invented');
  });
});

describe('journal rows are idempotent', () => {
  test('recording the same step twice writes one row', async () => {
    const wallet = seedWallet();
    const entry = {
      tenantId: world.ids.tenantA,
      walletId: wallet._id,
      type: 'credit' as const,
      amount: 10,
      description: 'x',
      referenceId: oid(),
      referenceType: 'varisangya' as const,
      kind: 'payment' as const,
      entryKey: 'varisangya:abc:payment',
    };
    await Promise.all([recordTransaction(entry), recordTransaction(entry), recordTransaction(entry)]);
    assert.equal(world.stores.txn.docs.length, 1);
  });

  test('rows written before entryKey existed still count as "this payment was credited"', async () => {
    const payment = oid();
    const wallet = seedWallet({ balance: 500 });
    world.stores.txn.insert({ _id: oid(), tenantId: world.ids.tenantA, walletId: wallet._id, type: 'credit', amount: 500, description: 'legacy', referenceId: payment, referenceType: 'varisangya' });
    assert.equal(await hasPaymentCredit(world.ids.tenantA, 'varisangya', payment), true);
    assert.equal(await hasPaymentCredit(world.ids.tenantA, 'varisangya', oid()), false);
    assert.equal(await hasPaymentCredit(world.ids.tenantB, 'varisangya', payment), false);
  });

  test('deleting an older verified payment (journal row without entryKey) debits the wallet and journals a reversal', async () => {
    const wallet = seedWallet({ balance: 500 });
    const id = oid();
    world.stores.varisangya.insert({ _id: id, tenantId: world.ids.tenantA, memberId: world.ids.memberA1, amount: 500, paymentDate: new Date(), status: 'verified', receiptNo: '1' });
    world.stores.txn.insert({ _id: oid(), tenantId: world.ids.tenantA, walletId: wallet._id, type: 'credit', amount: 500, description: 'legacy', referenceId: id, referenceType: 'varisangya' });
    const reply = await call(deleteVarisangya, { ...world.asAdmin(), params: { id: String(id) } });
    assert.equal(reply.status, 200);
    assert.equal(world.stores.wallet.docs[0].balance, 0);
    assert.equal(world.stores.txn.docs.filter((t) => t.kind === 'reversal').length, 1);
  });

  test('deleting a verified payment whose credit was never journaled does NOT debit the wallet', async () => {
    seedWallet({ balance: 200 });
    const id = oid();
    world.stores.varisangya.insert({ _id: id, tenantId: world.ids.tenantA, memberId: world.ids.memberA1, amount: 500, paymentDate: new Date(), status: 'verified', receiptNo: '1' });
    const reply = await call(deleteVarisangya, { ...world.asAdmin(), params: { id: String(id) } });
    assert.equal(reply.status, 200);
    assert.equal(world.stores.wallet.docs[0].balance, 200);
    assert.equal(world.stores.txn.docs.length, 0);
  });
});

describe('wallet reads are tenant-checked', () => {
  const makeTransactions = (wallet: any, n: number) => {
    for (let i = 0; i < n; i++) {
      world.stores.txn.insert({
        _id: oid(),
        tenantId: wallet.tenantId,
        walletId: wallet._id,
        type: i % 2 ? 'debit' : 'credit',
        amount: i + 1,
        description: `row ${i}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
      });
    }
  };

  test("another Mahallu's wallet transactions are refused (403) and not even counted", async () => {
    const wallet = seedWallet();
    makeTransactions(wallet, 3);
    const reply = await call(getWalletTransactions, { ...world.asAdminB(), params: { walletId: String(wallet._id) }, query: {} });
    assert.equal(reply.status, 403);
    assert.equal(reply.body.success, false);
    assert.equal(world.stores.txn.count('find'), 0, 'no transaction query ran');
  });

  test('a user with no Mahallu is refused outright', async () => {
    const wallet = seedWallet();
    const reply = await call(getWalletTransactions, { user: { role: 'mahall' }, params: { walletId: String(wallet._id) }, query: {} });
    assert.equal(reply.status, 403);
  });

  test('the owner reads their transactions, newest first, paginated', async () => {
    const wallet = seedWallet();
    makeTransactions(wallet, 25);
    const first = await call(getWalletTransactions, { ...world.asAdmin(), params: { walletId: String(wallet._id) }, query: { limit: '10' } });
    assert.equal(first.status, 200);
    assert.equal(first.body.data.length, 10);
    assert.equal(first.body.pagination.total, 25);
    assert.equal(first.body.pagination.totalPages, 3);
    assert.equal(first.body.data[0].description, 'row 24');
    const third = await call(getWalletTransactions, { ...world.asAdmin(), params: { walletId: String(wallet._id) }, query: { limit: '10', page: '3' } });
    assert.equal(third.body.data.length, 5);
  });

  test('without an explicit limit a page is large enough for the existing screens, but still bounded', async () => {
    const wallet = seedWallet();
    makeTransactions(wallet, 120);
    const reply = await call(getWalletTransactions, { ...world.asAdmin(), params: { walletId: String(wallet._id) }, query: {} });
    assert.equal(reply.body.data.length, 50);
    assert.equal(reply.body.pagination.total, 120);
  });

  test('the type filter works, and a transaction of another wallet never leaks in', async () => {
    const wallet = seedWallet();
    const stranger = seedWallet({ memberId: world.ids.memberA2 });
    makeTransactions(wallet, 6);
    makeTransactions(stranger, 4);
    const credits = await call(getWalletTransactions, { ...world.asAdmin(), params: { walletId: String(wallet._id) }, query: { type: 'credit', limit: '100' } });
    assert.equal(credits.body.pagination.total, 3);
    assert.ok(credits.body.data.every((t: any) => t.type === 'credit' && String(t.walletId) === String(wallet._id)));
  });

  test('unknown wallet is 404 and a malformed id is 400', async () => {
    assert.equal((await call(getWalletTransactions, { ...world.asAdmin(), params: { walletId: String(oid()) }, query: {} })).status, 404);
    assert.equal((await call(getWalletTransactions, { ...world.asAdmin(), params: { walletId: 'nope' }, query: {} })).status, 400);
  });

  test('a super admin may read any Mahallu wallet', async () => {
    const wallet = seedWallet();
    makeTransactions(wallet, 2);
    const reply = await call(getWalletTransactions, { isSuperAdmin: true, user: { role: 'super_admin' }, params: { walletId: String(wallet._id) }, query: {} });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.pagination.total, 2);
  });

  test('getWallet ignores a client-supplied tenantId for a normal user (no cross-tenant read)', async () => {
    seedWallet({ balance: 123 });
    const reply = await call(getWallet, {
      ...world.asAdminB(),
      query: { tenantId: String(world.ids.tenantA), memberId: String(world.ids.memberA1) },
    });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.data.balance, 0, "tenant B's admin sees nothing of tenant A's wallet");
  });

  test('getWallet refuses a user with no Mahallu, and asks for a family or member', async () => {
    seedWallet({ balance: 5 });
    assert.equal((await call(getWallet, { user: { role: 'mahall' }, query: { memberId: String(world.ids.memberA1) } })).status, 403);
    assert.equal((await call(getWallet, { ...world.asAdmin(), query: {} })).status, 400);
    assert.equal((await call(getWallet, { ...world.asAdmin(), query: { memberId: 'x' } })).status, 400);
  });

  test('a super admin names the Mahallu explicitly', async () => {
    seedWallet({ balance: 9 });
    const reply = await call(getWallet, {
      isSuperAdmin: true,
      user: { role: 'super_admin' },
      query: { tenantId: String(world.ids.tenantA), memberId: String(world.ids.memberA1) },
    });
    assert.equal(reply.body.data.balance, 9);
  });
});
});
