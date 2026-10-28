import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult, ValidationChain } from 'express-validator';
import ReliefCase from '../models/ReliefCase';
import { MarriageAssistance } from '../models/MarriageAssistance';
import Member from '../models/Member';
import Family from '../models/Family';
import * as relief from '../controllers/reliefController';
import * as marriage from '../controllers/marriageAssistanceController';
import {
  createReliefCaseValidation,
  updateReliefCaseValidation,
  createMarriageAssistanceValidation,
  updateMarriageAssistanceValidation,
} from '../validations/moduleValidation';
import { fakeModel, FakeCollection, callHandler, oid, silenceConsoleError } from './fakeMongo';

/**
 * Amount rules agreed for the two forms:
 *  - Emergency relief: a case can be reported without an amount; the amount is recorded later through the
 *    status endpoint, and any amount that is sent is still validated.
 *  - Marriage assistance: the amount is required for financial assistance only.
 */

const TENANT = String(oid());
const MEMBER = oid();
const FAMILY = oid();

const errorsOf = async (chains: ValidationChain[], body: Record<string, any>) => {
  const req: any = { body: { ...body }, params: { id: String(oid()) }, query: {}, headers: {} };
  for (const chain of chains) await chain.run(req);
  return validationResult(req)
    .array()
    .map((e: any) => ({ path: e.path, msg: e.msg }));
};
const amountErrors = async (chains: ValidationChain[], body: Record<string, any>) =>
  (await errorsOf(chains, body)).filter((e) => e.path === 'amount');

const BASE_RELIEF = { title: 'Roof collapsed', urgency: 'high' };
const BASE_MARRIAGE = { memberId: String(MEMBER) };

describe('Emergency relief: validation', () => {
  test('a report without an amount is accepted (missing, null, blank)', async () => {
    for (const body of [BASE_RELIEF, { ...BASE_RELIEF, amount: undefined }, { ...BASE_RELIEF, amount: null }, { ...BASE_RELIEF, amount: '' }, { ...BASE_RELIEF, amount: '   ' }]) {
      assert.deepEqual(await errorsOf(createReliefCaseValidation, body), [], JSON.stringify(body));
    }
  });

  test('an amount that is sent is still validated', async () => {
    for (const bad of [0, '0', -5, 10.999, 'abc', 100_000_001, true, {}]) {
      assert.equal((await amountErrors(createReliefCaseValidation, { ...BASE_RELIEF, amount: bad })).length > 0, true, JSON.stringify(bad));
    }
    for (const good of [0.01, 1, 1500.5, '250', 100_000_000]) {
      assert.deepEqual(await amountErrors(createReliefCaseValidation, { ...BASE_RELIEF, amount: good }), [], JSON.stringify(good));
    }
  });

  test('the "Report an Emergency Case" form payload is accepted: no amount is part of it', async () => {
    // What ReliefCreate.tsx sends (fields it leaves empty are undefined and never reach the wire).
    const minimal = { title: 'Roof collapsed', urgency: 'medium' };
    const full = { familyId: String(FAMILY), title: 'Roof collapsed', titleMl: 'മേൽക്കൂര', description: 'Heavy rain', urgency: 'critical', followUpDate: '2026-11-15' };
    for (const body of [minimal, full]) assert.deepEqual(await errorsOf(createReliefCaseValidation, body), [], JSON.stringify(body));
  });

  test('the other required fields are still required on create', async () => {
    const paths = (await errorsOf(createReliefCaseValidation, {})).map((e) => e.path);
    assert.ok(paths.includes('title'));
    assert.ok(!paths.includes('amount'));
  });

  test('update behaves as before (amount optional, validated when sent)', async () => {
    assert.deepEqual(await amountErrors(updateReliefCaseValidation, {}), []);
    assert.equal((await amountErrors(updateReliefCaseValidation, { amount: 0 })).length > 0, true);
  });
});

