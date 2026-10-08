import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createVarisangya,
  updateVarisangya,
  deleteVarisangya,
  verifyVarisangya,
  rejectVarisangya,
  getAllVarisangyas,
  getCollectionsSummary,
} from '../controllers/collectibleController';
import {
  getOwnVarisangya,
  getOwnPayments,
  getOwnWallet,
  getOwnWalletTransactions,
  requestVarisangyaPayment,
} from '../controllers/memberUserController';
import { computeFamilyDues } from '../services/varisangyaNotificationService';
import Tenant from '../models/Tenant';
import { MasterCategoryValue } from '../models/MasterCategory';
import { installFake, call, oid, Installed } from './support/fakeMongo';
import { makeWorld, World } from './support/collectiblesWorld';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] varisangyaVerification', () => {

/**
 * Varisangya payment lifecycle: pending vs verified, atomic verification, compensation on failure,
 * idempotent creates, and the server-side summary. Stateful in-memory fakes (no database), so the
 * concurrency cases are real races.
 */

let world: World;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => world.restore());

const date = new Date('2026-03-01T00:00:00.000Z');

const seedPending = (over: Record<string, any> = {}) => {
  const row = {
    _id: oid(),
    tenantId: world.ids.tenantA,
    memberId: world.ids.memberA1,
    familyId: world.ids.familyA,
    amount: 500,
    paymentDate: date,
    status: 'pending',
    source: 'member',
    ...over,
  };
  world.stores.varisangya.insert(row);
  return row;
};

const verify = (id: any, as = world.asAdmin()) => call(verifyVarisangya, { ...as, params: { id: String(id) } });
const rowOf = (id: any) => world.stores.varisangya.docs.find((d) => String(d._id) === String(id));
const walletBalance = () => world.stores.wallet.docs.reduce((s, w) => s + (w.balance || 0), 0);
const noEffects = () => {
  assert.equal(world.stores.wallet.docs.length, 0, 'no wallet created');
  assert.equal(world.stores.txn.docs.length, 0, 'no journal rows');
  assert.equal(world.stores.ledgerItem.docs.length, 0, 'no ledger entries');
  assert.equal(world.accountABalance(), 0, 'bank balance untouched');
};

describe('verify: exactly once', () => {
  test('20 parallel verifies of one pending payment credit the wallet, journal and ledger exactly once', async () => {
    const row = seedPending();
    const replies = await Promise.all(Array.from({ length: 20 }, () => verify(row._id)));

    assert.equal(replies.filter((r) => r.status === 200).length, 1);
    assert.equal(replies.filter((r) => r.status === 409).length, 19);
    for (const r of replies.filter((r) => r.status === 409)) assert.match(r.body.message, /already been processed/i);

    assert.equal(walletBalance(), 500);
    assert.equal(world.stores.wallet.docs.length, 1);
    assert.equal(world.stores.txn.docs.length, 1);
    assert.equal(world.stores.txn.docs[0].type, 'credit');
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.accountABalance(), 500);
    const stored = rowOf(row._id);
    assert.equal(stored.status, 'verified');
    assert.ok(stored.receiptNo, 'a receipt number is assigned at verification');
    assert.equal(String(stored.verifiedBy), String(world.ids.adminA));
  });

  test('verifying again later answers 409, and a missing payment 404', async () => {
    const row = seedPending();
    assert.equal((await verify(row._id)).status, 200);
    assert.equal((await verify(row._id)).status, 409);
    assert.equal((await verify(oid())).status, 404);
    assert.equal(walletBalance(), 500);
  });

  test("another tenant's pending payment cannot be verified", async () => {
    const row = seedPending();
    const reply = await verify(row._id, world.asAdminB());
    assert.equal(reply.status, 404);
    assert.equal(rowOf(row._id).status, 'pending');
    noEffects();
  });

  test('a member-submitted payment credits the SAME wallet getOwnWallet shows (no duplicate wallet)', async () => {
    const row = seedPending();
    // member opens the app first (creates the wallet), then the admin verifies
    const before = await call(getOwnWallet, { user: { role: 'user', memberId: world.ids.memberA1 } });
    assert.equal(before.status, 200);
    assert.equal(before.body.data.balance, 0);

    assert.equal((await verify(row._id)).status, 200);

    const after = await call(getOwnWallet, { user: { role: 'user', memberId: world.ids.memberA1 } });
    assert.equal(world.stores.wallet.docs.length, 1, 'one wallet, not two');
    assert.equal(after.body.data.balance, 500);
    assert.equal(String(after.body.data._id), String(before.body.data._id));

    const txns = await call(getOwnWalletTransactions, { user: { role: 'user', memberId: world.ids.memberA1 }, query: {} });
    assert.equal(txns.body.pagination.total, 1);
    assert.equal(txns.body.data[0].amount, 500);
  });
});

