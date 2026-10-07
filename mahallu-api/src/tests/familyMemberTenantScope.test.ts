import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Family from '../models/Family';
import Member from '../models/Member';
import {
  getAllFamilies,
  getFamilyById,
  getFamilyStats,
  updateFamily,
  deleteFamily,
  createFamily,
  bulkImportFamilies,
} from '../controllers/familyController';
import {
  getAllMembers,
  getMemberById,
  getMembersByFamily,
  createMember,
  updateMember,
  updateMemberStatus,
  deleteMember,
  bulkImportMembers,
} from '../controllers/memberController';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { call, installFake, oid, Installed } from './support/fakeMongo';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] familyMemberTenantScope', () => {

/**
 * Families and members are open to every staff role (docs/AUTHORIZATION_POLICY.md D2 is undecided), but
 * whatever the role, they must stay inside the caller's OWN Mahallu. This pins that for every list and
 * by-id path, for an institute caller in particular. It does not say what an institute caller should be
 * allowed to do inside its own Mahallu: that is the open decision.
 */

const A = oid();
const B = oid();
const FAMILY_A = oid();
const FAMILY_B = oid();
const MEMBER_A = oid();
const MEMBER_B = oid();
const INSTITUTE = oid();

let families: Installed;
let members: Installed;
beforeEach(() => {
  families = installFake(Family, [
    { _id: FAMILY_A, tenantId: A, mahallId: 'FID1', houseName: 'House A', status: 'approved' },
    { _id: FAMILY_B, tenantId: B, mahallId: 'FID1', houseName: 'House B', status: 'approved' },
  ]);
  members = installFake(Member, [
    { _id: MEMBER_A, tenantId: A, mahallId: 'FID1-1', name: 'Member A', familyId: FAMILY_A, gender: 'male', status: 'active' },
    { _id: MEMBER_B, tenantId: B, mahallId: 'FID1-1', name: 'Member B', familyId: FAMILY_B, gender: 'female', status: 'active' },
  ]);
});
afterEach(() => {
  families.restore();
  members.restore();
});

const institute = (over: Record<string, unknown> = {}) => ({
  user: { _id: oid(), role: 'institute', tenantId: A, instituteId: INSTITUTE },
  tenantId: String(A),
  isSuperAdmin: false,
  ...over,
});

const ids = (reply: { body: any }) => (reply.body?.data ?? []).map((d: any) => String(d._id));
const untouched = () => {
  assert.equal(String(families.store.docs.find((d) => String(d._id) === String(FAMILY_B))?.houseName), 'House B');
  assert.equal(members.store.docs.find((d) => String(d._id) === String(MEMBER_B))?.status, 'active');
  assert.equal(families.store.docs.length, 2);
  assert.equal(members.store.docs.length, 2);
};

describe('lists are pinned to the caller\'s Mahallu', () => {
  test('families: only the caller\'s own, even when the query names another Mahallu', async () => {
    const reply = await call(getAllFamilies, { ...institute(), query: { tenantId: String(B) } });
    assert.equal(reply.status, 200);
    assert.deepEqual(ids(reply), [String(FAMILY_A)]);
  });

  test('members: only the caller\'s own, even when the query names another Mahallu or family', async () => {
    const reply = await call(getAllMembers, { ...institute(), query: { tenantId: String(B), familyId: String(FAMILY_B) } });
    assert.equal(reply.status, 200);
    assert.deepEqual(ids(reply), []);
    const own = await call(getAllMembers, { ...institute(), query: { tenantId: String(B) } });
    assert.deepEqual(ids(own), [String(MEMBER_A)]);
  });

  test('family statistics count only the caller\'s own members', async () => {
    const reply = await call(getFamilyStats, { ...institute(), query: { tenantId: String(B) } });
    assert.deepEqual(reply.body.data, { totalMembers: 1, maleCount: 1, femaleCount: 0 });
  });

  test('another Mahallu\'s family id lists no members', async () => {
    const reply = await call(getMembersByFamily, { ...institute(), params: { familyId: String(FAMILY_B) } });
    assert.deepEqual(ids(reply), []);
  });
});