describe('Marriage assistance: validation', () => {
  test('financial assistance requires an amount: missing, null, blank are refused with a message on the amount field', async () => {
    for (const body of [{}, { amount: undefined }, { amount: null }, { amount: '' }, { amount: '  ' }]) {
      const errors = await amountErrors(createMarriageAssistanceValidation, { ...BASE_MARRIAGE, type: 'financial_assistance', ...body });
      assert.deepEqual(errors.map((e) => e.msg), ['Please enter the amount.'], JSON.stringify(body));
    }
  });

  test('financial assistance: invalid amounts are refused, valid ones accepted (above 0 up to the maximum, 2 decimals)', async () => {
    for (const bad of [-1, '-5', 10.999, '10.999', 'abc', '12abc', 100_000_001, 1e21, true, [], {}]) {
      const errors = await amountErrors(createMarriageAssistanceValidation, { ...BASE_MARRIAGE, type: 'financial_assistance', amount: bad });
      assert.ok(errors.length > 0, JSON.stringify(bad));
    }
    for (const good of [0.01, 1, 250, '250.5', 1234.56, 100_000_000]) {
      const errors = await amountErrors(createMarriageAssistanceValidation, { ...BASE_MARRIAGE, type: 'financial_assistance', amount: good });
      assert.deepEqual(errors, [], JSON.stringify(good));
    }
  });

  test('financial assistance: zero is refused (it is the sum paid out), with a message on the amount field', async () => {
    for (const zero of [0, '0', '0.00', 0.0]) {
      const errors = await amountErrors(createMarriageAssistanceValidation, { ...BASE_MARRIAGE, type: 'financial_assistance', amount: zero });
      assert.deepEqual(errors.map((e) => e.msg), ['The amount must be greater than zero.'], JSON.stringify(zero));
    }
    // on an edit that states the type, too; an edit that does not state it is judged by the controller
    const update = await amountErrors(updateMarriageAssistanceValidation, { type: 'financial_assistance', amount: 0 });
    assert.deepEqual(update.map((e) => e.msg), ['The amount must be greater than zero.']);
  });

  for (const type of ['proposal_support', 'premarital_counselling']) {
    test(`${type} can be created without an amount`, async () => {
      for (const body of [{}, { amount: undefined }, { amount: null }, { amount: '' }]) {
        assert.deepEqual(await errorsOf(createMarriageAssistanceValidation, { ...BASE_MARRIAGE, type, ...body }), [], JSON.stringify(body));
      }
    });

    test(`${type}: an amount that is sent anyway must still be valid`, async () => {
      assert.ok((await amountErrors(createMarriageAssistanceValidation, { ...BASE_MARRIAGE, type, amount: -1 })).length > 0);
      assert.deepEqual(await amountErrors(createMarriageAssistanceValidation, { ...BASE_MARRIAGE, type, amount: 100 }), []);
    });
  }

  test('the type itself is still required and must be a known one', async () => {
    assert.ok((await errorsOf(createMarriageAssistanceValidation, BASE_MARRIAGE)).some((e) => e.path === 'type'));
    assert.ok((await errorsOf(createMarriageAssistanceValidation, { ...BASE_MARRIAGE, type: 'cash' })).some((e) => e.path === 'type'));
  });

  test('update: amount stays optional and validated when sent', async () => {
    assert.deepEqual(await amountErrors(updateMarriageAssistanceValidation, { type: 'financial_assistance' }), []);
    assert.ok((await amountErrors(updateMarriageAssistanceValidation, { amount: -1 })).length > 0);
  });
});

/**
 * The three request bodies the CMS form was seen to send (captured from a browser run against a mocked API),
 * run through the route's validators exactly as sent.
 */
describe('Marriage assistance: the requests the CMS form sends', () => {
  const SENT = {
    proposal_support: { type: 'proposal_support', memberId: String(MEMBER), notes: '' },
    premarital_counselling: { type: 'premarital_counselling', memberId: String(MEMBER), notes: '' },
    financial_assistance: { type: 'financial_assistance', memberId: String(MEMBER), notes: '', amount: 12500.5 },
  };

  for (const [type, body] of Object.entries(SENT)) {
    test(`${type}: passes validation as sent`, async () => {
      assert.deepEqual(await errorsOf(createMarriageAssistanceValidation, body), []);
    });
  }

  test('only the financial request carries an amount property', () => {
    assert.equal('amount' in SENT.proposal_support, false);
    assert.equal('amount' in SENT.premarital_counselling, false);
    assert.equal(SENT.financial_assistance.amount, 12500.5);
  });

  test('the financial body without its amount, or with zero, is what validation refuses', async () => {
    const { amount: _omit, ...noAmount } = SENT.financial_assistance;
    assert.deepEqual((await errorsOf(createMarriageAssistanceValidation, noAmount)).map((e) => e.path), ['amount']);
    assert.deepEqual((await errorsOf(createMarriageAssistanceValidation, { ...noAmount, amount: 0 })).map((e) => e.path), ['amount']);
  });
});

