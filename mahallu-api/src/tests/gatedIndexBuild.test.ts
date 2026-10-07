import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import http from 'http';
import mongoose from 'mongoose';
import type { AddressInfo } from 'net';
import { getUniqueIndexRegistry } from '../services/indexPreflight';
import type { IndexSpec, PreflightReport } from '../services/indexPreflight';
import {
  indexListingMatches,
  prepareIndexBuild,
  readIndexBuildMode,
  readIndexBuildWaitMs,
  runGatedIndexBuild,
  runStartupIndexes,
  runStartupIndexStep,
  waitUpTo,
} from '../services/indexBuild';
import type { BuildableModel, GatedBuildOptions } from '../services/indexBuild';
import { STARTUP_ORDER, runStartupSequence } from '../services/startupSequence';
import {
  getIndexBuildMode,
  getIndexBuildPhase,
  getIndexReadiness,
  getIndexState,
  getIndexSummary,
  indexNameOf,
  resetIndexState,
  setIndexBuildMode,
} from '../utils/indexMonitor';
import { connectDatabase } from '../config/database';
import { appState, createApp } from '../app';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] gatedIndexBuild', () => {

/**
 * The gated index build, driven with FAKE collections (no database). The fake models reuse the REAL
 * schemas' declared indexes, so the whole real registry (unique, partial, collation, TTL, sparse) goes
 * through the build and the verification exactly as declared.
 *
 * Every fake collection THROWS on any destructive operation and records the attempt: the tests assert
 * that none was ever made.
 */

type Doc = Record<string, any>;
const FORBIDDEN = [
  'dropIndex', 'dropIndexes', 'drop', 'deleteMany', 'deleteOne', 'updateMany', 'updateOne', 'replaceOne',
  'insertOne', 'insertMany', 'bulkWrite', 'findOneAndUpdate', 'findOneAndDelete', 'syncIndexes', 'cleanIndexes',
  'dropCollection', 'dropDatabase', 'remove',
] as const;

let events: string[] = [];
let forbiddenCalls: string[] = [];

const defaultIndexName = (keys: Doc) =>
  Object.entries(keys)
    .map(([k, v]) => `${k}_${v}`)
    .join('_');

class FakeCollection {
  indexList: Doc[] = [{ v: 2, key: { _id: 1 }, name: '_id_' }];
  /** `<Model>.<index>` -> error to throw when that index is created. */
  static failures = new Map<string, Error>();
  /** `<Model>` -> make collection.indexes() throw / hide indexes. */
  static listingBroken = new Set<string>();
  static hideFromListing = new Set<string>();
  /** Awaited before every createIndex (lets a test hold a build open). */
  static gate: Promise<void> | undefined;

  constructor(public modelName: string, public name: string) {
    for (const op of FORBIDDEN) {
      (this as any)[op] = () => {
        forbiddenCalls.push(`${modelName}.${op}`);
        throw new Error(`FORBIDDEN destructive operation: ${op}`);
      };
    }
  }

  async createIndex(keys: Doc, options: Doc = {}): Promise<string> {
    const name = options.name || defaultIndexName(keys);
    if (FakeCollection.gate) await FakeCollection.gate;
    events.push(`createIndex:${this.modelName}.${name}`);
    const failure = FakeCollection.failures.get(`${this.modelName}.${name}`);
    if (failure) throw failure;
    const existing = this.indexList.find((i) => i.name === name);
    if (existing) {
      if (JSON.stringify(existing.key) !== JSON.stringify(keys)) throw Object.assign(new Error('IndexKeySpecsConflict'), { code: 86 });
      return name;
    }
    this.indexList.push({
      v: 2,
      key: { ...keys },
      name,
      ...(options.unique ? { unique: true } : {}),
      ...(options.sparse ? { sparse: true } : {}),
      ...(options.partialFilterExpression ? { partialFilterExpression: options.partialFilterExpression } : {}),
      ...(options.expireAfterSeconds !== undefined ? { expireAfterSeconds: options.expireAfterSeconds } : {}),
      ...(options.collation
        ? { collation: { locale: options.collation.locale, caseLevel: false, strength: options.collation.strength ?? 3, version: '57.1' } }
        : {}),
    });
    return name;
  }

  async indexes(): Promise<Doc[]> {
    events.push(`indexes:${this.modelName}`);
    if (FakeCollection.listingBroken.has(this.modelName)) throw new Error('listIndexes failed');
    return this.indexList.filter((i) => !FakeCollection.hideFromListing.has(`${this.modelName}.${i.name}`));
  }
}

/** A fake model that carries a REAL schema's declared indexes and a fake collection. */
const fakeModelOf = (real: any): BuildableModel => {
  const collection = new FakeCollection(real.modelName, real.collection.name);
  const model: any = {
    modelName: real.modelName,
    schema: { indexes: () => real.schema.indexes() },
    collection,
    async createIndexes(options?: { toCreate?: unknown[] }) {
      const wanted = options?.toCreate ?? real.schema.indexes();
      for (const tuple of wanted as Array<[Doc, Doc]>) {
        const opts = { ...(tuple[1] || {}) };
        delete opts._autoIndex;
        await collection.createIndex({ ...tuple[0] }, opts);
      }
    },
  };
  for (const op of FORBIDDEN) {
    model[op] = () => {
      forbiddenCalls.push(`${real.modelName}.model.${op}`);
      throw new Error(`FORBIDDEN destructive operation: ${op}`);
    };
  }
  return model as BuildableModel;
};

