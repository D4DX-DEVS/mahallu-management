import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Varisangya, Zakat } from '../models/Collectible';
import { createVarisangya, createZakat, getNextReceiptNumber, verifyVarisangya } from '../controllers/collectibleController';
import {
  RECEIPT_START,
  SAFE_NUMERIC_RECEIPT,
  CLIENT_RECEIPT_PATTERN,
  allocateReceiptNo,
  peekNextReceiptNo,
  seedReceiptNumber,
  receiptCounterKey,
} from '../services/receiptNumberService';
import { call, oid } from './support/fakeMongo';
import { makeWorld, World } from './support/collectiblesWorld';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] receiptNumbers', () => {

/**
 * Receipt numbers: atomic per-tenant sequence, safe seeding, uniqueness, validated client numbers.
 */

let world: World;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => world.restore());

const pay = (body: Record<string, any> = {}, as = world.asAdmin()) =>
  call(createVarisangya, {
    ...as,
    body: { memberId: String(world.ids.memberA1), amount: 10, paymentDate: '2026-03-02', ...body },
  });

const receipts = () => world.stores.varisangya.docs.map((d) => d.receiptNo);

describe('auto numbering', () => {
  test('parallel creates get distinct, consecutive receipt numbers starting after 14000', async () => {
    const replies = await Promise.all(Array.from({ length: 30 }, () => pay()));
    assert.ok(replies.every((r) => r.status === 201));
    const numbers = receipts().map(Number).sort((a, b) => a - b);
    assert.equal(new Set(numbers).size, 30, 'no duplicates');
    assert.deepEqual(numbers, Array.from({ length: 30 }, (_, i) => RECEIPT_START + 1 + i));
  });

  test('varisangya and zakat have separate sequences per Mahallu (as before), and Mahallus are independent', async () => {
    await pay();
    await call(createZakat, { ...world.asAdmin(), body: { payerName: 'Some Payer', amount: 50, paymentDate: '2026-03-02' } });
    await pay({ memberId: String(world.ids.memberB1) }, world.asAdminB());
    assert.deepEqual(receipts().sort(), ['14001', '14001']);
    assert.equal(world.stores.zakat.docs[0].receiptNo, '14001');
    assert.equal(world.stores.counter.docs.length, 3);
    assert.ok(world.stores.counter.docs.some((c) => c._id === receiptCounterKey('varisangya', world.ids.tenantA)));
  });

  test('numbering is seeded from the highest existing plain numeric receipt', async () => {
    world.stores.varisangya.insert({ _id: oid(), tenantId: world.ids.tenantA, amount: 1, paymentDate: new Date(), receiptNo: '15000', status: 'verified' });
    world.stores.varisangya.insert({ _id: oid(), tenantId: world.ids.tenantA, amount: 1, paymentDate: new Date(), receiptNo: '14500', status: 'verified' });
    world.stores.varisangya.insert({ _id: oid(), tenantId: world.ids.tenantB, amount: 1, paymentDate: new Date(), receiptNo: '99000', status: 'verified' }); // other Mahallu
    assert.equal((await pay()).body.data.receiptNo, '15001');
    assert.equal((await pay()).body.data.receiptNo, '15002');
  });

  test('a huge digit string or a text receipt cannot break numbering ($toInt overflow)', async () => {
    const base = { tenantId: world.ids.tenantA, amount: 1, paymentDate: new Date(), status: 'verified' };
    world.stores.varisangya.insert({ _id: oid(), ...base, receiptNo: '99999999999' });
    world.stores.varisangya.insert({ _id: oid(), ...base, receiptNo: '12345678901234567890' });
    world.stores.varisangya.insert({ _id: oid(), ...base, receiptNo: 'REC-77' });
    world.stores.varisangya.insert({ _id: oid(), ...base, receiptNo: '14200' });
    assert.equal(await seedReceiptNumber(Varisangya as any, world.ids.tenantA), 14200);
    const reply = await pay();
    assert.equal(reply.status, 201);
    assert.equal(reply.body.data.receiptNo, '14201');
  });

  test('only 1-9 digit strings are considered for seeding', () => {
    for (const ok of ['1', '14001', '999999999', '000123']) assert.ok(SAFE_NUMERIC_RECEIPT.test(ok), ok);
    for (const bad of ['1000000000', '99999999999', '12a', '', ' 12', '1.5', '-5']) assert.ok(!SAFE_NUMERIC_RECEIPT.test(bad), bad);
  });

  test('a number that is already used is skipped, never reissued', async () => {
    // counter row exists at 14000 but number 14001 was saved by something that bypassed the counter
    world.stores.counter.insert({ _id: receiptCounterKey('varisangya', world.ids.tenantA), seq: 14000 });
    world.stores.varisangya.insert({ _id: oid(), tenantId: world.ids.tenantA, amount: 1, paymentDate: new Date(), receiptNo: '14001', status: 'verified' });
    world.stores.varisangya.insert({ _id: oid(), tenantId: world.ids.tenantA, amount: 1, paymentDate: new Date(), receiptNo: '14002', status: 'verified' });
    const reply = await pay();
    assert.equal(reply.body.data.receiptNo, '14003');
  });

  test('the counter never goes backwards: deleting the latest payment does not reissue its number', async () => {
    const first = await pay();
    assert.equal(first.body.data.receiptNo, '14001');
    world.stores.varisangya.docs.length = 0;
    assert.equal((await pay()).body.data.receiptNo, '14002');
  });

  test('a collision reported by the unique index takes the next number and still succeeds', async () => {
    const dup = Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyPattern: { tenantId: 1, receiptNo: 1 } });
    world.stores.varisangya.failOn('Varisangya.create', dup);
    const reply = await pay();
    assert.equal(reply.status, 201);
    assert.equal(reply.body.data.receiptNo, '14002');
    assert.equal(world.stores.varisangya.docs.length, 1);
    assert.equal(world.stores.wallet.docs[0].balance, 10, 'credited once');
  });

  test('allocateReceiptNo gives out unique numbers under heavy concurrency', async () => {
    const got = await Promise.all(Array.from({ length: 50 }, () => allocateReceiptNo('zakat', Zakat as any, world.ids.tenantA)));
    assert.equal(new Set(got).size, 50);
  });
});