describe('Relief and marriage assistance: controllers', () => {
  const c: Record<string, FakeCollection> = {};
  const restorers: Array<() => void> = [];
  let restoreConsole: () => void;
  const models: Record<string, any> = { relief: ReliefCase, marriage: MarriageAssistance, members: Member, families: Family };
  const call = (handler: any, extra: Record<string, any>) =>
    callHandler(handler, { tenantId: TENANT, isSuperAdmin: false, user: { role: 'mahall', _id: oid(), id: String(oid()) }, ...extra });

  before(() => {
    for (const [key, Model] of Object.entries(models)) {
      const f = fakeModel(Model);
      c[key] = f.collection;
      restorers.push(f.restore);
    }
    restoreConsole = silenceConsoleError();
  });
  after(() => {
    restorers.forEach((restore) => restore());
    restoreConsole();
  });
  beforeEach(() => {
    for (const col of Object.values(c)) {
      col.rows.length = 0;
      col.log.length = 0;
    }
    c.members.seed({ _id: MEMBER, tenantId: TENANT, name: 'Member' });
    c.families.seed({ _id: FAMILY, tenantId: TENANT, houseName: 'House' });
  });

  describe('emergency relief', () => {
    test('a case is created without an amount, as "reported", with no amount stored', async () => {
      const result = await call(relief.createReliefCase, { body: { ...BASE_RELIEF } });
      assert.equal(result.status, 201);
      assert.equal(c.relief.rows.length, 1);
      assert.equal(c.relief.rows[0].status, 'reported');
      assert.equal(c.relief.rows[0].amount, undefined);
    });

    test('the report contract is unchanged: an amount sent with it is not stored (the status endpoint records it)', async () => {
      const result = await call(relief.createReliefCase, { body: { ...BASE_RELIEF, amount: 1500.5 } });
      assert.equal(result.status, 201);
      assert.equal(c.relief.rows[0].amount, undefined);
      assert.equal(c.relief.rows[0].status, 'reported');
    });

    test('status and assistance cannot be smuggled in with the report', async () => {
      await call(relief.createReliefCase, { body: { ...BASE_RELIEF, status: 'assisted', assistanceGiven: 'food' } });
      assert.equal(c.relief.rows[0].status, 'reported');
      assert.equal(c.relief.rows[0].assistanceGiven, undefined);
    });

    test('the amount given later is validated and recorded by the status endpoint, then locked', async () => {
      const created = await call(relief.createReliefCase, { body: { ...BASE_RELIEF } });
      const id = String(created.body.data._id);
      const step = (status: string, extra: Record<string, any> = {}) =>
        call(relief.updateReliefStatus, { params: { id }, body: { status, ...extra } });

      assert.equal((await step('verified')).status, 200);
      assert.equal((await step('approved')).status, 200);
      assert.equal((await step('assisted', { assistanceGiven: 'food kit', amount: 0 })).status, 400, 'zero is refused');
      assert.equal((await step('assisted', { assistanceGiven: 'food kit', amount: 10.999 })).status, 400);
      assert.equal(c.relief.get(id)!.status, 'approved');

      assert.equal((await step('assisted', { assistanceGiven: 'food kit', amount: 1500.5 })).status, 200);
      assert.equal(c.relief.get(id)!.amount, 1500.5);
      assert.equal(c.relief.get(id)!.status, 'assisted');
      assert.equal((await step('closed', { amount: 5 })).status, 409, 'locked once assisted');
      assert.equal(c.relief.get(id)!.amount, 1500.5);
    });
  });

  describe('marriage assistance', () => {
    test('proposal support and premarital counselling are created without an amount, and no zero is stored', async () => {
      for (const type of ['proposal_support', 'premarital_counselling']) {
        const result = await call(marriage.createAssistance, { body: { ...BASE_MARRIAGE, type } });
        assert.equal(result.status, 201, type);
      }
      assert.equal(c.marriage.rows.length, 2);
      for (const row of c.marriage.rows) {
        assert.equal(row.amount, undefined, 'no fabricated zero');
        assert.equal(row.status, 'requested');
      }
    });

    test('all three request bodies the form sends are created, and only the financial one stores an amount', async () => {
      for (const body of [
        { type: 'proposal_support', memberId: String(MEMBER), notes: '' },
        { type: 'premarital_counselling', memberId: String(MEMBER), notes: '' },
        { type: 'financial_assistance', memberId: String(MEMBER), notes: '', amount: 12500.5 },
      ]) {
        assert.equal((await call(marriage.createAssistance, { body })).status, 201, body.type);
      }
      assert.deepEqual(
        c.marriage.rows.map((r) => [r.type, r.amount]),
        [['proposal_support', undefined], ['premarital_counselling', undefined], ['financial_assistance', 12500.5]]
      );
    });

    test('a blank amount on a non-financial request is dropped, not stored as 0', async () => {
      await call(marriage.createAssistance, { body: { ...BASE_MARRIAGE, type: 'proposal_support', amount: '' } });
      assert.equal(c.marriage.rows[0].amount, undefined);
    });

    test('financial assistance without an amount is refused and nothing is created', async () => {
      for (const body of [{}, { amount: '' }, { amount: null }]) {
        const result = await call(marriage.createAssistance, { body: { ...BASE_MARRIAGE, type: 'financial_assistance', ...body } });
        assert.equal(result.status, 400, JSON.stringify(body));
        assert.equal(result.body.message, 'Please enter the amount.');
      }
      assert.equal(c.marriage.rows.length, 0);
    });

    test('financial assistance with a zero amount is refused and nothing is created', async () => {
      for (const zero of [0, '0', '0.00']) {
        const result = await call(marriage.createAssistance, { body: { ...BASE_MARRIAGE, type: 'financial_assistance', amount: zero } });
        assert.equal(result.status, 400, JSON.stringify(zero));
        assert.equal(result.body.message, 'The amount must be greater than zero.');
      }
      assert.equal(c.marriage.rows.length, 0);
    });

    test('a financial request cannot be edited down to zero, and a non-financial one is not affected', async () => {
      const [financial] = c.marriage.seed({ tenantId: TENANT, memberId: MEMBER, type: 'financial_assistance', amount: 500, status: 'requested' });
      const refused = await call(marriage.updateAssistance, { params: { id: String(financial._id) }, body: { amount: 0 } });
      assert.equal(refused.status, 400);
      assert.equal(c.marriage.get(financial._id)!.amount, 500);

      const [other] = c.marriage.seed({ tenantId: TENANT, memberId: MEMBER, type: 'proposal_support', status: 'requested' });
      const ok = await call(marriage.updateAssistance, { params: { id: String(other._id) }, body: { notes: 'n' } });
      assert.equal(ok.status, 200);
    });

    test('switching to financial assistance with a zero amount on record or in the edit is refused', async () => {
      const [item] = c.marriage.seed({ tenantId: TENANT, memberId: MEMBER, type: 'proposal_support', amount: 0, status: 'requested' });
      const path = { id: String(item._id) };
      assert.equal((await call(marriage.updateAssistance, { params: path, body: { type: 'financial_assistance' } })).status, 400);
      assert.equal((await call(marriage.updateAssistance, { params: path, body: { type: 'financial_assistance', amount: 0 } })).status, 400);
      assert.equal(c.marriage.get(item._id)!.type, 'proposal_support');
    });

    test('financial assistance with a valid amount is created and the amount is stored', async () => {
      const result = await call(marriage.createAssistance, { body: { ...BASE_MARRIAGE, type: 'financial_assistance', amount: 25000 } });
      assert.equal(result.status, 201);
      assert.equal(c.marriage.rows[0].amount, 25000);
    });

    test('switching an open request to financial assistance needs an amount (sent or already on record)', async () => {
      const [item] = c.marriage.seed({ tenantId: TENANT, memberId: MEMBER, type: 'proposal_support', status: 'requested' });
      const path = { id: String(item._id) };
      const refused = await call(marriage.updateAssistance, { params: path, body: { type: 'financial_assistance' } });
      assert.equal(refused.status, 400);
      assert.equal(c.marriage.get(item._id)!.type, 'proposal_support');

      const ok = await call(marriage.updateAssistance, { params: path, body: { type: 'financial_assistance', amount: 100 } });
      assert.equal(ok.status, 200);
      assert.equal(c.marriage.get(item._id)!.type, 'financial_assistance');
      assert.equal(c.marriage.get(item._id)!.amount, 100);
    });

    test('editing notes on an existing financial request that has no amount is not blocked', async () => {
      const [legacy] = c.marriage.seed({ tenantId: TENANT, memberId: MEMBER, type: 'financial_assistance', status: 'requested' });
      const result = await call(marriage.updateAssistance, { params: { id: String(legacy._id) }, body: { notes: 'follow up' } });
      assert.equal(result.status, 200);
    });
  });
});