describe('verify: compensation when a step fails', () => {
  test('a failure at the ledger step reverts the wallet credit, the journal row and the status, and reports an error', async () => {
    const row = seedPending();
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', new Error('ledger unavailable'));

    const reply = await verify(row._id);
    assert.equal(reply.status, 500);
    assert.equal(reply.body.success, false);

    assert.equal(walletBalance(), 0, 'wallet credit undone');
    assert.equal(world.stores.txn.docs.length, 0, 'journal row undone');
    assert.equal(world.stores.ledgerItem.docs.length, 0);
    assert.equal(world.accountABalance(), 0);
    assert.equal(rowOf(row._id).status, 'pending', 'status reverted so it can be verified again');

    // and a retry now succeeds, once
    const retry = await verify(row._id);
    assert.equal(retry.status, 200);
    assert.equal(walletBalance(), 500);
    assert.equal(world.accountABalance(), 500);
  });

  test('a failure at the journal step also reverts the wallet credit', async () => {
    const row = seedPending();
    world.stores.txn.failOn('Transaction.findOneAndUpdate', new Error('journal down'));
    const reply = await verify(row._id);
    assert.equal(reply.status, 500);
    assert.equal(walletBalance(), 0);
    assert.equal(rowOf(row._id).status, 'pending');
    assert.equal(world.stores.txn.docs.length, 0);
    assert.equal(world.stores.ledgerItem.docs.length, 0);
  });

  test('when an undo step ALSO fails the caller is told to check the record (never a silent drift)', async () => {
    const row = seedPending();
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', new Error('ledger unavailable'));
    // the wallet debit that undoes the credit fails too
    world.stores.wallet.failOn('Wallet.findOneAndUpdate', new Error('wallet unavailable'), 1, (f) => !!f.balance);

    const reply = await verify(row._id);
    assert.equal(reply.status, 500);
    assert.match(reply.body.message, /check the record/i);
    // the failed undo is visible as a credited wallet that no journal row backs: that is what the message is about
    assert.equal(walletBalance(), 500);
  });
});

describe('create (admin)', () => {
  const create = (body: Record<string, any>, as = world.asAdmin()) => call(createVarisangya, { ...as, body });

  test('goes through the same verified path: wallet, journal, ledger, receipt', async () => {
    const reply = await create({ memberId: String(world.ids.memberA1), amount: 250, paymentDate: '2026-03-02' });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.data.status, 'verified');
    assert.equal(reply.body.data.source, 'admin');
    assert.equal(walletBalance(), 250);
    assert.equal(world.accountABalance(), 250);
    assert.ok(reply.body.data.receiptNo);
    assert.equal(world.stores.txn.docs[0].entryKey, `varisangya:${reply.body.data._id}:payment`);
  });

  test('the client cannot choose status, source, verifier, tenant or id', async () => {
    const stranger = oid();
    const reply = await create({
      familyId: String(world.ids.familyA),
      amount: 100,
      paymentDate: '2026-03-02',
      status: 'pending',
      source: 'member',
      verifiedBy: String(stranger),
      tenantId: String(world.ids.tenantB),
      _id: String(stranger),
      createdBy: String(stranger),
    });
    assert.equal(reply.status, 201);
    const row = world.stores.varisangya.docs[0];
    assert.equal(String(row.tenantId), String(world.ids.tenantA));
    assert.equal(row.status, 'verified');
    assert.equal(row.source, 'admin');
    assert.equal(String(row.verifiedBy), String(world.ids.adminA));
    assert.notEqual(String(row._id), String(stranger));
    assert.equal(world.stores.wallet.docs[0].key, `f:${world.ids.familyA}`);
  });

  test('a family or member of another Mahallu is refused and nothing is written', async () => {
    const reply = await create({ memberId: String(world.ids.memberB1), amount: 100, paymentDate: '2026-03-02' });
    assert.equal(reply.status, 400);
    const reply2 = await create({ familyId: String(world.ids.familyB), amount: 100, paymentDate: '2026-03-02' });
    assert.equal(reply2.status, 400);
    assert.equal(world.stores.varisangya.docs.length, 0);
    noEffects();
  });

  test('amount must be a positive money value', async () => {
    for (const amount of [0, -5, 'abc', 1e21, 10.999, null, undefined]) {
      const reply = await create({ memberId: String(world.ids.memberA1), amount, paymentDate: '2026-03-02' });
      assert.equal(reply.status, 400, String(amount));
    }
    assert.equal(world.stores.varisangya.docs.length, 0);
  });

  test('a non-super user with no Mahallu is refused, not given a body-chosen tenant', async () => {
    const reply = await call(createVarisangya, {
      user: { role: 'mahall', _id: world.ids.adminA },
      body: { tenantId: String(world.ids.tenantA), memberId: String(world.ids.memberA1), amount: 10, paymentDate: '2026-03-02' },
    });
    assert.equal(reply.status, 403);
    assert.equal(world.stores.varisangya.docs.length, 0);
  });

  test('a failure at the ledger step leaves no row, no wallet credit and no journal row', async () => {
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', new Error('ledger unavailable'));
    const reply = await create({ memberId: String(world.ids.memberA1), amount: 300, paymentDate: '2026-03-02' });
    assert.equal(reply.status, 500);
    assert.equal(world.stores.varisangya.docs.length, 0, 'the row was removed again');
    assert.equal(walletBalance(), 0);
    assert.equal(world.stores.txn.docs.length, 0);
    assert.equal(world.accountABalance(), 0);
  });
});

