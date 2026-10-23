/**
 * Demo request review: the extra tenant details a request carries, the pending / accepted /
 * rejected states, who may decide, and how an accepted request becomes a Mahallu.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';

import DemoRequest from '../models/DemoRequest';
import Tenant from '../models/Tenant';
import {
  acceptDemoRequest,
  createDemoRequest,
  getDemoRequest,
  listDemoRequests,
  rejectDemoRequest,
} from '../controllers/demoRequestController';
import { createTenant } from '../controllers/tenantController';
import { authMiddleware, superAdminOnly } from '../middleware/authMiddleware';
import demoRequestRoutes from '../routes/demoRequestRoutes';
import { createDemoRequestValidation, rejectDemoRequestValidation } from '../validations/demoRequestValidation';
import { createTenantValidation } from '../validations/tenantValidation';
import * as dxing from '../services/dxingService';
import { call, installFake, oid } from './support/fakeMongo';

const validate = async (chains: any[], body: any, params: any = {}) => {
  const req: any = { body, params, query: {}, headers: {} };
  for (const chain of chains) await chain.run(req);
  return validationResult(req)
    .array()
    .map((e: any) => `${e.path}: ${e.msg}`);
};

const baseRequest = { mahalluName: 'Beypore Juma Masjid', contactNumber: '9876543210', whatsappNumber: '9876543211' };
const fullRequest = {
  ...baseRequest,
  type: 'juma_masjid',
  location: 'Beypore',
  address: { state: 'Kerala', district: 'Kozhikode', pinCode: '673015', postOffice: 'Beypore', village: 'Beypore' },
};

/** Replace the WhatsApp sender for one test and put it back afterwards. */
const withWhatsApp = async (impl: (phone: string, text: string) => Promise<unknown>, run: () => Promise<void>) => {
  const original = (dxing as any).sendWhatsAppMessage;
  (dxing as any).sendWhatsAppMessage = impl;
  try {
    await run();
  } finally {
    (dxing as any).sendWhatsAppMessage = original;
  }
};

const admin = { isSuperAdmin: true, user: { _id: oid(), role: 'super_admin' } };

// ---------------------------------------------------------------- validation

test('the old three-field form still validates, and the extra tenant details are accepted', async () => {
  assert.deepEqual(await validate(createDemoRequestValidation, baseRequest), []);
  assert.deepEqual(await validate(createDemoRequestValidation, fullRequest), []);
});

test('a demo request type must be Mahallu or Juma Masjid', async () => {
  for (const type of ['standard', 'premium', 'enterprise', 'other']) {
    const errors = await validate(createDemoRequestValidation, { ...baseRequest, type });
    assert.deepEqual(errors, ['type: Please choose a valid type.'], type);
  }
  assert.deepEqual(await validate(createDemoRequestValidation, { ...baseRequest, type: 'mahallu' }), []);
});

test('over-long details and bad numbers are still refused', async () => {
  const errors = await validate(createDemoRequestValidation, {
    ...baseRequest,
    contactNumber: '123',
    location: 'x'.repeat(301),
    address: { village: 'v'.repeat(201) },
  });
  assert.equal(errors.length, 3);
});

test('a tenant is created as Mahallu or Juma Masjid, and LSG name is optional', async () => {
  const tenant = {
    name: 'Beypore Juma Masjid',
    code: 'TN1ABCDE',
    type: 'mahallu',
    address: { state: 'Kerala', district: 'Kozhikode', village: 'Beypore' },
  };
  assert.deepEqual(await validate(createTenantValidation, tenant), []);
  assert.deepEqual(await validate(createTenantValidation, { ...tenant, type: 'juma_masjid' }), []);
  assert.deepEqual(await validate(createTenantValidation, { ...tenant, address: { ...tenant.address, lsgName: 'Koodali' } }), []);
  for (const type of ['standard', 'premium', 'enterprise', '']) {
    assert.deepEqual(await validate(createTenantValidation, { ...tenant, type }), ['type: Please choose a valid tenant type.'], type);
  }
  assert.deepEqual(await validate(createTenantValidation, { ...tenant, demoRequestId: 'nope' }), [
    'demoRequestId: Please choose a valid demo request.',
  ]);
});

