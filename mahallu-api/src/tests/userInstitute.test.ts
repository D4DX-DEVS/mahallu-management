import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../models/User';
import Institute from '../models/Institute';
import { updateUser } from '../controllers/userController';

/**
 * An institute account's institute could only be chosen when the account was created, so an
 * account created without one could never be linked (the app then had no instituteId and every
 * institute screen was refused with NO_INSTITUTE). updateUser now sets it, to an institute of the
 * account's own Mahallu only.
 */

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();
const OTHER_TENANT = oid();
const ADMIN = { _id: oid(), tenantId: TENANT, phone: '9000000001', role: 'mahall' };
const INSTITUTE_USER = { _id: oid(), tenantId: TENANT, phone: '9000000003', role: 'institute', instituteId: null };
const SURVEY_USER = { _id: oid(), tenantId: TENANT, phone: '9000000004', role: 'survey' };
const OWN_INSTITUTE = { _id: oid(), tenantId: TENANT };
const FOREIGN_INSTITUTE = { _id: oid(), tenantId: OTHER_TENANT };

let updates: any[] = [];
// Stubbed per call and restored in `finally`, like userPhoneChange.test: the aggregate entry file
// runs other suites that stub the same model methods.
const call = async (targetId: any, body: Record<string, unknown>) => {
  updates = [];
  const original = { findById: User.findById, findByIdAndUpdate: User.findByIdAndUpdate };
  const originalInstitute = { findOne: Institute.findOne };
  (User as any).findById = async (id: any) =>
    [ADMIN, INSTITUTE_USER, SURVEY_USER].find((u) => String(u._id) === String(id)) ?? null;
  (User as any).findByIdAndUpdate = (id: any, data: any) => {
    updates.push({ id, data });
    return { select: async () => ({ ...data }) };
  };
  (Institute as any).findOne = (query: any) => ({
    select: async () =>
      [OWN_INSTITUTE, FOREIGN_INSTITUTE].find(
        (i) => String(i._id) === String(query._id) && String(i.tenantId) === String(query.tenantId)
      ) ?? null,
  });
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  try {
    await updateUser(
      { params: { id: String(targetId) }, body, user: ADMIN, tenantId: String(TENANT), isSuperAdmin: false } as any,
      res
    );
  } finally {
    Object.assign(User, original);
    Object.assign(Institute, originalInstitute);
  }
  return out;
};

test("an institute account can be linked to one of its own Mahallu's institutes", async () => {
  const out = await call(INSTITUTE_USER._id, { instituteId: String(OWN_INSTITUTE._id) });
  assert.equal(out.status, 200);
  assert.equal(String(updates[0].data.instituteId), String(OWN_INSTITUTE._id));
});

test("another Mahallu's institute is refused and nothing is saved", async () => {
  const out = await call(INSTITUTE_USER._id, { instituteId: String(FOREIGN_INSTITUTE._id) });
  assert.equal(out.status, 404);
  assert.equal(updates.length, 0);
});

test('only an institute account can be given an institute', async () => {
  const out = await call(SURVEY_USER._id, { instituteId: String(OWN_INSTITUTE._id) });
  assert.equal(out.status, 400);
  assert.equal(updates.length, 0);
});

test('an edit that does not mention the institute leaves it alone', async () => {
  const out = await call(INSTITUTE_USER._id, { name: 'Renamed' });
  assert.equal(out.status, 200);
  assert.equal('instituteId' in updates[0].data, false);
});
