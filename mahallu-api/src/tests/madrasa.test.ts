/**
 * B3.1 tests. Classes and enrollments are mostly CRUD, so what is worth
 * pinning here is the schema shape the CMS relies on: the enums it renders as
 * dropdowns, and the unique index that stops a student being enrolled twice.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MadrasaClass,
  StudentEnrollment,
  CLASS_TYPES,
  ENROLLMENT_STATUSES,
} from '../models/Madrasa';

test('class types match the set the CMS offers', () => {
  assert.deepEqual(
    [...CLASS_TYPES],
    ['weekend_madrasa', 'tuition', 'adult_quran', 'remedial', 'other']
  );
});

test('enrollment statuses match the set the CMS offers', () => {
  assert.deepEqual([...ENROLLMENT_STATUSES], ['active', 'completed', 'dropped']);
});

test('a class carries tenantId and the fields the list view reads', () => {
  const paths = MadrasaClass.schema.paths;
  ['tenantId', 'name', 'academicYear', 'classType', 'teacherEmployeeId', 'status'].forEach(
    (field) => {
      assert.ok(paths[field], `MadrasaClass is missing ${field}`);
    }
  );
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.name.isRequired, true);
  assert.equal(paths.academicYear.isRequired, true);
});

test('an enrollment requires a tenant, a class and a student', () => {
  const paths = StudentEnrollment.schema.paths;
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.classId.isRequired, true);
  assert.equal(paths.memberId.isRequired, true);
});

test('a student cannot be enrolled in the same class twice', () => {
  const unique = StudentEnrollment.schema
    .indexes()
    .find(([fields, options]: any[]) => fields.classId && fields.memberId && options?.unique);
  assert.ok(unique, 'expected a unique compound index on classId + memberId');
});

test('both collections timestamp their documents', () => {
  assert.ok(MadrasaClass.schema.paths.createdAt, 'MadrasaClass has no timestamps');
  assert.ok(StudentEnrollment.schema.paths.createdAt, 'StudentEnrollment has no timestamps');
});