describe('create: idempotent by clientRequestId', () => {
  const body = (extra: Record<string, any> = {}) => ({
    memberId: String(world.ids.memberA1),
    amount: 400,
    paymentDate: '2026-03-02',
    clientRequestId: 'req-abcdef-0001',
    ...extra,
  });

  test('a double submit returns the first payment (200, idempotent) and credits the wallet once', async () => {
    const first = await call(createVarisangya, { ...world.asAdmin(), body: body() });
    const second = await call(createVarisangya, { ...world.asAdmin(), body: body() });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.idempotent, true);
    assert.equal(String(second.body.data._id), String(first.body.data._id));
    assert.equal(world.stores.varisangya.docs.length, 1);
    assert.equal(walletBalance(), 400);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.accountABalance(), 400);
  });

  test('10 simultaneous submits with the same id produce exactly one payment and one credit', async () => {
    const replies = await Promise.all(
      Array.from({ length: 10 }, () => call(createVarisangya, { ...world.asAdmin(), body: body() }))
    );
    assert.ok(replies.every((r) => [200, 201, 409].includes(r.status)), replies.map((r) => r.status).join());
    assert.equal(replies.filter((r) => r.status === 201).length, 1);
    assert.equal(world.stores.varisangya.docs.length, 1);
    assert.equal(walletBalance(), 400);
    assert.equal(world.accountABalance(), 400);
    // once the first is finished a retry is a clean 200
    const retry = await call(createVarisangya, { ...world.asAdmin(), body: body() });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.idempotent, true);
  });

  test('the same id for a different payment is refused', async () => {
    await call(createVarisangya, { ...world.asAdmin(), body: body() });
    const reply = await call(createVarisangya, { ...world.asAdmin(), body: body({ amount: 999 }) });
    assert.equal(reply.status, 409);
    assert.equal(world.stores.varisangya.docs.length, 1);
  });

  test('ids are per Mahallu: another Mahallu can reuse the same id', async () => {
    await call(createVarisangya, { ...world.asAdmin(), body: body() });
    const other = await call(createVarisangya, {
      ...world.asAdminB(),
      body: body({ memberId: String(world.ids.memberB1) }),
    });
    assert.equal(other.status, 201);
    assert.equal(world.stores.varisangya.docs.length, 2);
  });

  test('an id of the wrong shape is rejected', async () => {
    const reply = await call(createVarisangya, { ...world.asAdmin(), body: body({ clientRequestId: 'short' }) });
    assert.equal(reply.status, 400);
  });

  test('a create that died after saving the row is completed by the retry (no second row)', async () => {
    // simulate the interrupted attempt: a pending admin row with the id, created a while ago
    seedPending({ source: 'admin', familyId: undefined, clientRequestId: 'req-abcdef-0001', amount: 400, createdAt: new Date(Date.now() - 120_000), receiptNo: '14001' });
    const retry = await call(createVarisangya, { ...world.asAdmin(), body: body() });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.idempotent, true);
    assert.equal(retry.body.data.status, 'verified');
    assert.equal(world.stores.varisangya.docs.length, 1);
    assert.equal(walletBalance(), 400);
    assert.equal(world.accountABalance(), 400);
  });

  test('a young pending row (first request still running) is not raced: the retry is told to wait', async () => {
    seedPending({ source: 'admin', familyId: undefined, clientRequestId: 'req-abcdef-0001', amount: 400, createdAt: new Date(), receiptNo: '14001' });
    const retry = await call(createVarisangya, { ...world.asAdmin(), body: body() });
    assert.equal(retry.status, 409);
    assert.equal(walletBalance(), 0);
  });
});

