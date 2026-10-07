import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import User from '../models/User';
import { updateUser } from '../controllers/userController';
import { createUserValidation, updateUserValidation } from '../validations/userValidation';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] userSensitiveModules', () => {

/**
 * `permissions` was written whole (`$set: { permissions: { view, add, edit, delete } }`), which replaces
 * the stored object. EditSurveyUser and EditInstituteUser send only the four flags, so saving either
 * form erased the account's counselling / maslahat / inheritance / health / welfare grants. The update
 * is now field-wise: a field the request does not mention is left alone.
 *
 * Who may GRANT a module (and whether a Mahallu admin may grant one to themselves) is NOT decided here:
 * see docs/AUTHORIZATION_POLICY.md D6. These tests only pin that nothing existing is removed and that the
 * shape of the input is validated.
 */

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();
const ADMIN = { _id: oid(), tenantId: TENANT, phone: '9000000001', role: 'mahall' };
const STAFF = { _id: oid(), tenantId: TENANT, phone: '9000000002', role: 'survey' };

let updates: any[] = [];
let originals: any;
beforeEach(() => {
  updates = [];
  originals = { findById: User.findById, findByIdAndUpdate: User.findByIdAndUpdate };
  (User as any).findById = async (id: any) => [ADMIN, STAFF].find((u) => String(u._id) === String(id)) ?? null;
  (User as any).findByIdAndUpdate = (id: any, data: any, options: any) => {
    updates.push({ id, data, options });
    return { select: async () => ({ ...data }) };
  };
});
afterEach(() => Object.assign(User, originals));

const put = async (targetId: any, body: Record<string, unknown>, isSuperAdmin = false) => {
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  await updateUser({ params: { id: String(targetId) }, body, user: ADMIN, tenantId: String(TENANT), isSuperAdmin } as any, res);
  return out;
};

/** What Mongo would be told: the update after Mongoose has cast it against the real User schema. */
const castUpdate = (update: Record<string, unknown>): any => {
  const q: any = User.findOneAndUpdate({ _id: STAFF._id }, update as any, { runValidators: true });
  return typeof q._castUpdate === 'function' ? q._castUpdate(q.getUpdate()) : undefined;
};

describe('saving the survey / institute edit form (four flags, no sensitiveModules)', () => {
  const FLAGS = { view: true, add: false, edit: true, delete: false };

  test('does not write the permissions object as a whole', async () => {
    const out = await put(STAFF._id, { name: 'Staff', permissions: FLAGS });
    assert.equal(out.status, 200);
    const data = updates[0].data;
    assert.equal('permissions' in data, false, 'a whole `permissions` $set would replace sensitiveModules');
    assert.deepEqual(
      Object.keys(data).filter((k) => k.startsWith('permissions.')).sort(),
      ['permissions.add', 'permissions.delete', 'permissions.edit', 'permissions.view']
    );
    assert.equal(data['permissions.edit'], true);
  });

  test('never mentions sensitiveModules, so an existing grant is untouched', async () => {
    await put(STAFF._id, { permissions: FLAGS });
    assert.equal('permissions.sensitiveModules' in updates[0].data, false);
  });

  test('after Mongoose casts it, the update sets the flags one by one and leaves sensitiveModules out', async () => {
    await put(STAFF._id, { permissions: FLAGS });
    const cast = castUpdate(updates[0].data);
    if (!cast) return; // Mongoose internals changed: the structural assertions above still apply
    const set = cast.$set ?? {};
    assert.equal('permissions' in set, false);
    assert.equal(set['permissions.view'], true);
    assert.equal(JSON.stringify(cast).includes('sensitiveModules'), false);
  });

  test('a partial permissions object does not reset the flags it leaves out', async () => {
    await put(STAFF._id, { permissions: { view: true } });
    assert.deepEqual(
      Object.keys(updates[0].data).filter((k) => k.startsWith('permissions.')),
      ['permissions.view']
    );
  });

  test('an update with no permissions touches no permission field', async () => {
    await put(STAFF._id, { name: 'Renamed' });
    assert.deepEqual(Object.keys(updates[0].data).filter((k) => k.startsWith('permissions')), []);
  });
});

describe('the Mahallu user form (sends sensitiveModules)', () => {
  test('grants are written as sent, and an empty list still revokes them all', async () => {
    await put(STAFF._id, { permissions: { view: true, sensitiveModules: ['health', 'welfare'] } });
    assert.deepEqual(updates[0].data['permissions.sensitiveModules'], ['health', 'welfare']);
    await put(STAFF._id, { permissions: { view: true, sensitiveModules: [] } });
    assert.deepEqual(updates[1].data['permissions.sensitiveModules'], []);
  });

  test('the update still runs the schema validators (the Mongoose enum is the last line of defence)', async () => {
    await put(STAFF._id, { permissions: { sensitiveModules: ['health'] } });
    assert.equal(updates[0].options.runValidators, true);
  });
});

describe('sensitiveModules input validation', () => {
  const run = async (chains: any[], body: Record<string, unknown>): Promise<string[]> => {
    const req: any = { body, query: {}, params: { id: String(STAFF._id) }, headers: {} };
    for (const chain of chains) await chain.run(req);
    return validationResult(req).array().map((e: any) => `${e.path}: ${e.msg}`);
  };
  const base = { name: 'New Staff', phone: '9111111111' };
  const ALL = ['counselling', 'maslahat', 'inheritance', 'health', 'welfare'];

  for (const [label, chains, extra] of [
    ['create', createUserValidation, base],
    ['update', updateUserValidation, {}],
  ] as const) {
    test(`${label}: omitted, empty, one name and all five names are accepted`, async () => {
      assert.deepEqual(await run(chains as any[], { ...extra, permissions: { view: true } }), []);
      assert.deepEqual(await run(chains as any[], { ...extra, permissions: { sensitiveModules: [] } }), []);
      assert.deepEqual(await run(chains as any[], { ...extra, permissions: { sensitiveModules: ['health'] } }), []);
      assert.deepEqual(await run(chains as any[], { ...extra, permissions: { sensitiveModules: ALL } }), []);
    });

    test(`${label}: an unknown name, a duplicate, a sixth entry, a non-list and null are refused with a message`, async () => {
      for (const sensitiveModules of [['payroll'], ['health', 'health'], [...ALL, 'welfare'], 'health', null, [{ $ne: 1 }], [1]]) {
        const errors = await run(chains as any[], { ...extra, permissions: { sensitiveModules } });
        assert.ok(errors.length > 0, JSON.stringify(sensitiveModules));
      }
    });

    test(`${label}: permissions must be an object and the four flags booleans`, async () => {
      assert.ok((await run(chains as any[], { ...extra, permissions: 'all' })).length > 0);
      assert.ok((await run(chains as any[], { ...extra, permissions: { edit: 'maybe' } })).length > 0);
      assert.deepEqual(await run(chains as any[], { ...extra, permissions: { view: true, add: false, edit: true, delete: false } }), []);
    });
  }
});

describe('the enum in the schema and the validator agree', () => {
  test('the five names are exactly what the User model accepts', () => {
    const path: any = User.schema.path('permissions.sensitiveModules');
    assert.deepEqual([...path.caster.enumValues].sort(), [...['counselling', 'maslahat', 'inheritance', 'health', 'welfare']].sort());
  });
});
});