describe('the "next number" preview', () => {
  test('is informational: it does not consume a number', async () => {
    const first = await call(getNextReceiptNumber, { ...world.asAdmin(), query: { type: 'varisangya' } });
    const again = await call(getNextReceiptNumber, { ...world.asAdmin(), query: { type: 'varisangya' } });
    assert.equal(first.body.data.receiptNo, '14001');
    assert.equal(again.body.data.receiptNo, '14001');
    assert.equal((await pay()).body.data.receiptNo, '14001');
    const after = await call(getNextReceiptNumber, { ...world.asAdmin(), query: { type: 'varisangya' } });
    assert.equal(after.body.data.receiptNo, '14002');
  });

  test('needs a Mahallu and a valid type', async () => {
    assert.equal((await call(getNextReceiptNumber, { isSuperAdmin: true, user: { role: 'super_admin' }, query: { type: 'varisangya' } })).status, 400);
    assert.equal((await call(getNextReceiptNumber, { ...world.asAdmin(), query: { type: 'other' } })).status, 400);
    assert.equal((await call(getNextReceiptNumber, { user: { role: 'mahall' }, query: { type: 'zakat' } })).status, 403);
    assert.equal(await peekNextReceiptNo('zakat', Zakat as any, world.ids.tenantA), '14001');
  });
});

