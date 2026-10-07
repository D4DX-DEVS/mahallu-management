import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Support } from '../models/Social';
import { getAllSupport, createSupport } from '../controllers/socialController';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] supportTickets', () => {

/**
 * Support tickets hold whatever a user typed. Reading the queue is for admins; any other staff
 * role sees only the tickets they raised. Creating one takes the owner and Mahallu from the
 * session, and the workflow fields (status, response) are not the creator's to set.
 */
const oid = () => new mongoose.Types.ObjectId();
const TENANT = String(oid());
const OTHER_TENANT = String(oid());
const USER = oid();

const finds: any[] = [];
const created: any[] = [];
const saved: Array<() => void> = [];
const stub = (target: any, key: string, impl: any) => {
  const original = target[key];
  target[key] = impl;
  saved.push(() => {
    target[key] = original;
  });
};

before(() => {
  const chain = (): any => {
    const c: any = { populate: () => c, sort: () => c, skip: () => c, limit: () => c, then: (r: any) => r([]) };
    return c;
  };
  stub(Support, 'find', (q: any) => {
    finds.push(JSON.parse(JSON.stringify(q)));
    return chain();
  });
  stub(Support, 'countDocuments', async () => 0);
  stub(Support, 'findById', () => ({ populate: async () => ({}) }));
  stub(Support.prototype, 'save', async function (this: any) {
    created.push(this.toObject());
    return this;
  });
});
after(() => saved.reverse().forEach((r) => r()));

const run = async (fn: any, req: any) => {
  finds.length = 0;
  created.length = 0;
  const out: any = { status: 200, body: undefined };
  const res: any = {
    status(c: number) {
      out.status = c;
      return res;
    },
    json(b: any) {
      out.body = b;
      return res;
    },
  };
  await fn({ params: {}, query: {}, body: {}, tenantId: TENANT, isSuperAdmin: false, user: { _id: USER, role: 'survey' }, ...req }, res);
  return out;
};

describe('GET /support', () => {
  test('a Mahallu admin sees the whole Mahallu queue', async () => {
    await run(getAllSupport, { user: { _id: USER, role: 'mahall' } });
    assert.equal(finds[0].tenantId, TENANT);
    assert.equal('userId' in finds[0], false);
  });

  test('other staff roles see only their own tickets', async () => {
    for (const role of ['survey', 'institute']) {
      await run(getAllSupport, { user: { _id: USER, role } });
      assert.equal(finds[0].tenantId, TENANT, role);
      assert.equal(finds[0].userId, String(USER), role);
    }
  });
});

describe('POST /support', () => {
  test('owner and tenant come from the session; status/response/tenantId in the body are ignored', async () => {
    const out = await run(createSupport, {
      body: { subject: 'Help', message: 'Please', status: 'resolved', response: 'done', tenantId: OTHER_TENANT, userId: String(oid()) },
    });
    assert.equal(out.status, 201);
    assert.equal(String(created[0].tenantId), TENANT);
    assert.equal(String(created[0].userId), String(USER));
    assert.notEqual(created[0].status, 'resolved');
    assert.equal(created[0].response, undefined);
  });

  test('a non-super user without a Mahallu cannot pick one through the body', async () => {
    const out = await run(createSupport, { tenantId: undefined, body: { subject: 'Help', message: 'Please', tenantId: OTHER_TENANT } });
    assert.equal(out.status, 400);
    assert.equal(created.length, 0);
  });
});
});
