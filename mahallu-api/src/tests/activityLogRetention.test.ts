import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  ActivityLog,
  DEFAULT_ACTIVITY_LOG_RETENTION_DAYS,
  activityLogExpiry,
  activityLogRetentionDays,
} from '../models/Social';

/**
 * Activity-log retention: new entries get an `expiresAt` (default now + 180 days, override with
 * ACTIVITY_LOG_RETENTION_DAYS) with its own TTL index. The existing createdAt index is left alone (a
 * TTL option on an existing non-TTL index would raise IndexOptionsConflict at startup), and entries
 * written before this field existed have no expiresAt, so they are never deleted.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-03-01T10:00:00.000Z');

test('the default retention is 180 days', () => {
  assert.equal(DEFAULT_ACTIVITY_LOG_RETENTION_DAYS, 180);
  assert.equal(activityLogRetentionDays({}), 180);
  assert.equal(activityLogExpiry(NOW, {}).getTime(), NOW.getTime() + 180 * DAY);
});

test('ACTIVITY_LOG_RETENTION_DAYS overrides it', () => {
  assert.equal(activityLogRetentionDays({ ACTIVITY_LOG_RETENTION_DAYS: '30' }), 30);
  assert.equal(activityLogExpiry(NOW, { ACTIVITY_LOG_RETENTION_DAYS: '30' }).getTime(), NOW.getTime() + 30 * DAY);
  assert.equal(activityLogExpiry(NOW, { ACTIVITY_LOG_RETENTION_DAYS: '365' }).getTime(), NOW.getTime() + 365 * DAY);
  assert.equal(activityLogRetentionDays({ ACTIVITY_LOG_RETENTION_DAYS: '90.9' }), 90);
});

test('a missing, empty, zero, negative or non-numeric value falls back to 180 (never "expire immediately")', () => {
  for (const value of ['', '0', '-5', 'abc', 'NaN', 'Infinity', ' ']) {
    assert.equal(activityLogRetentionDays({ ACTIVITY_LOG_RETENTION_DAYS: value }), 180, JSON.stringify(value));
  }
});

test('the expiry never lands before the entry was written', () => {
  const expires = activityLogExpiry(NOW, { ACTIVITY_LOG_RETENTION_DAYS: '1' });
  assert.ok(expires.getTime() > NOW.getTime());
});

test('a new entry gets expiresAt by default', () => {
  const before = Date.now();
  const entry: any = new ActivityLog({ action: 'create', entityType: 'x', httpMethod: 'POST', endpoint: '/x' });
  assert.ok(entry.expiresAt instanceof Date);
  assert.ok(entry.expiresAt.getTime() >= before + activityLogRetentionDays() * DAY - 1000);
});

test('the TTL lives on its own index; createdAt keeps its plain indexes', () => {
  const indexes = ActivityLog.schema.indexes();
  const ttl = indexes.filter(([, options]) => (options as any)?.expireAfterSeconds !== undefined);
  assert.equal(ttl.length, 1);
  assert.deepEqual(ttl[0][0], { expiresAt: 1 });
  assert.equal((ttl[0][1] as any).expireAfterSeconds, 0);
  // nothing else became a TTL index, in particular nothing on createdAt
  const onCreatedAt = indexes.filter(([keys]) => 'createdAt' in (keys as object));
  assert.ok(onCreatedAt.length >= 1);
  assert.ok(onCreatedAt.every(([, options]) => (options as any)?.expireAfterSeconds === undefined));
});

test('an entry written before the field existed is not given an expiry when it is read back', () => {
  // The TTL index only ever sees what is stored: a stored entry without expiresAt is never deleted.
  // Reading one back must not queue a write of the default either.
  const legacy: any = ActivityLog.hydrate({ _id: new mongoose.Types.ObjectId(), action: 'create', entityType: 'x', httpMethod: 'POST', endpoint: '/x' });
  assert.equal(legacy.isModified('expiresAt'), false);
  assert.ok(!(ActivityLog.schema.path('expiresAt') as any).isRequired);
});