describe('pending payments have NO financial side effects', () => {
  test('updating a pending payment (even its amount) touches no wallet, journal or ledger', async () => {
    const row = seedPending();
    const reply = await call(updateVarisangya, {
      ...world.asAdmin(),
      params: { id: String(row._id) },
      body: { amount: 750, remarks: 'edited', status: 'verified', receiptNo: 'X-1', source: 'admin', memberId: String(world.ids.memberA2) },
    });
    assert.equal(reply.status, 200);
    const stored = rowOf(row._id);
    assert.equal(stored.amount, 750);
    assert.equal(stored.remarks, 'edited');
    assert.equal(stored.status, 'pending', 'status cannot be set through update');
    assert.equal(stored.source, 'member');
    assert.equal(stored.receiptNo, undefined);
    assert.equal(String(stored.memberId), String(world.ids.memberA1));
    for (const s of [world.stores.wallet, world.stores.txn, world.stores.ledgerItem, world.stores.ledger]) {
      assert.deepEqual(s.log, [], `${s.name} must not be touched`);
    }
    noEffects();
  });

  test('deleting a pending payment touches no wallet, journal or ledger (and cannot 500 on an empty wallet)', async () => {
    const row = seedPending();
    const reply = await call(deleteVarisangya, { ...world.asAdmin(), params: { id: String(row._id) } });
    assert.equal(reply.status, 200);
    assert.equal(rowOf(row._id), undefined);
    for (const s of [world.stores.wallet, world.stores.txn, world.stores.ledgerItem]) {
      assert.deepEqual(s.log, [], `${s.name} must not be touched`);
    }
    noEffects();
  });

  test('after verify, a later edit adjusts the wallet by the difference only: no double counting', async () => {
    const row = seedPending();
    await verify(row._id);
    assert.equal(walletBalance(), 500);
    const reply = await call(updateVarisangya, { ...world.asAdmin(), params: { id: String(row._id) }, body: { amount: 800 } });
    assert.equal(reply.status, 200);
    assert.equal(walletBalance(), 800);
    assert.equal(world.accountABalance(), 800);
  });
});

