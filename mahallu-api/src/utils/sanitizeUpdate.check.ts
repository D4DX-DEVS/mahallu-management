/**
 * Self-check for the update sanitizer. No test framework needed:
 *   npx ts-node src/utils/sanitizeUpdate.check.ts
 *
 * Guards the tenant-isolation fix: a client-supplied tenantId must never
 * survive into an update payload.
 */
import assert from 'assert';
import { stripImmutable } from './sanitizeUpdate';

const attackerBody = {
  name: 'Renamed',
  category: 'miskin',
  tenantId: '507f1f77bcf86cd799439099', // another Mahallu
  _id: '507f1f77bcf86cd799439011',
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
  __v: 3,
};

const clean = stripImmutable(attackerBody) as Record<string, unknown>;

assert.strictEqual(clean.tenantId, undefined, 'tenantId must be stripped');
assert.strictEqual(clean._id, undefined, '_id must be stripped');
assert.strictEqual(clean.createdAt, undefined, 'createdAt must be stripped');
assert.strictEqual(clean.updatedAt, undefined, 'updatedAt must be stripped');
assert.strictEqual(clean.__v, undefined, '__v must be stripped');

// Legitimate fields survive
assert.strictEqual(clean.name, 'Renamed');
assert.strictEqual(clean.category, 'miskin');

// Original body is not mutated
assert.strictEqual(attackerBody.tenantId, '507f1f77bcf86cd799439099');

console.log('sanitizeUpdate check: PASS');