let fakes: BuildableModel[] = [];
const allSpecs = (): IndexSpec[] => getUniqueIndexRegistry();
const declaredOf = (model: BuildableModel): Array<{ name: string; unique: boolean }> =>
  (model.schema.indexes() as Array<[Doc, Doc | undefined]>).map(([fields, options]) => ({
    name: `${model.modelName}.${indexNameOf(fields, options?.name)}`,
    unique: !!options?.unique,
  }));

/** A preflight report: every registered unique index is clean unless overridden. */
const reportWith = (overrides: Record<string, 'duplicates' | 'unknown'> = {}): PreflightReport => ({
  ok: Object.keys(overrides).length === 0,
  duplicatesFound: Object.values(overrides).includes('duplicates'),
  incomplete: Object.values(overrides).includes('unknown'),
  checkedAt: new Date(0).toISOString(),
  specs: allSpecs().map((spec) => {
    const status = overrides[spec.name] ?? 'clean';
    return {
      name: spec.name, model: spec.model, fields: spec.fields, status,
      duplicateGroups: status === 'duplicates' ? 1 : 0,
      conflictingIds: status === 'duplicates' ? ['000000000000000000000001', '000000000000000000000002'] : [],
      groups: [], truncated: false, ...(status === 'unknown' ? { error: 'PreflightTimeout' } : {}),
    };
  }),
});

const realError = console.error;
const realWarn = console.warn;
const realInfo = console.info;
const realLog = console.log;
let errors: string[] = [];
let warnings: string[] = [];
let infos: string[] = [];
const quiet = {
  error: (...a: any[]) => void errors.push(a.map(String).join(' ')),
  warn: (...a: any[]) => void warnings.push(a.map(String).join(' ')),
  info: (...a: any[]) => void infos.push(a.map(String).join(' ')),
};

before(() => {
  getUniqueIndexRegistry(); // loads every model and attaches the monitors
});

beforeEach(() => {
  events = [];
  forbiddenCalls = [];
  errors = [];
  warnings = [];
  infos = [];
  FakeCollection.failures = new Map();
  FakeCollection.listingBroken = new Set();
  FakeCollection.hideFromListing = new Set();
  FakeCollection.gate = undefined;
  console.error = quiet.error;
  console.warn = quiet.warn;
  console.info = quiet.info;
  console.log = () => undefined;
  resetIndexState();
  setIndexBuildMode('gated');
  fakes = mongoose.modelNames().sort().map((name) => fakeModelOf(mongoose.model(name)));
});

afterEach(() => {
  // The one invariant of every scenario: nothing destructive was ever attempted.
  assert.deepEqual(forbiddenCalls, [], 'no destructive operation may ever be called');
  console.error = realError;
  console.warn = realWarn;
  console.info = realInfo;
  console.log = realLog;
});

after(() => {
  resetIndexState();
});

const build = (options: Partial<GatedBuildOptions> = {}) => runGatedIndexBuild({ models: fakes, log: quiet, ...options });
const createCalls = () => events.filter((e) => e.startsWith('createIndex:')).map((e) => e.slice('createIndex:'.length));
const stateOf = (name: string) => {
  const [model, ...rest] = name.split('.');
  return getIndexState().find((e) => e.model === model && e.index === rest.join('.'))!;
};

const FAMILY = 'Family.tenantId_1_mahallId_1';