describe('update / delete of VERIFIED payments', () => {
  const makeVerified = async (amount = 500) => {
    const reply = await call(createVarisangya, {
      ...world.asAdmin(),
      body: { memberId: String(world.ids.memberA1), amount, paymentDate: '2026-03-02' },
    });
    assert.equal(reply.status, 201);
    return reply.body.data;
  };
  const update = (id: any, body: Record<string, any>) =>
    call(updateVarisangya, { ...world.asAdmin(), params: { id: String(id) }, body });

  test('lowering the amount debits the DIFFERENCE, journals an adjustment, and re-posts the ledger', async () => {
    const payment = await makeVerified(500);
    const reply = await update(payment._id, { amount: 300 });
    assert.equal(reply.status, 200);
    assert.equal(walletBalance(), 300);
    assert.equal(world.accountABalance(), 300);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.stores.ledgerItem.docs[0].amount, 300);
    const adjustment = world.stores.txn.docs.find((t) => t.kind === 'adjustment');
    assert.equal(adjustment.type, 'debit');
    assert.equal(adjustment.amount, 200);
    assert.equal(world.stores.txn.docs.length, 2, 'append-only: the original credit row is kept');
  });

  test('raising the amount credits the difference', async () => {
    const payment = await makeVerified(500);
    await update(payment._id, { amount: 900 });
    assert.equal(walletBalance(), 900);
    assert.equal(world.stores.txn.docs.find((t) => t.kind === 'adjustment').type, 'credit');
  });

  test('a reduction the wallet cannot cover is refused (409) and nothing changes', async () => {
    const payment = await makeVerified(500);
    world.stores.wallet.docs[0].balance = 100; // drifted legacy wallet
    const reply = await update(payment._id, { amount: 300 });
    assert.equal(reply.status, 409);
    assert.equal(rowOf(payment._id).amount, 500, 'amount reverted');
    assert.equal(world.stores.wallet.docs[0].balance, 100, 'wallet never goes negative / untouched');
    assert.equal(world.stores.ledgerItem.docs[0].amount, 500);
    assert.equal(world.accountABalance(), 500);
  });

  test('a ledger failure during an edit restores the amount, the wallet and the old ledger entry', async () => {
    const payment = await makeVerified(500);
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', new Error('ledger unavailable'));
    const reply = await update(payment._id, { amount: 300 });
    assert.equal(reply.status, 500);
    assert.equal(rowOf(payment._id).amount, 500);
    assert.equal(walletBalance(), 500);
    assert.equal(world.stores.ledgerItem.docs.length, 1, 'the old entry is back');
    assert.equal(world.stores.ledgerItem.docs[0].amount, 500);
    assert.equal(world.accountABalance(), 500);
    assert.equal(world.stores.txn.docs.filter((t) => t.kind === 'adjustment').length, 0);
  });

  test('two edits racing on the same amount: one applies, the other is refused (no double adjustment)', async () => {
    const payment = await makeVerified(500);
    const replies = await Promise.all([update(payment._id, { amount: 300 }), update(payment._id, { amount: 100 })]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
    const final = rowOf(payment._id).amount;
    assert.equal(walletBalance(), final);
    assert.equal(world.accountABalance(), final);
  });

  test('deleting reverses wallet, journal (reversal row), ledger and bank balance', async () => {
    const payment = await makeVerified(500);
    const reply = await call(deleteVarisangya, { ...world.asAdmin(), params: { id: String(payment._id) } });
    assert.equal(reply.status, 200);
    assert.equal(rowOf(payment._id), undefined);
    assert.equal(walletBalance(), 0);
    assert.equal(world.stores.ledgerItem.docs.length, 0);
    assert.equal(world.accountABalance(), 0);
    const kinds = world.stores.txn.docs.map((t) => t.kind).sort();
    assert.deepEqual(kinds, ['payment', 'reversal']);
  });

  test('two deletes at once reverse the effects once', async () => {
    const payment = await makeVerified(500);
    const replies = await Promise.all([
      call(deleteVarisangya, { ...world.asAdmin(), params: { id: String(payment._id) } }),
      call(deleteVarisangya, { ...world.asAdmin(), params: { id: String(payment._id) } }),
    ]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [200, 404]);
    assert.equal(walletBalance(), 0);
    assert.equal(world.accountABalance(), 0);
    assert.equal(world.stores.txn.docs.filter((t) => t.kind === 'reversal').length, 1);
  });

  test('a delete the wallet cannot cover is refused and the row, wallet and ledger are all back', async () => {
    const payment = await makeVerified(500);
    world.stores.wallet.docs[0].balance = 100;
    const reply = await call(deleteVarisangya, { ...world.asAdmin(), params: { id: String(payment._id) } });
    assert.equal(reply.status, 409);
    assert.ok(rowOf(payment._id), 'the payment is restored');
    assert.equal(world.stores.wallet.docs[0].balance, 100);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.accountABalance(), 500);
  });

  test("another tenant's payment cannot be edited or deleted", async () => {
    const payment = await makeVerified(500);
    const edit = await call(updateVarisangya, { ...world.asAdminB(), params: { id: String(payment._id) }, body: { amount: 1 } });
    const del = await call(deleteVarisangya, { ...world.asAdminB(), params: { id: String(payment._id) } });
    assert.equal(edit.status, 404);
    assert.equal(del.status, 404);
    assert.equal(rowOf(payment._id).amount, 500);
  });
});

