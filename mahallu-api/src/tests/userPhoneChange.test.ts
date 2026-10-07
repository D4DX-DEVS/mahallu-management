import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../models/User';
import { updateUser } from '../controllers/userController';

/**
 * switch-account treats "same phone number" as proof that another account is also
 * yours. updateUser used to let a Mahallu admin rewrite their OWN phone to anyone's
 * number, which then listed - and let them switch into - that person's accounts
 * (another Mahallu's admin, or the Super Admin) without an OTP.
 */

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();
const ADMIN = { _id: oid(), tenantId: TENANT, phone: '9000000001', role: 'mahall' };
const COLLEAGUE = { _id: oid(), tenantId: TENANT, phone: '9000000002', role: 'survey' };

let updates: any[] = [];
// Stubbed per call and restored in `finally`: this suite runs inside the aggregate entry file
// alongside others that stub User.findById, so a file-wide before() hook can be overridden.
const call = async (targetId: any, body: Record<string, unknown>, isSuperAdmin = false) => {
  updates = [];
  const original = { findById: User.findById, findByIdAndUpdate: User.findByIdAndUpdate };
  (User as any).findById = async (id: any) => [ADMIN, COLLEAGUE].find((u) => String(u._id) === String(id)) ?? null;
  (User as any).findByIdAndUpdate = (id: any, data: any) => {
    updates.push({ id, data });
    return { select: async () => ({ ...data }) };
  };
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  try {
    await updateUser(
      { params: { id: String(targetId) }, body, user: ADMIN, tenantId: String(TENANT), isSuperAdmin } as any,
      res
    );
  } finally {
    Object.assign(User, original);
  }
  return out;
};

test('a Mahallu admin cannot change their own phone number through the user editor', async () => {
  const out = await call(ADMIN._id, { phone: '9111111111' });
  assert.equal(out.status, 403);
  assert.equal(updates.length, 0);
});

test('re-sending the unchanged phone number with other edits is still fine', async () => {
  const out = await call(ADMIN._id, { name: 'New Name', phone: ADMIN.phone });
  assert.equal(out.status, 200);
  assert.equal(updates.length, 1);
});

test("an admin can still edit a colleague's details, including their phone", async () => {
  const out = await call(COLLEAGUE._id, { phone: '9222222222' });
  assert.equal(out.status, 200);
  assert.equal(updates[0].data.phone, '9222222222');
});

test("changing a colleague's phone ends that account's sessions (tokenVersion moves on)", async () => {
  await call(COLLEAGUE._id, { phone: '9333333333' });
  assert.deepEqual(updates[0].data.$inc, { tokenVersion: 1 });
});

test('edits that leave the phone unchanged do not end anyone\'s sessions', async () => {
  await call(COLLEAGUE._id, { name: 'Renamed' });
  assert.equal(updates[0].data.$inc, undefined);
  await call(COLLEAGUE._id, { phone: COLLEAGUE.phone });
  assert.equal(updates[0].data.$inc, undefined);
});
