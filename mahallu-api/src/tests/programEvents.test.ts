/**
 * C3 tests. The register/attendance endpoints need a live DB, so what is pinned
 * here is the schema contract they and the CMS event page depend on: the event
 * fields exist, stay optional (old programs must remain valid), and attendance
 * defaults to false rather than undefined.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import Institute from '../models/Institute';

test('event fields exist on the program model', () => {
  const paths = Institute.schema.paths;
  ['eventDate', 'registrations', 'competitions', 'awards'].forEach((field) => {
    assert.ok(paths[field], `missing field: ${field}`);
  });
});

test('every event field is optional so existing programs stay valid', () => {
  const paths = Institute.schema.paths as any;
  ['eventDate', 'awards'].forEach((field) => {
    assert.notEqual(paths[field].isRequired, true, `${field} must stay optional`);
  });
  const doc = new Institute({
    tenantId: '507f1f77bcf86cd799439011',
    name: 'Old program',
    place: 'Mahallu',
    type: 'program',
  });
  assert.equal(doc.validateSync(), undefined);
});

test('a registration references a Member and defaults to not attended', () => {
  const registration = (Institute.schema.path('registrations') as any).schema;
  assert.equal(registration.path('memberId').options.ref, 'Member');
  assert.equal(registration.path('memberId').isRequired, true);
  assert.equal(registration.path('attended').defaultValue, false);
});

test('a competition needs a name and carries a winners list', () => {
  const competition = (Institute.schema.path('competitions') as any).schema;
  assert.equal(competition.path('name').isRequired, true);
  assert.ok(competition.path('winners'));
});

test('registrations round-trip through the document', () => {
  const doc = new Institute({
    tenantId: '507f1f77bcf86cd799439011',
    name: 'Annual gathering',
    place: 'Mahallu',
    type: 'program',
    eventDate: new Date('2026-03-01T00:00:00.000Z'),
    registrations: [{ memberId: '507f1f77bcf86cd799439012' }],
    competitions: [{ name: "Qur'an recitation", winners: ['Ahmed'] }],
  });
  assert.equal(doc.validateSync(), undefined);
  assert.equal(doc.registrations?.[0].attended, false);
  assert.equal(doc.competitions?.[0].winners[0], 'Ahmed');
});
