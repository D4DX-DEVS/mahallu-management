import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import Tenant from '../models/Tenant';
import { updateTenant } from '../controllers/tenantController';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] tenantUpdate', () => {

/**
 * PUT /tenants/:id is open to every role of the tenant itself. It used to write the raw body,
 * so a survey worker could suspend the Mahallu, change its plan or switch modules on.
 */
const original = { findById: Tenant.findById, findByIdAndUpdate: Tenant.findByIdAndUpdate };
let written: any;
test.before(() => {
  (Tenant as any).findById = async () => null;
  (Tenant as any).findByIdAndUpdate = async (_id: any, data: any) => {
    written = data;
    return { ...data };
  };
});
test.after(() => Object.assign(Tenant, original));

const call = async (role: string, body: any, isSuperAdmin = false) => {
  written = undefined;
  const out: any = { status: 200 };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  await updateTenant({ params: { id: 't1' }, tenantId: 't1', isSuperAdmin, user: { role }, body } as any, res);
  return { out, written };
};

test('a survey or institute user cannot edit the Mahallu record at all', async () => {
  for (const role of ['survey', 'institute']) {
    const { out, written } = await call(role, { name: 'x' });
    assert.equal(out.status, 403, role);
    assert.equal(written, undefined);
  }
});

test('a Mahallu admin keeps editing their profile but cannot touch platform-owned fields', async () => {
  const { out, written } = await call('mahall', {
    name: 'Renamed',
    status: 'inactive',
    code: 'HACK',
    type: 'other',
    classification: 'x',
    subscription: { plan: 'enterprise', isActive: true },
    settings: { features: { everything: true }, educationOptions: ['a'] },
  });
  assert.equal(out.status, 200);
  assert.equal(written.name, 'Renamed');
  for (const f of ['status', 'code', 'type', 'classification', 'subscription']) assert.equal(written[f], undefined, f);
  assert.equal(written.settings.features, undefined);
  assert.deepEqual(written.settings.educationOptions, ['a']);
});

test('a Super Admin can still change every field', async () => {
  const { written } = await call('super_admin', { status: 'suspended', subscription: { plan: 'pro' } }, true);
  assert.equal(written.status, 'suspended');
  assert.equal(written.subscription.plan, 'pro');
});
});
