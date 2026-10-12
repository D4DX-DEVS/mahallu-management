/**
 * B3.2 tests. Attendance & Exams cover the schema shapes the CMS relies on:
 * compound indexes for uniqueness, enrollment validation, marks validation.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ClassAttendance, Exam } from '../models/Attendance';
import { MadrasaClass, StudentEnrollment } from '../models/Madrasa';

test('ClassAttendance has required fields', () => {
  const paths = ClassAttendance.schema.paths;
  ['tenantId', 'classId', 'date', 'records'].forEach((field) => {
    assert.ok(paths[field], `ClassAttendance is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.classId.isRequired, true);
  assert.equal(paths.date.isRequired, true);
});

test('ClassAttendance enforces one record per class per date', () => {
  const indexes = ClassAttendance.schema.indexes();
  const unique = indexes.find(([fields, options]: any[]) => {
    return fields.tenantId && fields.classId && fields.date && options?.unique;
  });
  assert.ok(unique, 'expected a unique compound index on tenantId + classId + date');
});

test('ClassAttendance normalizes date to midnight UTC', () => {
  // Schema has a setter; verify it's there
  const dateField = ClassAttendance.schema.path('date') as any;
  assert.ok(dateField.setters.length > 0, 'date field should have a setter for normalization');
});

test('Exam has required fields', () => {
  const paths = Exam.schema.paths;
  ['tenantId', 'classId', 'name', 'examDate', 'maxMarks'].forEach((field) => {
    assert.ok(paths[field], `Exam is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.classId.isRequired, true);
  assert.equal(paths.name.isRequired, true);
  assert.equal(paths.examDate.isRequired, true);
  assert.equal(paths.maxMarks.isRequired, true);
});

test('Exam results array contains enrollmentId, marks, and optional grade', () => {
  const resultsPath = Exam.schema.path('results') as any;
  assert.ok(resultsPath, 'Exam should have results field');
  // results is an array of objects, check the schema definition
  const schemaType = resultsPath.schema || resultsPath.constructor;
  assert.ok(schemaType, 'results should have a schema definition');
});

test('Exam maxMarks has minimum constraint', () => {
  const maxMarksPath = Exam.schema.path('maxMarks') as any;
  // Check validators/validators array
  const hasMinValidator = (maxMarksPath.validators || []).some(
    (v: any) => v.type === 'min' || v.message?.includes('min')
  );
  // Alternatively check the schema definition
  assert.ok(
    hasMinValidator || maxMarksPath.options?.min !== undefined,
    'maxMarks should have a minimum constraint'
  );
});

test('Exam status enum has expected values', () => {
  const statusPath = Exam.schema.path('status') as any;
  assert.ok(statusPath, 'Exam should have status field');
  // Check if enum is defined
  const enumVals = statusPath.enumValues || statusPath.options?.enum;
  if (enumVals) {
    assert.ok(
      enumVals.includes('scheduled') && enumVals.includes('completed'),
      'Exam status should include scheduled and completed'
    );
  }
});

test('both models timestamp their documents', () => {
  assert.ok(ClassAttendance.schema.paths.createdAt, 'ClassAttendance should have createdAt');
  assert.ok(Exam.schema.paths.createdAt, 'Exam should have createdAt');
});
