/**
 * Demo requests: the landing page's public form lands in an inbox that only
 * platform staff can read.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import DemoRequest from '../models/DemoRequest';
import { createDemoRequest, listDemoRequests } from '../controllers/demoRequestController';
import { superAdminOnly } from '../middleware/authMiddleware';
import { call, installFake } from './support/fakeMongo';

test('a landing-page submission is stored and acknowledged', async () => {
  const fake = installFake(DemoRequest);
  try {
    const reply = await call(createDemoRequest, {
      body: { mahalluName: 'Beypore Juma Masjid', contactNumber: '9876543210', whatsappNumber: '9876543211' },
    });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.success, true);

    const rows = fake.store.find({});
    assert.equal(rows.length, 1);
    assert.equal(rows[0].mahalluName, 'Beypore Juma Masjid');
    assert.equal(rows[0].contactNumber, '9876543210');
    assert.equal(rows[0].whatsappNumber, '9876543211');
  } finally {
    fake.restore();
  }
});

test('the inbox lists newest first, pages, and searches by name or number', async () => {
  const now = Date.now();
  const row = (name: string, phone: string, ageMs: number) => ({
    mahalluName: name,
    contactNumber: phone,
    whatsappNumber: phone,
    createdAt: new Date(now - ageMs),
  });
  const fake = installFake(DemoRequest, [
    row('Alpha Mahallu', '9000000001', 3000),
    row('Beta Mahallu', '9000000002', 2000),
    row('Gamma Mahallu', '9000000003', 1000),
  ]);
  try {
    const firstPage = await call(listDemoRequests, { isSuperAdmin: true, query: { page: '1', limit: '2' } });
    assert.equal(firstPage.status, 200);
    assert.deepEqual(
      firstPage.body.data.map((r: any) => r.mahalluName),
      ['Gamma Mahallu', 'Beta Mahallu']
    );
    assert.equal(firstPage.body.pagination.total, 3);
    assert.equal(firstPage.body.pagination.totalPages, 2);

    const byNumber = await call(listDemoRequests, { isSuperAdmin: true, query: { search: '0002' } });
    assert.deepEqual(byNumber.body.data.map((r: any) => r.mahalluName), ['Beta Mahallu']);

    const byName = await call(listDemoRequests, { isSuperAdmin: true, query: { search: 'alpha' } });
    assert.deepEqual(byName.body.data.map((r: any) => r.contactNumber), ['9000000001']);
  } finally {
    fake.restore();
  }
});

test('the inbox guard refuses anyone who is not a super admin', () => {
  let nextCalled = false;
  let status = 200;
  const res: any = {
    status(code: number) {
      status = code;
      return res;
    },
    json() {
      return res;
    },
  };
  superAdminOnly({ isSuperAdmin: false } as any, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(status, 403);
});
