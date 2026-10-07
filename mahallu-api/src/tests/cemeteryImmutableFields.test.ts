import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Cemetery, GraveRecord } from '../models/Cemetery';
import { updateCemetery, updateGraveRecord } from '../controllers/cemeteryController';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] cemeteryImmutableFields', () => {

/**
 * updateCemetery passed req.body straight to findByIdAndUpdate after the ownership check, so a body
 * `tenantId` could move a cemetery to another Mahallu. Grave updates already dropped cemeteryId and
 * graveNo but not tenantId / _id.
 */

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();
const OTHER_TENANT = oid();

const original = {
  cemFindById: Cemetery.findById,
  cemUpdate: Cemetery.findByIdAndUpdate,
  graveFindById: GraveRecord.findById,
  graveUpdate: GraveRecord.findByIdAndUpdate,
  graveCount: GraveRecord.countDocuments,
};

let updates: Array<{ id: unknown; update: any }> = [];

before(() => {
  (Cemetery as any).findById = async () => ({ _id: oid(), tenantId: TENANT, name: 'Old' });
  (Cemetery as any).findByIdAndUpdate = async (id: unknown, update: any) => {
    updates.push({ id, update });
    return { _id: id, toObject: () => ({ _id: id, ...update }) };
  };
  (GraveRecord as any).findById = async () => ({ _id: oid(), tenantId: TENANT });
  (GraveRecord as any).findByIdAndUpdate = (id: unknown, update: any) => {
    updates.push({ id, update });
    const chain: any = { populate: () => chain, then: (resolve: any) => resolve({ _id: id, ...update }) };
    return chain;
  };
  (GraveRecord as any).countDocuments = async () => 0;
});

after(() => {
  Object.assign(Cemetery, { findById: original.cemFindById, findByIdAndUpdate: original.cemUpdate });
  Object.assign(GraveRecord, {
    findById: original.graveFindById,
    findByIdAndUpdate: original.graveUpdate,
    countDocuments: original.graveCount,
  });
});

const call = async (handler: (req: any, res: any) => Promise<unknown>, body: Record<string, unknown>) => {
  updates = [];
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
  await handler({ params: { id: String(oid()) }, tenantId: TENANT, isSuperAdmin: false, body }, res);
  return out;
};

test('updateCemetery ignores tenantId and _id in the body', async () => {
  const out = await call(updateCemetery, { name: 'New name', tenantId: String(OTHER_TENANT), _id: String(oid()) });
  assert.equal(out.status, 200);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].update.name, 'New name');
  assert.ok(!('tenantId' in updates[0].update));
  assert.ok(!('_id' in updates[0].update));
});

test('updateCemetery still applies the ordinary editable fields', async () => {
  await call(updateCemetery, { name: 'N', capacity: 50, status: 'active' });
  assert.deepEqual(updates[0].update, { name: 'N', capacity: 50, status: 'active' });
});

test('updateGraveRecord ignores tenantId and _id (and still ignores cemeteryId / graveNo)', async () => {
  const out = await call(updateGraveRecord, {
    deceasedName: 'Renamed',
    tenantId: String(OTHER_TENANT),
    _id: String(oid()),
    cemeteryId: String(oid()),
    graveNo: 'X-1',
  });
  assert.equal(out.status, 200);
  assert.deepEqual(updates[0].update, { deceasedName: 'Renamed' });
});
});
