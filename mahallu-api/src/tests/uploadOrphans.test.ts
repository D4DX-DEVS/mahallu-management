import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Certificate from '../models/Certificate';
import * as uploadService from '../services/uploadService';
import * as reconciliation from '../utils/reconciliation';
import { issueCertificate, UploadTracker } from '../services/certificateService';
import { makeCertificateWorld, newId, captureConsoleError, CertificateWorld } from './support/certificateWorld';

// One root suite so this file's stubs never leak into other suites in the single `npm test` process.
describe('[isolated] upload orphans', () => {
  /**
   * Certificate flow: number -> PDF rendered -> uploaded to private storage -> record saved.
   * An upload whose record could not be saved must be removed, but ONLY the upload of this request,
   * NEVER a key some record references, and a failed clean-up must be recorded for an operator.
   * The storage client is an in-memory fake injected into uploadService: no network, no real bucket.
   */
  let world: CertificateWorld;
  let log: ReturnType<typeof captureConsoleError>;

  beforeEach(() => {
    log = captureConsoleError();
    world = makeCertificateWorld();
  });
  afterEach(() => {
    world.restore();
    log.restore();
  });

  const orphanLines = () => log.lines.filter((l) => l.startsWith('[ORPHAN OBJECT]'));

  test('a save failure after upload deletes exactly that key, once', async () => {
    world.certs.store.failOn('Certificate.save', new Error('database is down'));
    await assert.rejects(() => issueCertificate('nikah', newId(), newId(), 'Admin'), /database is down/);
    assert.equal(world.storage.puts.length, 1);
    assert.deepEqual(world.storage.deletes, [world.storage.puts[0]]);
    assert.equal(world.storage.objects.size, 0);
    assert.deepEqual(orphanLines(), [], 'a clean discard leaves no orphan marker');
  });

  test('a duplicate-number race: the failed attempt upload is deleted once, the final certificate PDF is kept', async () => {
    const dup = Object.assign(new Error('E11000'), { code: 11000, keyPattern: { certificateNo: 1 } });
    world.certs.store.failOn('Certificate.save', dup);
    const cert = await issueCertificate('nikah', newId(), newId(), 'Admin');
    assert.equal(world.storage.puts.length, 2);
    assert.deepEqual(world.storage.deletes, [world.storage.puts[0]]);
    assert.deepEqual([...world.storage.objects], [cert.pdfKey]);
  });

  test('when the delete itself fails the ORIGINAL error is still raised and an orphan marker with the key is logged', async () => {
    world.certs.store.failOn('Certificate.save', new Error('database is down'));
    world.storage.failDelete = () => Object.assign(new Error('AKIA-SECRET-ACCESS-DENIED token=abc123'), { name: 'AccessDenied' });
    await assert.rejects(() => issueCertificate('nikah', newId(), newId(), 'Admin'), /database is down/);

    const key = world.storage.puts[0];
    assert.equal(orphanLines().length, 1);
    const payload = JSON.parse(orphanLines()[0].replace('[ORPHAN OBJECT] ', ''));
    assert.deepEqual(Object.keys(payload).sort(), ['key', 'reason']);
    assert.equal(payload.key, key);
    assert.match(payload.reason, /certificate-save-failed/);
    assert.equal(world.storage.deletes.length, 1, 'no retry loop on a failing delete');
    assert.ok(!log.lines.join('\n').includes('AKIA-SECRET'), 'storage error text and secrets are never logged');
    assert.ok(!log.lines.join('\n').includes('abc123'));
  });

  test('a key referenced by a certificate is never deleted', async () => {
    const key = `${world.prefix}certificates/t/x.pdf`;
    world.certs.store.insert({
      tenantId: newId(), certificateNo: 'NK-2026-0001', type: 'nikah', registrationId: newId(),
      issuedBy: 'a', issueDate: new Date(), pdfKey: key, status: 'valid',
    });
    world.storage.objects.add(key);
    assert.equal(await uploadService.discardPrivateObject(key), 'kept-referenced');
    assert.deepEqual(world.storage.deletes, []);
    assert.ok(world.storage.objects.has(key));
  });

  test('a key referenced by an uploaded document is never deleted', async () => {
    const key = `${world.prefix}${newId()}/doc.pdf`;
    world.documents.store.insert({
      tenantId: newId(), ownerType: 'member', documentType: 'other', fileKey: key, fileName: 'a.pdf',
      mimeType: 'application/pdf', size: 1, uploadedByUserId: newId(), status: 'pending',
    });
    assert.equal(await uploadService.discardPrivateObject(key), 'kept-referenced');
    assert.deepEqual(world.storage.deletes, []);
  });

  test('the save succeeded but the caller saw an error (timeout after commit): the PDF is kept', async () => {
    const realSave = Certificate.prototype.save;
    Certificate.prototype.save = async function (this: any, ...args: any[]) {
      await (realSave as any).apply(this, args); // the row IS stored...
      throw new Error('connection reset after commit'); // ...but the caller is told it failed
    } as any;
    try {
      await assert.rejects(() => issueCertificate('nikah', newId(), newId(), 'Admin'), /connection reset/);
    } finally {
      Certificate.prototype.save = realSave;
    }
    assert.equal(world.certs.store.docs.length, 1);
    assert.deepEqual(world.storage.deletes, [], 'the stored certificate still points at its PDF');
    assert.ok(world.storage.objects.has(world.certs.store.docs[0].pdfKey));
    assert.deepEqual(orphanLines(), []);
  });

  test('when "is it referenced?" cannot be answered nothing is deleted (fail closed) and the key is reported', async () => {
    world.certs.store.failOn('Certificate.exists', new Error('database is down'), 5, (filter) => 'pdfKey' in filter);
    world.certs.store.failOn('Certificate.save', new Error('database is down'));
    await assert.rejects(() => issueCertificate('nikah', newId(), newId(), 'Admin'), /database is down/);
    assert.deepEqual(world.storage.deletes, []);
    assert.equal(world.storage.objects.size, 1);
    assert.equal(orphanLines().length, 1);
    assert.match(orphanLines()[0], /unverified/);
    assert.ok(orphanLines()[0].includes(world.storage.puts[0]));
  });

  test('deletePrivateObject refuses keys outside the private documents prefix and keys with ..', async () => {
    const refused = [
      'uploads/notifications/a.jpg',
      'other/documents/a.pdf',
      `${world.prefix}../secrets/a.pdf`,
      `${world.prefix}a/../../b.pdf`,
      `${world.prefix}a/./b.pdf`,
      `${world.prefix}a//b.pdf`,
      `${world.prefix}a\\b.pdf`,
      `${world.prefix}a\u0000b.pdf`,
      world.prefix,
      `${world.prefix}a/`,
      '',
      undefined,
      null,
      42,
    ];
    for (const key of refused) {
      assert.equal(await uploadService.deletePrivateObject(key as any), false, `refused: ${String(key)}`);
      assert.equal(await uploadService.discardPrivateObject(key as any), 'refused');
    }
    assert.deepEqual(world.storage.commands, [], 'the storage client was never called');
    assert.equal(await uploadService.deletePrivateObject(`${world.prefix}certificates/t/ok.pdf`), true);
    assert.deepEqual(world.storage.commands, ['DeleteObjectCommand']);
  });

  test('deleting an object that is already gone is a success, and a double discard deletes once', async () => {
    const key = `${world.prefix}certificates/t/gone.pdf`;
    assert.equal(await uploadService.deletePrivateObject(key), true, 'missing object (S3 204) counts as removed');
    // NoSuchKey / 404 from the provider also counts as success
    uploadService.setStorageClientForTests({
      send: async () => { throw Object.assign(new Error('missing'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } }); },
    });
    assert.equal(await uploadService.deletePrivateObject(key), true);

    uploadService.setStorageClientForTests({ send: async (c: any) => { world.storage.deletes.push(c.input.Key); return {}; } });
    world.storage.deletes.length = 0;
    const tracker = new UploadTracker();
    tracker.track(key);
    assert.equal(await tracker.discardAll('test'), true);
    assert.equal(await tracker.discardAll('test'), true);
    assert.deepEqual(world.storage.deletes, [key], 'second discard is a no-op');
  });

  test('a failing storage delete never throws and returns false; only the error class is logged', async () => {
    uploadService.setStorageClientForTests({ send: async () => { throw Object.assign(new Error('secret endpoint https://x.example key=ZZZ'), { name: 'TimeoutError' }); } });
    assert.equal(await uploadService.deletePrivateObject(`${world.prefix}certificates/t/a.pdf`), false);
    assert.equal(await uploadService.discardPrivateObject(`${world.prefix}certificates/t/a.pdf`), 'failed');
    const text = log.lines.join('\n');
    assert.ok(text.includes('TimeoutError'));
    assert.ok(!text.includes('ZZZ') && !text.includes('x.example'));
  });

  test('the tracker only ever discards keys uploaded by its own request', async () => {
    const mine = `${world.prefix}certificates/t/mine.pdf`;
    const theirs = `${world.prefix}certificates/t/theirs.pdf`;
    world.storage.objects.add(mine).add(theirs);
    const tracker = new UploadTracker();
    tracker.track(mine);
    await tracker.discardAll('test');
    assert.deepEqual(world.storage.deletes, [mine]);
    assert.ok(world.storage.objects.has(theirs));

    const committed = new UploadTracker();
    committed.track(theirs);
    committed.commit(theirs); // a certificate references it now
    await committed.discardAll('test');
    assert.deepEqual(world.storage.deletes, [mine], 'committed uploads are never discarded');
  });

  test('a failed discard also opens a reconciliation issue (file name + tenant, never the secret text)', async () => {
    const calls: any[] = [];
    const real = reconciliation.reportReconciliationRequired;
    (reconciliation as any).reportReconciliationRequired = async (input: any) => { calls.push(input); return { logged: true, persisted: true }; };
    try {
      const tenant = newId();
      world.certs.store.failOn('Certificate.save', new Error('database is down'));
      world.storage.failDelete = () => new Error('AKIA-SECRET');
      await assert.rejects(() => issueCertificate('nikah', newId(), tenant, 'Admin'), /database is down/);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].flow, 'private object cleanup');
      assert.equal(calls[0].step, 'delete orphaned upload');
      assert.equal(String(calls[0].tenantId), tenant);
      assert.match(calls[0].reason, /certificate-save-failed:failed/);
      assert.ok(world.storage.puts[0].includes(calls[0].entityId), 'identifies the stored file by its name');
      assert.ok(!JSON.stringify(calls).includes('AKIA-SECRET'));
    } finally {
      (reconciliation as any).reportReconciliationRequired = real;
    }
  });

  test('reportOrphanedObject logs a structured line with the key and reason only, and never throws', () => {
    uploadService.reportOrphanedObject(`${world.prefix}certificates/t/z.pdf`, 'unit-test');
    assert.equal(orphanLines().length, 1);
    assert.deepEqual(JSON.parse(orphanLines()[0].replace('[ORPHAN OBJECT] ', '')), {
      key: `${world.prefix}certificates/t/z.pdf`,
      reason: 'unit-test',
    });
  });
});
