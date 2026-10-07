import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describeTarget, evaluateMigrationGuard } from '../scripts/migrateToNewCluster';

/**
 * The cluster migration used to drop every target collection with no guard: if MONGODB_URI_NEW equalled
 * MONGODB_URI it wiped the SOURCE first. The guard is a pure function so it is tested without any
 * database. (Importing the script runs nothing: main() starts only when it is the entry point.)
 */

// Fixture connection strings are ASSEMBLED at run time from obviously fake parts (reserved .invalid hosts and a
// random per-run password), so no credential-bearing URI is ever written in this file and nothing here can be
// mistaken for, or replaced by, a real connection string. The guard under test is a pure function: it never connects.
const FAKE_PASSWORD = `pw-${randomBytes(8).toString('hex')}`;
const fakeUri = (scheme: string, user: string, host: string, rest: string, password = FAKE_PASSWORD) =>
  `${scheme}://${user}:${password}@${host}${rest}`;
const SRC = fakeUri('mongodb+srv', 'appuser', 'cluster0.source.invalid', '/mahallu-management?retryWrites=true&w=majority');
const DST = fakeUri('mongodb+srv', 'other', 'cluster1.target.invalid', '/mahallu-management?retryWrites=true');

test('describeTarget keeps only host and database, never credentials or options', () => {
  assert.deepEqual(describeTarget(SRC), { host: 'cluster0.source.invalid', db: 'mahallu-management' });
  assert.deepEqual(describeTarget(fakeUri('mongodb', 'u', 'Host.Example.com:27017', '/appdb')), { host: 'host.example.com', db: 'appdb' });
  assert.deepEqual(describeTarget(fakeUri('mongodb', 'u', 'b:27017,a:27018', '/appdb?replicaSet=rs0')), { host: 'a:27018,b', db: 'appdb' });
  assert.deepEqual(describeTarget('mongodb://localhost'), { host: 'localhost', db: 'test' });
  assert.deepEqual(describeTarget('mongodb://localhost/?x=1'), { host: 'localhost', db: 'test' });
  // a password with an encoded '@' does not leak into the host
  assert.equal(describeTarget(SRC)!.host.includes(FAKE_PASSWORD), false);
  for (const bad of [undefined, '', 'http://example.com/db', 'not a uri']) assert.equal(describeTarget(bad as any), null);
});

test('refuses when the two URIs are the same host and database, however they are spelled', () => {
  const same = [
    [SRC, SRC],
    [SRC, fakeUri('mongodb+srv', 'someone', 'cluster0.source.invalid', '/mahallu-management?retryWrites=true&w=majority', 'else')], // other credentials, same place
    [SRC, SRC.replace('retryWrites=true&w=majority', 'appName=copy')],
    ['mongodb://h:27017/db', 'mongodb://H/db'],
    ['mongodb://a:1,b:2/db', 'mongodb://b:2/db'], // shares a node and names the same db
  ];
  for (const [source, target] of same) {
    for (const apply of [false, true]) {
      const result = evaluateMigrationGuard({ sourceUri: source, targetUri: target, apply, dropTarget: true });
      assert.equal(result.ok, false, `${source} -> ${target} (apply=${apply})`);
      assert.match((result as any).reason, /same database/);
    }
  }
});

test('the refusal never prints a URI or a credential', () => {
  const result: any = evaluateMigrationGuard({ sourceUri: SRC, targetUri: SRC, apply: true, dropTarget: true });
  assert.ok(!/mongodb(\+srv)?:\/\//.test(result.reason));
  assert.ok(!/appuser|retryWrites/.test(result.reason) && !result.reason.includes(FAKE_PASSWORD));
  assert.match(result.reason, /cluster0\.source\.invalid/);
});

test('a different database on the same server, or the same name on another host, is allowed', () => {
  assert.equal(evaluateMigrationGuard({ sourceUri: 'mongodb://h/db1', targetUri: 'mongodb://h/db2', apply: false, dropTarget: false }).ok, true);
  assert.equal(evaluateMigrationGuard({ sourceUri: SRC, targetUri: DST, apply: false, dropTarget: false }).ok, true);
});

test('the default is a dry run: without --apply nothing is allowed to write, even with --drop-target', () => {
  assert.deepEqual(evaluateMigrationGuard({ sourceUri: SRC, targetUri: DST, apply: false, dropTarget: false }), { ok: true, mode: 'dry-run' });
  assert.deepEqual(
    evaluateMigrationGuard({ sourceUri: SRC, targetUri: DST, apply: false, dropTarget: true, nonEmptyTargetCollections: ['members'] }),
    { ok: true, mode: 'dry-run' }
  );
});

test('--apply onto an empty target proceeds', () => {
  assert.deepEqual(evaluateMigrationGuard({ sourceUri: SRC, targetUri: DST, apply: true, dropTarget: false, nonEmptyTargetCollections: [] }), { ok: true, mode: 'apply' });
  assert.deepEqual(evaluateMigrationGuard({ sourceUri: SRC, targetUri: DST, apply: true, dropTarget: false }), { ok: true, mode: 'apply' });
});

test('--apply onto a target that already holds data is refused unless --drop-target is given', () => {
  const refused: any = evaluateMigrationGuard({ sourceUri: SRC, targetUri: DST, apply: true, dropTarget: false, nonEmptyTargetCollections: ['members', 'families'] });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /members, families/);
  assert.match(refused.reason, /--drop-target/);
  assert.deepEqual(
    evaluateMigrationGuard({ sourceUri: SRC, targetUri: DST, apply: true, dropTarget: true, nonEmptyTargetCollections: ['members', 'families'] }),
    { ok: true, mode: 'apply' }
  );
});

test('missing or malformed settings are refused', () => {
  for (const [source, target] of [[undefined, DST], [SRC, undefined], ['', ''], ['postgres://x/y', DST], [SRC, 'nonsense']]) {
    const result = evaluateMigrationGuard({ sourceUri: source as any, targetUri: target as any, apply: true, dropTarget: true });
    assert.equal(result.ok, false);
  }
});