describe('clean preflight', () => {
  test('every index is built, unique ones first and verified; every unique index is enforced and readiness says so', async () => {
    const result = await build({ report: reportWith() });
    const total = fakes.reduce((n, m) => n + declaredOf(m).length, 0);
    assert.equal(createCalls().length, total, 'each declared index is created exactly once');
    const specCount = allSpecs().length;
    assert.ok(specCount > 20, 'the real registry is large');
    assert.equal(result.summary.total, specCount);
    assert.equal(result.summary.enforced, specCount);
    assert.equal(result.otherIndexes.failed, 0);
    assert.equal(result.otherIndexes.built, total - specCount);

    // unique before non-unique, across every model
    const uniqueNames = new Set(fakes.flatMap((m) => declaredOf(m).filter((d) => d.unique).map((d) => d.name)));
    const calls = createCalls();
    const lastUnique = Math.max(...calls.map((c, i) => (uniqueNames.has(c) ? i : -1)));
    const firstOther = calls.findIndex((c) => !uniqueNames.has(c));
    assert.ok(lastUnique < firstOther, 'all unique indexes are built before the non-unique ones');

    assert.equal(getIndexReadiness().indexesEnforced, true);
    assert.equal(getIndexSummary().enforced, specCount);
    assert.equal(getIndexBuildPhase(), 'complete');
    assert.match(infos.join('\n'), /gated build finished: unique enforced \d+\/\d+, blocked by duplicates 0, failed 0, unknown 0/);
  });

  test('models are built in name order and each model verifies (lists its indexes) after its own unique builds', async () => {
    await build({ report: reportWith() });
    const family = events.indexOf(`createIndex:${FAMILY}`);
    const familyListing = events.indexOf('indexes:Family');
    assert.ok(family >= 0 && familyListing > family);
    const names = fakes.map((m) => m.modelName);
    assert.deepEqual(names, [...names].sort());
  });

  test('non-unique performance indexes, TTL indexes and collations are still created, with their options', async () => {
    await build({ report: reportWith() });
    const otp = (fakes.find((m) => m.modelName === 'OTP')!.collection as unknown as FakeCollection).indexList;
    assert.ok(otp.some((i) => i.expireAfterSeconds === 0), 'the OTP TTL index is created');
    const activity = (fakes.find((m) => m.modelName === 'ActivityLog')!.collection as unknown as FakeCollection).indexList;
    assert.ok(activity.some((i) => i.expireAfterSeconds === 0), 'the ActivityLog TTL index is created');
    const category = (fakes.find((m) => m.modelName === 'MasterCategory')!.collection as unknown as FakeCollection).indexList;
    assert.ok(category.some((i) => i.collation && i.collation.locale === 'en' && i.unique), 'the collation unique index is created and verified');
    assert.equal(stateOf('MasterCategory.key_1').status, 'enforced');
    const nonUniqueEvents = createCalls().filter((c) => !declaredOf(fakes.find((m) => m.modelName === c.split('.')[0])!).find((d) => d.name === c)!.unique);
    assert.ok(nonUniqueEvents.length > 50, 'plenty of non-unique indexes are built');
  });
});

describe('duplicates found by the preflight', () => {
  test('the blocked unique index is NOT built and is reported; its model and every other index are still built', async () => {
    const result = await build({ report: reportWith({ [FAMILY]: 'duplicates' }) });
    assert.ok(!createCalls().includes(FAMILY), 'the blocked index is never created');
    assert.equal(stateOf(FAMILY).status, 'blocked-by-duplicates');
    const familyModel = fakes.find((m) => m.modelName === 'Family')!;
    const familyOthers = declaredOf(familyModel).filter((d) => d.name !== FAMILY);
    for (const d of familyOthers) assert.ok(createCalls().includes(d.name), `${d.name} is still built`);
    assert.equal(result.summary.blockedByDuplicates, 1);
    assert.equal(result.summary.enforced, result.summary.total - 1);
    assert.equal(result.otherIndexes.failed, 0);
    const readiness = getIndexReadiness();
    assert.equal(readiness.indexesEnforced, false);
    assert.equal(readiness.indexes.blockedByDuplicates, 1);
    assert.match(errors.join('\n'), /NOT BUILT: Family\.tenantId_1_mahallId_1 is blocked by duplicate data/);
  });

  test('a model with SEVERAL unique indexes: only the blocked one is skipped', async () => {
    const siblings = allSpecs().filter((s) => s.model === 'Varisangya');
    assert.ok(siblings.length >= 2, 'Varisangya declares several unique indexes');
    const blocked = siblings[0].name;
    await build({ report: reportWith({ [blocked]: 'duplicates' }) });
    assert.ok(!createCalls().includes(blocked));
    for (const s of siblings.slice(1)) {
      assert.ok(createCalls().includes(s.name));
      assert.equal(stateOf(s.name).status, 'enforced');
    }
    assert.equal(stateOf(blocked).status, 'blocked-by-duplicates');
  });
});

describe('build failures', () => {
  test('a duplicate-key error while building (data changed after the check) -> build-failed, never enforced, no driver message leaks', async () => {
    const dup = Object.assign(new Error('E11000 duplicate key error collection: x index: tenantId_1_mahallId_1 dup key: { mahallId: "SECRET-FID" }'), {
      code: 11000,
      codeName: 'DuplicateKey',
    });
    FakeCollection.failures.set(FAMILY, dup);
    const result = await build({ report: reportWith() });
    assert.equal(stateOf(FAMILY).status, 'build-failed');
    assert.match(stateOf(FAMILY).detail || '', /duplicate key while building/);
    assert.equal(result.summary.buildFailed, 1);
    assert.equal(getIndexReadiness().indexesEnforced, false);
    assert.equal(getIndexReadiness().indexes.buildFailed, 1);
    const logged = [...errors, ...warnings, ...infos].join('\n');
    assert.ok(!logged.includes('SECRET-FID'), 'the driver message (which holds a key value) is never logged');
    assert.match(errors.join('\n'), /INDEX BUILD FAILED: Family\.tenantId_1_mahallId_1/);
    // the rest still got built
    assert.equal(result.summary.enforced, result.summary.total - 1);
  });

  test('a failing non-unique index is counted and warned about but does not touch uniqueness', async () => {
    const familyModel = fakes.find((m) => m.modelName === 'Family')!;
    const other = declaredOf(familyModel).find((d) => !d.unique)!;
    FakeCollection.failures.set(other.name, Object.assign(new Error('boom'), { code: 67 }));
    const result = await build({ report: reportWith() });
    assert.equal(result.otherIndexes.failed, 1);
    assert.equal(result.summary.enforced, result.summary.total);
    assert.equal(getIndexReadiness().indexesEnforced, true);
    assert.equal(getIndexReadiness().indexBuild.otherIndexes.failed, 1);
    assert.match(warnings.join('\n'), /could not build Family\./);
  });

  test('createIndexes that throws synchronously is contained', async () => {
    const familyModel: any = fakes.find((m) => m.modelName === 'Family')!;
    familyModel.createIndexes = () => {
      throw new TypeError('sync failure');
    };
    const result = await build({ report: reportWith() });
    assert.equal(stateOf(FAMILY).status, 'build-failed');
    assert.ok(result.summary.enforced > 0);
  });

  test('a built index that the collection does not list, or a listing that fails, is reported as NOT enforced', async () => {
    FakeCollection.hideFromListing.add(FAMILY);
    FakeCollection.listingBroken.add('Wallet');
    await build({ report: reportWith() });
    assert.equal(stateOf(FAMILY).status, 'unknown');
    for (const s of allSpecs().filter((x) => x.model === 'Wallet')) assert.equal(stateOf(s.name).status, 'unknown');
    assert.equal(getIndexReadiness().indexesEnforced, false);
  });
});

