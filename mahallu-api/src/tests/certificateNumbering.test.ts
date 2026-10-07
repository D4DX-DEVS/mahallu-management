import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Counter from '../models/Counter';
import Certificate from '../models/Certificate';
import CertificateClaim from '../models/CertificateClaim';
import { installFake, Installed } from './support/fakeMongo';
import Tenant from '../models/Tenant';
import { NikahRegistration } from '../models/Registration';
import * as uploadService from '../services/uploadService';
import { issueCertificate, nextCertificateNo } from '../services/certificateService';
import { nextSequence } from '../utils/idCounter';

/**
 * Certificate numbers are GLOBAL (certificateNo has a global unique index; /api/verify/:no has no
 * tenant hint). They used to be "this Mahallu's count + 1", so a second Mahallu's first certificate
 * collided with the first Mahallu's, every retry recomputed the same number, and each retry rendered
 * a PDF and uploaded an orphan object. Numbers now come from an atomic counter per (type, year).
 *
 * The database is replaced by an in-memory Counter that applies each update atomically per call.
 */

const oid = () => new mongoose.Types.ObjectId();
const dup = (field = 'certificateNo') =>
  Object.assign(new Error('E11000 duplicate key error'), { code: 11000, keyPattern: { [field]: 1 } });

// --- in-memory fakes ----------------------------------------------------------------------------
let counters = new Map<string, number>();
let existing: string[] = [];      // certificateNo values already in the collection (any tenant)
let saved: any[] = [];
let uploads: string[] = [];
let deleted: string[] = [];
let failSaveWith: Array<Error | null> = [];
let counterCalls = 0;

const originals: Array<[any, string, any]> = [];
const stub = (target: any, key: string, impl: any) => {
  originals.push([target, key, target[key]]);
  target[key] = impl;
};

