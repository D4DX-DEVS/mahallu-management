import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import Tenant from '../models/Tenant';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import * as reconciliation from '../utils/reconciliation';
import {
  issueCertificate,
  issueCertificateDetailed,
  certificateIssueKey,
  certificateIssueTuning,
  CertificateIssueInProgressError,
  wasIssuedNow,
} from '../services/certificateService';
import { issueCertificateHandler, revokeCertificate, verifyCertificate } from '../controllers/certificateController';
import { call, matches, oid } from './support/fakeMongo';
import { makeCertificateWorld, newId, captureConsoleError, CertificateWorld } from './support/certificateWorld';

// Defaults as shipped (the test world shrinks them for speed while a test runs).
const SHIPPED_TUNING = { ...certificateIssueTuning };

// One root suite so the stubs installed by this file's hooks never leak into other suites when every
// test file is imported into the single `npm test` process.
describe('[isolated] certificate issue edge cases', () => {
  /**
   * Edge cases of the CertificateClaim + issue flow that the race / numbering / orphan suites do not
   * cover: HTTP-level concurrency, claim takeover mid-upload, failure at every step with retry, number
   * gaps, discard failures, revoked certificates, registration state and tenant scope, bounded waiting,
   * and which fields come from the registration rather than the request. No database and no object
   * storage is touched: models are in-memory fakes and the storage client is injected.
   */
  let world: CertificateWorld;
  let log: ReturnType<typeof captureConsoleError>;
  const YEAR = new Date().getFullYear();
  const no = (n: number, prefix = 'NK') => `${prefix}-${YEAR}-${String(n).padStart(4, '0')}`;

  // --- registrations (the world's blanket "always approved" stub is replaced by a scoped store) -------
  type Kind = 'nikah' | 'death' | 'noc';
  let regs: Array<Record<string, any>>;
  let lookups: Array<{ kind: Kind; filter: any }>;
  let regFailures: Error[];
  let undoStubs: Array<() => void>;
  let texts: string[];

  const addReg = (kind: Kind, tenantId: string, extra: Record<string, any> = {}) => {
    const base: Record<string, any> =
      kind === 'nikah'
        ? { groomName: 'Groom One', brideName: 'Bride One', nikahDate: new Date(2026, 5, 1), groomId: oid(), brideId: oid() }
        : kind === 'death'
          ? { deceasedName: 'Deceased One', deathDate: new Date(2026, 4, 1), deceasedId: oid() }
          : { applicantName: 'Applicant One', applicantId: oid(), type: 'common', purpose: 'Visa' };
    const reg: Record<string, any> = { _id: oid(), kind, tenantId, status: 'approved', ...base, ...extra };
    regs.push(reg);
    return reg;
  };

  beforeEach(() => {
    log = captureConsoleError();
    world = makeCertificateWorld();
    regs = [];
    lookups = [];
    regFailures = [];
    undoStubs = [];
    texts = [];
    for (const [Model, kind] of [[NikahRegistration, 'nikah'], [DeathRegistration, 'death'], [NOC, 'noc']] as Array<[any, Kind]>) {
      const previous = Model.findOne;
      Model.findOne = async (filter: any) => {
        lookups.push({ kind, filter });
        await new Promise<void>((resolve) => setImmediate(resolve));
        const failure = regFailures.shift();
        if (failure) throw failure;
        return regs.find((r) => r.kind === kind && matches(r, filter)) || null;
      };
      undoStubs.push(() => { Model.findOne = previous; });
    }
    // record every string written into the PDF so the tests can see where its content came from
    const realText = (PDFDocument as any).prototype.text;
    (PDFDocument as any).prototype.text = function (this: any, t: any, ...rest: any[]) {
      texts.push(String(t));
      return realText.call(this, t, ...rest);
    };
    undoStubs.push(() => { (PDFDocument as any).prototype.text = realText; });
  });
  afterEach(() => {
    undoStubs.reverse().forEach((undo) => undo());
    world.restore();
    log.restore();
  });

  const valid = () => world.certs.store.docs.filter((d) => d.status === 'valid');
  const counterSeq = (type = 'nikah') => world.counters.store.docs.find((c) => c._id === `cert:${type}:${YEAR}`)?.seq ?? 0;
  const orphanLines = () => log.lines.filter((l) => l.startsWith('[ORPHAN OBJECT]'));
  const issueBody = (kind: Kind, reg: Record<string, any>) => ({ type: kind, registrationId: String(reg._id) });
  const http = (tenant: string, body: any, user: any = { name: 'Admin' }) => call(issueCertificateHandler, { tenantId: tenant, body, user });
  const waitFor = async (condition: () => boolean, ms = 2000) => {
    const end = Date.now() + ms;
    while (!condition()) {
      if (Date.now() > end) throw new Error('timed out waiting for the test condition');
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  };
  const stub = (target: any, key: string, impl: any) => {
    const previous = target[key];
    target[key] = impl;
    undoStubs.push(() => { target[key] = previous; });
    return () => { target[key] = previous; };
  };

  // =====================================================================================================
  // (1) concurrency at the HTTP layer
  // =====================================================================================================

  test('20 parallel HTTP requests for one registration: one 201, nineteen 200 alreadyIssued, one number, one PDF', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const replies = await Promise.all(Array.from({ length: 20 }, () => http(tenant, issueBody('nikah', reg))));
    assert.equal(replies.filter((r) => r.status === 201).length, 1);
    assert.equal(replies.filter((r) => r.status === 200 && r.body.alreadyIssued === true).length, 19);
    assert.equal(new Set(replies.map((r) => r.body.data.certificateNo)).size, 1);
    assert.equal(world.certs.store.docs.length, 1);
    assert.equal(counterSeq(), 1);
    assert.equal(world.storage.puts.length, 1);
    assert.deepEqual(world.storage.deletes, []);
    assert.deepEqual([...world.storage.objects], [world.certs.store.docs[0].pdfKey], 'the one retained PDF is the one the certificate points at');
    assert.equal(world.claims.store.docs.length, 0);
    assert.equal(regs.length, 1);
    assert.equal(lookups.length, 1, 'only the claim owner loaded the registration');
  });

  // =====================================================================================================
  // (2) / (3) repeats and certificates that already exist
  // =====================================================================================================

  test('five sequential identical requests: 201 then four 200s with the same number; one number, one upload', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const first = await http(tenant, issueBody('nikah', reg));
    assert.equal(first.status, 201);
    const rest = [];
    for (let i = 0; i < 4; i++) rest.push(await http(tenant, issueBody('nikah', reg)));
    assert.ok(rest.every((r) => r.status === 200 && r.body.alreadyIssued === true));
    assert.ok(rest.every((r) => r.body.data.certificateNo === first.body.data.certificateNo));
    assert.equal(counterSeq(), 1);
    assert.equal(world.storage.puts.length, 1);
    assert.equal(world.claims.store.count('create'), 1);
  });

  test('a certificate that already exists (made earlier, with its issueKey) is returned: no claim, no number, no registration lookup', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    world.certs.store.insert({
      tenantId: tenant, certificateNo: no(41), type: 'nikah', registrationId: String(reg._id), issuedBy: 'earlier',
      issueDate: new Date(), pdfKey: `${world.prefix}certificates/${tenant}/earlier.pdf`, status: 'valid',
      issueKey: certificateIssueKey(tenant, 'nikah', reg._id),
    });
    const reply = await http(tenant, issueBody('nikah', reg));
    assert.equal(reply.status, 200);
    assert.equal(reply.body.alreadyIssued, true);
    assert.equal(reply.body.data.certificateNo, no(41));
    assert.equal(world.claims.store.count('create'), 0);
    assert.equal(counterSeq(), 0);
    assert.equal(lookups.length, 0);
    assert.equal(world.storage.puts.length, 0);
  });

  test('CURRENT BEHAVIOUR: an existing valid certificate is returned even if its registration is no longer approved', async () => {
    // The "already issued" answer comes before the registration is read. Revoking is the way to withdraw a
    // certificate; changing a registration back does not. (Product decision if this should differ.)
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const first = await http(tenant, issueBody('nikah', reg));
    assert.equal(first.status, 201);
    reg.status = 'rejected';
    const again = await http(tenant, issueBody('nikah', reg));
    assert.equal(again.status, 200);
    assert.equal(again.body.data.certificateNo, first.body.data.certificateNo);
  });

  // =====================================================================================================
  // (4) claim timeout / takeover
  // =====================================================================================================

  test('a waiter takes over a claim that becomes stale while it is waiting, and completes the issue', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    certificateIssueTuning.staleMs = 60;
    certificateIssueTuning.waitMs = 30_000;
    world.claims.store.insert({ _id: certificateIssueKey(tenant, 'nikah', reg._id), token: 'crashed', claimedAt: new Date() });
    const result = await issueCertificateDetailed('nikah', String(reg._id), tenant, 'Admin');
    assert.equal(result.created, true);
    assert.equal(world.claims.store.docs.length, 0);
    assert.equal(counterSeq(), 1);
  });

  test('takeover while the old owner is mid-upload: one certificate, the loser PDF removed once, the winner PDF kept', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const key = certificateIssueKey(tenant, 'nikah', reg._id);
    let release!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    let ownerAKey = '';
    world.storage.gatePut.push((k) => { ownerAKey = k; return hold; }); // owner A's upload is paused

    const a = issueCertificateDetailed('nikah', String(reg._id), tenant, 'A');
    await waitFor(() => world.storage.commands.includes('PutObjectCommand'));
    assert.equal(world.claims.store.docs.length, 1, 'A holds the claim');
    world.claims.store.docs[0].claimedAt = new Date(Date.now() - certificateIssueTuning.staleMs - 1000); // A looks crashed

    const b = await issueCertificateDetailed('nikah', String(reg._id), tenant, 'B'); // takes over and finishes
    assert.equal(b.created, true);
    assert.equal(world.claims.store.docs.length, 0, 'B released its claim');

    release(); // A wakes up and tries to save
    const aResult = await a;
    assert.equal(aResult.created, false, 'A lost: the unique issueKey index let only one certificate in');
    assert.equal(aResult.certificate.certificateNo, b.certificate.certificateNo);
    assert.equal(world.certs.store.docs.length, 1);
    assert.equal(world.certs.store.docs[0].issueKey, key);
    assert.deepEqual(world.storage.deletes, [ownerAKey], "exactly A's own upload was removed, once");
    assert.deepEqual([...world.storage.objects], [b.certificate.pdfKey]);
    assert.equal(world.claims.store.docs.length, 0, "A's late release removed nothing of B's");
    assert.equal(counterSeq(), 2, 'GAP: A consumed a number it never published (numbers may skip, never repeat)');
  });

  // =====================================================================================================
  // (5) failure at every step: claim released, this request's upload discarded, retry succeeds, number gap
  // =====================================================================================================

  interface Step {
    name: string;
    /** numbers consumed by the FAILED request (reached allocation) */
    consumed: number;
    expectedError: RegExp | ((e: any) => boolean);
    issuedBy?: string;
    /** installs the failure; may return a function that removes it again before the retry */
    inject: () => (() => void) | void;
    uploaded?: boolean;
  }
  const boom = (name: string) => new Error(`boom ${name}`);
  const steps = (): Step[] => [
    { name: 'registration load', consumed: 0, expectedError: /boom registration load/, inject: () => { regFailures.push(boom('registration load')); } },
    {
      name: 'tenant lookup', consumed: 0, expectedError: /boom tenant lookup/,
      inject: () => stub(Tenant, 'findById', () => ({ select: async () => { throw boom('tenant lookup'); } })),
    },
    { name: 'number allocation', consumed: 0, expectedError: /boom number allocation/, inject: () => { world.counters.store.failOn('Counter.findOneAndUpdate', boom('number allocation')); } },
    {
      name: 'number-in-use check', consumed: 1, expectedError: /boom number check/,
      inject: () => { world.certs.store.failOn('Certificate.exists', boom('number check'), 1, (f: any) => 'certificateNo' in f); },
    },
    { name: 'document validation', consumed: 1, issuedBy: '', expectedError: (e: any) => e?.name === 'ValidationError', inject: () => undefined },
    { name: 'claim refresh', consumed: 1, expectedError: /boom claim refresh/, inject: () => { world.claims.store.failOn('CertificateClaim.findOneAndUpdate', boom('claim refresh')); } },
    {
      name: 'PDF render', consumed: 1, expectedError: /boom render/,
      inject: () => stub(QRCode, 'toBuffer', async () => { throw boom('render'); }),
    },
    { name: 'upload', consumed: 1, expectedError: /boom upload/, inject: () => { world.storage.failPut = [boom('upload')]; } },
    { name: 'certificate save', consumed: 1, uploaded: true, expectedError: /boom save/, inject: () => { world.certs.store.failOn('Certificate.save', boom('save')); } },
  ];

  for (const index of steps().keys()) {
    test(`failure at step ${index + 1} (${steps()[index].name}): claim released, upload discarded, retry succeeds, number gap as documented`, async () => {
      const step = steps()[index];
      const tenant = newId();
      const reg = addReg('nikah', tenant);
      const undo = step.inject();

      await assert.rejects(() => issueCertificate('nikah', String(reg._id), tenant, step.issuedBy ?? 'Admin'), step.expectedError);
      if (undo) undo();

      assert.equal(world.claims.store.docs.length, 0, 'the claim is released at once, so the retry does not wait');
      assert.equal(world.certs.store.docs.length, 0);
      assert.equal(world.storage.puts.length, step.uploaded ? 1 : 0);
      assert.deepEqual(world.storage.deletes, step.uploaded ? world.storage.puts : [], "only this request's own upload is removed");
      assert.equal(world.storage.objects.size, 0, 'nothing is left in storage');
      assert.deepEqual(orphanLines(), [], 'a clean discard leaves no orphan marker');
      assert.equal(counterSeq(), step.consumed, 'a number is consumed only by a request that reached allocation');

      const retry = await issueCertificateDetailed('nikah', String(reg._id), tenant, 'Admin');
      assert.equal(retry.created, true);
      assert.equal(retry.certificate.certificateNo, no(step.consumed + 1), 'the retry takes the NEXT number: a skipped number is a gap, never a repeat');
      assert.equal(valid().length, 1);
      assert.equal(world.storage.objects.size, 1);
      assert.equal(world.claims.store.docs.length, 0);
    });
  }

  test('exhausted number attempts (counter behind existing data): 503, nothing uploaded, claim released, retry succeeds past the gap', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    world.counters.store.insert({ _id: `cert:nikah:${YEAR}`, seq: 0 });
    for (let n = 1; n <= 5; n++) {
      world.certs.store.insert({
        tenantId: newId(), certificateNo: no(n), type: 'nikah', registrationId: newId(), issuedBy: 'x', issueDate: new Date(),
        pdfKey: `${world.prefix}certificates/other/${n}.pdf`, status: 'valid',
      });
    }
    await assert.rejects(
      () => issueCertificate('nikah', String(reg._id), tenant, 'Admin'),
      (e: any) => e.statusCode === 503
    );
    assert.equal(world.storage.puts.length, 0, 'taken numbers are skipped without rendering or uploading');
    assert.equal(world.claims.store.docs.length, 0);
    assert.equal(counterSeq(), 5, 'GAP: five numbers were skipped because they already existed');
    const retry = await issueCertificate('nikah', String(reg._id), tenant, 'Admin');
    assert.equal(retry.certificateNo, no(6));
  });

  test('a claim that cannot be released never masks the original error and expires by itself', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    world.certs.store.failOn('Certificate.save', boom('save'));
    world.claims.store.failOn('CertificateClaim.deleteOne', boom('release'));
    await assert.rejects(() => issueCertificate('nikah', String(reg._id), tenant, 'Admin'), /boom save/);
    assert.equal(world.claims.store.docs.length, 1, 'left behind');
    assert.ok(log.lines.some((l) => l.includes('could not release the issue claim')));
    assert.ok(!log.lines.join('\n').includes('boom release'), 'only the error class is logged');

    certificateIssueTuning.waitMs = 40;
    await assert.rejects(() => issueCertificate('nikah', String(reg._id), tenant, 'Admin'), CertificateIssueInProgressError);
    world.claims.store.docs[0].claimedAt = new Date(Date.now() - certificateIssueTuning.staleMs - 1000); // time passes
    const retry = await issueCertificateDetailed('nikah', String(reg._id), tenant, 'Admin');
    assert.equal(retry.created, true);
  });

  test('a claim that cannot be released after SUCCESS still returns the certificate; repeats do not need the claim', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    world.claims.store.failOn('CertificateClaim.deleteOne', boom('release'));
    const first = await issueCertificateDetailed('nikah', String(reg._id), tenant, 'Admin');
    assert.equal(first.created, true);
    const again = await issueCertificateDetailed('nikah', String(reg._id), tenant, 'Admin');
    assert.equal(again.created, false);
    assert.equal(again.certificate.certificateNo, first.certificate.certificateNo);
  });

  test('HTTP: a storage failure answers 500 with plain copy, no storage text, and a retry succeeds', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    world.storage.failPut = [Object.assign(new Error('AccessDenied AKIA-SECRET-KEY bucket=prod'), { name: 'AccessDenied' })];
    const failed = await http(tenant, issueBody('nikah', reg));
    assert.equal(failed.status, 500);
    assert.equal(failed.body.message, "We couldn't issue the certificate. Please try again.");
    assert.ok(!/AKIA|bucket|AccessDenied/.test(JSON.stringify(failed.body)));
    assert.equal(world.claims.store.docs.length, 0);
    const retry = await http(tenant, issueBody('nikah', reg));
    assert.equal(retry.status, 201);
  });

  // =====================================================================================================
  // (6) database failure AFTER upload
  // =====================================================================================================

  test('after a failed save only this request key is deleted: other objects (referenced or not) are never touched', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const referencedByCertificate = `${world.prefix}certificates/${tenant}/kept-cert.pdf`;
    const referencedByDocument = `${world.prefix}${tenant}/kept-doc.pdf`;
    const unreferencedForeign = `${world.prefix}certificates/${tenant}/someone-elses-inflight.pdf`;
    for (const k of [referencedByCertificate, referencedByDocument, unreferencedForeign]) world.storage.objects.add(k);
    world.certs.store.insert({
      tenantId: tenant, certificateNo: no(77), type: 'nikah', registrationId: newId(), issuedBy: 'x', issueDate: new Date(),
      pdfKey: referencedByCertificate, status: 'valid', issueKey: certificateIssueKey(tenant, 'nikah', newId()),
    });
    world.documents.store.insert({
      tenantId: tenant, ownerType: 'member', documentType: 'other', fileKey: referencedByDocument, fileName: 'a.pdf',
      mimeType: 'application/pdf', size: 1, uploadedByUserId: newId(), status: 'pending',
    });
    world.certs.store.failOn('Certificate.save', boom('save'));
    await assert.rejects(() => issueCertificate('nikah', String(reg._id), tenant, 'Admin'), /boom save/);
    assert.equal(world.storage.deletes.length, 1);
    assert.equal(world.storage.deletes[0], world.storage.puts[0]);
    for (const k of [referencedByCertificate, referencedByDocument, unreferencedForeign]) assert.ok(world.storage.objects.has(k), `untouched: ${k}`);
    assert.equal(world.storage.objects.size, 3);
  });

  test('duplicate issueKey with a findable winner: the winner is returned, this upload removed once, the winner PDF untouched', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const winnerKey = `${world.prefix}certificates/${tenant}/winner.pdf`;
    world.storage.objects.add(winnerKey);
    // the unique index refuses the second valid certificate (the row is inserted after the first lookups)
    const rows = world.certs.store.docs;
    world.storage.gatePut.push(async () => {
      world.certs.store.insert({
        tenantId: tenant, certificateNo: no(900), type: 'nikah', registrationId: String(reg._id), issuedBy: 'w', issueDate: new Date(),
        pdfKey: winnerKey, status: 'valid', issueKey: certificateIssueKey(tenant, 'nikah', reg._id),
      });
    });
    const result = await issueCertificateDetailed('nikah', String(reg._id), tenant, 'Admin');
    assert.equal(result.created, false);
    assert.equal(result.certificate.certificateNo, no(900));
    assert.equal(rows.length, 1);
    assert.deepEqual(world.storage.deletes, world.storage.puts, 'only this request upload was deleted, exactly once');
    assert.ok(world.storage.objects.has(winnerKey));
    assert.deepEqual(orphanLines(), []);
  });

  test('duplicate issueKey but the winner cannot be found: 409 CERTIFICATE_BEING_ISSUED, this upload removed once', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    world.certs.store.failOn('Certificate.save', Object.assign(new Error('E11000'), { code: 11000, keyPattern: { issueKey: 1 } }));
    await assert.rejects(
      () => issueCertificate('nikah', String(reg._id), tenant, 'Admin'),
      (e: any) => e instanceof CertificateIssueInProgressError && e.code === 'CERTIFICATE_BEING_ISSUED' && e.statusCode === 409
    );
    assert.deepEqual(world.storage.deletes, world.storage.puts);
    assert.equal(world.storage.puts.length, 1);
    assert.equal(world.storage.objects.size, 0);
    assert.equal(world.claims.store.docs.length, 0);
  });

  test('duplicate issueKey + failing delete: the winner is still returned, the orphan is reported (log + reconciliation) once', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const calls: any[] = [];
    const real = reconciliation.reportReconciliationRequired;
    (reconciliation as any).reportReconciliationRequired = async (input: any) => { calls.push(input); return { logged: true, persisted: true }; };
    try {
      world.storage.failDelete = () => Object.assign(new Error('AKIA-SECRET'), { name: 'AccessDenied' });
      world.storage.gatePut.push(async () => {
        world.certs.store.insert({
          tenantId: tenant, certificateNo: no(901), type: 'nikah', registrationId: String(reg._id), issuedBy: 'w', issueDate: new Date(),
          pdfKey: `${world.prefix}certificates/${tenant}/w.pdf`, status: 'valid', issueKey: certificateIssueKey(tenant, 'nikah', reg._id),
        });
      });
      const result = await issueCertificateDetailed('nikah', String(reg._id), tenant, 'Admin');
      assert.equal(result.created, false, 'a failed clean-up does not turn a success into an error');
    } finally {
      (reconciliation as any).reportReconciliationRequired = real;
    }
    assert.equal(orphanLines().length, 1);
    assert.ok(orphanLines()[0].includes(world.storage.puts[0]));
    assert.equal(world.storage.deletes.length, 1, 'no retry loop on a failing delete');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].flow, 'private object cleanup');
    assert.match(calls[0].reason, /certificate-save-failed:failed/);
    assert.ok(!JSON.stringify(calls).includes('AKIA-SECRET'));
  });

  test('a reconciliation reporter that throws or rejects never masks the original save error', async () => {
    const real = reconciliation.reportReconciliationRequired;
    try {
      for (const reporter of [
        () => { throw new Error('reporter exploded'); },
        async () => { throw new Error('reporter rejected'); },
      ]) {
        (reconciliation as any).reportReconciliationRequired = reporter;
        world.certs.store.failOn('Certificate.save', boom('save'));
        world.storage.failDelete = () => new Error('delete refused');
        const tenant = newId();
        const reg = addReg('nikah', tenant);
        await assert.rejects(() => issueCertificate('nikah', String(reg._id), tenant, 'Admin'), /boom save/);
      }
      await new Promise((resolve) => setImmediate(resolve)); // let the swallowed rejection settle: no unhandled rejection
    } finally {
      (reconciliation as any).reportReconciliationRequired = real;
    }
    assert.equal(orphanLines().length, 2);
  });

  test('two failed attempts inside one request (number clash, then database down): each upload is deleted exactly once', async () => {
    const dup = Object.assign(new Error('E11000'), { code: 11000, keyPattern: { certificateNo: 1 } });
    world.certs.store.failOn('Certificate.save', dup);
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    world.certs.store.failOn('Certificate.save', boom('save'));
    await assert.rejects(() => issueCertificate('nikah', String(reg._id), tenant, 'Admin'), /boom save/);
    assert.equal(world.storage.puts.length, 2);
    assert.equal(new Set(world.storage.puts).size, 2);
    assert.deepEqual([...world.storage.deletes].sort(), [...world.storage.puts].sort());
    assert.equal(world.storage.objects.size, 0);
    assert.equal(counterSeq(), 2, 'GAP: two numbers consumed, none published');
  });

  // =====================================================================================================
  // (7) revoked certificates (CURRENT behaviour; re-issue after revoke is a PRODUCT decision)
  // =====================================================================================================

  test('CURRENT BEHAVIOUR: revoke clears issueKey, a NEW certificate with a NEW number is issued; the revoked one and its PDF stay', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const first = await http(tenant, issueBody('nikah', reg));
    assert.equal(first.status, 201);
    const firstKey = world.certs.store.docs[0].pdfKey;

    const revoked = await call(revokeCertificate, { tenantId: tenant, params: { id: String(first.body.data._id) }, body: { reason: 'Wrong spelling' } });
    assert.equal(revoked.status, 200);

    const second = await http(tenant, issueBody('nikah', reg));
    assert.equal(second.status, 201, 'a revoked certificate does not count as issued');
    assert.notEqual(second.body.data.certificateNo, first.body.data.certificateNo);
    assert.equal(second.body.data.certificateNo, no(2));

    const old = world.certs.store.docs.find((d) => d.certificateNo === first.body.data.certificateNo);
    assert.equal(old.status, 'revoked');
    assert.equal(old.revokedReason, 'Wrong spelling');
    assert.equal(old.pdfKey, firstKey, 'the revoked row keeps pointing at its PDF');
    assert.equal(old.issueKey, undefined);
    assert.deepEqual(world.storage.deletes, [], 'revoking never deletes the PDF');
    assert.ok(world.storage.objects.has(firstKey));
    assert.equal(world.storage.objects.size, 2);

    const verify = await call(verifyCertificate, { params: { certificateNo: first.body.data.certificateNo } });
    assert.equal(verify.body.data.status, 'revoked', 'the public verify page keeps showing the old number as revoked');
    assert.equal(valid().length, 1);
  });

  test('after a revoke, 20 parallel issue requests still produce exactly one new certificate', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const first = await issueCertificateDetailed('nikah', String(reg._id), tenant, 'Admin');
    await call(revokeCertificate, { tenantId: tenant, params: { id: String(first.certificate._id) }, body: { reason: 'r' } });
    const results = await Promise.all(Array.from({ length: 20 }, () => issueCertificateDetailed('nikah', String(reg._id), tenant, 'Admin')));
    assert.equal(results.filter((r) => r.created).length, 1);
    assert.equal(world.certs.store.docs.length, 2);
    assert.equal(valid().length, 1);
    assert.equal(world.storage.puts.length, 2);
    assert.equal(counterSeq(), 2);
  });

  test('revoke is tenant scoped and needs a reason: another Mahallu cannot revoke it; nothing changes', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const first = await issueCertificateDetailed('nikah', String(reg._id), tenant, 'Admin');
    const foreign = await call(revokeCertificate, { tenantId: newId(), params: { id: String(first.certificate._id) }, body: { reason: 'x' } });
    assert.equal(foreign.status, 404);
    const noReason = await call(revokeCertificate, { tenantId: tenant, params: { id: String(first.certificate._id) }, body: {} });
    assert.equal(noReason.status, 400);
    assert.equal(valid().length, 1);
    assert.equal(world.certs.store.docs[0].issueKey, certificateIssueKey(tenant, 'nikah', reg._id));
  });

  // =====================================================================================================
  // (8) registration state and tenant scope
  // =====================================================================================================

  test('only approved registrations can be issued: pending / correction_required / rejected are 400 for every type, with no side effects', async () => {
    const tenant = newId();
    for (const kind of ['nikah', 'death', 'noc'] as Kind[]) {
      for (const status of ['pending', 'correction_required', 'rejected']) {
        const reg = addReg(kind, tenant, { status });
        const reply = await http(tenant, issueBody(kind, reg));
        assert.equal(reply.status, 400, `${kind}/${status}`);
        assert.match(reply.body.message, /must be approved/);
      }
    }
    assert.equal(world.certs.store.docs.length, 0);
    assert.equal(world.counters.store.docs.length, 0, 'no number consumed');
    assert.equal(world.storage.puts.length, 0);
    assert.equal(world.claims.store.docs.length, 0);
    assert.equal(world.claims.store.count('create'), 9, 'a claim was taken and released each time');
  });

  test('each approved type is issued with its own prefix and sequence', async () => {
    const tenant = newId();
    const nikah = addReg('nikah', tenant);
    const death = addReg('death', tenant);
    const noc = addReg('noc', tenant);
    const numbers = [];
    for (const [kind, reg] of [['nikah', nikah], ['death', death], ['noc', noc]] as Array<[Kind, any]>) {
      const reply = await http(tenant, issueBody(kind, reg));
      assert.equal(reply.status, 201);
      numbers.push(reply.body.data.certificateNo);
    }
    assert.deepEqual(numbers, [no(1, 'NK'), no(1, 'DT'), no(1, 'NC')]);
  });

  test('a registration of ANOTHER Mahallu is refused (400), looked up with the caller tenant, and issues nothing', async () => {
    const owner = newId();
    const intruder = newId();
    const reg = addReg('nikah', owner);
    const refused = await http(intruder, issueBody('nikah', reg));
    assert.equal(refused.status, 400);
    assert.match(refused.body.message, /couldn't find that nikah registration/);
    assert.equal(String(lookups[0].filter.tenantId), intruder, 'the registration is read inside the caller tenant only');
    assert.equal(world.certs.store.docs.length, 0);
    assert.equal(world.storage.puts.length, 0);
    assert.equal(world.claims.store.docs.length, 0);
    assert.equal(counterSeq(), 0);
    // the real owner is unaffected by the refused attempt
    assert.equal((await http(owner, issueBody('nikah', reg))).status, 201);
    assert.equal(String(world.certs.store.docs[0].tenantId), owner);
  });

  test('a registration that does not exist (or was deleted before the request) is a 400, not a 500', async () => {
    const tenant = newId();
    const gone = addReg('death', tenant);
    regs.length = 0;
    const reply = await http(tenant, issueBody('death', gone));
    assert.equal(reply.status, 400);
    assert.match(reply.body.message, /couldn't find that death registration/);
    assert.equal(world.claims.store.docs.length, 0);
    assert.equal(counterSeq(), 0);
  });

  test('CURRENT BEHAVIOUR: a registration deleted or changed AFTER it was read still gets its certificate (the read is a snapshot)', async () => {
    // The registration is read once, under the claim. There is no second check before the save. The window
    // is the number allocation + render + upload (milliseconds). Product decision if it must be closed.
    const tenant = newId();
    const deleted = addReg('nikah', tenant);
    const rejectedLater = addReg('nikah', tenant);
    world.storage.gatePut.push(async () => { regs.splice(regs.indexOf(deleted), 1); });
    const a = await issueCertificateDetailed('nikah', String(deleted._id), tenant, 'Admin');
    assert.equal(a.created, true);
    world.storage.gatePut.push(async () => { rejectedLater.status = 'rejected'; });
    const b = await issueCertificateDetailed('nikah', String(rejectedLater._id), tenant, 'Admin');
    assert.equal(b.created, true);
    assert.equal(valid().length, 2);
  });

  test('the request itself is validated before anything runs: unknown type, malformed id, missing Mahallu are 400s', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    for (const body of [
      { type: 'passport', registrationId: String(reg._id) },
      { type: ['nikah'], registrationId: String(reg._id) },
      { type: 'nikah', registrationId: 'not-an-id' },
      { type: 'nikah', registrationId: { $ne: null } },
      { type: 'nikah' },
    ]) {
      assert.equal((await http(tenant, body)).status, 400, JSON.stringify(body));
    }
    const noTenant = await call(issueCertificateHandler, { body: issueBody('nikah', reg), user: { name: 'A' } });
    assert.equal(noTenant.status, 400);
    assert.equal(world.claims.store.count('create'), 0);
    assert.equal(lookups.length, 0);
    assert.equal(world.storage.commands.length, 0);
  });

  // =====================================================================================================
  // (9) no unbounded waiting
  // =====================================================================================================

  test('shipped tuning: waiters give up after 10 s, polling every 200 ms, and a claim is stale after 120 s (longer than any wait)', () => {
    assert.equal(SHIPPED_TUNING.waitMs, 10_000);
    assert.equal(SHIPPED_TUNING.pollMs, 200);
    assert.equal(SHIPPED_TUNING.staleMs, 120_000);
    assert.ok(SHIPPED_TUNING.staleMs > SHIPPED_TUNING.waitMs);
  });

  test('a waiter behind a live claim answers 409 after the wait and not much later, with the retry hint, and consumes nothing', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    world.claims.store.insert({ _id: certificateIssueKey(tenant, 'nikah', reg._id), token: 'busy', claimedAt: new Date() });
    certificateIssueTuning.waitMs = 120;
    const started = Date.now();
    const reply = await http(tenant, issueBody('nikah', reg));
    const elapsed = Date.now() - started;
    assert.equal(reply.status, 409);
    assert.equal(reply.body.code, 'CERTIFICATE_BEING_ISSUED');
    assert.equal(reply.body.retryAfterSeconds, 3);
    assert.ok(elapsed >= 100 && elapsed < 8000, `waited ${elapsed} ms`);
    assert.equal(counterSeq(), 0);
    assert.equal(world.storage.commands.length, 0);
    assert.equal(world.claims.store.docs.length, 1, "the other owner's claim is untouched");
  });

  // =====================================================================================================
  // (10) subject ids and PDF fields come from the registration, not the request
  // =====================================================================================================

  test('nikah: subject ids, PDF text, tenant, number, status and issuer come from the registration / session, not the body', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const otherTenant = newId();
    const reply = await http(
      tenant,
      {
        ...issueBody('nikah', reg),
        tenantId: otherTenant, subjectMemberIds: [newId()], pdfKey: 'uploads/documents/evil.pdf', certificateNo: 'NK-1999-0001',
        status: 'revoked', issuedBy: 'Evil', issueKey: 'x', groomName: 'Evil Groom', fields: [['Groom', 'Evil Groom']],
      },
      { name: 'Admin A' }
    );
    assert.equal(reply.status, 201);
    const row = world.certs.store.docs[0];
    assert.equal(String(row.tenantId), tenant);
    assert.equal(row.certificateNo, no(1));
    assert.equal(row.status, 'valid');
    assert.equal(row.issuedBy, 'Admin A');
    assert.equal(row.issueKey, certificateIssueKey(tenant, 'nikah', reg._id));
    assert.deepEqual(row.subjectMemberIds.map(String), [String(reg.groomId), String(reg.brideId)]);
    assert.ok(row.pdfKey.startsWith(`${world.prefix}certificates/${tenant}/`), 'the PDF is stored under the caller tenant folder');
    assert.ok(!row.pdfKey.includes('evil'));
    assert.ok(texts.includes('Groom One') && texts.includes('Bride One') && texts.includes('Test Mahallu'));
    assert.ok(texts.some((t) => t.includes(no(1))));
    assert.ok(!texts.some((t) => /Evil/.test(t)), 'nothing from the request body reaches the PDF');
  });

  test('death and NOC: subject member comes from the registration and the PDF is built from its fields', async () => {
    const tenant = newId();
    const death = addReg('death', tenant);
    const noc = addReg('noc', tenant, { applicantId: undefined });
    const d = await http(tenant, { ...issueBody('death', death), subjectMemberIds: [newId()], deceasedName: 'Evil' });
    const n = await http(tenant, { ...issueBody('noc', noc), subjectMemberIds: [newId()], applicantName: 'Evil' });
    assert.equal(d.status, 201);
    assert.equal(n.status, 201);
    const rows = world.certs.store.docs;
    assert.deepEqual(rows.find((r) => r.type === 'death').subjectMemberIds.map(String), [String(death.deceasedId)]);
    assert.deepEqual(rows.find((r) => r.type === 'noc').subjectMemberIds ?? [], [], 'no applicant member on the NOC: no subject, whatever the body says');
    assert.ok(texts.includes('Deceased One') && texts.includes('Applicant One'));
    assert.ok(!texts.some((t) => /Evil/.test(t)));
  });

  test('issuer defaults to "Mahall Admin" when the session has no name', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const reply = await http(tenant, issueBody('nikah', reg), { name: undefined });
    assert.equal(reply.status, 201);
    assert.equal(world.certs.store.docs[0].issuedBy, 'Mahall Admin');
  });

  // =====================================================================================================
  // numbering: the counter is seeded above everything already issued, revoked or not, by any Mahallu
  // =====================================================================================================

  test('first use of a counter is seeded above revoked and other-Mahallu certificates of that type and year only', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const legacy = (certificateNo: string, status = 'valid') =>
      world.certs.store.insert({
        tenantId: newId(), certificateNo, type: 'nikah', registrationId: newId(), issuedBy: 'x', issueDate: new Date(),
        pdfKey: `${world.prefix}certificates/o/${certificateNo}.pdf`, status,
      });
    legacy(no(5), 'revoked');
    legacy(no(3));
    legacy(`NK-${YEAR - 1}-0099`);
    legacy(no(50, 'DT'));
    const cert = await issueCertificate('nikah', String(reg._id), tenant, 'Admin');
    assert.equal(cert.certificateNo, no(6));
    assert.equal(counterSeq(), 6);
  });

  test('wasIssuedNow is true only for the call that created the certificate', async () => {
    const tenant = newId();
    const reg = addReg('nikah', tenant);
    const [a, b] = await Promise.all([
      issueCertificate('nikah', String(reg._id), tenant, 'Admin'),
      issueCertificate('nikah', String(reg._id), tenant, 'Admin'),
    ]);
    assert.equal([a, b].filter(wasIssuedNow).length, 1);
  });
});
