/**
 * B10 Cemetery tests. Cemetery & GraveRecord cover the schema shapes:
 * compound indexes for uniqueness, cemetery capacity, grave-number uniqueness.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { Cemetery, GraveRecord } from '../models/Cemetery';
import { DeathRegistration } from '../models/Registration';

test('Cemetery has required fields', () => {
  const paths = Cemetery.schema.paths;
  ['tenantId', 'name', 'capacity', 'status'].forEach((field) => {
    assert.ok(paths[field], `Cemetery is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.name.isRequired, true);
  assert.equal(paths.capacity.isRequired, true);
});

test('Cemetery capacity has minimum constraint', () => {
  const capacityPath = Cemetery.schema.path('capacity') as any;
  // Check validators array
  const hasMinValidator = (capacityPath.validators || []).some(
    (v: any) => v.type === 'min' || v.message?.includes('min')
  );
  assert.ok(
    hasMinValidator || capacityPath.options?.min !== undefined,
    'capacity should have a minimum constraint'
  );
});

test('Cemetery status enum has active and inactive', () => {
  const statusPath = Cemetery.schema.path('status') as any;
  const enumVals = statusPath.enumValues || statusPath.options?.enum;
  if (enumVals) {
    assert.ok(
      enumVals.includes('active') && enumVals.includes('inactive'),
      'Cemetery status should include active and inactive'
    );
  }
});

test('GraveRecord has required fields', () => {
  const paths = GraveRecord.schema.paths;
  ['tenantId', 'cemeteryId', 'graveNo', 'deceasedName'].forEach((field) => {
    assert.ok(paths[field], `GraveRecord is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.cemeteryId.isRequired, true);
  assert.equal(paths.graveNo.isRequired, true);
  assert.equal(paths.deceasedName.isRequired, true);
});

test('GraveRecord enforces unique graveNo per cemetery per tenant', () => {
  const indexes = GraveRecord.schema.indexes();
  const unique = indexes.find(([fields, options]: any[]) => {
    return fields.tenantId && fields.cemeteryId && fields.graveNo && options?.unique;
  });
  assert.ok(
    unique,
    'expected a unique compound index on tenantId + cemeteryId + graveNo'
  );
});

test('DeathRegistration has optional graveRecordId field', () => {
  const paths = DeathRegistration.schema.paths;
  assert.ok(paths.graveRecordId, 'DeathRegistration should have graveRecordId field');
  // Optional fields in Mongoose don't have isRequired set to true
  assert.notEqual(
    paths.graveRecordId.isRequired,
    true,
    'graveRecordId should not be required'
  );
});

test('Cemetery has index on tenantId and status', () => {
  const indexes = Cemetery.schema.indexes();
  const found = indexes.some(
    ([fields, options]: any[]) => fields.tenantId && fields.status
  );
  assert.ok(found, 'Cemetery should have an index on (tenantId, status)');
});

test('GraveRecord has index on tenantId and cemeteryId', () => {
  const indexes = GraveRecord.schema.indexes();
  const found = indexes.some(
    ([fields, options]: any[]) => fields.tenantId && fields.cemeteryId
  );
  assert.ok(found, 'GraveRecord should have an index on (tenantId, cemeteryId)');
});

test('Cemetery timestamps its documents', () => {
  assert.ok(Cemetery.schema.paths.createdAt, 'Cemetery should have createdAt');
  assert.ok(Cemetery.schema.paths.updatedAt, 'Cemetery should have updatedAt');
});

test('GraveRecord timestamps its documents', () => {
  assert.ok(GraveRecord.schema.paths.createdAt, 'GraveRecord should have createdAt');
  assert.ok(GraveRecord.schema.paths.updatedAt, 'GraveRecord should have updatedAt');
});

test('Cemetery has optional location and notes fields', () => {
  const paths = Cemetery.schema.paths;
  assert.ok(paths.location, 'Cemetery should have location field');
  assert.ok(paths.notes, 'Cemetery should have notes field');
  // Optional fields in Mongoose don't have isRequired set to true
  assert.notEqual(
    paths.location.isRequired,
    true,
    'location should not be required'
  );
  assert.notEqual(
    paths.notes.isRequired,
    true,
    'notes should not be required'
  );
});

test('GraveRecord has optional fields: deceasedMemberId, familyId, dateOfDeath, burialDate, rowLabel', () => {
  const paths = GraveRecord.schema.paths;
  ['deceasedMemberId', 'familyId', 'dateOfDeath', 'burialDate', 'rowLabel', 'notes'].forEach((field) => {
    assert.ok(paths[field], `GraveRecord should have ${field} field`);
    // Optional fields in Mongoose don't have isRequired set to true
    assert.notEqual(
      paths[field].isRequired,
      true,
      `${field} should not be required`
    );
  });
});