describe('certificate numbering', () => {
  let claims: Installed;
  beforeEach(() => {
    claims = installFake(CertificateClaim); // the per-registration claim (a separate collection)
    stub(Counter, 'findOneAndUpdate', async (filter: any, update: any) => {
      counterCalls += 1;
      await Promise.resolve(); // let concurrent callers interleave here...
      const current = counters.get(filter._id); // ...the read-modify-write below has no await: atomic
      if (current === undefined) return null;
      const next = current + update.$inc.seq;
      counters.set(filter._id, next);
      return { _id: filter._id, seq: next };
    });
    stub(Counter, 'create', async (doc: any) => {
      await Promise.resolve();
      if (counters.has(doc._id)) throw dup('_id');
      counters.set(doc._id, doc.seq);
      return doc;
    });
    stub(Certificate, 'find', (filter: any) => {
      const rx: RegExp = filter?.certificateNo?.$regex;
      assert.ok(!('tenantId' in (filter || {})), 'the seed must look across ALL tenants');
      const rows = existing.filter((no) => !rx || rx.test(no)).map((certificateNo) => ({ certificateNo }));
      const chain: any = { select: () => chain, lean: async () => rows };
      return chain;
    });
    stub(Certificate, 'exists', async (filter: any) => (existing.includes(filter.certificateNo) ? { _id: oid() } : null));
    stub(Certificate, 'findOne', async () => null);
    stub(Certificate.prototype, 'save', async function (this: any) {
      const planned = failSaveWith.shift();
      if (planned) throw planned;
      if (existing.includes(this.certificateNo)) throw dup();
      existing.push(this.certificateNo);
      saved.push(this);
      return this;
    });
    stub(Tenant, 'findById', () => ({ select: async () => ({ name: 'Test Mahallu' }) }));
    stub(NikahRegistration, 'findOne', async () => ({
      status: 'approved',
      groomName: 'G',
      brideName: 'B',
      nikahDate: new Date(2026, 5, 1),
    }));
    stub(uploadService, 'uploadPrivateBuffer', async (_b: Buffer, folder: string) => {
      const key = `${folder}/${uploads.length + 1}.pdf`;
      uploads.push(key);
      return key;
    });
    stub(uploadService, 'discardPrivateObject', async (key: string) => { deleted.push(key); return 'deleted'; });

  });

  afterEach(() => {
    claims.restore();
    for (const [target, key, value] of originals.reverse()) {
      if (value === undefined) delete target[key];
      else target[key] = value;
    }
    originals.length = 0;
  });

  beforeEach(() => {
    counters = new Map();
    existing = [];
    saved = [];
    uploads = [];
    deleted = [];
    failSaveWith = [];
    counterCalls = 0;
  });

  const YEAR = new Date().getFullYear();

  // --- tests --------------------------------------------------------------------------------------

  test('two Mahallus issuing their first certificate get different numbers (and both succeed first time)', async () => {
    const a = await issueCertificate('nikah', String(oid()), String(oid()), 'Admin A');
    const b = await issueCertificate('nikah', String(oid()), String(oid()), 'Admin B');
    assert.equal(a.certificateNo, `NK-${YEAR}-0001`);
    assert.equal(b.certificateNo, `NK-${YEAR}-0002`);
    assert.notEqual(a.certificateNo, b.certificateNo);
    assert.equal(uploads.length, 2, 'one PDF per certificate, no retries and no orphans');
    assert.deepEqual(deleted, []);
  });

  test('25 certificates numbered in parallel are 25 distinct numbers, all inside one sequence', async () => {
    const numbers = await Promise.all(Array.from({ length: 25 }, () => nextCertificateNo('nikah')));
    assert.equal(new Set(numbers).size, 25);
    const suffixes = numbers.map((n) => Number(n.split('-')[2])).sort((x, y) => x - y);
    assert.deepEqual(suffixes, Array.from({ length: 25 }, (_, i) => i + 1));
    assert.ok(numbers.every((n) => /^NK-\d{4}-\d{4}$/.test(n)), 'format PREFIX-YYYY-NNNN is kept');
  });

  test('25 parallel issueCertificate calls from different Mahallus never share a number', async () => {
    const issued = await Promise.all(
      Array.from({ length: 25 }, () => issueCertificate('nikah', String(oid()), String(oid()), 'Admin'))
    );
    assert.equal(new Set(issued.map((c) => c.certificateNo)).size, 25);
    assert.equal(uploads.length, 25);
  });

  test('the sequence is seeded above everything already issued, by any Mahallu, for that type and year only', async () => {
    existing = [`NK-${YEAR}-0007`, `NK-${YEAR}-0012`, `NK-${YEAR}-0003`, `NK-${YEAR - 1}-0099`, `DT-${YEAR}-0050`, `NK-${YEAR}-0013-X`];
    assert.equal(await nextCertificateNo('nikah'), `NK-${YEAR}-0013`);
    assert.equal(await nextCertificateNo('nikah'), `NK-${YEAR}-0014`);
    // a different type has its own sequence, seeded from its own data
    assert.equal(await nextCertificateNo('death'), `DT-${YEAR}-0051`);
    assert.equal(await nextCertificateNo('noc'), `NC-${YEAR}-0001`);
  });

  test('seeding reads the existing data once: later numbers are a single atomic increment', async () => {
    existing = [`NK-${YEAR}-0005`];
    await nextCertificateNo('nikah');
    const before = counterCalls;
    await nextCertificateNo('nikah');
    assert.equal(counterCalls - before, 1);
  });

  test('year rollover starts a new sequence', async () => {
    assert.equal(await nextCertificateNo('nikah', new Date(2026, 11, 31)), 'NK-2026-0001');
    assert.equal(await nextCertificateNo('nikah', new Date(2026, 11, 31)), 'NK-2026-0002');
    assert.equal(await nextCertificateNo('nikah', new Date(2027, 0, 1)), 'NK-2027-0001');
    assert.equal(await nextCertificateNo('nikah', new Date(2026, 11, 31)), 'NK-2026-0003');
  });

  test('a duplicate-key error on save is retried with the NEXT number and the first upload is removed', async () => {
    failSaveWith = [dup('certificateNo')];
    const cert = await issueCertificate('nikah', String(oid()), String(oid()), 'Admin');
    assert.equal(cert.certificateNo, `NK-${YEAR}-0002`);
    assert.equal(uploads.length, 2);
    assert.deepEqual(deleted, [uploads[0]], 'the PDF of the failed attempt is deleted, none is left orphaned');
  });

  test('a number that already exists is skipped without rendering or uploading anything for it', async () => {
    // A counter that is behind the data (e.g. a number issued by hand): the counter is advanced past it.
    counters.set(`cert:nikah:${YEAR}`, 0);
    existing = [`NK-${YEAR}-0001`, `NK-${YEAR}-0002`];
    const cert = await issueCertificate('nikah', String(oid()), String(oid()), 'Admin');
    assert.equal(cert.certificateNo, `NK-${YEAR}-0003`);
    assert.equal(uploads.length, 1, 'only the final number was rendered and uploaded');
  });

  test('a failure other than a duplicate key propagates and does not leave the upload behind', async () => {
    failSaveWith = [new Error('database is down')];
    await assert.rejects(() => issueCertificate('nikah', String(oid()), String(oid()), 'Admin'), /database is down/);
    assert.equal(uploads.length, 1);
    assert.deepEqual(deleted, [uploads[0]]);
  });

  test('nextSequence: the first caller seeds, a racing first caller takes its number from the existing counter', async () => {
    let seeded = 0;
    const seed = async () => { seeded += 1; return 40; };
    const [a, b, c] = await Promise.all([nextSequence('k', { seed }), nextSequence('k', { seed }), nextSequence('k', { seed })]);
    assert.deepEqual([a, b, c].sort((x, y) => x - y), [41, 42, 43]);
    assert.ok(seeded >= 1 && seeded <= 3);
    assert.equal(await nextSequence('k', { seed }), 44);
    assert.equal(seeded <= 3, true, 'a key that exists is never seeded again');
  });

  test('nextSequence reserves a block when asked, returning its last number', async () => {
    assert.equal(await nextSequence('block', { by: 5, seed: async () => 10 }), 15);
    assert.equal(await nextSequence('block', { by: 3 }), 18);
    assert.equal(await nextSequence('block'), 19);
  });
});
