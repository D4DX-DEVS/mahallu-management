import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Institute from '../models/Institute';
import { getAllInstitutes, getInstituteById, updateInstitute, deleteInstitute } from '../controllers/instituteController';
import { tenantFilter } from '../middleware/tenantMiddleware';

/**
 * Who can list, open, edit and delete an institute.
 *
 * An institute admin works across their own Mahallu: every institute and
 * madrasa in it can be listed, opened and edited, and nothing in any other
 * Mahallu can. The Mahallu comes from the signed-in account (`req.tenantId`),
 * never from the query string or a header. Deleting stays limited to the
 * admin's own institute.
 *
 * These run the real controllers against a stubbed model, with `req` shaped the
 * way authMiddleware and tenantFilter leave it.
 */

const id = () => new mongoose.Types.ObjectId();
const TENANT = id();
const OTHER_TENANT = id();
const OWN = id();
const SIBLING = id();
const FOREIGN = id();

const records: Record<string, any> = {
  [OWN.toString()]: { _id: OWN, tenantId: TENANT, name: 'Own Madrasa' },
  [SIBLING.toString()]: { _id: SIBLING, tenantId: TENANT, name: 'Sibling Madrasa' },
  [FOREIGN.toString()]: { _id: FOREIGN, tenantId: OTHER_TENANT, name: 'Other Mahallu Madrasa' },
};

let lastQuery: any;
let updated: any;
const original = {
  find: Institute.find,
  countDocuments: Institute.countDocuments,
  findById: Institute.findById,
  findByIdAndUpdate: Institute.findByIdAndUpdate,
  findByIdAndDelete: Institute.findByIdAndDelete,
};

const matches = (doc: any, query: any) =>
  Object.entries(query).every(([k, v]) => (v === null ? false : String(doc[k]) === String(v)));

test.before(() => {
  (Institute as any).find = (query: any) => {
    lastQuery = query;
    const rows = Object.values(records).filter((r) => matches(r, query));
    const chain: any = { sort: () => chain, skip: () => chain, limit: async () => rows };
    return chain;
  };
  (Institute as any).countDocuments = async (query: any) =>
    Object.values(records).filter((r) => matches(r, query)).length;
  (Institute as any).findById = async (key: string) => records[String(key)] ?? null;
  (Institute as any).findByIdAndUpdate = async (key: string, body: any) => {
    updated = { key: String(key), body };
    return { ...records[String(key)], ...body };
  };
  (Institute as any).findByIdAndDelete = async () => null;
});
test.after(() => {
  Object.assign(Institute, original);
});

type Who = { role: string; tenantId?: any; instituteId?: any; superAdmin?: boolean };

/** `req` as authMiddleware + tenantFilter leave it. */
const reqFor = (who: Who, extra: Record<string, any> = {}) => {
  const req: any = {
    user: { role: who.role, tenantId: who.tenantId, instituteId: who.instituteId },
    isSuperAdmin: !!who.superAdmin,
    tenantId: who.tenantId?.toString(),
    instituteId: who.role === 'institute' ? who.instituteId?.toString() : undefined,
    query: {},
    body: {},
    params: {},
    headers: {},
    ...extra,
  };
  tenantFilter(req, {} as any, () => undefined);
  return req;
};

const call = async (fn: any, req: any) => {
  const out: any = { status: 200, body: undefined };
  const r: any = {
    status(c: number) {
      out.status = c;
      return r;
    },
    json(b: any) {
      out.body = b;
      return r;
    },
  };
  await fn(req, r);
  return out;
};

const instituteAdmin: Who = { role: 'institute', tenantId: TENANT, instituteId: OWN };
const names = (out: any) => out.body.data.map((i: any) => i.name).sort();

test('institute admin lists every institute in their own Mahallu, and none from another', async () => {
  const out = await call(getAllInstitutes, reqFor(instituteAdmin));
  assert.equal(out.status, 200);
  assert.deepEqual(names(out), ['Own Madrasa', 'Sibling Madrasa']);
  assert.equal(out.body.pagination.total, 2);
});

test('institute admin can open a same-Mahallu institute, their own or a sibling', async () => {
  for (const key of [OWN, SIBLING]) {
    const out = await call(getInstituteById, reqFor(instituteAdmin, { params: { id: key.toString() } }));
    assert.equal(out.status, 200);
  }
});

test('every institute the list offers an institute admin can be opened', async () => {
  const listed = await call(getAllInstitutes, reqFor(instituteAdmin));
  assert.ok(listed.body.data.length > 1);
  for (const row of listed.body.data) {
    const out = await call(getInstituteById, reqFor(instituteAdmin, { params: { id: row._id.toString() } }));
    assert.equal(out.status, 200);
  }
});

