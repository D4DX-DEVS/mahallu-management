/**
 * B7 tests. Khateeb and Khutbah are mostly CRUD, so what is worth
 * pinning here is the schema shape the CMS relies on: the enums it renders as
 * dropdowns, tenant isolation, and reference validation.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import Khateeb, { KHATEEB_STATUSES, IKhateeb } from '../models/Khateeb';
import Khutbah, { KHUTBAH_STATUSES, IKhutbah } from '../models/Khutbah';
import Institute from '../models/Institute';

test('khateeb statuses match the set the CMS offers', () => {
  assert.deepEqual([...KHATEEB_STATUSES], ['active', 'inactive']);
});

test('khutbah statuses match the set the CMS offers', () => {
  assert.deepEqual([...KHUTBAH_STATUSES], ['scheduled', 'delivered', 'cancelled']);
});

test('a khateeb carries tenantId and the fields the list view reads', () => {
  const paths = Khateeb.schema.paths;
  ['tenantId', 'name', 'status', 'contactNo'].forEach((field) => {
    assert.ok(paths[field], `Khateeb is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.name.isRequired, true);
});

test('a khutbah requires a tenant, khateeb, date and topic', () => {
  const paths = Khutbah.schema.paths;
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.khateebId.isRequired, true);
  assert.equal(paths.date.isRequired, true);
  assert.equal(paths.topic.isRequired, true);
});

test('both collections timestamp their documents', () => {
  assert.ok(Khateeb.schema.paths.createdAt, 'Khateeb has no timestamps');
  assert.ok(Khutbah.schema.paths.createdAt, 'Khutbah has no timestamps');
});

test('Institute type enum includes mosque', () => {
  const paths = Institute.schema.paths;
  const enumValues = (paths.type as any).enumValues || (paths.type as any).options?.enum;
  assert.ok(enumValues && enumValues.includes('mosque'), 'Institute type enum missing mosque');
});

test('Institute supports audience and programType optional fields for Islamic programs', () => {
  const paths = Institute.schema.paths;
  assert.ok(paths.audience, 'Institute missing audience field');
  assert.ok(paths.programType, 'Institute missing programType field');
});
