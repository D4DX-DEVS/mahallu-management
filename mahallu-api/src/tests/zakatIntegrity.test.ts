import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createZakat,
  updateZakat,
  deleteZakat,
  verifyZakat,
  getAllZakats,
} from '../controllers/collectibleController';
import {
  createDistribution,
  updateDistribution,
  deleteDistribution,
  getZakatSummary,
  getAllDistributions,
} from '../controllers/zakatDistributionController';
import { requestZakatPayment } from '../controllers/memberUserController';
import { updateZakatValidation, createZakatValidation } from '../validations/collectibleValidation';
import { validationResult } from 'express-validator';
import { call, oid } from './support/fakeMongo';
import { makeWorld, World } from './support/collectiblesWorld';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] zakatIntegrity', () => {

/**
 * Zakat collections and distributions: whitelisted updates, verified-only ledger effects, atomic
 * verification, and distributions that post / reverse their ledger entry with the row.
 */

let world: World;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => world.restore());

const date = new Date('2026-03-01T00:00:00.000Z');

const seedZakat = (over: Record<string, any> = {}) => {
  const row = {
    _id: oid(),
    tenantId: world.ids.tenantA,
    payerName: 'Seeded Payer',
    payerId: world.ids.memberA1,
    amount: 1000,
    paymentDate: date,
    status: 'pending',
    source: 'member',
    ...over,
  };
  world.stores.zakat.insert(row);
  return row;
};
const zakatRow = (id: any) => world.stores.zakat.docs.find((d) => String(d._id) === String(id));
const createVerified = async (amount = 1000) => {
  const reply = await call(createZakat, {
    ...world.asAdmin(),
    body: { payerName: 'Admin Entered', amount, paymentDate: '2026-03-02' },
  });
  assert.equal(reply.status, 201);
  return reply.body.data;
};
const update = (id: any, body: Record<string, any>, as = world.asAdmin()) =>
  call(updateZakat, { ...as, params: { id: String(id) }, body });

