/**
 * B5 tests. Volunteers module — profile and assignment schema validation.
 * Pins the enum sets and unique constraints the CMS relies on.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VolunteerProfile,
  VolunteerAssignment,
  VOLUNTEER_WINGS,
  SERVICE_TYPES,
  AVAILABILITY_OPTIONS,
} from '../models/VolunteerProfile';

test('volunteer wings match the options offered in CMS', () => {
  assert.deepEqual([...VOLUNTEER_WINGS], ['youth', 'women', 'general']);
});

test('service types match the options offered in CMS', () => {
  assert.deepEqual([...SERVICE_TYPES], [
    'janazah',
    'grave_digging',
    'patient_transport',
    'palliative',
    'emergency',
    'first_aid',
    'disaster',
    'environment',
    'govt_scheme_support',
    'medical',
    'other',
  ]);
});

test('availability options match the CMS options', () => {
  assert.deepEqual([...AVAILABILITY_OPTIONS], ['anytime', 'weekends', 'emergency_only']);
});

test('a volunteer profile has tenantId, memberId, wings, and status', () => {
  const paths = VolunteerProfile.schema.paths;
  ['tenantId', 'memberId', 'wings', 'serviceTypes', 'availability', 'status'].forEach(
    (field) => {
      assert.ok(paths[field], `VolunteerProfile is missing ${field}`);
    }
  );
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.memberId.isRequired, true);
  assert.equal(paths.wings.isRequired, true);
  assert.equal(paths.serviceTypes.isRequired, true);
});

test('a volunteer profile has a unique compound index on (tenantId, memberId)', () => {
  const unique = VolunteerProfile.schema
    .indexes()
    .find(([fields, options]: any[]) => fields.tenantId && fields.memberId && options?.unique);
  assert.ok(unique, 'expected a unique compound index on tenantId + memberId');
});

test('volunteer profile timestamps exist', () => {
  assert.ok(VolunteerProfile.schema.paths.createdAt, 'VolunteerProfile has no timestamps');
  assert.ok(VolunteerProfile.schema.paths.updatedAt, 'VolunteerProfile has no updatedAt');
});

test('an assignment has tenantId, volunteerIds, serviceType, date, and status', () => {
  const paths = VolunteerAssignment.schema.paths;
  ['tenantId', 'volunteerIds', 'serviceType', 'date', 'description', 'status'].forEach(
    (field) => {
      assert.ok(paths[field], `VolunteerAssignment is missing ${field}`);
    }
  );
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.volunteerIds.isRequired, true);
  assert.equal(paths.serviceType.isRequired, true);
  assert.equal(paths.date.isRequired, true);
  assert.equal(paths.description.isRequired, true);
});

test('assignment statuses are assigned, completed, or cancelled', () => {
  const statusPath = VolunteerAssignment.schema.paths.status as any;
  assert.deepEqual(statusPath.enumValues, ['assigned', 'completed', 'cancelled']);
});

test('assignment timestamps exist', () => {
  assert.ok(
    VolunteerAssignment.schema.paths.createdAt,
    'VolunteerAssignment has no timestamps'
  );
  assert.ok(
    VolunteerAssignment.schema.paths.updatedAt,
    'VolunteerAssignment has no updatedAt'
  );
});
