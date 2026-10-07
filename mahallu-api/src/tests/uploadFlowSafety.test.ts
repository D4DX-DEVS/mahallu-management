import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import Certificate from '../models/Certificate';
import DocumentFile from '../models/DocumentFile';
import * as uploadService from '../services/uploadService';
import * as reconciliation from '../utils/reconciliation';
import { uploadDocument, listDocuments, getDocumentUrl } from '../controllers/documentController';
import { uploadBannerImage, uploadNotificationImage } from '../controllers/uploadController';
import { downloadCertificate, listCertificates, verifyCertificate } from '../controllers/certificateController';
import { oid } from './support/fakeMongo';
import { makeCertificateWorld, newId, captureConsoleError, CertificateWorld } from './support/certificateWorld';

// One root suite so the stubs installed by this file's hooks never leak into other suites when every
// test file is imported into the single `npm test` process.
describe('[isolated] upload flow safety', () => {
  /**
   * Every flow that writes to object storage, checked for the window "uploaded -> record saved":
   *   private documents (documentController), certificate PDFs (certificateService, see the issue suites),
   *   public banner / notification images (uploadController, no record in the same request).
   * Plus: signed-URL endpoints never serve another Mahallu's or another member's object.
   * No database and no object storage is touched: models are in-memory fakes, the client is injected.
   */
  let world: CertificateWorld;
  let log: ReturnType<typeof captureConsoleError>;
  let undoStubs: Array<() => void>;
  const savedEnv: Record<string, string | undefined> = {};
  const ENV_KEYS = ['DO_SPACES_ENDPOINT', 'DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_BUCKET', 'DO_SPACES_CDN_ENDPOINT'];

  beforeEach(() => {
    log = captureConsoleError();
    world = makeCertificateWorld();
    undoStubs = [];
    // dummy values only: the injected client never opens a connection
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
    process.env.DO_SPACES_ENDPOINT = 'https://storage.test.invalid';
    process.env.DO_SPACES_KEY = 'test-key';
    process.env.DO_SPACES_SECRET = 'test-secret';
    process.env.DO_SPACES_BUCKET = 'test-bucket';
    delete process.env.DO_SPACES_CDN_ENDPOINT;
  });
  afterEach(() => {
    undoStubs.reverse().forEach((undo) => undo());
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    world.restore();
    log.restore();
  });

  const stub = (target: any, key: string, impl: any) => {
    const previous = target[key];
    target[key] = impl;
    undoStubs.push(() => { target[key] = previous; });
  };
  const orphanLines = () => log.lines.filter((l) => l.startsWith('[ORPHAN OBJECT]'));
  const run = async (handler: (req: any, res: any) => any, req: Record<string, any>) => {
    const out: { status: number; body: any } = { status: 200, body: undefined };
    const res: any = {
      status(code: number) { out.status = code; return res; },
      json(body: any) { out.body = body; return res; },
      req: { method: 'TEST', originalUrl: '/test' },
    };
    await handler({ params: {}, body: {}, query: {}, user: { role: 'mahall', name: 'Admin' }, ...req }, res);
    return out;
  };

  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0]);
  const PDF = Buffer.from('%PDF-1.4\n%test file\n');
  const HTML = Buffer.from('<html><script>alert(1)</script></html>');
  const file = (buffer: Buffer, mimetype: string, originalname = 'scan.png') => ({ buffer, mimetype, originalname, size: buffer.length });
  const uploadReq = (tenantId: string | undefined, overrides: Record<string, any> = {}) => ({
    tenantId,
    body: { documentType: 'id_proof' },
    file: file(PNG, 'image/png'),
    user: { role: 'member', _id: oid(), memberId: oid() },
    ...overrides,
  });
  const documentRows = () => world.documents.store.docs;

  // =====================================================================================================
  // private documents: upload -> DocumentFile.create
  // =====================================================================================================

  test('document upload: the object is private, stored under the tenant folder, and the record points at it', async () => {
    const tenant = newId();
    const reply = await run(uploadDocument, uploadReq(tenant, { file: file(PNG, 'application/pdf', '../../evil<name>.png') }));
    assert.equal(reply.status, 201);
    assert.equal(world.storage.puts.length, 1);
    const [row] = documentRows();
    assert.equal(row.fileKey, world.storage.puts[0]);
    assert.ok(row.fileKey.startsWith(`${world.prefix}${tenant}/`));
    assert.equal(world.storage.putInputs[0].ACL, 'private');
    assert.equal(world.storage.putInputs[0].ContentType, 'image/png', 'the bytes decide the type, not the claimed Content-Type');
    assert.equal(row.mimeType, 'image/png');
    assert.equal(row.fileName, 'evilname.png');
    assert.deepEqual(world.storage.deletes, []);
  });

  test('document upload rejected before the upload: nothing is ever sent to storage', async () => {
    const tenant = newId();
    const cases: Array<[string, Record<string, any>]> = [
      ['no file', { file: undefined }],
      ['no tenant', { tenantId: undefined }],
      ['unknown document type', { body: { documentType: 'passport' } }],
      ['unknown owner type', { body: { documentType: 'id_proof', ownerType: 'tenant' } }],
      ['HTML claiming to be a PDF', { file: file(HTML, 'application/pdf', 'a.pdf') }],
      ['GIF (an image the documents flow does not take)', { file: file(Buffer.from('GIF89a......'), 'image/gif', 'a.gif') }],
      ['truncated file', { file: file(Buffer.from([0x89, 0x50]), 'image/png') }],
    ];
    for (const [label, overrides] of cases) {
      const reply = await run(uploadDocument, uploadReq(tenant, overrides));
      assert.equal(reply.status, 400, label);
    }
    assert.deepEqual(world.storage.commands, []);
    assert.equal(documentRows().length, 0);
  });

  test('a failed storage upload: 500 with plain copy, no record, nothing to delete', async () => {
    world.storage.failPut = [Object.assign(new Error('AccessDenied AKIA-SECRET'), { name: 'AccessDenied' })];
    const reply = await run(uploadDocument, uploadReq(newId()));
    assert.equal(reply.status, 500);
    assert.equal(reply.body.message, "We couldn't upload the document. Please try again.");
    assert.ok(!JSON.stringify(reply.body).includes('AKIA'));
    assert.deepEqual(world.storage.commands, ['PutObjectCommand']);
    assert.equal(documentRows().length, 0);
  });

  test('document save failure: exactly that key is discarded once; unreferenced; the error is sanitised', async () => {
    const tenant = newId();
    const referencedElsewhere = `${world.prefix}${tenant}/already-linked.pdf`;
    const unrelated = `${world.prefix}${tenant}/another-request.png`;
    world.documents.store.insert({
      tenantId: tenant, ownerType: 'member', documentType: 'other', fileKey: referencedElsewhere, fileName: 'a.pdf',
      mimeType: 'application/pdf', size: 1, uploadedByUserId: newId(), status: 'pending',
    });
    world.storage.objects.add(referencedElsewhere).add(unrelated);
    world.documents.store.failOn('DocumentFile.create', new Error('E-DB connect failed mongodb://user:pass@host/db'));

    const reply = await run(uploadDocument, uploadReq(tenant));
    assert.equal(reply.status, 500);
    assert.equal(reply.body.message, "We couldn't upload the document. Please try again.");
    assert.ok(!/mongodb|pass@|E-DB/.test(JSON.stringify(reply.body)), 'the driver text never reaches the caller');

    assert.equal(world.storage.puts.length, 1);
    assert.deepEqual(world.storage.deletes, [world.storage.puts[0]], 'only the key this request created, once');
    assert.ok(world.storage.objects.has(referencedElsewhere) && world.storage.objects.has(unrelated), 'no other object is touched');
    assert.equal(world.storage.objects.size, 2);
    assert.equal(documentRows().length, 1, 'no new record');
    assert.deepEqual(orphanLines(), []);
  });

  test('document save failure + failing delete: [ORPHAN OBJECT] marker with key + reason, reconciliation issue, original error kept', async () => {
    const tenant = newId();
    const calls: any[] = [];
    const real = reconciliation.reportReconciliationRequired;
    (reconciliation as any).reportReconciliationRequired = async (input: any) => { calls.push(input); return { logged: true, persisted: true }; };
    try {
      world.documents.store.failOn('DocumentFile.create', new Error('connect ECONNREFUSED 127.0.0.1:27017'));
      world.storage.failDelete = () => Object.assign(new Error('AKIA-SECRET-DENIED'), { name: 'AccessDenied' });
      const reply = await run(uploadDocument, uploadReq(tenant));
      assert.equal(reply.status, 500, 'the caller still gets the original failure, not the clean-up one');
      assert.equal(reply.body.message, "We couldn't upload the document. Please try again.");
    } finally {
      (reconciliation as any).reportReconciliationRequired = real;
    }
    const key = world.storage.puts[0];
    assert.equal(orphanLines().length, 1);
    const payload = JSON.parse(orphanLines()[0].replace('[ORPHAN OBJECT] ', ''));
    assert.deepEqual(Object.keys(payload).sort(), ['key', 'reason']);
    assert.equal(payload.key, key);
    assert.match(payload.reason, /^document-save-failed:failed$/);
    assert.equal(world.storage.deletes.length, 1, 'no retry loop on a failing delete');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].flow, 'private object cleanup');
    assert.equal(String(calls[0].tenantId), tenant);
    assert.ok(key.includes(calls[0].entityId));
    assert.ok(!JSON.stringify(calls).includes('AKIA-SECRET'));
    assert.ok(!orphanLines().join('').includes('AKIA-SECRET'));
  });

  test('document save succeeded but the caller saw an error (timeout after commit): the object is kept, no orphan marker', async () => {
    const realCreate = (DocumentFile as any).create;
    stub(DocumentFile, 'create', async (data: any) => {
      await realCreate(data); // the row IS stored...
      throw new Error('connection reset after commit'); // ...but the caller is told it failed
    });
    const reply = await run(uploadDocument, uploadReq(newId()));
    assert.equal(reply.status, 500);
    assert.equal(documentRows().length, 1);
    assert.deepEqual(world.storage.deletes, []);
    assert.ok(world.storage.objects.has(documentRows()[0].fileKey));
    assert.deepEqual(orphanLines(), []);
  });

  test('"is it referenced?" cannot be answered: nothing is deleted (fail closed) and the key is reported as unverified', async () => {
    world.documents.store.failOn('DocumentFile.create', new Error('database is down'));
    world.documents.store.failOn('DocumentFile.exists', new Error('database is down'));
    const reply = await run(uploadDocument, uploadReq(newId()));
    assert.equal(reply.status, 500);
    assert.deepEqual(world.storage.deletes, []);
    assert.equal(world.storage.objects.size, 1);
    assert.equal(orphanLines().length, 1);
    assert.match(orphanLines()[0], /document-save-failed:unverified/);
  });

  test('two concurrent uploads, one fails to save: only the failed request key is deleted, the other stays and is referenced', async () => {
    const tenant = newId();
    world.documents.store.failOn('DocumentFile.create', new Error('database is down'));
    const [a, b] = await Promise.all([run(uploadDocument, uploadReq(tenant)), run(uploadDocument, uploadReq(tenant))]);
    assert.deepEqual([a.status, b.status].sort(), [201, 500]);
    assert.equal(world.storage.puts.length, 2);
    assert.equal(world.storage.deletes.length, 1);
    assert.equal(documentRows().length, 1);
    assert.notEqual(world.storage.deletes[0], documentRows()[0].fileKey, 'the surviving record keeps its object');
    assert.deepEqual([...world.storage.objects], [documentRows()[0].fileKey]);
  });

  // =====================================================================================================
  // discard primitive: reference check and idempotency
  // =====================================================================================================

  test('a key referenced by a REVOKED certificate is kept as well (the reference check ignores status)', async () => {
    const key = `${world.prefix}certificates/${newId()}/revoked.pdf`;
    world.certs.store.insert({
      tenantId: newId(), certificateNo: 'NK-2026-0042', type: 'nikah', registrationId: newId(), issuedBy: 'a', issueDate: new Date(),
      pdfKey: key, status: 'revoked',
    });
    world.storage.objects.add(key);
    assert.equal(await uploadService.discardPrivateObject(key), 'kept-referenced');
    assert.deepEqual(world.storage.deletes, []);
  });

  test('discarding the same unreferenced key twice is a harmless repeat: gone after the first, still "deleted" after the second', async () => {
    const key = `${world.prefix}${newId()}/x.png`;
    world.storage.objects.add(key);
    assert.equal(await uploadService.discardPrivateObject(key), 'deleted');
    assert.equal(world.storage.objects.size, 0);
    assert.equal(await uploadService.discardPrivateObject(key), 'deleted');
    assert.equal(world.storage.objects.size, 0);
  });

  test('every model field that can hold a private object key is covered by the reference check (tripwire for new fields)', async () => {
    const modelsDir = path.join(__dirname, '..', 'models');
    for (const f of fs.readdirSync(modelsDir)) if (f.endsWith('.ts')) require(path.join(modelsDir, f));

    const CANDIDATE = /(key|url|uri|image|photo|logo|avatar|pdf|file|attachment|document|receipt|proof|signature|banner|path|link)s?$/i;
    const found: string[] = [];
    const walk = (schema: any, prefix: string, model: string) => {
      for (const [p, t] of Object.entries<any>(schema.paths)) {
        if (t.schema) { walk(t.schema, `${prefix}${p}.`, model); continue; }
        const inst = t.instance === 'Array' ? t.caster?.instance ?? t.$embeddedSchemaType?.instance : t.instance;
        if ((inst === 'String' || inst === 'Mixed') && CANDIDATE.test(p.split('.').pop() as string)) found.push(`${model}.${prefix}${p}`);
      }
    };
    for (const name of mongoose.modelNames()) walk(mongoose.model(name).schema, '', name);

    // Private object keys: the ONLY fields uploadService.isPrivateObjectReferenced looks at.
    const PRIVATE_KEY_FIELDS = ['Certificate.pdfKey', 'DocumentFile.fileKey'];
    // Public image URLs / external links (public CDN or somebody else's site): never a private key.
    const PUBLIC_URL_FIELDS = [
      'Banner.image', 'Banner.link', 'Feed.image', 'Notification.imageUrl', 'Notification.link', 'Tenant.logo',
      'Khutbah.resourceUrl', 'LibraryBook.resourceUrl',
    ];
    // Names that merely look like storage fields.
    const NOT_STORAGE = ['Certificate.issueKey', 'Wallet.key', 'Transaction.entryKey', 'MasterCategory.key', 'MasterCategoryValue.categoryKey'];
    const known = new Set([...PRIVATE_KEY_FIELDS, ...PUBLIC_URL_FIELDS, ...NOT_STORAGE]);
    const unknown = found.filter((f) => !known.has(f));
    assert.deepEqual(
      unknown,
      [],
      `New model field(s) ${unknown.join(', ')} look like they hold a file key or URL. If it holds a PRIVATE object key, add it to isPrivateObjectReferenced in services/uploadService.ts; then list it here.`
    );
    for (const f of PRIVATE_KEY_FIELDS) assert.ok(found.includes(f), `${f} still exists`);

    // and the check really does cover both
    const certKey = `${world.prefix}certificates/t/c.pdf`;
    const docKey = `${world.prefix}t/d.pdf`;
    world.certs.store.insert({ tenantId: newId(), certificateNo: 'NK-2026-0777', type: 'nikah', registrationId: newId(), issuedBy: 'a', issueDate: new Date(), pdfKey: certKey, status: 'valid' });
    world.documents.store.insert({ tenantId: newId(), ownerType: 'member', documentType: 'other', fileKey: docKey, fileName: 'a', mimeType: 'application/pdf', size: 1, uploadedByUserId: newId(), status: 'pending' });
    assert.equal(await uploadService.isPrivateObjectReferenced(certKey), true);
    assert.equal(await uploadService.isPrivateObjectReferenced(docKey), true);
    assert.equal(await uploadService.isPrivateObjectReferenced(`${world.prefix}t/none.pdf`), false);
  });

  test('inventory tripwire: only four modules write to object storage and only two use multer', () => {
    const srcDir = path.join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== 'tests') walk(full); }
        else if (entry.name.endsWith('.ts')) files.push(full);
      }
    };
    walk(srcDir);
    const rel = (f: string) => path.relative(srcDir, f).split(path.sep).join('/');
    const grep = (re: RegExp) => files.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map(rel).sort();

    assert.deepEqual(
      grep(/uploadPrivateDocument|uploadPrivateBuffer|uploadFileToSpaces|@aws-sdk\/client-s3|PutObjectCommand/),
      ['controllers/documentController.ts', 'controllers/uploadController.ts', 'services/certificateService.ts', 'services/uploadService.ts'],
      'a new place that writes to object storage must be added to this inventory AND given upload -> save clean-up',
    );
    assert.deepEqual(grep(/from 'multer'|require\('multer'\)/), ['controllers/documentController.ts', 'controllers/uploadController.ts']);
    // registration / member flows only LINK already-uploaded DocumentFile ids; they never upload
    assert.deepEqual(grep(/DeleteObjectCommand/), ['services/uploadService.ts']);
  });

  // =====================================================================================================
  // public images (banners / notifications): no record in the same request -> no server-side clean-up
  // =====================================================================================================

  test('public image upload: public-read, outside the private folder, never deletable through the private clean-up', async () => {
    for (const [handler, folder] of [[uploadBannerImage, 'banners'], [uploadNotificationImage, 'notifications']] as Array<[any, string]>) {
      world.storage.puts.length = 0;
      world.storage.putInputs.length = 0;
      const reply = await run(handler, { file: file(PNG, 'image/png', 'b.png') });
      assert.equal(reply.status, 200);
      assert.match(reply.body.url, new RegExp(`^https://test-bucket\\.storage\\.test\\.invalid/(.+/)?${folder}/[^/]+\\.png$`));
      const key = world.storage.puts[0];
      assert.equal(world.storage.putInputs[0].ACL, 'public-read');
      assert.ok(key.includes(`/${folder}/`) && !key.startsWith(world.prefix), 'not under <folder>/documents/');
      assert.equal(await uploadService.deletePrivateObject(key), false, 'the private delete refuses public keys');
      assert.equal(await uploadService.discardPrivateObject(key), 'refused');
    }
    assert.ok(world.storage.commands.every((c) => c === 'PutObjectCommand'), 'no delete was ever attempted');
  });

  test('public image upload: HTML disguised as an image is a 400 and nothing reaches storage', async () => {
    for (const handler of [uploadBannerImage, uploadNotificationImage]) {
      const reply = await run(handler, { file: file(HTML, 'image/png', 'x.png') });
      assert.equal(reply.status, 400);
    }
    const none = await run(uploadBannerImage, {});
    assert.equal(none.status, 400);
    assert.deepEqual(world.storage.commands, []);
  });

  test('public image upload failure: 500 with plain copy, no delete attempted (nothing was stored)', async () => {
    world.storage.failPut = [new Error('NoSuchBucket AKIA-SECRET')];
    const reply = await run(uploadBannerImage, { file: file(PNG, 'image/png') });
    assert.equal(reply.status, 500);
    assert.equal(reply.body.message, "We couldn't upload the banner image. Please try again.");
    assert.ok(!/AKIA|NoSuchBucket/.test(JSON.stringify(reply.body)));
    assert.deepEqual(world.storage.commands, ['PutObjectCommand']);
  });

  test('ACCEPTED LIMITATION: a public image is uploaded first and linked later by the CMS; an unlinked one is never removed by the server', async () => {
    // upload succeeds -> the CMS then posts the banner with the URL. If that second request fails, nothing
    // on the server knows the image exists (no model), so it stays in the bucket. A lifecycle rule on the
    // banners/ and notifications/ prefixes is the operator-side answer.
    const reply = await run(uploadBannerImage, { file: file(PNG, 'image/png') });
    assert.equal(reply.status, 200);
    assert.equal(world.storage.objects.size, 1);
    assert.deepEqual(world.storage.deletes, []);
    assert.deepEqual(orphanLines(), []);
  });

  // =====================================================================================================
  // signed-URL endpoints: tenant and ownership
  // =====================================================================================================

  describe('downloads', () => {
    let signed: string[];
    beforeEach(() => {
      signed = [];
      stub(uploadService, 'getSignedDownloadUrl', async (key: string) => { signed.push(key); return `https://signed.test.invalid/${encodeURIComponent(key)}`; });
    });

    const tenantA = newId();
    const tenantB = newId();
    const memberOwner = newId();
    const memberOther = newId();
    const admin = { role: 'mahall', name: 'Admin' };

    const certificate = () => {
      const row = world.certs.store.insert({
        tenantId: tenantA, certificateNo: 'NK-2026-0001', type: 'nikah', registrationId: newId(), subjectMemberIds: [memberOwner],
        issuedBy: 'a', issueDate: new Date(), pdfKey: `${world.prefix}certificates/${tenantA}/a.pdf`, status: 'valid',
      });
      return row;
    };
    const documentOf = (uploader: string | undefined) =>
      world.documents.store.insert({
        tenantId: tenantA, ownerType: 'member', documentType: 'id_proof', fileKey: `${world.prefix}${tenantA}/doc.pdf`, fileName: 'a.pdf',
        mimeType: 'application/pdf', size: 1, uploadedByUserId: newId(), uploadedByMemberId: uploader, status: 'pending',
      });

    test('certificate download: own-tenant admin and the subject member get a URL for that certificate key only', async () => {
      const cert = certificate();
      const asAdmin = await run(downloadCertificate, { tenantId: tenantA, params: { id: String(cert._id) }, user: admin });
      assert.equal(asAdmin.status, 200);
      const asMember = await run(downloadCertificate, { tenantId: tenantA, params: { id: String(cert._id) }, user: { role: 'member', memberId: memberOwner } });
      assert.equal(asMember.status, 200);
      assert.deepEqual(signed, [cert.pdfKey, cert.pdfKey]);
      assert.deepEqual(Object.keys(asAdmin.body.data).sort(), ['expiresIn', 'fileName', 'url'], 'the storage key is never in the answer');
      assert.equal(asAdmin.body.data.fileName, 'NK-2026-0001.pdf');
      assert.ok(!JSON.stringify(asAdmin.body).includes('certificates/'), 'only the signed url mentions the key');
    });

    test('certificate download: another Mahallu (even an admin), another member, or a member-less user never get a URL', async () => {
      const cert = certificate();
      const id = String(cert._id);
      const otherTenantAdmin = await run(downloadCertificate, { tenantId: tenantB, params: { id }, user: admin });
      const sameMemberIdOtherTenant = await run(downloadCertificate, { tenantId: tenantB, params: { id }, user: { role: 'member', memberId: memberOwner } });
      const otherMember = await run(downloadCertificate, { tenantId: tenantA, params: { id }, user: { role: 'member', memberId: memberOther } });
      const noMember = await run(downloadCertificate, { tenantId: tenantA, params: { id }, user: { role: 'member' } });
      assert.equal(otherTenantAdmin.status, 404);
      assert.equal(sameMemberIdOtherTenant.status, 404);
      assert.equal(otherMember.status, 403);
      assert.equal(noMember.status, 403);
      assert.deepEqual(signed, [], 'getSignedDownloadUrl was never called');
    });

    test('document url: own-tenant admin and the uploader get a URL; other members and other Mahallus do not', async () => {
      const doc = documentOf(memberOwner);
      const id = String(doc._id);
      const asAdmin = await run(getDocumentUrl, { tenantId: tenantA, params: { id }, user: admin });
      const asOwner = await run(getDocumentUrl, { tenantId: tenantA, params: { id }, user: { role: 'member', memberId: memberOwner } });
      assert.equal(asAdmin.status, 200);
      assert.equal(asOwner.status, 200);
      assert.deepEqual(Object.keys(asOwner.body.data).sort(), ['expiresIn', 'fileName', 'mimeType', 'url'], 'no key in the answer');
      assert.deepEqual(signed, [doc.fileKey, doc.fileKey]);

      signed.length = 0;
      const otherMember = await run(getDocumentUrl, { tenantId: tenantA, params: { id }, user: { role: 'member', memberId: memberOther } });
      const otherTenantAdmin = await run(getDocumentUrl, { tenantId: tenantB, params: { id }, user: admin });
      const otherTenantSameMember = await run(getDocumentUrl, { tenantId: tenantB, params: { id }, user: { role: 'member', memberId: memberOwner } });
      const noMember = await run(getDocumentUrl, { tenantId: tenantA, params: { id }, user: { role: 'member' } });
      assert.equal(otherMember.status, 403);
      assert.equal(otherTenantAdmin.status, 404);
      assert.equal(otherTenantSameMember.status, 404);
      assert.equal(noMember.status, 403);
      assert.deepEqual(signed, []);
    });

    test('document url: a document with no recorded uploader member is admin-only', async () => {
      const doc = documentOf(undefined);
      const id = String(doc._id);
      const asMember = await run(getDocumentUrl, { tenantId: tenantA, params: { id }, user: { role: 'member', memberId: memberOwner } });
      assert.equal(asMember.status, 403);
      assert.equal((await run(getDocumentUrl, { tenantId: tenantA, params: { id }, user: admin })).status, 200);
    });

    test('document list: a member sees only own uploads, an admin only own-Mahallu documents', async () => {
      documentOf(memberOwner);
      documentOf(memberOther);
      world.documents.store.insert({
        tenantId: tenantB, ownerType: 'member', documentType: 'id_proof', fileKey: `${world.prefix}${tenantB}/b.pdf`, fileName: 'b.pdf',
        mimeType: 'application/pdf', size: 1, uploadedByUserId: newId(), uploadedByMemberId: memberOwner, status: 'pending',
      });
      const mine = await run(listDocuments, { tenantId: tenantA, user: { role: 'member', memberId: memberOwner } });
      assert.equal(mine.body.data.length, 1);
      assert.equal(String(mine.body.data[0].uploadedByMemberId), memberOwner);
      assert.equal(String(mine.body.data[0].tenantId), tenantA);
      const adminA = await run(listDocuments, { tenantId: tenantA, user: admin });
      assert.equal(adminA.body.data.length, 2);
      assert.ok(adminA.body.data.every((d: any) => String(d.tenantId) === tenantA));
      const noMember = await run(listDocuments, { tenantId: tenantA, user: { role: 'member' } });
      assert.equal(noMember.status, 403);
    });

    test('certificate list: always inside the caller tenant; a member is limited to certificates they are the subject of', async () => {
      const filters: any[] = [];
      const realFind = (Certificate as any).find;
      stub(Certificate, 'find', (filter: any) => { filters.push(filter); return realFind(filter); });
      await run(listCertificates, { tenantId: tenantA, user: admin, query: { type: 'nikah' } });
      await run(listCertificates, { tenantId: tenantA, user: { role: 'member', memberId: memberOwner }, query: { type: 'nikah', status: 'revoked' } });
      const noMember = await run(listCertificates, { tenantId: tenantA, user: { role: 'member' } });
      assert.deepEqual(filters[0], { tenantId: tenantA, type: 'nikah' });
      assert.deepEqual(filters[1], { tenantId: tenantA, subjectMemberIds: memberOwner }, 'a member cannot widen the filter with query params');
      assert.equal(noMember.status, 403);
      assert.equal(filters.length, 2);
    });

    test('certificate list: a member response has no pdfKey / issueKey; the admin response keeps every field', async () => {
      const own = world.certs.store.insert({
        tenantId: tenantA, certificateNo: 'NK-2026-0005', type: 'nikah', registrationId: newId(), subjectMemberIds: [memberOwner],
        issuedBy: 'a', issueDate: new Date(), pdfKey: `${world.prefix}certificates/${tenantA}/own.pdf`, status: 'valid',
        issueKey: `${tenantA}:nikah:reg`,
      });
      // The in-memory fake ignores select(); this wrapper applies the "-field" exclusions a real query would.
      const realFind = (Certificate as any).find;
      const selects: string[] = [];
      stub(Certificate, 'find', (filter: any) => {
        // the fake cannot match a scalar against an array field, so the member filter is widened to the tenant here
        const q = realFind('subjectMemberIds' in filter ? { tenantId: filter.tenantId } : filter);
        let excluded: string[] = [];
        const wrapped: any = {
          select: (spec: string) => { selects.push(spec); excluded = spec.split(/\s+/).filter((f) => f.startsWith('-')).map((f) => f.slice(1)); return wrapped; },
          sort: (s: any) => { q.sort(s); return wrapped; },
          skip: (n: number) => { q.skip(n); return wrapped; },
          limit: (n: number) => { q.limit(n); return wrapped; },
          then: (resolve: any, reject: any) =>
            q.then((rows: any[]) => rows.map((r) => { const copy = { ...r }; excluded.forEach((f) => delete copy[f]); return copy; })).then(resolve, reject),
        };
        return wrapped;
      });
      const asMember = await run(listCertificates, { tenantId: tenantA, user: { role: 'member', memberId: memberOwner } });
      const asAdmin = await run(listCertificates, { tenantId: tenantA, user: admin });
      assert.equal(asAdmin.body.data.length, 1);
      const adminRow = asAdmin.body.data[0];
      assert.equal(adminRow.pdfKey, own.pdfKey, 'admin responses are unchanged');
      assert.equal(adminRow.issueKey, own.issueKey);
      assert.deepEqual(selects, ['-pdfKey -issueKey'], 'only the member query projects the fields away');
      assert.equal(asMember.body.data.length, 1);
      const memberRow = asMember.body.data[0];
      assert.ok(!('pdfKey' in memberRow) && !('issueKey' in memberRow));
      for (const field of ['certificateNo', 'type', 'issueDate', 'status', 'issuedBy', 'subjectMemberIds']) assert.ok(field in memberRow, `${field} is still returned`);
      assert.ok(!JSON.stringify(asMember.body).includes('certificates/'), 'the storage key appears nowhere in the member response');
    });

    test('public verify answers only the five public fields: no key, no member ids, no registration, no tenant id', async () => {
      const cert = certificate();
      const reply = await run(verifyCertificate, { params: { certificateNo: cert.certificateNo }, user: undefined });
      assert.equal(reply.status, 200);
      assert.deepEqual(Object.keys(reply.body.data).sort(), ['certificateNo', 'issueDate', 'issuedByMahallu', 'status', 'type']);
      assert.ok(!/pdfKey|certificates\/|subjectMemberIds|registrationId/.test(JSON.stringify(reply.body)));
    });
  });
});