describe('updateZakat only changes whitelisted fields', () => {
  test('status, receiptNo, source, payerId, verifiedBy and tenantId in the body are ignored', async () => {
    const row = seedZakat();
    const stranger = String(oid());
    const reply = await update(row._id, {
      payerName: 'Renamed Payer',
      remarks: 'note',
      status: 'verified',
      receiptNo: 'HACK-1',
      source: 'admin',
      payerId: stranger,
      verifiedBy: stranger,
      tenantId: String(world.ids.tenantB),
      createdBy: stranger,
    });
    assert.equal(reply.status, 200);
    const stored = zakatRow(row._id);
    assert.equal(stored.payerName, 'Renamed Payer');
    assert.equal(stored.remarks, 'note');
    assert.equal(stored.status, 'pending', 'verification only happens through verify');
    assert.equal(stored.receiptNo, undefined);
    assert.equal(stored.source, 'member');
    assert.equal(String(stored.payerId), String(world.ids.memberA1));
    assert.equal(stored.verifiedBy, undefined);
    assert.equal(String(stored.tenantId), String(world.ids.tenantA));
    // and, being pending, no ledger effect
    assert.equal(world.stores.ledgerItem.docs.length, 0);
    assert.equal(world.accountABalance(), 0);
  });

  test('setting status:verified through update does not bypass verification', async () => {
    const row = seedZakat();
    await update(row._id, { status: 'verified' });
    assert.equal(zakatRow(row._id).status, 'pending');
    assert.deepEqual(world.stores.ledgerItem.log, []);
  });

  test('amount must be greater than zero: 0, negative and junk are rejected, and nothing changes', async () => {
    const payment = await createVerified(1000);
    for (const amount of [0, -1, '0', 'abc', null, 1e21, 10.999]) {
      const reply = await update(payment._id, { amount });
      assert.equal(reply.status, 400, String(amount));
    }
    assert.equal(zakatRow(payment._id).amount, 1000);
    assert.equal(world.stores.ledgerItem.docs[0].amount, 1000);
    assert.equal(world.accountABalance(), 1000);
  });

  test('a verified payment: any real amount change re-posts the ledger and the bank balance (including very small ones)', async () => {
    const payment = await createVerified(1000);
    assert.equal((await update(payment._id, { amount: 0.5 })).status, 200);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.stores.ledgerItem.docs[0].amount, 0.5);
    assert.equal(world.accountABalance(), 0.5);

    assert.equal((await update(payment._id, { amount: '1200.25' })).status, 200);
    assert.equal(world.stores.ledgerItem.docs[0].amount, 1200.25);
    assert.equal(world.accountABalance(), 1200.25);
  });

  test('a verified payment: changing the date or payer name also refreshes the ledger entry', async () => {
    const payment = await createVerified(500);
    await update(payment._id, { paymentDate: '2026-04-15', payerName: 'New Name' });
    const entry = world.stores.ledgerItem.docs[0];
    assert.match(entry.description, /New Name/);
    assert.equal(new Date(entry.date).toISOString().slice(0, 10), '2026-04-15');
    assert.equal(world.accountABalance(), 500);
  });

  test('a note-only edit of a verified payment does not touch the ledger', async () => {
    const payment = await createVerified(500);
    world.stores.ledgerItem.log.length = 0;
    await update(payment._id, { remarks: 'only a note' });
    assert.deepEqual(world.stores.ledgerItem.log, []);
    assert.equal(zakatRow(payment._id).remarks, 'only a note');
  });

  test('an unchanged amount is a no-op, not a re-post', async () => {
    const payment = await createVerified(500);
    world.stores.ledgerItem.log.length = 0;
    assert.equal((await update(payment._id, { amount: 500 })).status, 200);
    assert.deepEqual(world.stores.ledgerItem.log, []);
  });

  test('a ledger failure during an edit restores the amount and the old entry', async () => {
    const payment = await createVerified(500);
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', new Error('ledger unavailable'));
    const reply = await update(payment._id, { amount: 300 });
    assert.equal(reply.status, 500);
    assert.equal(zakatRow(payment._id).amount, 500);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.stores.ledgerItem.docs[0].amount, 500);
    assert.equal(world.accountABalance(), 500);
  });

  test("another Mahallu's payment cannot be edited, and a user with no Mahallu cannot edit at all", async () => {
    const payment = await createVerified(500);
    assert.equal((await update(payment._id, { remarks: 'x' }, world.asAdminB())).status, 404);
    assert.equal((await update(payment._id, { remarks: 'x' }, { user: { role: 'mahall' } } as any)).status, 403);
    assert.equal(zakatRow(payment._id).remarks, undefined);
  });

  const validate = async (chains: any[], req: Record<string, any>) => {
    const full: any = { body: {}, params: {}, query: {}, headers: {}, cookies: {}, ...req };
    for (const chain of chains) await chain.run(full);
    return validationResult(full).array().map((e: any) => `${e.path}: ${e.msg}`);
  };

  test('the update validator rejects a zero / negative / junk amount and a bad id, and accepts a normal edit', async () => {
    const id = String(oid());
    for (const amount of [0, -1, 'abc', '1e3', 10.999]) {
      const errors = await validate(updateZakatValidation, { params: { id }, body: { amount } });
      assert.ok(errors.some((e) => e.startsWith('amount')), `amount ${amount} should be rejected: ${errors}`);
    }
    assert.ok((await validate(updateZakatValidation, { params: { id: 'nope' }, body: {} })).some((e) => e.startsWith('id')));
    assert.deepEqual(await validate(updateZakatValidation, { params: { id }, body: { amount: 12.5, remarks: 'ok', paymentDate: '2026-03-02' } }), []);
  });

  test('the create validator requires payer, amount > 0, date; checks clientRequestId and receiptNo shapes', async () => {
    assert.deepEqual(await validate(createZakatValidation, { body: { payerName: 'Ali K', amount: 5, paymentDate: '2026-03-02', clientRequestId: 'abcdefgh-1234', receiptNo: 'R-1' } }), []);
    const bad = await validate(createZakatValidation, { body: { payerName: '', amount: 0, paymentDate: 'x', clientRequestId: 'short', receiptNo: 'bad receipt' } });
    for (const field of ['payerName', 'amount', 'paymentDate', 'clientRequestId', 'receiptNo']) {
      assert.ok(bad.some((e) => e.startsWith(field)), `${field} should be rejected: ${bad}`);
    }
  });
});