describe('member-side views and submissions', () => {
  const asMember = (extra: Record<string, any> = {}) => ({
    user: { role: 'user', memberId: world.ids.memberA1 },
    ...extra,
  });

  test('a member submission is forced to pending with no receipt, whatever the body says', async () => {
    const reply = await call(requestVarisangyaPayment, {
      ...asMember(),
      body: { amount: 120, paymentDate: '2026-03-02', status: 'verified', source: 'admin', receiptNo: '99', verifiedBy: String(oid()), tenantId: String(world.ids.tenantB) },
    });
    assert.equal(reply.status, 201);
    const row = world.stores.varisangya.docs[0];
    assert.equal(row.status, 'pending');
    assert.equal(row.source, 'member');
    assert.equal(row.receiptNo, undefined);
    assert.equal(row.verifiedBy, undefined);
    assert.equal(String(row.tenantId), String(world.ids.tenantA));
    assert.equal(String(row.memberId), String(world.ids.memberA1));
    noEffects();
  });

  test('a member submission needs a positive amount', async () => {
    for (const amount of [0, -1, 'x']) {
      const reply = await call(requestVarisangyaPayment, { ...asMember(), body: { amount, paymentDate: '2026-03-02' } });
      assert.equal(reply.status, 400);
    }
  });

  test('a double-tapped submission with the same clientRequestId creates one pending payment', async () => {
    const body = { amount: 120, paymentDate: '2026-03-02', clientRequestId: 'phone-abcdef-01' };
    const first = await call(requestVarisangyaPayment, { ...asMember(), body });
    const second = await call(requestVarisangyaPayment, { ...asMember(), body });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.idempotent, true);
    assert.equal(world.stores.varisangya.docs.length, 1);
  });

  test("getOwnVarisangya labels a pending submission 'pending' (not 'paid') and keeps it out of the totals", async () => {
    seedPending({ amount: 100, status: 'verified', source: 'admin', receiptNo: '14001' });
    seedPending({ amount: 700, status: 'pending' });
    seedPending({ amount: 50, status: undefined, source: 'admin' }); // older payment without a status: received
    const reply = await call(getOwnVarisangya, { ...asMember(), query: {} });
    assert.equal(reply.status, 200);
    const byAmount = Object.fromEntries(reply.body.data.memberVarisangya.map((v: any) => [v.amount, v.status]));
    assert.deepEqual(byAmount, { 100: 'paid', 700: 'pending', 50: 'paid' });
    assert.equal(reply.body.data.summary.memberTotal, 150);
    assert.equal(reply.body.data.summary.memberCount, 2);
    assert.equal(reply.body.data.summary.memberPendingTotal, 700);
    assert.equal(reply.body.data.summary.memberPendingCount, 1);
  });

  test('getOwnPayments pages across varisangya AND zakat as one date-ordered list', async () => {
    const day = (n: number) => new Date(Date.UTC(2026, 0, n));
    for (let i = 1; i <= 12; i++) seedPending({ amount: i, status: 'verified', paymentDate: day(i * 2) }); // even days
    const zakatStore = world.stores.zakat;
    for (let i = 1; i <= 12; i++) {
      zakatStore.insert({ _id: oid(), tenantId: world.ids.tenantA, payerId: world.ids.memberA1, payerName: 'Member One', amount: 1000 + i, paymentDate: day(i * 2 + 1), status: 'verified' }); // odd days
    }
    const pageOf = async (page: number) => call(getOwnPayments, { ...asMember(), query: { page: String(page), limit: '10' } });
    const [p1, p2, p3] = [await pageOf(1), await pageOf(2), await pageOf(3)];
    assert.equal(p1.body.pagination.total, 24);
    assert.deepEqual([p1.body.data.length, p2.body.data.length, p3.body.data.length], [10, 10, 4]);
    const all = [...p1.body.data, ...p2.body.data, ...p3.body.data];
    assert.equal(new Set(all.map((r: any) => String(r._id))).size, 24, 'no row repeated or skipped');
    const times = all.map((r: any) => new Date(r.paymentDate).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a), 'newest first across both kinds');
    assert.ok(all.every((r: any) => r.type === 'varisangya' || r.type === 'zakat'));
  });
});