test('existing tenants keep loading: legacy types and a missing LSG name are valid on the model', () => {
  const address = { state: 'Kerala', district: 'Kozhikode', village: 'Beypore' };
  for (const type of ['standard', 'premium', 'enterprise', 'mahallu', 'juma_masjid']) {
    assert.equal(new Tenant({ name: 'A', code: 'A1', type, address }).validateSync(), undefined, type);
  }
  assert.ok(new Tenant({ name: 'A', code: 'A1', type: 'gold', address }).validateSync()?.errors.type);
  assert.equal(new Tenant({ name: 'A', code: 'A1', address }).type, 'mahallu');
});

test('a rejection needs a non-empty reason', async () => {
  const id = oid().toString();
  assert.deepEqual(await validate(rejectDemoRequestValidation, { reason: 'Outside our service area' }, { id }), []);
  for (const reason of [undefined, '', '   ', 42, null]) {
    const errors = await validate(rejectDemoRequestValidation, { reason }, { id });
    assert.deepEqual(errors, ['reason: Please enter the reason for rejection.'], String(reason));
  }
  assert.equal((await validate(rejectDemoRequestValidation, { reason: 'x'.repeat(501) }, { id })).length, 1);
  assert.equal((await validate(rejectDemoRequestValidation, { reason: 'ok' }, { id: 'bad' })).length, 1);
});

// ---------------------------------------------------------------- persistence

test('a submission stores the tenant details and always starts pending', async () => {
  const fake = installFake(DemoRequest);
  try {
    const reply = await call(createDemoRequest, { body: { ...fullRequest, status: 'accepted', tenantId: String(oid()) } });
    assert.equal(reply.status, 201);
    const [row] = fake.store.find({});
    assert.equal(row.type, 'juma_masjid');
    assert.equal(row.location, 'Beypore');
    assert.deepEqual(
      { ...row.address },
      { state: 'Kerala', district: 'Kozhikode', pinCode: '673015', postOffice: 'Beypore', village: 'Beypore' }
    );
    assert.equal(row.status, 'pending');
    assert.equal(row.tenantId, undefined);
  } finally {
    fake.restore();
  }
});

test('a submission never creates a tenant', async () => {
  const requests = installFake(DemoRequest);
  const tenants = installFake(Tenant);
  try {
    await call(createDemoRequest, { body: fullRequest });
    assert.equal(tenants.store.find({}).length, 0);
  } finally {
    requests.restore();
    tenants.restore();
  }
});

test('the old three-field submission is stored without empty detail fields', async () => {
  const fake = installFake(DemoRequest);
  try {
    await call(createDemoRequest, { body: baseRequest });
    const [row] = fake.store.find({});
    assert.equal(row.mahalluName, 'Beypore Juma Masjid');
    assert.equal(row.type, undefined);
    assert.equal(row.address, undefined);
  } finally {
    fake.restore();
  }
});

// ---------------------------------------------------------------- listing

test('the inbox filters by status and treats a request with no status as pending', async () => {
  const at = (n: number) => new Date(Date.now() - n);
  const row = (name: string, extra: object, age: number) => ({
    mahalluName: name,
    contactNumber: '9000000001',
    whatsappNumber: '9000000001',
    createdAt: at(age),
    ...extra,
  });
  const fake = installFake(DemoRequest, [
    row('Legacy', {}, 4000),
    row('New', { status: 'pending' }, 3000),
    row('Done', { status: 'accepted' }, 2000),
    row('Nope', { status: 'rejected' }, 1000),
  ]);
  try {
    const names = async (query: object) =>
      (await call(listDemoRequests, { ...admin, query })).body.data.map((r: any) => r.mahalluName);
    assert.deepEqual(await names({ status: 'pending' }), ['New', 'Legacy']);
    assert.deepEqual(await names({ status: 'accepted' }), ['Done']);
    assert.deepEqual(await names({ status: 'rejected' }), ['Nope']);
    assert.deepEqual(await names({}), ['Nope', 'Done', 'New', 'Legacy']);
    assert.deepEqual(await names({ status: 'pending', search: 'leg' }), ['Legacy']);
    assert.deepEqual(await names({ status: { $ne: 'x' } }), ['Nope', 'Done', 'New', 'Legacy']);
  } finally {
    fake.restore();
  }
});