test('institute admin can update a same-Mahallu institute, their own or a sibling', async () => {
  for (const key of [OWN, SIBLING]) {
    updated = undefined;
    const out = await call(
      updateInstitute,
      reqFor(instituteAdmin, { params: { id: key.toString() }, body: { description: 'Updated by QA' } })
    );
    assert.equal(out.status, 200);
    assert.equal(updated.key, key.toString());
    assert.equal(updated.body.description, 'Updated by QA');
    assert.equal(updated.body.tenantId, TENANT.toString());
  }
});

test('institute admin cannot move an institute to another Mahallu by sending a tenantId', async () => {
  const out = await call(
    updateInstitute,
    reqFor(instituteAdmin, { params: { id: SIBLING.toString() }, body: { tenantId: OTHER_TENANT.toString(), name: 'Moved' } })
  );
  assert.equal(out.status, 200);
  assert.equal(updated.body.tenantId, TENANT.toString());
});

test('institute admin is refused an institute in another Mahallu: view and update', async () => {
  updated = undefined;
  const params = { id: FOREIGN.toString() };
  assert.equal((await call(getInstituteById, reqFor(instituteAdmin, { params }))).status, 403);
  assert.equal((await call(updateInstitute, reqFor(instituteAdmin, { params, body: { name: 'x' } }))).status, 403);
  assert.equal((await call(deleteInstitute, reqFor(instituteAdmin, { params }))).status, 403);
  assert.equal(updated, undefined, 'nothing may be written');
});

test('a query string cannot widen the list to another Mahallu', async () => {
  const req = reqFor(instituteAdmin);
  req.query.tenantId = OTHER_TENANT.toString();
  req.query._id = FOREIGN.toString();
  const out = await call(getAllInstitutes, req);
  assert.deepEqual(names(out), ['Own Madrasa', 'Sibling Madrasa']);
  assert.equal(String(lastQuery.tenantId), TENANT.toString());
});

test('an x-institute-id or x-tenant-id header cannot widen access', async () => {
  const withHeaders = (extra: Record<string, any> = {}) => {
    const req = reqFor(instituteAdmin, extra);
    req.headers['x-institute-id'] = FOREIGN.toString();
    req.headers['x-tenant-id'] = OTHER_TENANT.toString();
    return req;
  };
  assert.deepEqual(names(await call(getAllInstitutes, withHeaders())), ['Own Madrasa', 'Sibling Madrasa']);
  assert.equal((await call(getInstituteById, withHeaders({ params: { id: FOREIGN.toString() } }))).status, 403);
  assert.equal(
    (await call(updateInstitute, withHeaders({ params: { id: FOREIGN.toString() }, body: { name: 'x' } }))).status,
    403
  );
});

test('an account with no Mahallu of its own lists nothing and opens nothing', async () => {
  const stray: Who = { role: 'institute', instituteId: OWN };
  const list = await call(getAllInstitutes, reqFor(stray));
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data, []);
  assert.equal(list.body.pagination.total, 0);
  assert.equal((await call(getInstituteById, reqFor(stray, { params: { id: OWN.toString() } }))).status, 403);
  assert.equal((await call(updateInstitute, reqFor(stray, { params: { id: OWN.toString() }, body: { name: 'x' } }))).status, 403);
});

test('institute admin can still delete only their own institute', async () => {
  assert.equal((await call(deleteInstitute, reqFor(instituteAdmin, { params: { id: OWN.toString() } }))).status, 200);
  assert.equal((await call(deleteInstitute, reqFor(instituteAdmin, { params: { id: SIBLING.toString() } }))).status, 403);
});

test('mahallu admin is unchanged: own Mahallu only, list, open, edit, delete', async () => {
  const mahall: Who = { role: 'mahall', tenantId: TENANT };
  assert.deepEqual(names(await call(getAllInstitutes, reqFor(mahall))), ['Own Madrasa', 'Sibling Madrasa']);
  assert.equal((await call(getInstituteById, reqFor(mahall, { params: { id: SIBLING.toString() } }))).status, 200);
  assert.equal((await call(getInstituteById, reqFor(mahall, { params: { id: FOREIGN.toString() } }))).status, 403);
  assert.equal(
    (await call(updateInstitute, reqFor(mahall, { params: { id: SIBLING.toString() }, body: { name: 'x' } }))).status,
    200
  );
  assert.equal((await call(deleteInstitute, reqFor(mahall, { params: { id: SIBLING.toString() } }))).status, 200);
});

test('super admin is unchanged: every Mahallu, or one chosen by tenantId', async () => {
  const sa: Who = { role: 'super_admin', superAdmin: true };
  assert.equal((await call(getAllInstitutes, reqFor(sa))).body.data.length, 3);
  const scoped = reqFor(sa, { tenantId: OTHER_TENANT.toString() });
  assert.deepEqual(names(await call(getAllInstitutes, scoped)), ['Other Mahallu Madrasa']);
  assert.equal((await call(getInstituteById, reqFor(sa, { params: { id: FOREIGN.toString() } }))).status, 200);
  assert.equal(
    (await call(updateInstitute, reqFor(sa, { params: { id: FOREIGN.toString() }, body: { name: 'x' } }))).status,
    200
  );
});