describe('verifyZakat', () => {
  const verify = (id: any, as = world.asAdmin()) => call(verifyZakat, { ...as, params: { id: String(id) } });

  test('20 parallel verifies post the ledger entry and the balance exactly once', async () => {
    const row = seedZakat();
    const replies = await Promise.all(Array.from({ length: 20 }, () => verify(row._id)));
    assert.equal(replies.filter((r) => r.status === 200).length, 1);
    assert.equal(replies.filter((r) => r.status === 409).length, 19);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.accountABalance(), 1000);
    assert.equal(zakatRow(row._id).status, 'verified');
    assert.ok(zakatRow(row._id).receiptNo);
    assert.equal(world.stores.wallet.docs.length, 0, 'zakat has no wallet');
  });

  test('a ledger failure reverts the status, and a retry succeeds once', async () => {
    const row = seedZakat();
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', new Error('ledger unavailable'));
    const reply = await verify(row._id);
    assert.equal(reply.status, 500);
    assert.equal(zakatRow(row._id).status, 'pending');
    assert.equal(world.accountABalance(), 0);
    assert.equal((await verify(row._id)).status, 200);
    assert.equal(world.accountABalance(), 1000);
  });

  test("another Mahallu cannot verify it; verifying a missing one is 404", async () => {
    const row = seedZakat();
    assert.equal((await verify(row._id, world.asAdminB())).status, 404);
    assert.equal((await verify(oid())).status, 404);
    assert.equal(zakatRow(row._id).status, 'pending');
  });

  test('flags the member as a zakat payer after verification', async () => {
    const row = seedZakat();
    await verify(row._id);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    const member = world.stores.member.docs.find((m) => String(m._id) === String(world.ids.memberA1));
    assert.equal(member.isZakatPayer, true);
  });
});

describe('createZakat', () => {
  const body = (extra: Record<string, any> = {}) => ({ payerName: 'Some Payer', amount: 750, paymentDate: '2026-03-02', ...extra });

  test('forces status/source/tenant, and goes through the single verified path', async () => {
    const reply = await call(createZakat, {
      ...world.asAdmin(),
      body: body({ status: 'pending', source: 'member', tenantId: String(world.ids.tenantB), verifiedBy: String(oid()) }),
    });
    assert.equal(reply.status, 201);
    const row = world.stores.zakat.docs[0];
    assert.equal(row.status, 'verified');
    assert.equal(row.source, 'admin');
    assert.equal(String(row.tenantId), String(world.ids.tenantA));
    assert.equal(String(row.verifiedBy), String(world.ids.adminA));
    assert.equal(world.accountABalance(), 750);
  });

  test('a payer of another Mahallu is refused', async () => {
    const reply = await call(createZakat, { ...world.asAdmin(), body: body({ payerId: String(world.ids.memberB1) }) });
    assert.equal(reply.status, 400);
    assert.equal(world.stores.zakat.docs.length, 0);
  });

  test('clientRequestId makes a double submit one payment and one ledger entry', async () => {
    const send = () => call(createZakat, { ...world.asAdmin(), body: body({ clientRequestId: 'zakat-req-000001' }) });
    const [a, b] = [await send(), await send()];
    assert.equal(a.status, 201);
    assert.equal(b.status, 200);
    assert.equal(b.body.idempotent, true);
    assert.equal(world.stores.zakat.docs.length, 1);
    assert.equal(world.accountABalance(), 750);
  });

  test('a ledger failure leaves no row behind', async () => {
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', new Error('ledger unavailable'));
    const reply = await call(createZakat, { ...world.asAdmin(), body: body() });
    assert.equal(reply.status, 500);
    assert.equal(world.stores.zakat.docs.length, 0);
    assert.equal(world.accountABalance(), 0);
  });

  test('payerName and amount are validated', async () => {
    assert.equal((await call(createZakat, { ...world.asAdmin(), body: body({ payerName: ' ' }) })).status, 400);
    assert.equal((await call(createZakat, { ...world.asAdmin(), body: body({ amount: 0 }) })).status, 400);
  });
});