// ---------------------------------------------------------------- accept

test('accepting a pending request records the decision and does not create a tenant', async () => {
  const id = oid();
  const requests = installFake(DemoRequest, [{ _id: id, ...fullRequest, status: 'pending' }]);
  const tenants = installFake(Tenant);
  try {
    const reply = await call(acceptDemoRequest, { ...admin, params: { id: String(id) } });
    assert.equal(reply.status, 200);
    const [row] = requests.store.find({});
    assert.equal(row.status, 'accepted');
    assert.ok(row.reviewedAt instanceof Date);
    assert.equal(String(row.reviewedBy), String(admin.user._id));
    assert.equal(tenants.store.find({}).length, 0);
  } finally {
    requests.restore();
    tenants.restore();
  }
});

test('a request saved before statuses existed can be accepted', async () => {
  const id = oid();
  const fake = installFake(DemoRequest, [{ _id: id, ...baseRequest }]);
  try {
    const reply = await call(acceptDemoRequest, { ...admin, params: { id: String(id) } });
    assert.equal(reply.status, 200);
    assert.equal(fake.store.find({})[0].status, 'accepted');
  } finally {
    fake.restore();
  }
});

test('an accepted or rejected request cannot be accepted or rejected again', async () => {
  const accepted = oid();
  const rejected = oid();
  const fake = installFake(DemoRequest, [
    { _id: accepted, ...baseRequest, status: 'accepted' },
    { _id: rejected, ...baseRequest, status: 'rejected', rejectionReason: 'No' },
  ]);
  try {
    for (const id of [accepted, rejected]) {
      const again = await call(acceptDemoRequest, { ...admin, params: { id: String(id) } });
      assert.equal(again.status, 409);
      assert.match(again.body.message, /already been/);
      const reject = await call(rejectDemoRequest, { ...admin, params: { id: String(id) }, body: { reason: 'Late' } });
      assert.equal(reject.status, 409);
    }
    assert.equal(fake.store.find({ _id: rejected })[0].rejectionReason, 'No');
  } finally {
    fake.restore();
  }
});