describe('family dues count only verified money', () => {
  let tenantInstall: Installed;
  let valuesInstall: Installed;
  beforeEach(() => {
    tenantInstall = installFake(Tenant, [{ _id: world.ids.tenantA, settings: { varisangyaAmount: 100 } }]);
    valuesInstall = installFake(MasterCategoryValue, []);
  });
  afterEach(() => {
    tenantInstall.restore();
    valuesInstall.restore();
  });

  test('a pending submission does not reduce what the family owes (and so does not suppress the reminder)', async () => {
    const now = new Date();
    const months = now.getMonth() + 1;
    const thisYear = new Date(now.getFullYear(), now.getMonth(), 1);
    seedPending({ amount: 300, status: 'verified', source: 'admin', paymentDate: thisYear });
    seedPending({ amount: 100000, status: 'pending', paymentDate: thisYear });
    const dues = await computeFamilyDues(world.ids.tenantA);
    const due = dues.find((d) => d.familyId === String(world.ids.familyA))!;
    assert.equal(due.paidAmount, 300);
    assert.equal(due.expectedAmount, 100 * months);
    assert.equal(due.dueAmount, Math.max(0, 100 * months - 300));
  });
});

describe('summary: the whole filtered set, not one page', () => {
  const seedMany = () => {
    let expected = { total: 0, verified: 0, pending: 0 };
    for (let i = 1; i <= 25; i++) {
      const pending = i % 4 === 0;
      const amount = i * 10 + 0.5;
      seedPending({
        amount,
        status: pending ? 'pending' : 'verified',
        paymentDate: new Date(Date.UTC(2026, 2, i)),
        familyId: i <= 15 ? world.ids.familyA : undefined,
        memberId: i <= 15 ? undefined : world.ids.memberA1,
      });
      expected.total += amount;
      if (pending) expected.pending += amount;
      else expected.verified += amount;
    }
    // another Mahallu's rows must never be counted
    for (let i = 0; i < 5; i++) {
      world.stores.varisangya.insert({ _id: oid(), tenantId: world.ids.tenantB, familyId: world.ids.familyB, amount: 9999, paymentDate: date, status: 'verified' });
    }
    return expected;
  };

  test('summary on a 10-row page equals the sum across ALL pages', async () => {
    const expected = seedMany();
    const pages = [];
    for (const page of [1, 2, 3]) {
      pages.push(await call(getAllVarisangyas, { ...world.asAdmin(), query: { page: String(page), limit: '10' } }));
    }
    assert.deepEqual(pages.map((p) => p.body.data.length), [10, 10, 5]);
    const pageSum = pages.reduce((s, p) => s + p.body.data.reduce((a: number, r: any) => a + r.amount, 0), 0);
    for (const p of pages) {
      assert.equal(p.body.summary.count, 25);
      assert.equal(p.body.summary.totalAmount, pageSum);
      assert.equal(p.body.summary.totalAmount, expected.total);
      assert.equal(p.body.summary.verifiedAmount, expected.verified);
      assert.equal(p.body.summary.pendingAmount, expected.pending);
      assert.equal(p.body.summary.pendingCount, 6);
      assert.equal(p.body.summary.verifiedCount, 19);
      assert.equal(p.body.pagination.total, 25);
    }
  });

  test('the summary uses the same filters as the list (family only, member only, date range)', async () => {
    seedMany();
    const sumOf = (rows: any[]) => rows.reduce((a, r) => a + r.amount, 0);
    const family = await call(getAllVarisangyas, { ...world.asAdmin(), query: { hasFamily: 'true', limit: '100' } });
    assert.equal(family.body.summary.count, 15);
    assert.equal(family.body.summary.totalAmount, sumOf(family.body.data));

    const member = await call(getAllVarisangyas, { ...world.asAdmin(), query: { hasMember: 'true', limit: '100' } });
    assert.equal(member.body.summary.count, 10);

    const ranged = await call(getAllVarisangyas, { ...world.asAdmin(), query: { dateFrom: '2026-03-01', dateTo: '2026-03-05', limit: '100' } });
    assert.equal(ranged.body.summary.count, 5);
    assert.equal(ranged.body.summary.totalAmount, sumOf(ranged.body.data));
  });

  test('a specific family filter is validated and scoped', async () => {
    seedMany();
    const bad = await call(getAllVarisangyas, { ...world.asAdmin(), query: { familyId: '{"$ne":null}' } });
    assert.equal(bad.status, 400);
    const other = await call(getAllVarisangyas, { ...world.asAdmin(), query: { familyId: String(world.ids.familyB) } });
    assert.equal(other.body.pagination.total, 0, "another Mahallu's family yields nothing");
    assert.equal(other.body.summary.totalAmount, 0);
  });

  test('a non-super user with no Mahallu is refused (403), never given an unscoped list', async () => {
    seedMany();
    const reply = await call(getAllVarisangyas, { user: { role: 'mahall' }, query: {} });
    assert.equal(reply.status, 403);
  });

  test('GET /collectibles/summary returns both collections in one call', async () => {
    const expected = seedMany();
    world.stores.zakat.insert({ _id: oid(), tenantId: world.ids.tenantA, payerName: 'A Payer', amount: 1000, paymentDate: date, status: 'verified' });
    world.stores.zakat.insert({ _id: oid(), tenantId: world.ids.tenantA, payerName: 'B Payer', amount: 40, paymentDate: date, status: 'pending' });
    const reply = await call(getCollectionsSummary, { ...world.asAdmin(), query: {} });
    assert.equal(reply.status, 200);
    const { varisangya, zakat, totals } = reply.body.data;
    assert.equal(varisangya.count, 25);
    assert.equal(varisangya.totalAmount, expected.total);
    assert.equal(zakat.count, 2);
    assert.equal(zakat.totalAmount, 1040);
    assert.equal(zakat.verifiedAmount, 1000);
    assert.equal(totals.count, 27);
    assert.equal(totals.totalAmount, expected.total + 1040);
  });
});