describe('client-supplied receipt numbers', () => {
  test('are accepted when free, and stored as given', async () => {
    const reply = await pay({ receiptNo: 'MANUAL/2026-7' });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.data.receiptNo, 'MANUAL/2026-7');
    assert.equal(world.stores.counter.docs.length, 0, 'the auto sequence is not consumed');
  });

  test('are rejected with 409 when the Mahallu already used them', async () => {
    assert.equal((await pay({ receiptNo: 'R-100' })).status, 201);
    const again = await pay({ receiptNo: 'R-100', memberId: String(world.ids.memberA2) });
    assert.equal(again.status, 409);
    assert.equal(world.stores.varisangya.docs.length, 1);
    assert.equal(world.stores.wallet.docs[0].balance, 10, 'no second credit');
  });

  test('the same number is fine in another Mahallu', async () => {
    assert.equal((await pay({ receiptNo: 'R-100' })).status, 201);
    assert.equal((await pay({ receiptNo: 'R-100', memberId: String(world.ids.memberB1) }, world.asAdminB())).status, 201);
  });

  test('a duplicate that arrives at the same moment is refused by the unique index', async () => {
    const replies = await Promise.all([pay({ receiptNo: 'RACE-1' }), pay({ receiptNo: 'RACE-1', memberId: String(world.ids.memberA2) })]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [201, 409]);
    assert.equal(world.stores.varisangya.docs.length, 1);
    assert.equal(world.stores.wallet.docs.reduce((s, w) => s + w.balance, 0), 10);
  });

  test('must look like a receipt number: bad characters, spaces and over-long values are refused', async () => {
    for (const receiptNo of ['has space', 'semi;colon', '$ne', '{"$gt":""}', 'x'.repeat(33), '-leading', '../etc']) {
      const reply = await pay({ receiptNo });
      assert.equal(reply.status, 400, receiptNo);
    }
    assert.equal(world.stores.varisangya.docs.length, 0);
    for (const ok of ['14001', 'A-1', 'REC/2026/001', 'a.b_c']) assert.ok(CLIENT_RECEIPT_PATTERN.test(ok), ok);
  });

  test('a duplicate zakat receipt is refused as well', async () => {
    const body = { payerName: 'Some Payer', amount: 50, paymentDate: '2026-03-02', receiptNo: 'Z-9' };
    assert.equal((await call(createZakat, { ...world.asAdmin(), body })).status, 201);
    assert.equal((await call(createZakat, { ...world.asAdmin(), body })).status, 409);
    assert.equal(world.stores.zakat.docs.length, 1);
  });
});

describe('member submissions get their number when verified', () => {
  test('parallel verifies of different pending payments get distinct numbers', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      const row = { _id: oid(), tenantId: world.ids.tenantA, memberId: world.ids.memberA1, amount: 5, paymentDate: new Date(), status: 'pending', source: 'member' };
      world.stores.varisangya.insert(row);
      ids.push(String(row._id));
    }
    const replies = await Promise.all(ids.map((id) => call(verifyVarisangya, { ...world.asAdmin(), params: { id } })));
    assert.ok(replies.every((r) => r.status === 200));
    const numbers = receipts();
    assert.equal(new Set(numbers).size, 12);
    assert.ok(numbers.every((n) => /^\d+$/.test(n)));
  });

  test('a pending submission has no receipt number until then', () => {
    world.stores.varisangya.insert({ _id: oid(), tenantId: world.ids.tenantA, amount: 5, paymentDate: new Date(), status: 'pending' });
    assert.equal(world.stores.varisangya.docs[0].receiptNo, undefined);
  });
});

describe('unique indexes (declared on the models)', () => {
  const partialUnique = (Model: any, field: string) =>
    (Model.schema.indexes() as any[]).some(
      ([fields, opts]) =>
        fields.tenantId === 1 && fields[field] === 1 && opts.unique === true && opts.partialFilterExpression?.[field]?.$type === 'string'
    );

  test('(tenantId, receiptNo) is unique and partial on both collections', () => {
    assert.ok(partialUnique(Varisangya, 'receiptNo'));
    assert.ok(partialUnique(Zakat, 'receiptNo'));
  });

  test('(tenantId, clientRequestId) is unique and partial on both collections', () => {
    assert.ok(partialUnique(Varisangya, 'clientRequestId'));
    assert.ok(partialUnique(Zakat, 'clientRequestId'));
  });
});
});