test('two administrators accepting at once: exactly one succeeds', async () => {
  const id = oid();
  const fake = installFake(DemoRequest, [{ _id: id, ...baseRequest, status: 'pending' }]);
  try {
    const replies = await Promise.all([
      call(acceptDemoRequest, { ...admin, params: { id: String(id) } }),
      call(acceptDemoRequest, { ...admin, params: { id: String(id) } }),
    ]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
  } finally {
    fake.restore();
  }
});

test('an unknown request answers 404 and a database error is reported, not hidden', async () => {
  const fake = installFake(DemoRequest);
  try {
    for (const handler of [acceptDemoRequest, getDemoRequest]) {
      assert.equal((await call(handler, { ...admin, params: { id: String(oid()) } })).status, 404);
    }
    assert.equal((await call(rejectDemoRequest, { ...admin, params: { id: String(oid()) }, body: { reason: 'x' } })).status, 404);

    fake.store.failOn('DemoRequest.findOneAndUpdate');
    const failed = await call(acceptDemoRequest, { ...admin, params: { id: String(oid()) } });
    assert.equal(failed.status, 500);
    assert.equal(failed.body.success, false);
  } finally {
    fake.restore();
  }
});

// ---------------------------------------------------------------- reject

test('rejecting stores the reason, messages the requester on WhatsApp, and records that it was sent', async () => {
  const id = oid();
  const fake = installFake(DemoRequest, [{ _id: id, ...baseRequest, status: 'pending' }]);
  const sent: Array<{ phone: string; text: string }> = [];
  try {
    await withWhatsApp(
      async (phone, text) => {
        sent.push({ phone, text });
        return { status: 200 };
      },
      async () => {
        const reply = await call(rejectDemoRequest, { ...admin, params: { id: String(id) }, body: { reason: '  Outside our service area  ' } });
        assert.equal(reply.status, 200);
        assert.equal(reply.body.notification, 'sent');
        const [row] = fake.store.find({});
        assert.equal(row.status, 'rejected');
        assert.equal(row.rejectionReason, 'Outside our service area');
        assert.equal(row.rejectionNotification.status, 'sent');
        assert.equal(row.rejectionNotification.channel, 'whatsapp');
      }
    );
    assert.equal(sent.length, 1);
    assert.equal(sent[0].phone, baseRequest.whatsappNumber);
    assert.match(sent[0].text, /Outside our service area/);
  } finally {
    fake.restore();
  }
});

test('when the WhatsApp message fails the rejection stands and nothing claims it was delivered', async () => {
  const id = oid();
  const fake = installFake(DemoRequest, [{ _id: id, ...baseRequest, status: 'pending' }]);
  try {
    await withWhatsApp(
      async () => {
        throw new Error('DXing configuration missing.');
      },
      async () => {
        const reply = await call(rejectDemoRequest, { ...admin, params: { id: String(id) }, body: { reason: 'Duplicate' } });
        assert.equal(reply.status, 200);
        assert.equal(reply.body.notification, 'failed');
        assert.doesNotMatch(reply.body.message, /was notified/);
        assert.match(reply.body.message, /could not be notified/);
        const [row] = fake.store.find({});
        assert.equal(row.status, 'rejected');
        assert.equal(row.rejectionReason, 'Duplicate');
        assert.equal(row.rejectionNotification.status, 'failed');
      }
    );
  } finally {
    fake.restore();
  }
});

test('a rejected request is not messaged a second time', async () => {
  const id = oid();
  const fake = installFake(DemoRequest, [{ _id: id, ...baseRequest, status: 'pending' }]);
  let sends = 0;
  try {
    await withWhatsApp(
      async () => {
        sends += 1;
        return { status: 200 };
      },
      async () => {
        const body = { reason: 'Duplicate' };
        const replies = await Promise.all([
          call(rejectDemoRequest, { ...admin, params: { id: String(id) }, body }),
          call(rejectDemoRequest, { ...admin, params: { id: String(id) }, body }),
        ]);
        assert.deepEqual(replies.map((r) => r.status).sort(), [200, 409]);
      }
    );
    assert.equal(sends, 1);
  } finally {
    fake.restore();
  }
});

// ---------------------------------------------------------------- authorization

test('every review route is behind authentication and the super admin guard; only the form is public', () => {
  const routes = (demoRequestRoutes as any).stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => ({
      method: Object.keys(layer.route.methods)[0],
      path: layer.route.path,
      handlers: layer.route.stack.map((l: any) => l.handle),
    }));

  const key = (r: any) => `${r.method} ${r.path}`;
  assert.deepEqual(routes.map(key).sort(), ['get /', 'get /:id', 'post /', 'post /:id/accept', 'post /:id/reject']);

  for (const route of routes) {
    const guarded = route.handlers.includes(authMiddleware) && route.handlers.includes(superAdminOnly);
    if (key(route) === 'post /') assert.equal(guarded, false, 'the landing-page form stays public');
    else {
      assert.ok(guarded, `${key(route)} must require a signed-in super admin`);
      assert.ok(route.handlers.indexOf(authMiddleware) < route.handlers.indexOf(superAdminOnly));
    }
  }
});

test('the guard refuses survey, institute and mahallu-admin sessions', () => {
  for (const role of ['mahall', 'survey', 'institute']) {
    let nextCalled = false;
    let status = 200;
    const res: any = { status: (c: number) => ((status = c), res), json: () => res };
    superAdminOnly({ isSuperAdmin: false, user: { role } } as any, res, () => (nextCalled = true));
    assert.equal(nextCalled, false, role);
    assert.equal(status, 403, role);
  }
});

// ---------------------------------------------------------------- tenant from request

const tenantBody = (extra: object = {}) => ({
  name: 'Beypore Juma Masjid',
  code: 'TN1ABCDE',
  type: 'juma_masjid',
  location: 'Beypore',
  address: { state: 'Kerala', district: 'Kozhikode', village: 'Beypore' },
  ...extra,
});

const withTenantWorld = async (seed: object[], run: (w: { requests: any; tenants: any }) => Promise<void>) => {
  const requests = installFake(DemoRequest, seed as any);
  const tenants = installFake(Tenant);
  try {
    await run({ requests, tenants });
  } finally {
    requests.restore();
    tenants.restore();
  }
};

