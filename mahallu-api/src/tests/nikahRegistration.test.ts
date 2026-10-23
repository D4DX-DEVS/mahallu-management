/**
 * Nikah registrations: addresses, witness details, mahr type, multi-line text, and the groom's and
 * bride's photos (validation, ownership, replacement, removal, clean-up on failure).
 *
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult } from 'express-validator';

import { NikahRegistration } from '../models/Registration';
import DocumentFile from '../models/DocumentFile';
import Member from '../models/Member';
import Certificate from '../models/Certificate';
import {
  createNikahRegistration,
  getNikahRegistrationById,
  updateNikahRegistration,
} from '../controllers/registrationController';
import { deleteDocument, uploadDocument } from '../controllers/documentController';
import { setStorageClientForTests } from '../services/uploadService';
import { createNikahRegistrationValidation, updateNikahRegistrationValidation } from '../validations/registrationValidation';
import { call, installFake, oid } from './support/fakeMongo';

const TENANT = oid();
const OTHER_TENANT = oid();
const ADMIN = oid();
const OTHER_USER = oid();

const validate = async (chains: any[], body: any, params: any = {}) => {
  const req: any = { body, params, query: {}, headers: {} };
  for (const chain of chains) await chain.run(req);
  return { errors: validationResult(req).array().map((e: any) => `${e.path}: ${e.msg}`), body: req.body };
};

const base = { groomName: 'Ahmed Kutty', brideName: 'Fathima Beevi', nikahDate: '2026-11-01' };

// ---------------------------------------------------------------- validation

describe('nikah validation', () => {
  test('an old-style payload (no new fields, with a mahr amount) still validates', async () => {
    const { errors } = await validate(createNikahRegistrationValidation, { ...base, mahrAmount: 50000, witness1: 'A', witness2: 'B' });
    assert.deepEqual(errors, []);
  });

  test('addresses are optional multi-line text, normalised, and capped at 500 characters', async () => {
    const { errors, body } = await validate(createNikahRegistrationValidation, {
      ...base,
      groomAddress: '  House 4,  \r\nBeypore\r\n  Kozhikode  ',
      brideAddress: 'x'.repeat(500),
    });
    assert.deepEqual(errors, []);
    assert.equal(body.groomAddress, 'House 4,\nBeypore\n  Kozhikode', 'one newline style, no trailing spaces, outer space trimmed');

    const tooLong = await validate(createNikahRegistrationValidation, { ...base, groomAddress: 'x'.repeat(501), witness2Address: 'x'.repeat(501) });
    assert.equal(tooLong.errors.length, 2);
  });

  test('a witness phone number may be local or international, but must look like a number', async () => {
    for (const ok of ['9876543210', '+971 50 123 4567', '(0495) 2 345 678', '+44-20-7946-0958', '0091 98765 43210']) {
      assert.deepEqual((await validate(createNikahRegistrationValidation, { ...base, witness1Phone: ok, witness2Phone: ok })).errors, [], ok);
    }
    for (const bad of ['abc', '12', '98765x3210', '++9876543210', '9'.repeat(25)]) {
      assert.equal((await validate(createNikahRegistrationValidation, { ...base, witness1Phone: bad })).errors.length, 1, bad);
    }
  });

  test('the mahr type is one of the four options, and "Other" needs a description', async () => {
    for (const type of ['gold_or_ornaments', 'cash', 'land']) {
      assert.deepEqual((await validate(createNikahRegistrationValidation, { ...base, mahrType: type })).errors, [], type);
    }
    assert.deepEqual((await validate(createNikahRegistrationValidation, { ...base, mahrType: 'other', mahrTypeOther: 'A car' })).errors, []);
    assert.equal((await validate(createNikahRegistrationValidation, { ...base, mahrType: 'diamonds' })).errors.length, 1);
    for (const other of [undefined, '', '   ']) {
      const { errors } = await validate(createNikahRegistrationValidation, { ...base, mahrType: 'other', mahrTypeOther: other });
      assert.deepEqual(errors, ['mahrTypeOther: Please specify the mahr type.'], String(other));
    }
    assert.equal((await validate(createNikahRegistrationValidation, { ...base, mahrType: 'other', mahrTypeOther: 'x'.repeat(101) })).errors.length, 1);
    // a custom text with another type is just ignored on save, not an error
    assert.deepEqual((await validate(createNikahRegistrationValidation, { ...base, mahrType: 'cash', mahrTypeOther: 'left over' })).errors, []);
  });

  test('the update rules accept the same new fields, and photo ids may be set, cleared or left out', async () => {
    const params = { id: String(oid()) };
    const photo = String(oid());
    assert.deepEqual((await validate(updateNikahRegistrationValidation, { groomPhotoId: photo, bridePhotoId: null }, params)).errors, []);
    assert.deepEqual((await validate(updateNikahRegistrationValidation, { groomPhotoId: '' }, params)).errors, []);
    assert.deepEqual((await validate(updateNikahRegistrationValidation, {}, params)).errors, []);
    assert.equal((await validate(updateNikahRegistrationValidation, { groomPhotoId: 'not-an-id' }, params)).errors.length, 1);
    assert.equal((await validate(updateNikahRegistrationValidation, { mahrType: 'other' }, params)).errors.length, 1, 'other without a description');
  });
});

// ---------------------------------------------------------------- a world with registrations, documents, storage

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 2)]);

const fakeStorage = () => {
  const objects = new Set<string>();
  const deletes: string[] = [];
  const client = {
    async send(command: any) {
      const name = command.constructor.name;
      if (name === 'PutObjectCommand') objects.add(command.input.Key);
      if (name === 'DeleteObjectCommand') {
        deletes.push(command.input.Key);
        objects.delete(command.input.Key);
      }
      return {};
    },
  };
  return { client, objects, deletes };
};

const photoDoc = (extra: Record<string, unknown> = {}) => {
  const id = oid();
  return {
    _id: id,
    tenantId: TENANT,
    ownerType: 'nikah',
    documentType: 'photo',
    fileKey: `uploads/documents/${TENANT}/${id}.jpg`,
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    size: 1000,
    uploadedByUserId: ADMIN,
    status: 'pending',
    ...extra,
  };
};

const withWorld = async (
  seed: { docs?: any[]; registrations?: any[] },
  run: (w: { registrations: any; docs: any; storage: ReturnType<typeof fakeStorage> }) => Promise<void>
) => {
  const storage = fakeStorage();
  for (const doc of seed.docs ?? []) storage.objects.add(doc.fileKey);
  setStorageClientForTests(storage.client);
  const registrations = installFake(NikahRegistration, seed.registrations ?? []);
  const docs = installFake(DocumentFile, seed.docs ?? []);
  const members = installFake(Member);
  // the storage guard checks certificates too before it deletes a file
  const certificates = installFake(Certificate);
  try {
    await run({ registrations, docs, storage });
  } finally {
    certificates.restore();
    members.restore();
    docs.restore();
    registrations.restore();
    setStorageClientForTests(null);
  }
};

const admin = (extra: Record<string, unknown> = {}) => ({
  isSuperAdmin: true,
  tenantId: String(TENANT),
  user: { _id: ADMIN, role: 'super_admin' },
  ...extra,
});

const registration = (extra: Record<string, unknown> = {}) => ({
  _id: oid(),
  tenantId: TENANT,
  groomName: 'Ahmed Kutty',
  brideName: 'Fathima Beevi',
  nikahDate: new Date('2026-11-01'),
  status: 'pending',
  ...extra,
});

// ---------------------------------------------------------------- create

describe('creating a nikah registration', () => {
  test('every new field is stored, and the custom mahr type is kept only for "Other"', async () => {
    await withWorld({}, async ({ registrations }) => {
      const reply = await call(createNikahRegistration, {
        ...admin(),
        body: {
          ...base,
          groomAddress: 'Groom House\nBeypore',
          brideAddress: 'Bride House\nFeroke',
          witness1: 'W One',
          witness1Phone: '+971 50 123 4567',
          witness1Address: 'W1 Address',
          witness2: 'W Two',
          witness2Phone: '9876543210',
          witness2Address: 'W2 Address',
          mahrType: 'cash',
          mahrTypeOther: 'left over',
          mahrDescription: 'Line one\nLine two',
          remarks: 'Remark one\nRemark two',
        },
      });
      assert.equal(reply.status, 201);
      const [row] = registrations.store.find({});
      assert.equal(row.groomAddress, 'Groom House\nBeypore');
      assert.equal(row.brideAddress, 'Bride House\nFeroke');
      assert.equal(row.witness1Phone, '+971 50 123 4567');
      assert.equal(row.witness1Address, 'W1 Address');
      assert.equal(row.witness2Phone, '9876543210');
      assert.equal(row.witness2Address, 'W2 Address');
      assert.equal(row.mahrType, 'cash');
      assert.equal(row.mahrTypeOther, undefined);
      assert.equal(row.mahrDescription, 'Line one\nLine two');
      assert.equal(row.remarks, 'Remark one\nRemark two');
    });

    await withWorld({}, async ({ registrations }) => {
      await call(createNikahRegistration, { ...admin(), body: { ...base, mahrType: 'other', mahrTypeOther: 'A car' } });
      const [row] = registrations.store.find({});
      assert.equal(row.mahrType, 'other');
      assert.equal(row.mahrTypeOther, 'A car');
    });
  });

  test("the old payload shape still creates a registration, and an old mahr amount is kept as given", async () => {
    await withWorld({}, async ({ registrations }) => {
      const reply = await call(createNikahRegistration, { ...admin(), body: { ...base, mahrAmount: 50000, witness1: 'A' } });
      assert.equal(reply.status, 201);
      const [row] = registrations.store.find({});
      assert.equal(row.mahrAmount, 50000);
      assert.equal(row.mahrType, undefined);
    });
  });

  test("photos are tied to the registration; each is the uploader's own image", async () => {
    const groom = photoDoc();
    const bride = photoDoc({ mimeType: 'image/png' });
    await withWorld({ docs: [groom, bride] }, async ({ registrations, docs }) => {
      const reply = await call(createNikahRegistration, {
        ...admin(),
        body: { ...base, groomPhotoId: String(groom._id), bridePhotoId: String(bride._id) },
      });
      assert.equal(reply.status, 201);
      const [row] = registrations.store.find({});
      assert.equal(String(row.groomPhotoId), String(groom._id));
      assert.equal(String(row.bridePhotoId), String(bride._id));
      for (const doc of docs.store.find({})) assert.equal(String(doc.ownerId), String(row._id), 'attached to the registration');
    });
  });

  test('a photo that is not usable is refused and nothing is saved', async () => {
    const pdf = photoDoc({ mimeType: 'application/pdf' });
    const huge = photoDoc({ size: 6 * 1024 * 1024 });
    const wrongType = photoDoc({ documentType: 'id_proof' });
    const otherTenant = photoDoc({ tenantId: OTHER_TENANT });
    const someoneElses = photoDoc({ uploadedByUserId: OTHER_USER });
    const attached = photoDoc({ ownerId: oid() });
    await withWorld({ docs: [pdf, huge, wrongType, otherTenant, someoneElses, attached] }, async ({ registrations }) => {
      const as = (user: Record<string, unknown>, isSuper = true) => ({ ...admin(), isSuperAdmin: isSuper, user });
      const tryPhoto = (doc: any, extra: Record<string, unknown> = {}) =>
        call(createNikahRegistration, { ...as({ _id: ADMIN, role: 'super_admin' }), ...extra, body: { ...base, groomPhotoId: String(doc._id) } });

      assert.equal((await tryPhoto(pdf)).status, 400);
      assert.equal((await tryPhoto(huge)).status, 400);
      assert.equal((await tryPhoto(wrongType)).status, 400);
      assert.equal((await tryPhoto(otherTenant)).status, 404, 'another Mahallu: not found');
      assert.equal((await tryPhoto(attached)).status, 409);
      assert.equal((await tryPhoto({ _id: oid() })).status, 404, 'unknown id');
      // a non-super caller may only use their own uploads
      const notOwner = await call(createNikahRegistration, { ...as({ _id: ADMIN, role: 'mahall' }, false), body: { ...base, groomPhotoId: String(someoneElses._id) } });
      assert.equal(notOwner.status, 404);
      // one photo cannot serve both people
      const ok = photoDoc();
      const same = await call(createNikahRegistration, { ...admin(), body: { ...base, groomPhotoId: String(ok._id), bridePhotoId: String(ok._id) } });
      assert.equal(same.status, 400);

      assert.equal(registrations.store.find({}).length, 0);
    });
  });

  test('if saving fails, no half-saved registration or attached photo is left behind', async () => {
    const groom = photoDoc();
    await withWorld({ docs: [groom] }, async ({ registrations, docs }) => {
      docs.store.failOn('DocumentFile.updateMany');
      const reply = await call(createNikahRegistration, { ...admin(), body: { ...base, groomPhotoId: String(groom._id) } });
      assert.equal(reply.status, 500);
      assert.equal(registrations.store.find({}).length, 0, 'the registration was rolled back');
      assert.equal(docs.store.find({})[0].ownerId, undefined, 'the photo is still an unattached upload');
    });
  });
});

// ---------------------------------------------------------------- update

describe('editing a nikah registration', () => {
  test('an edit that does not mention the photos or the old mahr amount keeps them', async () => {
    const groom = photoDoc();
    const row = registration({ groomPhotoId: groom._id, mahrAmount: 75000, witness1: 'Old Witness' });
    await withWorld({ docs: [{ ...groom, ownerId: row._id }], registrations: [row] }, async ({ registrations, docs, storage }) => {
      const reply = await call(updateNikahRegistration, {
        ...admin(),
        params: { id: String(row._id) },
        body: { groomName: 'Ahmed K', groomAddress: 'New address', witness1Phone: '9876543210', remarks: 'Edited' },
      });
      assert.equal(reply.status, 200);
      const saved = registrations.store.find({})[0];
      assert.equal(saved.groomName, 'Ahmed K');
      assert.equal(saved.groomAddress, 'New address');
      assert.equal(saved.witness1, 'Old Witness', 'untouched fields stay');
      assert.equal(String(saved.groomPhotoId), String(groom._id), 'the photo is retained');
      assert.equal(saved.mahrAmount, 75000, 'the historical amount is retained');
      assert.equal(docs.store.find({}).length, 1);
      assert.equal(storage.deletes.length, 0, 'nothing was deleted from storage');
    });
  });

  test('replacing a photo attaches the new one and removes the old record and file', async () => {
    const oldPhoto = photoDoc();
    const newPhoto = photoDoc();
    const row = registration({ groomPhotoId: oldPhoto._id });
    await withWorld({ docs: [{ ...oldPhoto, ownerId: row._id }, newPhoto], registrations: [row] }, async ({ registrations, docs, storage }) => {
      const reply = await call(updateNikahRegistration, { ...admin(), params: { id: String(row._id) }, body: { groomPhotoId: String(newPhoto._id) } });
      assert.equal(reply.status, 200);
      assert.equal(String(registrations.store.find({})[0].groomPhotoId), String(newPhoto._id));
      assert.equal(docs.store.find({ _id: oldPhoto._id }).length, 0, 'old record removed');
      assert.equal(String(docs.store.find({ _id: newPhoto._id })[0].ownerId), String(row._id));
      assert.deepEqual(storage.deletes, [oldPhoto.fileKey], 'only the replaced file was deleted');
      assert.ok(storage.objects.has(newPhoto.fileKey));
    });
  });

  test('removing a photo clears the reference and deletes the file; the other photo is untouched', async () => {
    const groom = photoDoc();
    const bride = photoDoc();
    const row = registration({ groomPhotoId: groom._id, bridePhotoId: bride._id });
    await withWorld(
      { docs: [{ ...groom, ownerId: row._id }, { ...bride, ownerId: row._id }], registrations: [row] },
      async ({ registrations, storage }) => {
        const reply = await call(updateNikahRegistration, { ...admin(), params: { id: String(row._id) }, body: { groomPhotoId: null } });
        assert.equal(reply.status, 200);
        const saved = registrations.store.find({})[0];
        assert.equal(saved.groomPhotoId, undefined);
        assert.equal(String(saved.bridePhotoId), String(bride._id));
        assert.deepEqual(storage.deletes, [groom.fileKey]);
      }
    );
  });

  test('if the edit fails, the old photo is kept and the new upload stays unattached', async () => {
    const oldPhoto = photoDoc();
    const newPhoto = photoDoc();
    const row = registration({ groomPhotoId: oldPhoto._id });
    await withWorld({ docs: [{ ...oldPhoto, ownerId: row._id }, newPhoto], registrations: [row] }, async ({ registrations, docs, storage }) => {
      registrations.store.failOn('NikahRegistration.findOneAndUpdate');
      const reply = await call(updateNikahRegistration, { ...admin(), params: { id: String(row._id) }, body: { groomPhotoId: String(newPhoto._id) } });
      assert.equal(reply.status, 500);
      assert.equal(String(registrations.store.find({})[0].groomPhotoId), String(oldPhoto._id));
      assert.equal(docs.store.find({ _id: oldPhoto._id }).length, 1, 'the old photo record is kept');
      assert.equal(docs.store.find({ _id: newPhoto._id })[0].ownerId, undefined, 'the new upload is not attached');
      assert.deepEqual(storage.deletes, [], 'no file was deleted');
    });
  });

  test('changing the mahr type away from "Other" drops the custom text; "Other" keeps it', async () => {
    const row = registration({ mahrType: 'other', mahrTypeOther: 'A car' });
    await withWorld({ registrations: [row] }, async ({ registrations }) => {
      await call(updateNikahRegistration, { ...admin(), params: { id: String(row._id) }, body: { mahrType: 'cash' } });
      let saved = registrations.store.find({})[0];
      assert.equal(saved.mahrType, 'cash');
      assert.equal(saved.mahrTypeOther, undefined);

      await call(updateNikahRegistration, { ...admin(), params: { id: String(row._id) }, body: { mahrType: 'other', mahrTypeOther: 'A flat' } });
      saved = registrations.store.find({})[0];
      assert.equal(saved.mahrTypeOther, 'A flat');
    });
  });

  test('an older registration with none of the new fields loads and edits without error', async () => {
    const legacy = registration({ witness1: 'A', witness2: 'B', mahrAmount: 25000, mahrDescription: 'Gold', remarks: 'ok' });
    await withWorld({ registrations: [legacy] }, async ({ registrations }) => {
      const loaded = await call(getNikahRegistrationById, { ...admin(), params: { id: String(legacy._id) } });
      assert.equal(loaded.status, 200);
      for (const field of ['groomAddress', 'brideAddress', 'witness1Phone', 'witness2Address', 'mahrType', 'groomPhotoId', 'bridePhotoId']) {
        assert.equal(loaded.body.data[field], undefined, field);
      }
      assert.equal(loaded.body.data.mahrAmount, 25000);

      const edited = await call(updateNikahRegistration, { ...admin(), params: { id: String(legacy._id) }, body: { remarks: 'updated' } });
      assert.equal(edited.status, 200);
      assert.equal(registrations.store.find({})[0].mahrAmount, 25000);
    });
  });

  test("an edit cannot take another registration's photo", async () => {
    const theirs = photoDoc({ ownerId: oid() });
    const row = registration();
    await withWorld({ docs: [theirs], registrations: [row] }, async ({ registrations }) => {
      const reply = await call(updateNikahRegistration, { ...admin(), params: { id: String(row._id) }, body: { bridePhotoId: String(theirs._id) } });
      assert.equal(reply.status, 409);
      assert.equal(registrations.store.find({})[0].bridePhotoId, undefined);
    });
  });
});

// ---------------------------------------------------------------- uploading and discarding photos

describe('uploading a person photo', () => {
  const upload = (buffer: Buffer, mimetype: string, body: Record<string, unknown> = {}) => ({
    ...admin(),
    body: { documentType: 'photo', ownerType: 'nikah', purpose: 'person_photo', ...body },
    file: { buffer, mimetype, size: buffer.length, originalname: 'groom.jpg' },
  });

  test('a JPEG is stored privately and recorded as an unattached nikah photo', async () => {
    await withWorld({}, async ({ docs, storage }) => {
      const reply = await call(uploadDocument, upload(JPEG, 'image/jpeg'));
      assert.equal(reply.status, 201);
      const [doc] = docs.store.find({});
      assert.equal(doc.documentType, 'photo');
      assert.equal(doc.ownerType, 'nikah');
      assert.equal(doc.mimeType, 'image/jpeg');
      assert.equal(doc.ownerId, undefined);
      assert.equal(storage.objects.size, 1);
      assert.equal(JSON.stringify(reply.body).includes('http'), false, 'no public URL is handed out');
    });
  });

  test('a PDF, a renamed non-image and an oversized image are refused as photos', async () => {
    await withWorld({}, async ({ docs, storage }) => {
      const pdf = await call(uploadDocument, upload(PDF, 'image/jpeg'));
      assert.equal(pdf.status, 400, 'a PDF labelled as an image is judged by its bytes');
      const fake = await call(uploadDocument, upload(Buffer.from('<html><script>alert(1)</script></html>'.padEnd(64, ' ')), 'image/png'));
      assert.equal(fake.status, 400);
      const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5 * 1024 * 1024 + 10, 1)]);
      const oversized = await call(uploadDocument, upload(big, 'image/jpeg'));
      assert.equal(oversized.status, 400);
      assert.equal(docs.store.find({}).length, 0);
      assert.equal(storage.objects.size, 0, 'nothing reached storage');
    });
  });

  test('a storage failure is reported and leaves no record', async () => {
    await withWorld({}, async ({ docs }) => {
      setStorageClientForTests({
        async send() {
          throw new Error('storage is down');
        },
      });
      const reply = await call(uploadDocument, upload(JPEG, 'image/jpeg'));
      assert.equal(reply.status, 500);
      assert.equal(reply.body.success, false);
      assert.equal(docs.store.find({}).length, 0);
    });
  });
});

describe('discarding an unattached upload', () => {
  test("the uploader can remove their own unattached photo, record and file", async () => {
    const doc = photoDoc();
    await withWorld({ docs: [doc] }, async ({ docs, storage }) => {
      const reply = await call(deleteDocument, { ...admin(), isSuperAdmin: false, user: { _id: ADMIN, role: 'mahall' }, params: { id: String(doc._id) } });
      assert.equal(reply.status, 200);
      assert.equal(docs.store.find({}).length, 0);
      assert.deepEqual(storage.deletes, [doc.fileKey]);
    });
  });

  test('an attached document is kept, and a stranger cannot remove someone else\'s upload', async () => {
    const attached = photoDoc({ ownerId: oid() });
    const mine = photoDoc();
    await withWorld({ docs: [attached, mine] }, async ({ docs, storage }) => {
      const kept = await call(deleteDocument, { ...admin(), params: { id: String(attached._id) } });
      assert.equal(kept.status, 409);
      const stranger = await call(deleteDocument, {
        ...admin(),
        isSuperAdmin: false,
        user: { _id: OTHER_USER, role: 'survey' },
        params: { id: String(mine._id) },
      });
      assert.equal(stranger.status, 403);
      const elsewhere = await call(deleteDocument, { ...admin(), tenantId: String(OTHER_TENANT), params: { id: String(mine._id) } });
      assert.equal(elsewhere.status, 404, 'another Mahallu cannot see it');
      assert.equal(docs.store.find({}).length, 2);
      assert.deepEqual(storage.deletes, []);
    });
  });
});
