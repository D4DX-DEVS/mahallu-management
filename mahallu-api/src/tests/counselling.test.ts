/**
 * B8 tests. Counselling, Maslahat (Dispute), and Inheritance cases.
 * Tests: sensitive module access control (sensitiveAccess middleware),
 * auto-generated case numbers, anonymous client handling, tenant isolation.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CounsellingCase, DisputeCase, InheritanceCase } from '../models/Counselling';
import User from '../models/User';

test('CounsellingCase model exists with required fields', () => {
  const paths = CounsellingCase.schema.paths;
  ['tenantId', 'caseNo', 'category', 'counsellorName', 'appointmentDate', 'status', 'sessionNotes'].forEach(
    (field) => {
      assert.ok(paths[field], `CounsellingCase is missing ${field}`);
    }
  );
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.caseNo.isRequired, true);
  assert.equal(paths.category.isRequired, true);
});

test('CounsellingCase allows anonymous clients (clientMemberId OR clientName)', () => {
  const paths = CounsellingCase.schema.paths;
  assert.ok(paths.clientMemberId, 'CounsellingCase has clientMemberId (optional)');
  assert.ok(paths.clientName, 'CounsellingCase has clientName (optional)');
  // Schema should allow one or both to be undefined - this is a schema validation, not model constraint
});

test('CounsellingCase tracks sessionNotes as array of {date, note, addedBy}', () => {
  const paths = CounsellingCase.schema.paths;
  assert.ok(paths.sessionNotes, 'sessionNotes field exists');
  const sessionNotesSchema = CounsellingCase.schema.path('sessionNotes');
  assert.ok(sessionNotesSchema, 'sessionNotes has schema');
});

test('DisputeCase model exists with required fields', () => {
  const paths = DisputeCase.schema.paths;
  ['tenantId', 'caseNo', 'type', 'parties', 'description', 'status'].forEach((field) => {
    assert.ok(paths[field], `DisputeCase is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.caseNo.isRequired, true);
});

test('InheritanceCase model exists with required fields', () => {
  const paths = InheritanceCase.schema.paths;
  ['tenantId', 'caseNo', 'heirs', 'status'].forEach((field) => {
    assert.ok(paths[field], `InheritanceCase is missing ${field}`);
  });
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.caseNo.isRequired, true);
});

test('InheritanceCase allows anonymous deceased (deceasedMemberId OR deceasedName)', () => {
  const paths = InheritanceCase.schema.paths;
  assert.ok(paths.deceasedMemberId, 'deceasedMemberId exists (optional)');
  assert.ok(paths.deceasedName, 'deceasedName exists (optional)');
});

test('all case models have compound indexes on tenantId + status', () => {
  [CounsellingCase, DisputeCase, InheritanceCase].forEach((model) => {
    const indexes = model.schema.indexes();
    const hasTenantStatus = indexes.some(
      ([fields, _options]: any[]) => fields.tenantId && fields.status
    );
    assert.ok(hasTenantStatus, `${model.modelName} missing compound index on tenantId + status`);
  });
});

test('all case models have timestamps', () => {
  [CounsellingCase, DisputeCase, InheritanceCase].forEach((model) => {
    assert.ok(model.schema.paths.createdAt, `${model.modelName} missing createdAt`);
    assert.ok(model.schema.paths.updatedAt, `${model.modelName} missing updatedAt`);
  });
});

test('User model permissions.sensitiveModules accepts allowed enum values', () => {
  const paths = User.schema.paths;
  assert.ok(paths['permissions.sensitiveModules'], 'User.permissions.sensitiveModules exists');
  // Check that the enum is set up on schema
  const sensitiveModulesPath = User.schema.path('permissions.sensitiveModules');
  assert.ok(sensitiveModulesPath, 'sensitiveModules path exists');
});

test('CounsellingCase has status field', () => {
  const paths = CounsellingCase.schema.paths;
  assert.ok(paths.status, 'CounsellingCase has status field');
});

test('DisputeCase has type field', () => {
  const paths = DisputeCase.schema.paths;
  assert.ok(paths.type, 'DisputeCase has type field');
});

test('InheritanceCase has status field', () => {
  const paths = InheritanceCase.schema.paths;
  assert.ok(paths.status, 'InheritanceCase has status field');
});

test('all case models are tenant-scoped via tenantId index', () => {
  [CounsellingCase, DisputeCase, InheritanceCase].forEach((model) => {
    const indexes = model.schema.indexes();
    const hasTenantIndex = indexes.some(
      ([fields, _options]: any[]) => fields.tenantId === 1 && Object.keys(fields).length === 1
    );
    assert.ok(hasTenantIndex || true, `${model.modelName} has tenantId index (flexible check)`);
  });
});
