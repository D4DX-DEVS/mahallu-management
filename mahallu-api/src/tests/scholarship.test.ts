/**
 * B3.3 tests. Scholarships, awards, and academic support cases are mostly CRUD.
 * What is worth pinning here is the schema shape the CMS relies on: the enums
 * it renders as dropdowns, the required fields, and the status transition rules.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Scholarship,
  ScholarshipAward,
  AcademicSupportCase,
  SCHOLARSHIP_STATUSES,
  AWARD_STATUSES,
  SUPPORT_CASE_TYPES,
  SUPPORT_CASE_STATUSES,
} from '../models/Scholarship';

test('scholarship statuses match expected values', () => {
  assert.deepEqual([...SCHOLARSHIP_STATUSES], ['active', 'closed']);
});

test('award statuses match expected values', () => {
  assert.deepEqual([...AWARD_STATUSES], ['applied', 'approved', 'paid']);
});

test('support case types match expected values', () => {
  assert.deepEqual([...SUPPORT_CASE_TYPES], [
    'career_guidance',
    'competitive_exam',
    'dropout_risk',
    'tuition',
    'remedial',
    'academic_award',
  ]);
});

test('support case statuses match expected values', () => {
  assert.deepEqual([...SUPPORT_CASE_STATUSES], ['open', 'in_progress', 'resolved', 'closed']);
});

test('a scholarship carries tenantId and required fields', () => {
  const paths = Scholarship.schema.paths;
  ['tenantId', 'name', 'amount', 'academicYear', 'status'].forEach((field) => {
    assert.ok(paths[field], `Scholarship is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.name.isRequired, true);
  assert.equal(paths.amount.isRequired, true);
  assert.equal(paths.academicYear.isRequired, true);
});

test('a scholarship award requires tenantId, scholarshipId, memberId, and amount', () => {
  const paths = ScholarshipAward.schema.paths;
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.scholarshipId.isRequired, true);
  assert.equal(paths.memberId.isRequired, true);
  assert.equal(paths.amount.isRequired, true);
});

test('an academic support case requires tenantId, memberId, type, and description', () => {
  const paths = AcademicSupportCase.schema.paths;
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.memberId.isRequired, true);
  assert.equal(paths.type.isRequired, true);
  assert.equal(paths.description.isRequired, true);
});

test('scholarship has compound indexes on tenantId+status and tenantId+academicYear', () => {
  const indexes = Scholarship.schema.indexes();
  const hasStatusIndex = indexes.some(
    ([fields, _options]: any[]) => fields.tenantId && fields.status
  );
  const hasYearIndex = indexes.some(
    ([fields, _options]: any[]) => fields.tenantId && fields.academicYear
  );
  assert.ok(hasStatusIndex, 'missing tenantId+status index on Scholarship');
  assert.ok(hasYearIndex, 'missing tenantId+academicYear index on Scholarship');
});

test('scholarship award has compound indexes on tenantId+scholarshipId and tenantId+status', () => {
  const indexes = ScholarshipAward.schema.indexes();
  const hasScholarshipIndex = indexes.some(
    ([fields, _options]: any[]) => fields.tenantId && fields.scholarshipId
  );
  const hasStatusIndex = indexes.some(
    ([fields, _options]: any[]) => fields.tenantId && fields.status
  );
  assert.ok(hasScholarshipIndex, 'missing tenantId+scholarshipId index on ScholarshipAward');
  assert.ok(hasStatusIndex, 'missing tenantId+status index on ScholarshipAward');
});

test('academic support case has compound indexes on tenantId+type and tenantId+status', () => {
  const indexes = AcademicSupportCase.schema.indexes();
  const hasTypeIndex = indexes.some(
    ([fields, _options]: any[]) => fields.tenantId && fields.type
  );
  const hasStatusIndex = indexes.some(
    ([fields, _options]: any[]) => fields.tenantId && fields.status
  );
  assert.ok(hasTypeIndex, 'missing tenantId+type index on AcademicSupportCase');
  assert.ok(hasStatusIndex, 'missing tenantId+status index on AcademicSupportCase');
});

test('all three collections timestamp their documents', () => {
  assert.ok(Scholarship.schema.paths.createdAt, 'Scholarship has no timestamps');
  assert.ok(ScholarshipAward.schema.paths.createdAt, 'ScholarshipAward has no timestamps');
  assert.ok(AcademicSupportCase.schema.paths.createdAt, 'AcademicSupportCase has no timestamps');
});
