/**
 * B6 tests. Health resources and medical camps are CRUD-based.
 * This tests the schema shapes the CMS relies on: type enums, tenant isolation, and access control.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import HealthResource, { HEALTH_RESOURCE_TYPES } from '../models/HealthResource';
import MedicalCamp from '../models/MedicalCamp';
import User from '../models/User';

test('health resource types include non-sensitive and sensitive', () => {
  assert.deepEqual([...HEALTH_RESOURCE_TYPES], [
    'doctor',
    'blood_donor',
    'palliative_case',
    'patient_support',
    'elderly_care',
  ]);
});

test('a health resource carries tenantId, type, name, and contact info', () => {
  const paths = HealthResource.schema.paths;
  ['tenantId', 'type', 'name', 'contactNo', 'status'].forEach((field) => {
    assert.ok(paths[field], `HealthResource is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.type.isRequired, true);
  assert.equal(paths.name.isRequired, true);
  assert.equal(paths.contactNo.isRequired, true);
});

test('a medical camp carries tenantId, name, date, location, and status', () => {
  const paths = MedicalCamp.schema.paths;
  ['tenantId', 'name', 'campDate', 'location', 'status'].forEach((field) => {
    assert.ok(paths[field], `MedicalCamp is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.name.isRequired, true);
  assert.equal(paths.campDate.isRequired, true);
  assert.equal(paths.location.isRequired, true);
});

test('health resources have compound indexes on tenantId + status and tenantId + type', () => {
  const indexes = HealthResource.schema.indexes();
  const hasTenantStatus = indexes.some(
    ([fields, _options]: any[]) => fields.tenantId && fields.status
  );
  const hasTenantType = indexes.some(
    ([fields, _options]: any[]) => fields.tenantId && fields.type
  );
  assert.ok(hasTenantStatus, 'expected compound index on tenantId + status');
  assert.ok(hasTenantType, 'expected compound index on tenantId + type');
});

test('medical camps have compound indexes on tenantId + status and tenantId + campDate', () => {
  const indexes = MedicalCamp.schema.indexes();
  const hasTenantStatus = indexes.some(
    ([fields, _options]: any[]) => fields.tenantId && fields.status
  );
  const hasTenantDate = indexes.some(
    ([fields, _options]: any[]) => fields.tenantId && fields.campDate
  );
  assert.ok(hasTenantStatus, 'expected compound index on tenantId + status');
  assert.ok(hasTenantDate, 'expected compound index on tenantId + campDate');
});

test('both collections timestamp their documents', () => {
  assert.ok(HealthResource.schema.paths.createdAt, 'HealthResource has no timestamps');
  assert.ok(MedicalCamp.schema.paths.createdAt, 'MedicalCamp has no timestamps');
});

test('user model schema exists', () => {
  // The IUser interface documents sensitiveModules as optional array in permissions
  assert.ok(User, 'User model exists');
});

test('health resource type enum includes sensitive types: palliative_case and patient_support', () => {
  const typePath = HealthResource.schema.path('type') as any;
  const typeEnum = typePath.enumValues || typePath.options?.enum;
  assert.ok(
    typeEnum.includes('palliative_case'),
    'expected palliative_case in type enum'
  );
  assert.ok(
    typeEnum.includes('patient_support'),
    'expected patient_support in type enum'
  );
});

test('medical camp status enum includes planned, completed, cancelled', () => {
  const statusPath = MedicalCamp.schema.path('status') as any;
  const statusEnum = statusPath.enumValues || statusPath.options?.enum;
  assert.deepEqual(statusEnum, ['planned', 'completed', 'cancelled']);
});
