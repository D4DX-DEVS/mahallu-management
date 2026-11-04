import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Member from '../models/Member';
import { getAllMembers } from '../controllers/memberController';
import { call, installFake, oid, Installed } from './support/fakeMongo';

describe('[isolated] memberBloodGroupFilter', () => {

const A = oid();
let members: Installed;
beforeEach(() => {
  members = installFake(Member, [
    { _id: oid(), tenantId: A, name: 'One', bloodGroup: 'O -ve', status: 'active' },
    { _id: oid(), tenantId: A, name: 'Two', bloodGroup: 'A +ve', status: 'active' },
    { _id: oid(), tenantId: A, name: 'Three', bloodGroup: 'O -ve', status: 'active' },
  ]);
});
afterEach(() => members.restore());

const admin = (query: Record<string, unknown>) => ({
  user: { _id: oid(), role: 'mahall', tenantId: A },
  tenantId: String(A),
  isSuperAdmin: false,
  query,
});

test('bloodGroup lists every member with that exact group and counts them', async () => {
  const reply = await call(getAllMembers, admin({ bloodGroup: 'O -ve' }));
  assert.equal(reply.status, 200);
  assert.deepEqual(reply.body.data.map((m: any) => m.name).sort(), ['One', 'Three']);
  assert.equal(reply.body.pagination.total, 2);
});

test('no bloodGroup lists everyone', async () => {
  assert.equal((await call(getAllMembers, admin({}))).body.data.length, 3);
});

test('an unknown blood group is refused', async () => {
  assert.equal((await call(getAllMembers, admin({ bloodGroup: 'Z +ve' }))).status, 400);
  assert.equal((await call(getAllMembers, admin({ bloodGroup: { $ne: 'x' } }))).status, 400);
});
});
