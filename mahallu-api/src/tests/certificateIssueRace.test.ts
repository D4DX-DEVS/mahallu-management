import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Certificate from '../models/Certificate';
import CertificateClaim from '../models/CertificateClaim';
import { NikahRegistration } from '../models/Registration';
import {
  issueCertificate,
  issueCertificateDetailed,
  certificateIssueKey,
  certificateIssueTuning,
  CertificateIssueInProgressError,
} from '../services/certificateService';
import { issueCertificateHandler, revokeCertificate } from '../controllers/certificateController';
import { call } from './support/fakeMongo';
import { makeCertificateWorld, newId, captureConsoleError, CertificateWorld } from './support/certificateWorld';

// One root suite so the stubs installed by this file's hooks never leak into other suites when every
// test file is imported into the single `npm test` process.
describe('[isolated] certificate issue race', () => {
  /**
   * Two simultaneous issueCertificate calls for the same registration used to both pass the "already
   * issued?" check and both issue a valid certificate. Issuing now takes a per-registration claim BEFORE
   * a number is consumed or a PDF is rendered, and the valid certificate carries a unique issueKey.
   */
  let world: CertificateWorld;
  let log: ReturnType<typeof captureConsoleError>;
  const YEAR = new Date().getFullYear();

  beforeEach(() => {
    log = captureConsoleError();
    world = makeCertificateWorld();
  });
  afterEach(() => {
    world.restore();
    log.restore();
  });

  const valid = () => world.certs.store.docs.filter((d) => d.status === 'valid');
  const counterSeq = (type = 'nikah') => world.counters.store.docs.find((c) => c._id === `cert:${type}:${YEAR}`)?.seq ?? 0;

  test('20 parallel issue calls for ONE registration: one certificate, one number, one PDF, same answer for all', async () => {
    const tenant = newId();
    const registration = newId();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => issueCertificateDetailed('nikah', registration, tenant, 'Admin'))
    );
    assert.equal(world.certs.store.docs.length, 1, 'exactly one certificate row');
    assert.equal(counterSeq(), 1, 'exactly one number consumed');
    assert.equal(world.storage.puts.length, 1, 'exactly one PDF rendered and uploaded');
    assert.deepEqual(world.storage.deletes, [], 'nothing to clean up');
    assert.equal(new Set(results.map((r) => r.certificate.certificateNo)).size, 1);
    assert.equal(results.filter((r) => r.created).length, 1, 'only the claim owner created it');
    assert.equal(world.claims.store.docs.length, 0, 'the claim is released');
    assert.equal(world.certs.store.docs[0].issueKey, certificateIssueKey(tenant, 'nikah', registration));
  });

  test('issuing again later is idempotent: same certificate, no new number, no new PDF', async () => {
    const tenant = newId();
    const registration = newId();
    const first = await issueCertificateDetailed('nikah', registration, tenant, 'Admin');
    const seqBefore = counterSeq();
    const again = await issueCertificateDetailed('nikah', registration, tenant, 'Admin');
    assert.equal(again.created, false);
    assert.equal(again.certificate.certificateNo, first.certificate.certificateNo);
    assert.equal(counterSeq(), seqBefore);
    assert.equal(world.storage.puts.length, 1);
    assert.equal(world.claims.store.count('create'), 1, 'the second call never even took a claim');
  });

  test('different registrations still get distinct, sequential numbers (3 callers each, all parallel)', async () => {
    const tenant = newId();
    const regs = Array.from({ length: 5 }, () => newId());
    const calls = regs.flatMap((r) => [0, 1, 2].map(() => issueCertificate('nikah', r, tenant, 'Admin')));
    const all = await Promise.all(calls);
    const numbers = [...new Set(all.map((c) => c.certificateNo))].sort();
    assert.deepEqual(numbers, [1, 2, 3, 4, 5].map((n) => `NK-${YEAR}-${String(n).padStart(4, '0')}`));
    assert.equal(world.certs.store.docs.length, 5);
    assert.equal(world.storage.puts.length, 5);
    assert.equal(counterSeq(), 5);
  });

  test('the same registration id in two Mahallus is two separate certificates', async () => {
    const registration = newId();
    const [a, b] = await Promise.all([
      issueCertificate('nikah', registration, newId(), 'A'),
      issueCertificate('nikah', registration, newId(), 'B'),
    ]);
    assert.notEqual(a.certificateNo, b.certificateNo);
  });

  test('a failure after the claim discards this request upload, releases the claim, and a retry succeeds', async () => {
    const tenant = newId();
    const registration = newId();
    world.certs.store.failOn('Certificate.save', new Error('database is down'));
    await assert.rejects(() => issueCertificate('nikah', registration, tenant, 'Admin'), /database is down/);
    assert.equal(world.claims.store.docs.length, 0, 'claim released on failure');
    assert.equal(world.storage.puts.length, 1);
    assert.deepEqual(world.storage.deletes, world.storage.puts, 'exactly the upload of the failed request is removed');
    assert.equal(world.storage.objects.size, 0);

    const retry = await issueCertificateDetailed('nikah', registration, tenant, 'Admin');
    assert.equal(retry.created, true);
    assert.equal(world.certs.store.docs.length, 1);
    assert.equal(world.storage.objects.size, 1);
  });

  test('a failed PDF upload releases the claim too (nothing was uploaded, nothing to delete)', async () => {
    world.storage.failPut = [new Error('storage unavailable')];
    const tenant = newId();
    const registration = newId();
    await assert.rejects(() => issueCertificate('nikah', registration, tenant, 'Admin'), /storage unavailable/);
    assert.equal(world.claims.store.docs.length, 0);
    assert.deepEqual(world.storage.deletes, []);
    const retry = await issueCertificate('nikah', registration, tenant, 'Admin');
    assert.ok(retry.certificateNo);
  });

  test('a rejected registration (not approved / not found) does not leave a claim behind', async () => {
    const original = (NikahRegistration as any).findOne;
    (NikahRegistration as any).findOne = async () => ({ status: 'pending' });
    try {
      await assert.rejects(() => issueCertificate('nikah', newId(), newId(), 'Admin'), /must be approved/);
    } finally {
      (NikahRegistration as any).findOne = original;
    }
    assert.equal(world.claims.store.docs.length, 0);
    assert.equal(counterSeq(), 0, 'no number consumed for an invalid request');
  });

  test('losers of a failed owner take over instead of waiting for nothing', async () => {
    const tenant = newId();
    const registration = newId();
    world.certs.store.failOn('Certificate.save', new Error('database is down'));
    const settled = await Promise.allSettled(
      Array.from({ length: 6 }, () => issueCertificate('nikah', registration, tenant, 'Admin'))
    );
    const fulfilled = settled.filter((s) => s.status === 'fulfilled');
    assert.equal(settled.filter((s) => s.status === 'rejected').length, 1, 'only the failing owner sees the failure');
    assert.equal(fulfilled.length, 5);
    assert.equal(valid().length, 1, 'still exactly one valid certificate');
    assert.equal(world.storage.objects.size, 1, 'exactly one PDF remains in storage');
  });

  test('an abandoned claim (older than the stale limit) is taken over', async () => {
    const tenant = newId();
    const registration = newId();
    const key = certificateIssueKey(tenant, 'nikah', registration);
    world.claims.store.insert({ _id: key, token: 'crashed-process', claimedAt: new Date(Date.now() - certificateIssueTuning.staleMs - 5000) });
    const result = await issueCertificateDetailed('nikah', registration, tenant, 'Admin');
    assert.equal(result.created, true);
    assert.equal(world.claims.store.docs.length, 0);
  });

  test('two callers racing to take over the same abandoned claim: only one proceeds', async () => {
    const tenant = newId();
    const registration = newId();
    const key = certificateIssueKey(tenant, 'nikah', registration);
    world.claims.store.insert({ _id: key, token: 'crashed-process', claimedAt: new Date(Date.now() - certificateIssueTuning.staleMs - 5000) });
    const results = await Promise.all(Array.from({ length: 10 }, () => issueCertificateDetailed('nikah', registration, tenant, 'Admin')));
    assert.equal(results.filter((r) => r.created).length, 1);
    assert.equal(world.certs.store.docs.length, 1);
    assert.equal(world.storage.puts.length, 1);
  });

  test('a live (not stale) claim with no result yet: callers get a 409 after the bounded wait, nothing is issued', async () => {
    const tenant = newId();
    const registration = newId();
    world.claims.store.insert({ _id: certificateIssueKey(tenant, 'nikah', registration), token: 'someone-else', claimedAt: new Date() });
    certificateIssueTuning.waitMs = 60;
    await assert.rejects(
      () => issueCertificate('nikah', registration, tenant, 'Admin'),
      (error: any) => error instanceof CertificateIssueInProgressError && error.statusCode === 409 && error.code === 'CERTIFICATE_BEING_ISSUED'
    );
    assert.equal(world.certs.store.docs.length, 0);
    assert.equal(counterSeq(), 0);
    assert.equal(world.storage.puts.length, 0);
    assert.equal(world.claims.store.docs.length, 1, "somebody else's claim is never removed");
  });

  test('the owner that lost its claim mid-flight stops before rendering and removes nothing of anybody else', async () => {
    const tenant = newId();
    const registration = newId();
    const key = certificateIssueKey(tenant, 'nikah', registration);
    // The claim row is taken over by another process right after this call took it.
    const realCreate = (CertificateClaim as any).create;
    (CertificateClaim as any).create = async (doc: any) => {
      const created = await realCreate(doc);
      world.claims.store.docs[0].token = 'taker-over';
      return created;
    };
    try {
      await assert.rejects(() => issueCertificate('nikah', registration, tenant, 'Admin'), CertificateIssueInProgressError);
    } finally {
      (CertificateClaim as any).create = realCreate;
    }
    assert.equal(world.storage.puts.length, 0);
    assert.equal(world.certs.store.docs.length, 0);
    assert.equal(world.claims.store.docs.find((c) => c._id === key)?.token, 'taker-over', 'the other owner keeps its claim');
  });

  test('revoke then re-issue still works: the revoked certificate stays, a NEW valid one is issued', async () => {
    const tenant = newId();
    const registration = newId();
    const first = await issueCertificateDetailed('nikah', registration, tenant, 'Admin');

    const revoked = await call(revokeCertificate, {
      tenantId: tenant,
      params: { id: String(first.certificate._id) },
      body: { reason: 'Wrong spelling' },
    });
    assert.equal(revoked.status, 200);
    const row = world.certs.store.docs.find((d) => String(d._id) === String(first.certificate._id));
    assert.equal(row.status, 'revoked');
    assert.equal(row.issueKey, undefined, 'issueKey is cleared so the unique index no longer covers it');

    const second = await issueCertificateDetailed('nikah', registration, tenant, 'Admin');
    assert.equal(second.created, true);
    assert.notEqual(second.certificate.certificateNo, first.certificate.certificateNo);
    assert.equal(world.certs.store.docs.length, 2);
    assert.equal(valid().length, 1);

    // and it is idempotent again afterwards
    const third = await issueCertificateDetailed('nikah', registration, tenant, 'Admin');
    assert.equal(third.created, false);
    assert.equal(third.certificate.certificateNo, second.certificate.certificateNo);

    // revoking a certificate that is already revoked is still a 404, as before
    const again = await call(revokeCertificate, { tenantId: tenant, params: { id: String(first.certificate._id) }, body: { reason: 'x' } });
    assert.equal(again.status, 404);
  });

  test('legacy valid certificates (no issueKey) are returned, not duplicated', async () => {
    const tenant = newId();
    const registration = newId();
    world.certs.store.insert({
      tenantId: tenant, certificateNo: `NK-${YEAR - 1}-0001`, type: 'nikah', registrationId: registration,
      issuedBy: 'old', issueDate: new Date(), pdfKey: `${world.prefix}old.pdf`, status: 'valid',
    });
    const result = await issueCertificateDetailed('nikah', registration, tenant, 'Admin');
    assert.equal(result.created, false);
    assert.equal(result.certificate.certificateNo, `NK-${YEAR - 1}-0001`);
    assert.equal(world.storage.puts.length, 0);
  });

  test('database backstop: the unique issueKey index (valid certificates only) refuses a second valid certificate', async () => {
    const index = (Certificate.schema.indexes() as any[]).find(([fields]) => 'issueKey' in fields);
    assert.ok(index, 'issueKey index declared');
    assert.equal(index[1].unique, true);
    assert.deepEqual(index[1].partialFilterExpression, { issueKey: { $type: 'string' } });

    const tenant = newId();
    const registration = newId();
    const key = certificateIssueKey(tenant, 'nikah', registration);
    const row = (no: string, extra: any = {}) => ({
      tenantId: tenant, certificateNo: no, type: 'nikah', registrationId: registration,
      issuedBy: 'a', issueDate: new Date(), pdfKey: 'k', status: 'valid', ...extra,
    });
    world.certs.store.insert(row('A-1', { issueKey: key }));
    assert.throws(() => world.certs.store.insert(row('A-2', { issueKey: key })), (e: any) => e.code === 11000 && 'issueKey' in e.keyPattern);
    world.certs.store.insert(row('A-3', { status: 'revoked' })); // no issueKey: any number of old / revoked rows
    world.certs.store.insert(row('A-4', { status: 'revoked' }));
  });

  test('if the lookup is blind (stale read) the index still stops the second certificate and the loser upload is removed', async () => {
    const tenant = newId();
    const registration = newId();
    const key = certificateIssueKey(tenant, 'nikah', registration);
    world.certs.store.insert({
      tenantId: tenant, certificateNo: `NK-${YEAR}-0900`, type: 'nikah', registrationId: registration,
      issuedBy: 'a', issueDate: new Date(), pdfKey: `${world.prefix}winner.pdf`, status: 'valid', issueKey: key,
    });
    // the first two lookups (before and right after the claim) miss the row, as with a stale replica read
    const realFindOne = (Certificate as any).findOne;
    let lookups = 0;
    (Certificate as any).findOne = (filter: any) => (++lookups <= 2 ? { then: (res: any) => Promise.resolve(null).then(res) } : realFindOne(filter));
    let result;
    try {
      result = await issueCertificateDetailed('nikah', registration, tenant, 'Admin');
    } finally {
      (Certificate as any).findOne = realFindOne;
    }
    assert.equal(result.created, false);
    assert.equal(result.certificate.certificateNo, `NK-${YEAR}-0900`);
    assert.equal(world.certs.store.docs.length, 1);
    assert.equal(world.storage.puts.length, 1);
    assert.deepEqual(world.storage.deletes, world.storage.puts, 'its own upload was removed');
  });

  test('HTTP: first issue 201, repeat 200 alreadyIssued with the same number, in-progress 409 with a code', async () => {
    const tenant = newId();
    const registration = newId();
    const body = { type: 'nikah', registrationId: registration };
    const first = await call(issueCertificateHandler, { tenantId: tenant, body });
    assert.equal(first.status, 201);
    assert.equal(first.body.alreadyIssued, false);
    const second = await call(issueCertificateHandler, { tenantId: tenant, body });
    assert.equal(second.status, 200);
    assert.equal(second.body.alreadyIssued, true);
    assert.equal(second.body.data.certificateNo, first.body.data.certificateNo);

    const other = newId();
    world.claims.store.insert({ _id: certificateIssueKey(tenant, 'nikah', other), token: 'busy', claimedAt: new Date() });
    certificateIssueTuning.waitMs = 30;
    const busy = await call(issueCertificateHandler, { tenantId: tenant, body: { type: 'nikah', registrationId: other } });
    assert.equal(busy.status, 409);
    assert.equal(busy.body.code, 'CERTIFICATE_BEING_ISSUED');
    assert.equal(busy.body.success, false);
  });
});
