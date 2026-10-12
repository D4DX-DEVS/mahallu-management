import { test } from 'node:test';
import assert from 'node:assert';
import { DevelopmentProject, PROJECT_AREAS, PROJECT_STATUSES } from '../models/DevelopmentProject';
import { LedgerItem } from '../models/MasterAccount';

test('DevelopmentProject model - enums and schema', () => {
  // Verify enum values
  assert.strictEqual(PROJECT_AREAS.length, 10, 'PROJECT_AREAS should have 10 values');
  assert.ok(PROJECT_AREAS.includes('roads'), 'PROJECT_AREAS should include roads');
  assert.ok(PROJECT_AREAS.includes('water'), 'PROJECT_AREAS should include water');
  assert.ok(PROJECT_AREAS.includes('sanitation'), 'PROJECT_AREAS should include sanitation');
  assert.ok(PROJECT_AREAS.includes('environment'), 'PROJECT_AREAS should include environment');
  assert.ok(PROJECT_AREAS.includes('education'), 'PROJECT_AREAS should include education');
  assert.ok(PROJECT_AREAS.includes('healthcare'), 'PROJECT_AREAS should include healthcare');
  assert.ok(PROJECT_AREAS.includes('public_facility'), 'PROJECT_AREAS should include public_facility');
  assert.ok(PROJECT_AREAS.includes('govt_scheme'), 'PROJECT_AREAS should include govt_scheme');
  assert.ok(PROJECT_AREAS.includes('infrastructure'), 'PROJECT_AREAS should include infrastructure');
  assert.ok(PROJECT_AREAS.includes('other'), 'PROJECT_AREAS should include other');

  assert.strictEqual(PROJECT_STATUSES.length, 5, 'PROJECT_STATUSES should have 5 values');
  assert.ok(PROJECT_STATUSES.includes('proposed'), 'PROJECT_STATUSES should include proposed');
  assert.ok(PROJECT_STATUSES.includes('approved'), 'PROJECT_STATUSES should include approved');
  assert.ok(PROJECT_STATUSES.includes('in_progress'), 'PROJECT_STATUSES should include in_progress');
  assert.ok(PROJECT_STATUSES.includes('completed'), 'PROJECT_STATUSES should include completed');
  assert.ok(PROJECT_STATUSES.includes('dropped'), 'PROJECT_STATUSES should include dropped');
});

test('DevelopmentProject model - schema has required fields', () => {
  const schema = DevelopmentProject.schema;

  // Check tenantId exists and is indexed
  assert.ok(schema.paths.tenantId, 'tenantId field should exist');
  assert.ok(schema.paths.tenantId.options.required, 'tenantId should be required');
  assert.ok(schema.paths.tenantId.options.index, 'tenantId should be indexed');

  // Check name exists and is required
  assert.ok(schema.paths.name, 'name field should exist');
  assert.ok(schema.paths.name.options.required, 'name should be required');

  // Check area exists and is required
  assert.ok(schema.paths.area, 'area field should exist');
  assert.ok(schema.paths.area.options.required, 'area should be required');

  // Check estimatedCost exists and is required
  assert.ok(schema.paths.estimatedCost, 'estimatedCost field should exist');
  assert.ok(schema.paths.estimatedCost.options.required, 'estimatedCost should be required');

  // Check progressPercent exists
  assert.ok(schema.paths.progressPercent, 'progressPercent field should exist');

  // Check status exists
  assert.ok(schema.paths.status, 'status field should exist');

  // Check optional fields exist
  assert.ok(schema.paths.nameMl, 'nameMl field should exist');
  assert.ok(schema.paths.proposal, 'proposal field should exist');
  assert.ok(schema.paths.fundingSource, 'fundingSource field should exist');
  assert.ok(schema.paths.committeeId, 'committeeId field should exist');
  assert.ok(schema.paths.completionReport, 'completionReport field should exist');
});

test('LedgerItem model - projectId field added', () => {
  const schema = LedgerItem.schema;

  // Check projectId field exists as optional ref
  assert.ok(schema.paths.projectId, 'projectId field should exist on LedgerItem');
  assert.ok(schema.paths.projectId.options.ref, 'projectId should have ref');
  assert.strictEqual(schema.paths.projectId.options.ref, 'DevelopmentProject', 'projectId should reference DevelopmentProject');
  assert.ok(schema.paths.projectId.options.index, 'projectId should be indexed');
});

test('DevelopmentProject - backward compatibility with existing LedgerItems', () => {
  // Ensure projectId is optional - old ledger items without projectId should still be valid
  const schema = LedgerItem.schema;
  const projectIdPath = schema.paths.projectId;

  // Check that projectId is not required (default is undefined/not set)
  assert.strictEqual(projectIdPath.options.required, undefined, 'projectId should not be required');
});
