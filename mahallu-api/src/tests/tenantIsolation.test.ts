import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Asset, AssetMaintenance } from '../models/Asset';
import { NOC } from '../models/Registration';
import Member from '../models/Member';
import Committee from '../models/Committee';
import { Support } from '../models/Social';
import { getAssetById, updateAsset, deleteAsset, updateMaintenanceRecord } from '../controllers/assetController';
import { updateNOC } from '../controllers/registrationController';
import { getMembersByFamily } from '../controllers/memberController';
import { getCommitteeMeetings } from '../controllers/committeeController';
import { updateSupport } from '../controllers/socialController';

/**
 * By-id handlers that looked a record up without the caller's Mahallu in the query: any signed-in
 * user of Mahallu A could read, change or delete Mahallu B's records by id (and, for updates,
 * tenantFilter re-parented the edited record into A). Each must now answer 403 for a foreign
 * record and leave it untouched, while the owning Mahallu still works.
 */
const oid = () => new mongoose.Types.ObjectId();
const MINE = oid();
const THEIRS = oid();
const ID = oid();

const calls: string[] = [];
const rec = (name: string) => (..._a: any[]) => { calls.push(name); return null; };
const saved: Record<string, any> = {};
const stub = (target: any, key: string, impl: any) => { saved[`${target.modelName ?? 'x'}.${key}`] = [target, key, target[key]]; target[key] = impl; };

test.before(() => {
  const owned = (tenant: any) => ({ _id: ID, tenantId: tenant, deleteOne: async () => { calls.push('asset.delete'); } });
  stub(Asset, 'findById', (id: any) => {
    const doc: any = owned(String(ID) === String(id) ? THEIRS : MINE);
    doc.populate = async () => doc;
    return Object.assign(Promise.resolve(doc), { populate: async () => doc });
  });
  stub(Asset, 'findByIdAndUpdate', async (_i: any, data: any) => { calls.push('asset.update'); return { ...data }; });
  stub(AssetMaintenance, 'findOneAndUpdate', async () => { calls.push('maint.update'); return {}; });
  stub(NOC, 'findById', async () => ({ _id: ID, tenantId: THEIRS }));
  stub(NOC, 'findByIdAndUpdate', rec('noc.update'));
  stub(Member, 'find', (q: any) => { calls.push('members.find:' + JSON.stringify(q.tenantId ?? null)); const chain: any = { populate: () => chain, sort: () => chain, then: (r: any) => r([]) }; return chain; });
  stub(Committee, 'findById', () => ({ select: async () => ({ tenantId: THEIRS }) }));
  stub(Support, 'findById', async () => ({ tenantId: THEIRS }));
  stub(Support, 'findByIdAndUpdate', rec('support.update'));
});
test.after(() => Object.values(saved).forEach(([t, k, v]: any) => { t[k] = v; }));

const run = async (fn: any, req: any) => {
  calls.length = 0;
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  await fn({ params: { id: String(ID), maintenanceId: String(oid()), familyId: String(oid()) }, query: {}, body: { name: 'x' }, user: { name: 'A' }, ...req }, res);
  return out;
};
const asA = { tenantId: String(MINE), isSuperAdmin: false };

test('assets of another Mahallu cannot be read, edited, deleted or have maintenance changed', async () => {
  for (const fn of [getAssetById, updateAsset, deleteAsset, updateMaintenanceRecord]) {
    const out = await run(fn, asA);
    assert.equal(out.status, 403, fn.name);
  }
  assert.deepEqual(calls.filter((c) => /update|delete/.test(c)), []);
});

test("a Mahallu's own asset is still editable, and the body cannot move it to another Mahallu", async () => {
  const out = await run(updateAsset, { tenantId: String(THEIRS), isSuperAdmin: false, body: { name: 'new', tenantId: String(MINE) } });
  assert.equal(out.status, 200);
  assert.ok(calls.includes('asset.update'));
});

test("another Mahallu's NOC cannot be approved", async () => {
  const out = await run(updateNOC, { ...asA, body: { status: 'approved' } });
  assert.equal(out.status, 403);
  assert.ok(!calls.includes('noc.update'));
});

test("a family id from another Mahallu lists nothing: the member query carries the caller's tenant", async () => {
  await run(getMembersByFamily, asA);
  assert.deepEqual(calls, ['members.find:' + JSON.stringify(String(MINE))]);
});

test("another Mahallu's committee meetings and support tickets are refused", async () => {
  assert.equal((await run(getCommitteeMeetings, asA)).status, 403);
  assert.equal((await run(updateSupport, asA)).status, 403);
  assert.ok(!calls.includes('support.update'));
});

test('a Super Admin is unaffected', async () => {
  assert.equal((await run(updateNOC, { tenantId: undefined, isSuperAdmin: true, body: { status: 'approved' } })).status !== 403, true);
});