describe('deleteZakat', () => {
  test('deleting a verified payment reverses its ledger entry and the bank balance', async () => {
    const payment = await createVerified(800);
    assert.equal(world.accountABalance(), 800);
    const reply = await call(deleteZakat, { ...world.asAdmin(), params: { id: String(payment._id) } });
    assert.equal(reply.status, 200);
    assert.equal(world.stores.ledgerItem.docs.length, 0);
    assert.equal(world.accountABalance(), 0);
    assert.equal(world.stores.zakat.docs.length, 0);
  });

  test('deleting a pending payment touches no ledger', async () => {
    const row = seedZakat();
    const reply = await call(deleteZakat, { ...world.asAdmin(), params: { id: String(row._id) } });
    assert.equal(reply.status, 200);
    assert.deepEqual(world.stores.ledgerItem.log, []);
    assert.equal(world.stores.zakat.docs.length, 0);
  });

  test('a ledger failure during a delete puts the payment back', async () => {
    const payment = await createVerified(800);
    world.stores.mahalluAccount.failOn('MahalluAccount.findOneAndUpdate', new Error('account update failed'));
    const reply = await call(deleteZakat, { ...world.asAdmin(), params: { id: String(payment._id) } });
    assert.equal(reply.status, 500);
    assert.ok(zakatRow(payment._id), 'row restored');
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.accountABalance(), 800);
  });
});

describe('member zakat submission', () => {
  test('is forced pending, whitelisted, idempotent by clientRequestId', async () => {
    const asMember = { user: { role: 'user', memberId: world.ids.memberA1 } };
    const body = { amount: 300, paymentDate: '2026-03-02', status: 'verified', receiptNo: '5', source: 'admin', payerName: 'Spoofed', clientRequestId: 'phone-zakat-0001' };
    const first = await call(requestZakatPayment, { ...asMember, body });
    const second = await call(requestZakatPayment, { ...asMember, body });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(world.stores.zakat.docs.length, 1);
    const row = world.stores.zakat.docs[0];
    assert.equal(row.status, 'pending');
    assert.equal(row.source, 'member');
    assert.equal(row.receiptNo, undefined);
    assert.equal(row.payerName, 'Member One', 'the payer is the logged-in member, not what the body says');
    assert.equal(world.accountABalance(), 0);
  });
});

describe('zakat summary counts only VERIFIED collections', () => {
  test('pending submissions are reported separately and excluded from collected; older rows without a status count', async () => {
    const year = new Date().getFullYear();
    const when = new Date(year, 2, 10);
    seedZakat({ amount: 1000, status: 'verified', paymentDate: when });
    seedZakat({ amount: 500, status: undefined, paymentDate: when }); // predates the status field
    seedZakat({ amount: 9000, status: 'pending', paymentDate: when });
    world.stores.zakat.insert({ _id: oid(), tenantId: world.ids.tenantB, payerName: 'Other', amount: 7777, paymentDate: when, status: 'verified' });
    world.stores.distribution.insert({ _id: oid(), tenantId: world.ids.tenantA, beneficiaryId: oid(), amount: 400, distributionDate: when, type: 'regular' });

    const reply = await call(getZakatSummary, { ...world.asAdmin(), query: {} });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.data.collected, 1500);
    assert.equal(reply.body.data.collectionCount, 2);
    assert.equal(reply.body.data.pendingCollected, 9000);
    assert.equal(reply.body.data.pendingCollectionCount, 1);
    assert.equal(reply.body.data.distributed, 400);
    assert.equal(reply.body.data.balance, 1100);
  });

  test('a user with no Mahallu is refused', async () => {
    assert.equal((await call(getZakatSummary, { user: { role: 'mahall' }, query: {} })).status, 403);
  });
});