test('creating the Mahallu from an accepted request links the two and keeps the chosen type', async () => {
  const id = oid();
  await withTenantWorld([{ _id: id, ...baseRequest, status: 'accepted' }], async ({ requests, tenants }) => {
    const reply = await call(createTenant, { ...admin, body: tenantBody({ demoRequestId: String(id) }) });
    assert.equal(reply.status, 201);
    const [tenant] = tenants.store.find({});
    assert.equal(tenant.type, 'juma_masjid');
    assert.equal(tenant.demoRequestId, undefined, 'the link is not stored on the tenant');
    assert.equal(tenant.address.lsgName, undefined);
    assert.equal(String(requests.store.find({})[0].tenantId), String(tenant._id));
  });
});

test('a request cannot produce a second Mahallu, even on retry', async () => {
  const id = oid();
  await withTenantWorld([{ _id: id, ...baseRequest, status: 'accepted' }], async ({ tenants }) => {
    const first = await call(createTenant, { ...admin, body: tenantBody({ demoRequestId: String(id) }) });
    assert.equal(first.status, 201);
    const retry = await call(createTenant, { ...admin, body: tenantBody({ code: 'TN2ABCDE', demoRequestId: String(id) }) });
    assert.equal(retry.status, 409);
    assert.match(retry.body.message, /already been created/);
    assert.equal(tenants.store.find({}).length, 1);
  });
});

test('two administrators submitting the form at once create exactly one Mahallu', async () => {
  const id = oid();
  await withTenantWorld([{ _id: id, ...baseRequest, status: 'accepted' }], async ({ tenants }) => {
    const replies = await Promise.all([
      call(createTenant, { ...admin, body: tenantBody({ code: 'TNAAAAAA', demoRequestId: String(id) }) }),
      call(createTenant, { ...admin, body: tenantBody({ code: 'TNBBBBBB', demoRequestId: String(id) }) }),
    ]);
    assert.deepEqual(replies.map((r) => r.status).sort(), [201, 409]);
    assert.equal(tenants.store.find({}).length, 1);
  });
});

test('pending and rejected requests cannot be turned into a Mahallu, and an unknown one answers 404', async () => {
  const pending = oid();
  const rejected = oid();
  await withTenantWorld(
    [
      { _id: pending, ...baseRequest, status: 'pending' },
      { _id: rejected, ...baseRequest, status: 'rejected' },
    ],
    async ({ requests, tenants }) => {
      for (const id of [pending, rejected]) {
        const reply = await call(createTenant, { ...admin, body: tenantBody({ demoRequestId: String(id) }) });
        assert.equal(reply.status, 409);
        assert.match(reply.body.message, /accepted request/);
      }
      const missing = await call(createTenant, { ...admin, body: tenantBody({ demoRequestId: String(oid()) }) });
      assert.equal(missing.status, 404);
      assert.equal(tenants.store.find({}).length, 0);
      assert.equal(requests.store.find({ tenantId: { $exists: true } }).length, 0);
    }
  );
});

test('if the Mahallu fails to save, the request is released so the form can be submitted again', async () => {
  const id = oid();
  await withTenantWorld([{ _id: id, ...baseRequest, status: 'accepted' }], async ({ requests, tenants }) => {
    tenants.store.failOn('Tenant.save');
    const failed = await call(createTenant, { ...admin, body: tenantBody({ demoRequestId: String(id) }) });
    assert.equal(failed.status, 500);
    assert.equal(requests.store.find({})[0].tenantId, undefined);
    assert.equal(tenants.store.find({}).length, 0);

    const retry = await call(createTenant, { ...admin, body: tenantBody({ demoRequestId: String(id) }) });
    assert.equal(retry.status, 201);
  });
});

test('creating a Mahallu without a request still works exactly as before', async () => {
  await withTenantWorld([], async ({ tenants }) => {
    const reply = await call(createTenant, { ...admin, body: tenantBody() });
    assert.equal(reply.status, 201);
    assert.equal(tenants.store.find({}).length, 1);
  });
});