describe('reject: a pending payment that was never received', () => {
  const reject = (id: any, body: any = {}, as = world.asAdmin()) =>
    call(rejectVarisangya, { ...as, params: { id: String(id) }, body });

  test('pending -> rejected with a reason: no receipt number, no wallet / journal / ledger', async () => {
    const row = seedPending();
    const reply = await reject(row._id, { rejectionReason: 'Not received' });
    assert.equal(reply.status, 200);
    const stored = rowOf(row._id);
    assert.equal(stored.status, 'rejected');
    assert.equal(stored.rejectionReason, 'Not received');
    assert.equal(String(stored.rejectedBy), String(world.ids.adminA));
    assert.ok(stored.rejectedAt instanceof Date);
    assert.equal(stored.receiptNo, undefined);
    noEffects();
  });

  test('a rejected payment cannot be verified, rejected again, or edited (409); a verified one cannot be rejected', async () => {
    const row = seedPending();
    assert.equal((await reject(row._id)).status, 200);
    assert.equal((await verify(row._id)).status, 409);
    assert.equal((await reject(row._id)).status, 409);
    const edit = await call(updateVarisangya, { ...world.asAdmin(), params: { id: String(row._id) }, body: { amount: 900 } });
    assert.equal(edit.status, 409);
    noEffects();

    const other = seedPending();
    assert.equal((await verify(other._id)).status, 200);
    assert.equal((await reject(other._id)).status, 409);
    assert.equal(rowOf(other._id).status, 'verified');
  });

  test("another Mahallu's payment is 404; deleting a rejected payment reverses nothing", async () => {
    const row = seedPending();
    assert.equal((await reject(row._id, {}, world.asAdminB())).status, 404);
    assert.equal((await reject(row._id)).status, 200);
    const del = await call(deleteVarisangya, { ...world.asAdmin(), params: { id: String(row._id) } });
    assert.equal(del.status, 200);
    noEffects();
  });

  test('rejected money counts nowhere: not in verified totals, dues, or the member summary; status is returned', async () => {
    const thisYear = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const row = seedPending({ amount: 700, paymentDate: thisYear });
    await reject(row._id);

    const list = await call(getAllVarisangyas, { ...world.asAdmin(), query: {} });
    assert.equal(list.body.data[0].status, 'rejected');
    assert.equal(list.body.summary.verifiedAmount, 0);

    const tenantInstall = installFake(Tenant, [{ _id: world.ids.tenantA, settings: { varisangyaAmount: 100 } }]);
    const valuesInstall = installFake(MasterCategoryValue, []);
    try {
      const dues = await computeFamilyDues(world.ids.tenantA);
      assert.equal(dues.find((d) => d.familyId === String(world.ids.familyA))!.paidAmount, 0);
    } finally {
      tenantInstall.restore();
      valuesInstall.restore();
    }

    const own = await call(getOwnPayments, { user: { role: 'user', memberId: world.ids.memberA1 }, query: {} });
    assert.equal(own.body.data[0].status, 'rejected');

    const mine = await call(getOwnVarisangya, { user: { role: 'user', memberId: world.ids.memberA1 }, query: {} });
    assert.equal(mine.body.data.memberVarisangya[0].status, 'rejected');
    assert.equal(mine.body.data.summary.memberTotal, 0);
  });
});
});