describe('zakat list summary', () => {
  test('covers the whole filtered set, not the 10-row page', async () => {
    let total = 0;
    for (let i = 1; i <= 23; i++) {
      seedZakat({ amount: i * 100, status: i % 5 === 0 ? 'pending' : 'verified', paymentDate: new Date(Date.UTC(2026, 1, i)) });
      total += i * 100;
    }
    world.stores.zakat.insert({ _id: oid(), tenantId: world.ids.tenantB, payerName: 'Other', amount: 99999, paymentDate: date, status: 'verified' });
    const page1 = await call(getAllZakats, { ...world.asAdmin(), query: { limit: '10' } });
    const page3 = await call(getAllZakats, { ...world.asAdmin(), query: { limit: '10', page: '3' } });
    assert.equal(page1.body.data.length, 10);
    assert.equal(page3.body.data.length, 3);
    assert.equal(page1.body.summary.totalAmount, total);
    assert.equal(page3.body.summary.totalAmount, total);
    assert.equal(page1.body.summary.count, 23);
    assert.equal(page1.body.summary.pendingCount, 4);
    assert.equal(page1.body.summary.verifiedAmount + page1.body.summary.pendingAmount, total);
  });

  test('respects the search filter in the summary too', async () => {
    seedZakat({ payerName: 'Aisha K', amount: 10, status: 'verified' });
    seedZakat({ payerName: 'Bilal M', amount: 20, status: 'verified' });
    const reply = await call(getAllZakats, { ...world.asAdmin(), query: { search: 'Aisha' } });
    assert.equal(reply.body.summary.count, 1);
    assert.equal(reply.body.summary.totalAmount, 10);
  });
});