describe('inconclusive preflight (fail closed)', () => {
  test('a spec the preflight could not check is NOT built and is reported unknown', async () => {
    const result = await build({ report: reportWith({ [FAMILY]: 'unknown' }) });
    assert.ok(!createCalls().includes(FAMILY));
    assert.equal(stateOf(FAMILY).status, 'unknown');
    assert.equal(result.summary.unknown, 1);
    assert.equal(getIndexReadiness().indexesEnforced, false);
    assert.match(warnings.join('\n'), /NOT BUILT: Family\.tenantId_1_mahallId_1 - the duplicate check did not complete/);
  });

  test('no preflight report at all (preflight enabled but it failed) -> no unique index is built, non-unique ones still are', async () => {
    const result = await build({ report: undefined, preflightRan: true });
    const uniqueNames = new Set(fakes.flatMap((m) => declaredOf(m).filter((d) => d.unique).map((d) => d.name)));
    assert.ok(createCalls().every((c) => !uniqueNames.has(c)), 'no unique index was created');
    assert.equal(result.summary.unknown, result.summary.total);
    assert.equal(result.summary.enforced, 0);
    assert.ok(result.otherIndexes.built > 50);
    assert.equal(getIndexReadiness().indexesEnforced, false);
  });

  test('a spec missing from the report is treated as unknown, not clean', async () => {
    const report = reportWith();
    report.specs = report.specs.filter((s) => s.name !== FAMILY);
    await build({ report });
    assert.ok(!createCalls().includes(FAMILY));
    assert.equal(stateOf(FAMILY).status, 'unknown');
  });
});

describe('preflight switched off in gated mode (INDEX_PREFLIGHT=off)', () => {
  test('every unique index is attempted UNCHECKED and verified; the result is still accurate', async () => {
    const result = await build({ report: undefined, preflightRan: false });
    assert.equal(result.summary.enforced, result.summary.total);
    assert.equal(getIndexReadiness().indexesEnforced, true);
  });

  test('...and a unique index that meets duplicates then fails and is reported build-failed', async () => {
    FakeCollection.failures.set(FAMILY, Object.assign(new Error('x'), { code: 11000 }));
    await build({ report: undefined, preflightRan: false });
    assert.equal(stateOf(FAMILY).status, 'build-failed');
    assert.equal(getIndexReadiness().indexesEnforced, false);
  });
});