describe('by-id paths refuse another Mahallu\'s records and change nothing', () => {
  test('read, update, status change and delete of a foreign family or member answer 403', async () => {
    const cases: Array<[string, (req: any, res: any) => any, Record<string, unknown>]> = [
      ['getFamilyById', getFamilyById, { params: { id: String(FAMILY_B) } }],
      ['updateFamily', updateFamily, { params: { id: String(FAMILY_B) }, body: { houseName: 'Hijacked' } }],
      ['deleteFamily', deleteFamily, { params: { id: String(FAMILY_B) } }],
      ['getMemberById', getMemberById, { params: { id: String(MEMBER_B) } }],
      ['updateMember', updateMember, { params: { id: String(MEMBER_B) }, body: { name: 'Hijacked' } }],
      ['updateMemberStatus', updateMemberStatus, { params: { id: String(MEMBER_B) }, body: { status: 'deleted' } }],
      ['deleteMember', deleteMember, { params: { id: String(MEMBER_B) } }],
    ];
    for (const [name, handler, req] of cases) {
      const reply = await call(handler, { ...institute(), ...req });
      assert.equal(reply.status, 403, name);
    }
    untouched();
    assert.equal(members.store.docs.find((d) => String(d._id) === String(MEMBER_B))?.name, 'Member B');
  });

  test('a member cannot be attached to, or created in, another Mahallu\'s family', async () => {
    const move = await call(updateMember, { ...institute(), params: { id: String(MEMBER_A) }, body: { familyId: String(FAMILY_B) } });
    assert.equal(move.status, 403);
    const add = await call(createMember, { ...institute(), body: { name: 'New', familyId: String(FAMILY_B) } });
    assert.equal(add.status, 403);
    assert.equal(members.store.docs.length, 2);
    assert.equal(String(members.store.docs.find((d) => String(d._id) === String(MEMBER_A))?.familyId), String(FAMILY_A));
  });

  test('bulk member import into another Mahallu\'s family is refused', async () => {
    const reply = await call(bulkImportMembers, { ...institute(), body: { familyId: String(FAMILY_B), members: [{ name: 'X' }] } });
    assert.equal(reply.status, 403);
    assert.equal(members.store.docs.length, 2);
  });

  test('the caller\'s own records are still reachable (the 403s above are about the Mahallu, not the route)', async () => {
    assert.equal((await call(getFamilyById, { ...institute(), params: { id: String(FAMILY_A) } })).status, 200);
    assert.equal((await call(getMemberById, { ...institute(), params: { id: String(MEMBER_A) } })).status, 200);
  });
});

describe('an account with no Mahallu or no institute is refused, never given an unscoped query', () => {
  const noTenant = { user: { _id: oid(), role: 'institute', instituteId: INSTITUTE }, tenantId: undefined, isSuperAdmin: false };

  test('no Mahallu: lists 403, by-id 403, writes 400/403, family members empty', async () => {
    assert.equal((await call(getAllFamilies, noTenant)).status, 403);
    assert.equal((await call(getAllMembers, noTenant)).status, 403);
    assert.equal((await call(getFamilyStats, noTenant)).status, 403);
    assert.equal((await call(getFamilyById, { ...noTenant, params: { id: String(FAMILY_A) } })).status, 403);
    assert.equal((await call(getMemberById, { ...noTenant, params: { id: String(MEMBER_A) } })).status, 403);
    assert.equal((await call(updateMember, { ...noTenant, params: { id: String(MEMBER_A) }, body: { name: 'x' } })).status, 403);
    assert.equal((await call(createFamily, { ...noTenant, body: { houseName: 'x', tenantId: String(A) } })).status, 400);
    assert.equal((await call(createMember, { ...noTenant, body: { name: 'x', familyName: 'x', tenantId: String(A) } })).status, 400);
    assert.equal((await call(bulkImportFamilies, { ...noTenant, body: { families: [{ houseName: 'x' }], tenantId: String(A) } })).status, 400);
    assert.deepEqual(ids(await call(getMembersByFamily, { ...noTenant, params: { familyId: String(FAMILY_A) } })), []);
    assert.equal(families.store.docs.length, 2);
    assert.equal(members.store.docs.length, 2);
  });

  test('an institute account that is not linked to an institute gets no list at all', async () => {
    const unlinked = institute({ user: { _id: oid(), role: 'institute', tenantId: A } });
    assert.equal((await call(getAllFamilies, unlinked)).status, 403);
    assert.equal((await call(getAllMembers, unlinked)).status, 403);
  });
});

describe('behind the real tenant middleware, a body cannot move a record to another Mahallu', () => {
  const through = async (handler: (req: any, res: any) => any, req: Record<string, any>) => {
    const full: any = { headers: {}, query: {}, params: {}, body: {}, ...req };
    await tenantMiddleware(full, {} as any, () => undefined);
    tenantFilter(full, {} as any, () => undefined);
    return call(handler, full);
  };
  const asInstitute = () => ({ user: { _id: oid(), role: 'institute', tenantId: A, instituteId: INSTITUTE } });

  test('updateMember with another Mahallu\'s tenantId in the body keeps the member where it is', async () => {
    const reply = await through(updateMember, { ...asInstitute(), params: { id: String(MEMBER_A) }, body: { name: 'Renamed', tenantId: String(B) } });
    assert.equal(reply.status, 200);
    const stored = members.store.docs.find((d) => String(d._id) === String(MEMBER_A));
    assert.equal(String(stored?.tenantId), String(A));
    assert.equal(stored?.name, 'Renamed');
  });

  test('updateFamily with another Mahallu\'s tenantId in the body keeps the family where it is', async () => {
    const reply = await through(updateFamily, { ...asInstitute(), params: { id: String(FAMILY_A) }, body: { houseName: 'Renamed', tenantId: String(B) } });
    assert.equal(reply.status, 200);
    assert.equal(String(families.store.docs.find((d) => String(d._id) === String(FAMILY_A))?.tenantId), String(A));
  });

  test('a query ?tenantId= and an x-tenant-id header do not move a non-super caller to another Mahallu', async () => {
    const reply = await through(getAllMembers, { ...asInstitute(), headers: { 'x-tenant-id': String(B) }, query: { tenantId: String(B) } });
    assert.deepEqual(ids(reply), [String(MEMBER_A)]);
  });
});
});