describe('distributions', () => {
  const seedBeneficiary = (over: Record<string, any> = {}) => {
    const b = { _id: oid(), tenantId: world.ids.tenantA, name: 'Needy Person', verificationStatus: 'verified', status: 'active', ...over };
    world.stores.beneficiary.insert(b);
    return b;
  };
  const distribute = (beneficiary: any, extra: Record<string, any> = {}, as = world.asAdmin()) =>
    call(createDistribution, {
      ...as,
      body: { beneficiaryId: String(beneficiary._id), amount: 400, distributionDate: '2026-03-05', type: 'regular', postToLedger: true, ...extra },
    });

  test('with postToLedger the row and its expense entry are written together', async () => {
    const b = seedBeneficiary();
    await call(createZakat, { ...world.asAdmin(), body: { payerName: 'Donor', amount: 1000, paymentDate: '2026-03-02' } });
    const reply = await distribute(b);
    assert.equal(reply.status, 201);
    assert.equal(world.stores.distribution.docs.length, 1);
    const entry = world.stores.ledgerItem.docs.find((i) => i.source === 'zakat_distribution');
    assert.equal(entry.type, 'expense');
    assert.equal(world.accountABalance(), 600);
  });

  test('a ledger failure leaves NO row behind, so a retry cannot duplicate it', async () => {
    const b = seedBeneficiary();
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', new Error('ledger unavailable'));
    const failed = await distribute(b);
    assert.equal(failed.status, 500);
    assert.equal(world.stores.distribution.docs.length, 0);
    const retry = await distribute(b);
    assert.equal(retry.status, 201);
    assert.equal(world.stores.distribution.docs.length, 1);
    assert.equal(world.accountABalance(), -400);
  });

  test('clientRequestId: a double submit creates one distribution and one expense', async () => {
    const b = seedBeneficiary();
    const send = () => distribute(b, { clientRequestId: 'dist-req-000001' });
    const replies = await Promise.all([send(), send(), send(), send()]);
    assert.ok(replies.every((r) => r.status === 201 || r.status === 200));
    assert.equal(replies.filter((r) => r.status === 201).length, 1);
    assert.equal(world.stores.distribution.docs.length, 1);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.accountABalance(), -400);
    const again = await send();
    assert.equal(again.status, 200);
    assert.equal(again.body.idempotent, true);
  });

  test('a retry finishes a distribution that was saved but never posted', async () => {
    const b = seedBeneficiary();
    world.stores.distribution.insert({
      _id: oid(), tenantId: world.ids.tenantA, beneficiaryId: b._id, amount: 400, distributionDate: new Date('2026-03-05'),
      type: 'regular', postToLedger: true, clientRequestId: 'dist-req-000002',
    });
    const reply = await distribute(b, { clientRequestId: 'dist-req-000002' });
    assert.equal(reply.status, 200);
    assert.equal(world.stores.distribution.docs.length, 1);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.accountABalance(), -400);
  });

  test('the same id for a different distribution is refused', async () => {
    const b = seedBeneficiary();
    await distribute(b, { clientRequestId: 'dist-req-000003' });
    const reply = await distribute(b, { clientRequestId: 'dist-req-000003', amount: 999 });
    assert.equal(reply.status, 409);
  });

  test('only a verified beneficiary of the same Mahallu, with a positive amount, is accepted', async () => {
    const pending = seedBeneficiary({ verificationStatus: 'pending' });
    const foreign = seedBeneficiary({ tenantId: world.ids.tenantB });
    const verified = seedBeneficiary();
    assert.equal((await distribute(pending)).status, 400);
    assert.equal((await distribute(foreign)).status, 400);
    assert.equal((await distribute(verified, { amount: 0 })).status, 400);
    assert.equal((await distribute(verified, { amount: -5 })).status, 400);
    assert.equal((await distribute(verified, { type: 'bogus' })).status, 400);
    assert.equal((await distribute(verified, { beneficiaryId: '$ne' })).status, 400);
    assert.equal(world.stores.distribution.docs.length, 0);
  });

  test('the client cannot choose tenant, creator or id', async () => {
    const b = seedBeneficiary();
    const stranger = String(oid());
    await distribute(b, { tenantId: String(world.ids.tenantB), createdBy: stranger, _id: stranger }, world.asAdmin({ user: { _id: world.ids.adminA, role: 'mahall' } }));
    const row = world.stores.distribution.docs[0];
    assert.equal(String(row.tenantId), String(world.ids.tenantA));
    assert.notEqual(String(row._id), stranger);
    assert.equal(String(row.createdBy), String(world.ids.adminA));
  });

  test('without postToLedger no ledger entry is written', async () => {
    const b = seedBeneficiary();
    const reply = await distribute(b, { postToLedger: false });
    assert.equal(reply.status, 201);
    assert.equal(world.stores.ledgerItem.docs.length, 0);
  });

  test('editing the amount of a POSTED distribution replaces the ledger entry and fixes the balance', async () => {
    const b = seedBeneficiary();
    const created = (await distribute(b)).body.data;
    assert.equal(world.accountABalance(), -400);
    const reply = await call(updateDistribution, {
      ...world.asAdmin(),
      params: { id: String(created._id) },
      body: { amount: 250, distributionDate: '2026-03-09', postToLedger: false, beneficiaryId: String(oid()), tenantId: String(world.ids.tenantB) },
    });
    assert.equal(reply.status, 200);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.stores.ledgerItem.docs[0].amount, 250);
    assert.equal(world.accountABalance(), -250);
    const stored = world.stores.distribution.docs[0];
    assert.equal(stored.amount, 250);
    assert.equal(stored.postToLedger, true, 'postToLedger cannot be flipped by an edit');
    assert.equal(String(stored.beneficiaryId), String(b._id));
    assert.equal(String(stored.tenantId), String(world.ids.tenantA));
  });

  test('a failure while replacing the ledger entry restores the amount and the old entry', async () => {
    const b = seedBeneficiary();
    const created = (await distribute(b)).body.data;
    world.stores.ledgerItem.failOn('LedgerItem.findOneAndUpdate', new Error('ledger unavailable'));
    const reply = await call(updateDistribution, { ...world.asAdmin(), params: { id: String(created._id) }, body: { amount: 250 } });
    assert.equal(reply.status, 500);
    assert.equal(world.stores.distribution.docs[0].amount, 400);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.stores.ledgerItem.docs[0].amount, 400);
    assert.equal(world.accountABalance(), -400);
  });

  test('editing an unposted distribution is a plain update with no ledger activity', async () => {
    const b = seedBeneficiary();
    const created = (await distribute(b, { postToLedger: false })).body.data;
    const reply = await call(updateDistribution, { ...world.asAdmin(), params: { id: String(created._id) }, body: { amount: 123, remarks: 'r' } });
    assert.equal(reply.status, 200);
    assert.equal(world.stores.distribution.docs[0].amount, 123);
    assert.deepEqual(world.stores.ledgerItem.log, []);
  });

  test('an amount of zero or less is refused on edit', async () => {
    const b = seedBeneficiary();
    const created = (await distribute(b)).body.data;
    for (const amount of [0, -3, 'x']) {
      const reply = await call(updateDistribution, { ...world.asAdmin(), params: { id: String(created._id) }, body: { amount } });
      assert.equal(reply.status, 400);
    }
    assert.equal(world.stores.distribution.docs[0].amount, 400);
  });

  test('deleting a posted distribution reverses the expense entry and gives the bank balance back', async () => {
    const b = seedBeneficiary();
    const created = (await distribute(b)).body.data;
    assert.equal(world.accountABalance(), -400);
    const reply = await call(deleteDistribution, { ...world.asAdmin(), params: { id: String(created._id) } });
    assert.equal(reply.status, 200);
    assert.equal(world.stores.distribution.docs.length, 0);
    assert.equal(world.stores.ledgerItem.docs.length, 0);
    assert.equal(world.accountABalance(), 0);
  });

  test('a failed reversal puts the distribution back (no expense left without its row)', async () => {
    const b = seedBeneficiary();
    const created = (await distribute(b)).body.data;
    world.stores.mahalluAccount.failOn('MahalluAccount.findOneAndUpdate', new Error('account update failed'));
    const reply = await call(deleteDistribution, { ...world.asAdmin(), params: { id: String(created._id) } });
    assert.equal(reply.status, 500);
    assert.equal(world.stores.distribution.docs.length, 1);
    assert.equal(world.stores.ledgerItem.docs.length, 1);
    assert.equal(world.accountABalance(), -400);
  });

  test('two deletes at once reverse once', async () => {
    const b = seedBeneficiary();
    const created = (await distribute(b)).body.data;
    const replies = await Promise.all([
      call(deleteDistribution, { ...world.asAdmin(), params: { id: String(created._id) } }),
      call(deleteDistribution, { ...world.asAdmin(), params: { id: String(created._id) } }),
    ]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [200, 404]);
    assert.equal(world.accountABalance(), 0);
  });

  test("another Mahallu's distribution can be neither edited nor deleted; a user with no Mahallu is refused", async () => {
    const b = seedBeneficiary();
    const created = (await distribute(b)).body.data;
    assert.equal((await call(updateDistribution, { ...world.asAdminB(), params: { id: String(created._id) }, body: { amount: 1 } })).status, 404);
    assert.equal((await call(deleteDistribution, { ...world.asAdminB(), params: { id: String(created._id) } })).status, 404);
    assert.equal((await call(deleteDistribution, { user: { role: 'mahall' }, params: { id: String(created._id) } })).status, 403);
    assert.equal((await call(getAllDistributions, { user: { role: 'mahall' }, query: {} })).status, 403);
    assert.equal(world.stores.distribution.docs.length, 1);
  });
});
});