describe('no destructive operation, ever', () => {
  test('across clean, blocked, failed and unknown scenarios the fake collections never saw a destructive call', async () => {
    await build({ report: reportWith() });
    await build({ report: reportWith({ [FAMILY]: 'duplicates' }) });
    FakeCollection.failures.set(FAMILY, Object.assign(new Error('x'), { code: 11000 }));
    await build({ report: reportWith() });
    await build({ report: reportWith({ [FAMILY]: 'unknown' }) });
    assert.deepEqual(forbiddenCalls, []);
    // the fakes really would have recorded one:
    assert.throws(() => (fakes[0].collection as any).dropIndex('x'), /FORBIDDEN/);
    forbiddenCalls = [];
  });

  test('a rebuild over an already built collection is idempotent: nothing is dropped or rewritten', async () => {
    await build({ report: reportWith() });
    const before = fakes.map((m) => JSON.stringify((m.collection as unknown as FakeCollection).indexList));
    events = [];
    await build({ report: reportWith() });
    assert.deepEqual(fakes.map((m) => JSON.stringify((m.collection as unknown as FakeCollection).indexList)), before);
    assert.equal(getIndexReadiness().indexesEnforced, true);
  });

  const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const DESTRUCTIVE =
    /\b(dropIndex|dropIndexes|dropCollection|dropDatabase|drop|deleteMany|deleteOne|updateMany|updateOne|replaceOne|insertOne|insertMany|bulkWrite|findOneAndUpdate|findOneAndDelete|findOneAndReplace|syncIndexes|cleanIndexes|remove|save|create|collMod)\b\s*\(|\$out\b|\$merge\b/;
  for (const file of ['../services/indexBuild.ts', '../services/startupSequence.ts', '../config/database.ts']) {
    test(`${path.basename(file)} contains no destructive or write operation (it only calls createIndexes)`, () => {
      const code = strip(fs.readFileSync(path.resolve(__dirname, file), 'utf8'));
      const hit = DESTRUCTIVE.exec(code);
      assert.equal(hit, null, `found ${hit && hit[0]}`);
      if (file.endsWith('indexBuild.ts')) assert.match(code, /\.createIndexes\(/);
    });
  }
});

describe('Mongoose really honours `createIndexes({ toCreate })` (the call the build relies on)', () => {
  test('only the listed index is created, with the schema options, and nothing else', async () => {
    const conn = mongoose.createConnection(); // never connected: no network
    const schema = new mongoose.Schema({ a: String, b: String, expiresAt: Date });
    schema.index({ a: 1, b: 1 }, { unique: true, partialFilterExpression: { a: { $exists: true } } });
    schema.index({ b: 1 });
    schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    const Probe: any = conn.model('GatedIndexProbe', schema);
    const created: Array<[Doc, Doc]> = [];
    Probe.collection.createIndex = async (keys: Doc, options: Doc) => {
      created.push([keys, options]);
      return 'x';
    };
    const tuples = Probe.schema.indexes();
    assert.equal(tuples.length, 3);
    await Probe.createIndexes({ toCreate: [tuples[2]] });
    assert.equal(created.length, 1, 'only the listed index is created');
    assert.deepEqual(created[0][0], { expiresAt: 1 });
    assert.equal(created[0][1].expireAfterSeconds, 0);
    await Probe.createIndexes({ toCreate: [tuples[0]] });
    assert.equal(created.length, 2);
    assert.deepEqual(created[1][0], { a: 1, b: 1 });
    assert.equal(created[1][1].unique, true);
    await conn.close().catch(() => undefined);
  });
});

describe('verification (indexListingMatches)', () => {
  const decl = { name: 'k_1', fields: { k: 1 }, options: { unique: true, collation: { locale: 'en', strength: 2 } } };
  const listed = { name: 'k_1', key: { k: 1 }, unique: true, collation: { locale: 'en', strength: 2, caseLevel: false } };
  test('matches only the index with the expected key, uniqueness, partial filter and collation', () => {
    assert.equal(indexListingMatches([listed], decl), true);
    assert.equal(indexListingMatches([{ ...listed, unique: false }], decl), false, 'not unique');
    assert.equal(indexListingMatches([{ ...listed, key: { other: 1 } }], decl), false, 'different key');
    assert.equal(indexListingMatches([{ ...listed, collation: undefined }], decl), false, 'collation missing');
    assert.equal(indexListingMatches([{ ...listed, collation: { locale: 'en', strength: 3 } }], decl), false, 'collation strength differs');
    assert.equal(indexListingMatches([], decl), false);
    const partialDecl = { name: 'p', fields: { a: 1 }, options: { unique: true, partialFilterExpression: { a: { $exists: true }, b: 1 } } };
    assert.equal(indexListingMatches([{ name: 'p', key: { a: 1 }, unique: true, partialFilterExpression: { b: 1, a: { $exists: true } } }], partialDecl), true, 'key order of the filter is irrelevant');
    assert.equal(indexListingMatches([{ name: 'p', key: { a: 1 }, unique: true }], partialDecl), false, 'partial filter missing');
    assert.equal(indexListingMatches([{ name: 'p', key: { a: 1 }, unique: true, partialFilterExpression: { a: 1 } }], { ...partialDecl, options: { unique: true } }), false, 'a partial filter the schema does not declare');
  });
});

describe('readiness JSON', () => {
  const withApp = async (fn: (base: string) => Promise<void>) => {
    const log = console.info;
    console.info = () => undefined;
    const savedEnv = { NODE_ENV: process.env.NODE_ENV, CORS_ORIGINS: process.env.CORS_ORIGINS };
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://cms.example.com';
    const app = createApp();
    console.info = log;
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
    try {
      await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
      delete (mongoose.connection as any).readyState;
      appState.shuttingDown = false;
      server.close();
      for (const [k, v] of Object.entries(savedEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };
  const ready = async (base: string) => {
    const res = await fetch(`${base}/api/ready`);
    return { status: res.status, body: (await res.json()) as any };
  };

  test('before anything is built: 200 (contract unchanged), indexesEnforced false, every index unknown', async () => {
    await withApp(async (base) => {
      const { status, body } = await ready(base);
      assert.equal(status, 200);
      assert.equal(body.status, 'ready');
      assert.equal(body.indexesEnforced, false);
      assert.equal(body.indexes.enforced, 0);
      assert.equal(body.indexes.unknown, body.indexes.total);
      assert.ok(body.indexes.total > 20);
      assert.deepEqual(body.indexBuild, { mode: 'gated', phase: 'pending', otherIndexes: { built: 0, failed: 0 } });
    });
  });

  test('shape: counts only, no ids, no index or model names, nothing about the data', async () => {
    await build({ report: reportWith({ [FAMILY]: 'duplicates', 'Wallet.tenantId_1_ownerType_1_ownerId_1': 'unknown' }) });
    FakeCollection.failures.set('Varisangya.tenantId_1_receiptNo_1', Object.assign(new Error('x'), { code: 11000 }));
    await withApp(async (base) => {
      const { status, body } = await ready(base);
      assert.equal(status, 200);
      assert.deepEqual(Object.keys(body).sort(), ['indexBuild', 'indexes', 'indexesEnforced', 'status']);
      assert.deepEqual(Object.keys(body.indexes).sort(), ['blockedByDuplicates', 'buildFailed', 'enforced', 'notEnforced', 'total', 'unknown']);
      assert.equal(body.indexes.blockedByDuplicates, 1);
      assert.equal(body.indexes.enforced + body.indexes.blockedByDuplicates + body.indexes.buildFailed + body.indexes.unknown, body.indexes.total);
      assert.equal(body.indexes.notEnforced, body.indexes.total - body.indexes.enforced);
      assert.equal(body.indexesEnforced, false);
      assert.equal(body.indexBuild.phase, 'complete');
      const raw = JSON.stringify(body);
      assert.ok(!/tenantId|mahallId|Family|Wallet|[0-9a-f]{24}/.test(raw), 'no names or ids in the response');
    });
  });

  test('fully enforced -> indexesEnforced true; the same app turns false again when a unique index is not enforced', async () => {
    await build({ report: reportWith() });
    await withApp(async (base) => {
      let { body } = await ready(base);
      assert.equal(body.indexesEnforced, true);
      assert.equal(body.indexes.enforced, body.indexes.total);
      assert.equal(body.indexes.notEnforced, 0);
      await build({ report: reportWith({ [FAMILY]: 'duplicates' }) });
      ({ body } = await ready(base));
      assert.equal(body.indexesEnforced, false);
      assert.equal(body.indexes.blockedByDuplicates, 1);
    });
  });

  test('503 contract is unchanged: database down or shutting down', async () => {
    await withApp(async (base) => {
      appState.shuttingDown = true;
      let res = await fetch(`${base}/api/ready`);
      assert.equal(res.status, 503);
      appState.shuttingDown = false;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });
      res = await fetch(`${base}/api/ready`);
      assert.equal(res.status, 503);
      assert.equal(((await res.json()) as any).database, 'down');
    });
  });
});

describe('startup order', () => {
  test('registerMonitors -> connect -> topology log -> indexes -> seed -> listen, and listen waits for the index step', async () => {
    const order: string[] = [];
    let releaseIndexes!: () => void;
    const indexesDone = new Promise<void>((resolve) => (releaseIndexes = resolve));
    const running = runStartupSequence({
      registerMonitors: () => void order.push('registerMonitors'),
      connect: async () => void order.push('connect'),
      logTopology: () => void order.push('logTopology'),
      indexes: async () => {
        order.push('indexes:start');
        await indexesDone;
        order.push('indexes:end');
      },
      seed: () => void order.push('seed'),
      listen: () => void order.push('listen'),
    });
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(order, ['registerMonitors', 'connect', 'logTopology', 'indexes:start'], 'nothing listens while the index step runs');
    releaseIndexes();
    await running;
    assert.deepEqual(order, ['registerMonitors', 'connect', 'logTopology', 'indexes:start', 'indexes:end', 'seed', 'listen']);
    assert.deepEqual([...STARTUP_ORDER], ['registerMonitors', 'connect', 'logTopology', 'indexes', 'seed', 'listen']);
  });

  test('a failing connect stops the sequence: no preflight, no build, no listen', async () => {
    const order: string[] = [];
    await assert.rejects(
      runStartupSequence({
        registerMonitors: () => void order.push('registerMonitors'),
        connect: async () => {
          throw new Error('no connection');
        },
        logTopology: () => void order.push('logTopology'),
        indexes: async () => void order.push('indexes'),
        listen: () => void order.push('listen'),
      })
    );
    assert.deepEqual(order, ['registerMonitors']);
  });

  test('src/index.ts runs exactly this sequence (and calls the server listen only through it)', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../index.ts'), 'utf8');
    const at = (needle: string) => {
      const i = source.indexOf(needle);
      assert.ok(i >= 0, `index.ts contains ${needle}`);
      return i;
    };
    const positions = ['registerMonitors:', 'connect: connectDatabase', 'logTopology:', 'indexes:', 'seed:', 'listen:'].map(at);
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'steps appear in the fixed order');
    assert.match(source, /await runStartupSequence\(\{/);
    assert.equal((source.match(/\.listen\(/g) || []).length, 1, 'one listen call');
    assert.ok(at('app.listen(') > at('const listenForRequests'), 'it lives inside listenForRequests');
    assert.ok(!/runStartupIndexPreflight|registerAllIndexMonitors/.test(source), 'the old unordered calls are gone');
  });

  test('the preflight finishes BEFORE the first index is built; with a clean preflight the build then creates indexes; the step then returns', async () => {
    const order: string[] = [];
    let preflightDone = false;
    await runStartupIndexStep({ NODE_ENV: 'production' } as NodeJS.ProcessEnv, {
      preflight: async () => {
        order.push('preflight:start');
        await new Promise((r) => setTimeout(r, 15));
        assert.deepEqual(createCalls(), [], 'nothing is built while the preflight runs');
        preflightDone = true;
        order.push('preflight:end');
        return reportWith();
      },
      build: async (options) => {
        assert.equal(preflightDone, true, 'the build starts only after the preflight finished');
        order.push('build:start');
        const result = await runGatedIndexBuild({ ...options, models: fakes, log: quiet });
        order.push('build:end');
        return result;
      },
    });
    assert.deepEqual(order, ['preflight:start', 'preflight:end', 'build:start', 'build:end']);
    assert.ok(createCalls().length > 0);
    assert.equal(getIndexBuildMode(), 'gated');
    assert.equal(getIndexReadiness().indexesEnforced, true);
  });

  test('while the build is still running readiness reports indexesEnforced false (never early) and the step stops waiting after INDEX_BUILD_WAIT_MS', async () => {
    let release!: () => void;
    FakeCollection.gate = new Promise<void>((resolve) => (release = resolve));
    const startedAt = Date.now();
    await runStartupIndexStep({ NODE_ENV: 'production', INDEX_BUILD_WAIT_MS: '30' } as unknown as NodeJS.ProcessEnv, {
      preflight: async () => reportWith(),
      build: (options) => runGatedIndexBuild({ ...options, models: fakes, log: quiet }),
    });
    assert.ok(Date.now() - startedAt < 5000, 'the step returned although the build is held open');
    assert.equal(getIndexBuildPhase(), 'building');
    const mid = getIndexReadiness();
    assert.equal(mid.indexesEnforced, false);
    assert.equal(mid.indexes.enforced, 0);
    assert.equal(mid.indexes.unknown, mid.indexes.total);
    assert.match(warnings.join('\n'), /index build still running after 30 ms/);
    release();
    // join the in-flight run, then it is complete and enforced
    const outcome = await runStartupIndexes({ NODE_ENV: 'production' } as NodeJS.ProcessEnv, {
      preflight: async () => {
        throw new Error('must join the running build, not start another');
      },
    });
    assert.equal(outcome.mode, 'gated');
    assert.equal(getIndexBuildPhase(), 'complete');
    assert.equal(getIndexReadiness().indexesEnforced, true);
  });

  test('re-runnable: a second run re-checks and re-builds from a fresh state', async () => {
    let preflights = 0;
    const deps = {
      preflight: async () => {
        preflights += 1;
        return reportWith(preflights === 1 ? { [FAMILY]: 'duplicates' } : {});
      },
      build: (options: GatedBuildOptions) => runGatedIndexBuild({ ...options, models: fakes, log: quiet }),
    };
    const env = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;
    await runStartupIndexes(env, deps);
    assert.equal(stateOf(FAMILY).status, 'blocked-by-duplicates');
    assert.equal(getIndexReadiness().indexesEnforced, false);
    // somebody resolved the duplicates; run again
    await runStartupIndexes(env, deps);
    assert.equal(preflights, 2);
    assert.equal(stateOf(FAMILY).status, 'enforced');
    assert.equal(getIndexReadiness().indexesEnforced, true);
  });

  test('a startup step that throws internally never throws out of startup and leaves indexes reported as not enforced', async () => {
    await runStartupIndexStep({ NODE_ENV: 'production' } as NodeJS.ProcessEnv, {
      preflight: async () => {
        throw new Error('preflight exploded');
      },
    });
    assert.equal(getIndexReadiness().indexesEnforced, false);
    assert.match(errors.join('\n'), /index startup failed/);
  });
});

describe('modes: development and test keep today\'s automatic behaviour', () => {
  test('mode selection: auto in development/test, gated otherwise, INDEX_BUILD_MODE overrides, junk is ignored', () => {
    const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
    assert.equal(readIndexBuildMode(env({ NODE_ENV: 'development' })), 'auto');
    assert.equal(readIndexBuildMode(env({ NODE_ENV: 'test' })), 'auto');
    assert.equal(readIndexBuildMode(env({ NODE_ENV: 'production' })), 'gated');
    assert.equal(readIndexBuildMode(env({ NODE_ENV: 'staging' })), 'gated');
    assert.equal(readIndexBuildMode(env({})), 'gated');
    assert.equal(readIndexBuildMode(env({ NODE_ENV: 'production', INDEX_BUILD_MODE: 'AUTO' })), 'auto');
    assert.equal(readIndexBuildMode(env({ NODE_ENV: 'development', INDEX_BUILD_MODE: 'gated' })), 'gated');
    assert.equal(readIndexBuildMode(env({ NODE_ENV: 'production', INDEX_BUILD_MODE: 'nonsense' })), 'gated');
    assert.equal(readIndexBuildMode(env({ NODE_ENV: 'development', INDEX_BUILD_MODE: 'nonsense' })), 'auto');
    assert.equal(readIndexBuildWaitMs(env({})), 120000);
    assert.equal(readIndexBuildWaitMs(env({ INDEX_BUILD_WAIT_MS: '0' })), 0);
    assert.equal(readIndexBuildWaitMs(env({ INDEX_BUILD_WAIT_MS: '-5' })), 120000);
    assert.equal(readIndexBuildWaitMs(env({ INDEX_BUILD_WAIT_MS: 'abc' })), 120000);
  });

  test('auto mode: the startup runs only the (report-only) preflight and never calls the explicit build', async () => {
    let builds = 0;
    let preflights = 0;
    const outcome = await runStartupIndexes({ NODE_ENV: 'development' } as NodeJS.ProcessEnv, {
      preflight: async () => {
        preflights += 1;
        return reportWith();
      },
      build: async () => {
        builds += 1;
        throw new Error('must not be called in auto mode');
      },
    });
    assert.equal(outcome.mode, 'auto');
    assert.equal(preflights, 1);
    assert.equal(builds, 0);
    assert.deepEqual(createCalls(), []);
    assert.equal(getIndexBuildMode(), 'auto');
  });

  test('auto mode: state still comes from Mongoose\'s own index events, exactly as before', () => {
    setIndexBuildMode('auto');
    resetIndexState();
    const family = () => getIndexState().find((e) => e.model === 'Family' && e.index === 'tenantId_1_mahallId_1')!;
    assert.equal(family().status, 'unknown');
    mongoose.model('Family').emit('index');
    assert.equal(family().status, 'enforced');
  });

  test('gated mode: Mongoose index events are ignored (an event for a model must not mark a skipped spec enforced)', () => {
    setIndexBuildMode('gated');
    mongoose.model('Family').emit('index');
    const family = getIndexState().find((e) => e.model === 'Family' && e.index === 'tenantId_1_mahallId_1')!;
    assert.equal(family.status, 'unknown');
  });

  describe('connectDatabase', () => {
    const saved: Record<string, string | undefined> = {};
    let options: Doc | undefined;
    const realConnect = mongoose.connect;
    let baseAutoIndex: unknown;
    beforeEach(() => {
      for (const k of ['NODE_ENV', 'INDEX_BUILD_MODE', 'MONGODB_URI']) saved[k] = process.env[k];
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/never-connected';
      options = undefined;
      baseAutoIndex = mongoose.get('autoIndex');
      (mongoose as any).connect = async (_uri: string, opts: Doc) => {
        options = opts;
        return mongoose;
      };
    });
    afterEach(() => {
      (mongoose as any).connect = realConnect;
      mongoose.set('autoIndex', baseAutoIndex as boolean);
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });

    test('gated (production): the connection opens with autoIndex OFF, so connecting builds nothing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.INDEX_BUILD_MODE;
      await connectDatabase();
      assert.equal(options!.autoIndex, false);
      assert.equal(mongoose.get('autoIndex'), false);
    });

    test('development and test: no autoIndex override (Mongoose builds as today)', async () => {
      for (const nodeEnv of ['development', 'test']) {
        process.env.NODE_ENV = nodeEnv;
        delete process.env.INDEX_BUILD_MODE;
        options = undefined;
        await connectDatabase();
        assert.ok(!('autoIndex' in options!), `${nodeEnv}: autoIndex is left at Mongoose's default`);
      }
    });

    test('INDEX_BUILD_MODE=auto in production keeps the automatic build (operator choice)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.INDEX_BUILD_MODE = 'auto';
      await connectDatabase();
      assert.ok(!('autoIndex' in options!));
    });
  });

  test('prepareIndexBuild (before connect) sets the mode, attaches the monitors and logs the mode once', () => {
    const mode = prepareIndexBuild({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    assert.equal(mode, 'gated');
    assert.equal(getIndexBuildMode(), 'gated');
    assert.match(infos.join('\n'), /build mode: gated \(autoIndex off/);
    assert.ok(getIndexState().length > 20, 'monitors are attached');
  });
});

describe('waitUpTo', () => {
  test('resolves done:true with the value, or done:false when the work is slower, and never rejects', async () => {
    assert.deepEqual(await waitUpTo(Promise.resolve(5), 1000), { done: true, value: 5 });
    assert.deepEqual(await waitUpTo(new Promise((r) => setTimeout(() => r(1), 200)), 5), { done: false });
    assert.deepEqual(await waitUpTo(Promise.reject(new Error('x')), 1000), { done: true });
  });
});

describe('the operator script is still read-only and consistent', () => {
  const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  test('checkIndexes.ts: autoIndex/autoCreate off, no write/build call, uses the same preflight as the gate', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../scripts/checkIndexes.ts'), 'utf8');
    const code = strip(source);
    assert.match(code, /autoIndex:\s*false/);
    assert.match(code, /autoCreate:\s*false/);
    assert.match(code, /runIndexPreflight\(/);
    assert.ok(!/createIndex|dropIndex|syncIndexes|ensureIndexes|deleteMany|updateMany|runGatedIndexBuild|indexBuild/.test(code), 'it never builds or changes anything');
  });

  test('the preflight and the monitor neither build nor drop (the build lives only in services/indexBuild.ts)', () => {
    for (const file of ['../services/indexPreflight.ts', '../utils/indexMonitor.ts']) {
      const code = strip(fs.readFileSync(path.resolve(__dirname, file), 'utf8'));
      assert.ok(!/createIndex|dropIndex|syncIndexes|ensureIndexes|deleteMany|updateMany/.test(code), `${path.basename(file)} is read-only`);
    }
  });
});

});
