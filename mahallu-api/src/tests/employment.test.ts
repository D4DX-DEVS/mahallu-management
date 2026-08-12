/**
 * B4 tests. Employment module: Employers, Job Vacancies, and Skill Trainings.
 * Validates schema shape, required fields, enums, and indexes.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Employer,
  JobVacancy,
  SkillTraining,
  EMPLOYMENT_OUTCOMES,
} from '../models/Employment';

test('employment outcomes match the set the CMS offers', () => {
  assert.deepEqual(
    [...EMPLOYMENT_OUTCOMES],
    ['none', 'employed', 'self_employed']
  );
});

test('an employer has tenantId and required fields', () => {
  const paths = Employer.schema.paths;
  ['tenantId', 'name', 'status'].forEach((field) => {
    assert.ok(paths[field], `Employer is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.name.isRequired, true);
});

test('a job vacancy requires tenantId, title, and either employerId or employerName', () => {
  const paths = JobVacancy.schema.paths;
  ['tenantId', 'title', 'status', 'postedDate'].forEach((field) => {
    assert.ok(paths[field], `JobVacancy is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.title.isRequired, true);
});

test('a job vacancy has status enum with open, filled, closed', () => {
  const statusPath = JobVacancy.schema.paths.status;
  const enum_values = (statusPath as any).enumValues || (statusPath as any).options?.enum;
  assert.ok(enum_values, 'JobVacancy status missing enum');
  assert.ok(
    enum_values.includes('open') && enum_values.includes('filled') && enum_values.includes('closed'),
    'JobVacancy status enum missing expected values'
  );
});

test('a skill training requires tenantId, name, startDate, endDate', () => {
  const paths = SkillTraining.schema.paths;
  ['tenantId', 'name', 'startDate', 'endDate', 'participants', 'status'].forEach((field) => {
    assert.ok(paths[field], `SkillTraining is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.name.isRequired, true);
  assert.equal(paths.startDate.isRequired, true);
  assert.equal(paths.endDate.isRequired, true);
});

test('a skill training has status enum with planned, ongoing, completed, cancelled', () => {
  const statusPath = SkillTraining.schema.paths.status;
  const enum_values = (statusPath as any).enumValues || (statusPath as any).options?.enum;
  assert.ok(enum_values, 'SkillTraining status missing enum');
  assert.ok(
    enum_values.includes('planned') && enum_values.includes('ongoing') &&
    enum_values.includes('completed') && enum_values.includes('cancelled'),
    'SkillTraining status enum missing expected values'
  );
});

test('all three collections timestamp their documents', () => {
  assert.ok(Employer.schema.paths.createdAt, 'Employer has no timestamps');
  assert.ok(JobVacancy.schema.paths.createdAt, 'JobVacancy has no timestamps');
  assert.ok(SkillTraining.schema.paths.createdAt, 'SkillTraining has no timestamps');
});

test('employer has compound index on tenantId + status', () => {
  const indexes = Employer.schema.indexes();
  const hasIndex = indexes.some(([fields]: any[]) =>
    fields.tenantId === 1 && fields.status === 1
  );
  assert.ok(hasIndex, 'expected a compound index on tenantId + status');
});

test('job vacancy has compound index on tenantId + status', () => {
  const indexes = JobVacancy.schema.indexes();
  const hasIndex = indexes.some(([fields]: any[]) =>
    fields.tenantId === 1 && fields.status === 1
  );
  assert.ok(hasIndex, 'expected a compound index on tenantId + status');
});

test('skill training has compound index on tenantId + status', () => {
  const indexes = SkillTraining.schema.indexes();
  const hasIndex = indexes.some(([fields]: any[]) =>
    fields.tenantId === 1 && fields.status === 1
  );
  assert.ok(hasIndex, 'expected a compound index on tenantId + status');
});
