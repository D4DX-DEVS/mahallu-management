import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import {
  EXTRA_MODEL_MODULES,
  findDuplicates,
  formatDuplicateError,
  getUniqueIndexRegistry,
  readPreflightConfig,
  runIndexPreflight,
  runStartupIndexPreflight,
} from '../services/indexPreflight';
import type { IndexSpec } from '../services/indexPreflight';
import {
  getIndexCounts,
  getIndexState,
  monitoredModelNames,
  resetIndexState,
  uniqueIndexesOf,
} from '../utils/indexMonitor';
import { exitCodeFor } from '../scripts/checkIndexes';
import { matches } from './support/fakeMongo';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] indexPreflight', () => {

/**
 * The read-only unique-index preflight, with a stateful stand-in for the aggregation (no database).
 * The stand-in INTERPRETS the pipeline the service sends ($match / $group / $match / $sort / $limit /
 * $project), so the tests exercise the real query shape, including the partial filter.
 */

type Doc = Record<string, any>;
const oid = () => new mongoose.Types.ObjectId();

const evalRef = (doc: Doc, expr: any) => (typeof expr === 'string' && expr.startsWith('$') ? doc[expr.slice(1)] : expr);
const keyOf = (v: any): string => JSON.stringify(v === undefined ? null : v instanceof mongoose.Types.ObjectId ? String(v) : v);

/** Run an aggregation pipeline over in-memory documents. */
const runPipeline = (docs: Doc[], pipeline: Doc[]): Doc[] => {
  let rows: Doc[] = docs.map((d) => ({ ...d }));
  for (const stage of pipeline) {
    if (stage.$match) {
      rows = rows.filter((d) => matches(d, stage.$match));
    } else if (stage.$group) {
      const { _id: idSpec, ...accumulators } = stage.$group;
      const groups = new Map<string, { id: Doc; rows: Doc[] }>();
      for (const row of rows) {
        const id: Doc = {};
        for (const [name, ref] of Object.entries(idSpec as Doc)) id[name] = evalRef(row, ref) ?? null;
        const key = JSON.stringify(Object.values(id).map(keyOf));
        if (!groups.has(key)) groups.set(key, { id, rows: [] });
        groups.get(key)!.rows.push(row);
      }
      rows = [...groups.values()].map((g) => {
        const out: Doc = { _id: g.id };
        for (const [name, acc] of Object.entries(accumulators as Doc)) {
          const [op, arg] = Object.entries(acc as Doc)[0];
          if (op === '$sum') out[name] = g.rows.length * Number(arg);
          else if (op === '$push') out[name] = g.rows.map((r) => evalRef(r, arg));
          else throw new Error(`unsupported accumulator ${op}`);
        }
        return out;
      });
    } else if (stage.$sort) {
      const [[field, dir]] = Object.entries(stage.$sort) as [string, number][];
      rows = [...rows].sort((a, b) => (b[field] - a[field]) * (dir === -1 ? 1 : -1) * -1);
    } else if (stage.$limit) {
      rows = rows.slice(0, stage.$limit);
    } else if (stage.$project) {
      rows = rows.map((r) => {
        const out: Doc = {};
        for (const [name, spec] of Object.entries(stage.$project as Doc)) {
          if (spec === 1) out[name] = r[name];
          else if (spec && spec.$slice) out[name] = (r[spec.$slice[0].slice(1)] as any[]).slice(0, spec.$slice[1]);
          else throw new Error(`unsupported projection ${name}`);
        }
        return out;
      });
    } else {
      throw new Error(`unsupported stage ${Object.keys(stage)[0]}`);
    }
  }
  return rows;
};

const restorers: Array<() => void> = [];
const data = new Map<string, Doc[]>();
const pipelines: Array<{ model: string; pipeline: Doc[]; options: any }> = [];
let failing = new Map<string, () => Promise<never>>();

const model = (name: string): any => mongoose.model(name);

before(() => {
  getUniqueIndexRegistry(); // loads every model
  for (const name of mongoose.modelNames()) {
    const M: any = model(name);
    const original = M.aggregate;
    M.aggregate = (pipeline: Doc[], options: any) => {
      pipelines.push({ model: name, pipeline, options });
      if (failing.has(name)) return failing.get(name)!();
      return Promise.resolve(runPipeline(data.get(name) || [], pipeline));
    };
    restorers.push(() => {
      M.aggregate = original;
    });
  }
});
after(() => restorers.forEach((r) => r()));

const realError = console.error;
const realWarn = console.warn;
const realInfo = console.info;
let errors: string[] = [];
let warnings: string[] = [];
beforeEach(() => {
  data.clear();
  pipelines.length = 0;
  failing = new Map();
  errors = [];
  warnings = [];
  console.error = (...args: any[]) => void errors.push(args.map(String).join(' '));
  console.warn = (...args: any[]) => void warnings.push(args.map(String).join(' '));
  console.info = () => undefined;
  resetIndexState();
});
const restoreConsole = () => {
  console.error = realError;
  console.warn = realWarn;
  console.info = realInfo;
};
after(restoreConsole);
after(resetIndexState);

const spec = (name: string): IndexSpec => {
  const found = getUniqueIndexRegistry().find((s) => s.name === name);
  assert.ok(found, `registry has ${name}`);
  return found!;
};
const T1 = oid();
const T2 = oid();

describe('registry derived from the model schemas', () => {
  test('every unique index declared by any model is in the registry (and its model is monitored)', () => {
    const registry = getUniqueIndexRegistry();
    const names = new Set(registry.map((s) => s.name));
    let declared = 0;
    for (const modelName of mongoose.modelNames()) {
      for (const decl of uniqueIndexesOf(model(modelName))) {
        declared += 1;
        assert.ok(names.has(`${modelName}.${decl.index}`), `${modelName}.${decl.index} is missing from the registry`);
        assert.ok(monitoredModelNames().includes(modelName), `${modelName} is not registered with the index monitor`);
      }
    }
    assert.equal(registry.length, declared);
    assert.ok(registry.length >= 20);
  });

  test('the registry also matches what the SOURCE declares: a new unique index cannot slip past it', () => {
    const srcRoot = path.resolve(__dirname, '..');
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === 'tests' ? [] : walk(p);
        return p.endsWith('.ts') ? [p] : [];
      });
    let inSource = 0;
    const outsideModels: string[] = [];
    for (const file of walk(srcRoot)) {
      const code = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      const count = (code.match(/\bunique:\s*true/g) || []).length;
      inSource += count;
      if (count > 0 && !file.includes(`${path.sep}models${path.sep}`)) outsideModels.push(path.basename(file, '.ts'));
    }
    // every file outside src/models that declares a unique index is one the registry loads explicitly
    for (const name of outsideModels) assert.ok(EXTRA_MODEL_MODULES.includes(name), `${name} declares a unique index but is not in EXTRA_MODEL_MODULES`);
    assert.equal(getUniqueIndexRegistry().length, inSource,'the number of `unique: true` declarations in the source differs from the registry');
  });

  test('the indexes the task names are all present, with their partial filters', () => {
    const partial = (name: string) => spec(name).partialFilterExpression;
    assert.deepEqual(partial('Family.tenantId_1_mahallId_1'), { mahallId: { $type: 'string' } });
    assert.deepEqual(partial('Member.tenantId_1_mahallId_1'), { mahallId: { $type: 'string' } });
    assert.deepEqual(partial('Varisangya.tenantId_1_receiptNo_1'), { receiptNo: { $type: 'string' } });
    assert.deepEqual(partial('Zakat.tenantId_1_receiptNo_1'), { receiptNo: { $type: 'string' } });
    assert.deepEqual(partial('LedgerItem.source_1_sourceId_1'), {
      source: { $type: 'string' },
      sourceId: { $type: 'objectId' },
    });
    assert.deepEqual(partial('Ledger.tenantId_1_instituteId_1_name_1_type_1'), { auto: true });
    assert.deepEqual(spec('Wallet.tenantId_1_key_1').fields, ['tenantId', 'key']);
    assert.deepEqual(spec('Transaction.tenantId_1_entryKey_1').fields, ['tenantId', 'entryKey']);
    for (const name of [
      'CounsellingCase.tenantId_1_caseNo_1',
      'DisputeCase.tenantId_1_caseNo_1',
      'InheritanceCase.tenantId_1_caseNo_1',
      'Varisangya.tenantId_1_clientRequestId_1',
      'Zakat.tenantId_1_clientRequestId_1',
      'QardRepayment.tenantId_1_clientRequestId_1',
      'ZakatDistribution.tenantId_1_clientRequestId_1',
    ]) {
      assert.ok(spec(name), name);
    }
  });
});

describe('findDuplicates', () => {
  test('Family and Member: the same mahallId twice in one Mahallu is a duplicate; other Mahallus and missing ids are not', async () => {
    for (const name of ['Family', 'Member']) {
      const a = oid();
      const b = oid();
      const c = oid();
      data.set(name, [
        { _id: a, tenantId: T1, mahallId: 'FID1' },
        { _id: b, tenantId: T1, mahallId: 'FID1' },
        { _id: c, tenantId: T2, mahallId: 'FID1' }, // same id, other Mahallu: allowed
        { _id: oid(), tenantId: T1 }, // no mahallId: outside the partial filter
        { _id: oid(), tenantId: T1 }, // a second one without: still outside it
        { _id: oid(), tenantId: T1, mahallId: null }, // null is not a string: outside it
        { _id: oid(), tenantId: T1, mahallId: null },
      ]);
      const out = await findDuplicates(spec(`${name}.tenantId_1_mahallId_1`));
      assert.equal(out.groups.length, 1, name);
      assert.equal(out.groups[0].count, 2);
      assert.deepEqual(out.groups[0].ids.sort(), [String(a), String(b)].sort());
      assert.equal(out.groups[0].key.mahallId, 'FID1');
      assert.equal(out.groups[0].key.tenantId, String(T1));
      assert.equal(out.truncated, false);
    }
  });

  test('case numbers: duplicates in each of the three case models', async () => {
    for (const name of ['CounsellingCase', 'DisputeCase', 'InheritanceCase']) {
      const a = oid();
      const b = oid();
      data.set(name, [
        { _id: a, tenantId: T1, caseNo: 'C-1' },
        { _id: b, tenantId: T1, caseNo: 'C-1' },
        { _id: oid(), tenantId: T1, caseNo: 'C-2' },
        { _id: oid(), tenantId: T2, caseNo: 'C-1' },
      ]);
      const out = await findDuplicates(spec(`${name}.tenantId_1_caseNo_1`));
      assert.equal(out.groups.length, 1, name);
      assert.deepEqual(out.groups[0].ids.sort(), [String(a), String(b)].sort());
      assert.equal(out.groups[0].key.caseNo, 'C-1');
    }
  });

  test('receipt numbers: duplicates among documents that HAVE one; documents without one are outside the partial filter', async () => {
    for (const name of ['Varisangya', 'Zakat']) {
      const a = oid();
      const b = oid();
      data.set(name, [
        { _id: a, tenantId: T1, receiptNo: '14001' },
        { _id: b, tenantId: T1, receiptNo: '14001' },
        { _id: oid(), tenantId: T1 }, // pending member submissions have no receipt yet
        { _id: oid(), tenantId: T1 },
        { _id: oid(), tenantId: T1, receiptNo: '14002' },
      ]);
      const out = await findDuplicates(spec(`${name}.tenantId_1_receiptNo_1`));
      assert.equal(out.groups.length, 1, name);
      assert.deepEqual(out.groups[0].ids.sort(), [String(a), String(b)].sort());
      assert.equal(out.groups[0].key.receiptNo, '14001');
    }
  });

  test('ledger items: the same (source, sourceId) twice; manual items and items without a sourceId are outside the filter', async () => {
    const sourceId = oid();
    const a = oid();
    const b = oid();
    data.set('LedgerItem', [
      { _id: a, source: 'salary', sourceId },
      { _id: b, source: 'salary', sourceId },
      { _id: oid(), source: 'zakat', sourceId }, // same sourceId, other source: fine
      { _id: oid(), source: 'manual' },
      { _id: oid(), source: 'manual' },
      { _id: oid(), source: 'manual', sourceId: null },
      { _id: oid(), source: 'manual', sourceId: null },
    ]);
    const out = await findDuplicates(spec('LedgerItem.source_1_sourceId_1'));
    assert.equal(out.groups.length, 1);
    assert.deepEqual(out.groups[0].ids.sort(), [String(a), String(b)].sort());
    assert.equal(out.groups[0].key.source, 'salary');
    assert.equal(out.groups[0].key.sourceId, String(sourceId));
  });

  test('auto ledgers: only ledgers flagged auto count', async () => {
    const inst = oid();
    data.set('Ledger', [
      { _id: oid(), tenantId: T1, instituteId: inst, name: 'Salary', type: 'expense', auto: true },
      { _id: oid(), tenantId: T1, instituteId: inst, name: 'Salary', type: 'expense' }, // made by hand
      { _id: oid(), tenantId: T1, instituteId: inst, name: 'Salary', type: 'expense' },
    ]);
    const out = await findDuplicates(spec('Ledger.tenantId_1_instituteId_1_name_1_type_1'));
    assert.equal(out.groups.length, 0);
  });

  test('a unique index with no partial filter covers every document', async () => {
    const a = oid();
    const b = oid();
    data.set('Tenant', [
      { _id: a, code: 'ABC' },
      { _id: b, code: 'ABC' },
      { _id: oid(), code: 'DEF' },
    ]);
    const out = await findDuplicates(spec('Tenant.code_1'));
    assert.equal(out.groups.length, 1);
    assert.equal(out.groups[0].key.code, 'ABC');
  });

  test('the limit truncates, and says so', async () => {
    const docs: Doc[] = [];
    for (let i = 0; i < 5; i++) docs.push({ _id: oid(), tenantId: T1, mahallId: `F${i}` }, { _id: oid(), tenantId: T1, mahallId: `F${i}` });
    data.set('Family', docs);
    const out = await findDuplicates(spec('Family.tenantId_1_mahallId_1'), { limit: 3 });
    assert.equal(out.groups.length, 3);
    assert.equal(out.truncated, true);
  });

  test('ids per group are capped (a huge group does not produce a huge answer)', async () => {
    const docs: Doc[] = [];
    for (let i = 0; i < 40; i++) docs.push({ _id: oid(), tenantId: T1, mahallId: 'SAME' });
    data.set('Family', docs);
    const out = await findDuplicates(spec('Family.tenantId_1_mahallId_1'));
    assert.equal(out.groups[0].count, 40);
    assert.equal(out.groups[0].ids.length, 10);
  });

  test('ONE aggregation per spec, read-only stages only, ids projected (never whole documents)', async () => {
    data.set('Family', [{ _id: oid(), tenantId: T1, mahallId: 'X' }]);
    await findDuplicates(spec('Family.tenantId_1_mahallId_1'));
    assert.equal(pipelines.length, 1);
    const stages = pipelines[0].pipeline.map((s) => Object.keys(s)[0]);
    assert.deepEqual(stages, ['$match', '$group', '$match', '$sort', '$limit', '$project']);
    assert.deepEqual(Object.keys(pipelines[0].pipeline[1].$group).sort(), ['_id', 'count', 'ids']);
    assert.deepEqual(pipelines[0].pipeline[1].$group.ids, { $push: '$_id' });
    assert.equal(pipelines[0].options.allowDiskUse, true);
  });
});

describe('runIndexPreflight', () => {
  test('no duplicates anywhere -> ok, every spec clean, and the indexes still unproven until the build reports', async () => {
    const report = await runIndexPreflight();
    assert.equal(report.ok, true);
    assert.equal(report.duplicatesFound, false);
    assert.equal(report.incomplete, false);
    assert.equal(report.specs.length, getUniqueIndexRegistry().length);
    assert.ok(report.specs.every((s) => s.status === 'clean' && s.duplicateGroups === 0 && s.conflictingIds.length === 0 && s.truncated === false));
    assert.equal(exitCodeFor(report), 0);
    // the preflight alone does not claim enforcement
    assert.equal(getIndexCounts().enforced, 0);
  });

  test('duplicates -> not ok, structured per spec, and the index is reported as blocked-by-duplicates', async () => {
    const a = oid();
    const b = oid();
    data.set('Family', [
      { _id: a, tenantId: T1, mahallId: 'FID9' },
      { _id: b, tenantId: T1, mahallId: 'FID9' },
    ]);
    const report = await runIndexPreflight();
    assert.equal(report.ok, false);
    assert.equal(report.duplicatesFound, true);
    assert.equal(exitCodeFor(report), 1);
    const family = report.specs.find((s) => s.name === 'Family.tenantId_1_mahallId_1')!;
    assert.equal(family.status, 'duplicates');
    assert.equal(family.duplicateGroups, 1);
    assert.deepEqual(family.conflictingIds.sort(), [String(a), String(b)].sort());
    assert.equal(family.truncated, false);
    const state = getIndexState().find((e) => e.model === 'Family' && e.index === 'tenantId_1_mahallId_1')!;
    assert.equal(state.status, 'blocked-by-duplicates');
    assert.ok(getIndexCounts().notEnforced >= 1);
  });

  test('the report carries ids and key values only, never other fields or personal data', async () => {
    const a = oid();
    const b = oid();
    data.set('Member', [
      { _id: a, tenantId: T1, mahallId: 'FID7-1', name: 'Secret Person', phone: '9876543210', email: 'x@example.com', aadhaar: '123412341234' },
      { _id: b, tenantId: T1, mahallId: 'FID7-1', name: 'Secret Person', phone: '9876543210', email: 'x@example.com' },
    ]);
    // a unique key that includes a phone number: the value must be redacted
    data.set('User', [
      { _id: oid(), phone: '9123456780', tenantId: T1, role: 'mahall', name: 'Secret Admin', passwordHash: 'hash-value' },
      { _id: oid(), phone: '9123456780', tenantId: T1, role: 'mahall', name: 'Secret Admin', passwordHash: 'hash-value' },
    ]);
    const report = await runIndexPreflight();
    const text = JSON.stringify(report);
    for (const secret of ['Secret Person', '9876543210', 'x@example.com', '123412341234', 'Secret Admin', '9123456780', 'hash-value']) {
      assert.ok(!text.includes(secret), `the report must not contain ${secret}`);
    }
    assert.ok(text.includes(String(a)) && text.includes(String(b)), 'it does contain the ids');
    assert.ok(text.includes('FID7-1'), 'and the key');
    const user = report.specs.find((s) => s.model === 'User')!;
    assert.equal(user.groups[0].key.phone, '[redacted]');
  });

  test('never throws when the aggregation throws: that spec is unknown, the rest are still checked', async () => {
    failing.set('Family', () => Promise.reject(Object.assign(new Error('connection to host db.internal:27017 with password=hunter2 lost'), { name: 'MongoNetworkError' })));
    data.set('Member', [
      { _id: oid(), tenantId: T1, mahallId: 'D' },
      { _id: oid(), tenantId: T1, mahallId: 'D' },
    ]);
    const report = await runIndexPreflight();
    const family = report.specs.find((s) => s.model === 'Family')!;
    assert.equal(family.status, 'unknown');
    assert.equal(family.error, 'MongoNetworkError', 'the error CLASS only');
    assert.ok(!JSON.stringify(report).includes('hunter2'));
    assert.ok(!JSON.stringify(report).includes('db.internal'));
    assert.equal(report.specs.find((s) => s.model === 'Member')!.status, 'duplicates');
    assert.equal(report.ok, false);
    assert.equal(report.incomplete, true);
    const state = getIndexState().find((e) => e.model === 'Family')!;
    assert.equal(state.status, 'unknown');
  });

  test('an aggregation that throws synchronously, or never answers, is also contained', async () => {
    failing.set('Family', () => {
      throw new Error('boom');
    });
    failing.set('Member', () => new Promise<never>(() => undefined));
    const started = Date.now();
    const report = await runIndexPreflight({ timeoutMs: 300 });
    assert.ok(Date.now() - started < 5000, 'bounded in time');
    assert.equal(report.specs.find((s) => s.model === 'Family')!.status, 'unknown');
    const member = report.specs.find((s) => s.model === 'Member')!;
    assert.equal(member.status, 'unknown');
    assert.equal(member.error, 'PreflightTimeout');
  });
});

describe('index state from the build events', () => {
  const family = () => getIndexState().find((e) => e.model === 'Family' && e.index === 'tenantId_1_mahallId_1')!;

  test('nothing known yet -> unknown; a clean build -> enforced', () => {
    assert.equal(family().status, 'unknown');
    model('Family').emit('index');
    assert.equal(family().status, 'enforced');
  });

  test('a failed build marks the index not enforced, logs ONE clear line, and never logs the key value from the driver message', () => {
    const err = Object.assign(
      new Error('E11000 duplicate key error collection: db.families index: tenantId_1_mahallId_1 dup key: { tenantId: ObjectId("x"), mahallId: "SECRET-FID" }'),
      { code: 11000, codeName: 'DuplicateKey' }
    );
    model('Family').emit('index', err);
    assert.equal(family().status, 'build-failed');
    assert.equal(errors.length, 1);
    assert.match(errors[0], /\[indexes\] INDEX BUILD FAILED: Family \(tenantId_1_mahallId_1\)/);
    assert.match(errors[0], /Uniqueness is NOT enforced/);
    assert.ok(!errors[0].includes('SECRET-FID'));
    const counts = getIndexCounts();
    assert.ok(counts.notEnforced >= 1);
    assert.deepEqual(Object.keys(counts).sort(), ['enforced', 'notEnforced'], 'counts only: no names, no ids');
  });

  test('a failure that names a different index of the same model leaves this one unproven, not failed', () => {
    model('Varisangya').emit('index', Object.assign(new Error('x index: tenantId_1_receiptNo_1 dup key'), { code: 11000 }));
    const states = getIndexState().filter((e) => e.model === 'Varisangya');
    assert.equal(states.find((e) => e.index === 'tenantId_1_receiptNo_1')!.status, 'build-failed');
    assert.equal(states.find((e) => e.index === 'tenantId_1_clientRequestId_1')!.status, 'unknown');
  });

  test('duplicates found by the preflight win over a generic build failure; a later successful build proves enforcement', async () => {
    data.set('Family', [
      { _id: oid(), tenantId: T1, mahallId: 'D' },
      { _id: oid(), tenantId: T1, mahallId: 'D' },
    ]);
    await runIndexPreflight();
    model('Family').emit('index', Object.assign(new Error('x'), { code: 11000 }));
    assert.equal(family().status, 'blocked-by-duplicates');
    model('Family').emit('index');
    assert.equal(family().status, 'enforced');
  });

  test('the same state feeds the counts shown on /api/ready', () => {
    const before = getIndexCounts();
    assert.equal(before.enforced, 0);
    model('Wallet').emit('index');
    const after = getIndexCounts();
    assert.equal(after.enforced, 1);
    assert.equal(after.enforced + after.notEnforced, before.enforced + before.notEnforced);
  });
});

describe('startup integration', () => {
  test('logs ONE actionable structured error per conflicting index, with ids only, and does not throw', async () => {
    const a = oid();
    const b = oid();
    data.set('Family', [
      { _id: a, tenantId: T1, mahallId: 'FID5', houseName: 'Private House' },
      { _id: b, tenantId: T1, mahallId: 'FID5', houseName: 'Private House' },
    ]);
    const report = await runStartupIndexPreflight({} as NodeJS.ProcessEnv);
    assert.ok(report && report.duplicatesFound);
    const lines = errors.filter((l) => l.includes('UNIQUE INDEX NOT SAFE'));
    assert.equal(lines.length, 1);
    assert.equal(
      lines[0],
      `[indexes] UNIQUE INDEX NOT SAFE: Family (tenantId, mahallId) has 1 duplicate groups; ids: ${[String(a), String(b)].join(', ')}; resolve manually, then restart. Uniqueness is NOT enforced until then.`
    );
    assert.ok(!lines[0].includes('Private House'));
    assert.equal(errors.length, 1, 'nothing else is logged as an error');
  });

  test('a preflight that fails entirely does not crash startup', async () => {
    for (const name of mongoose.modelNames()) failing.set(name, () => Promise.reject(new Error('down')));
    const report = await runStartupIndexPreflight({} as NodeJS.ProcessEnv);
    assert.ok(report);
    assert.equal(report!.incomplete, true);
    assert.ok(warnings.length > 0);
  });

  test('INDEX_PREFLIGHT=off skips every query', async () => {
    const out = await runStartupIndexPreflight({ INDEX_PREFLIGHT: 'off' } as unknown as NodeJS.ProcessEnv);
    assert.equal(out, undefined);
    assert.equal(pipelines.length, 0);
  });

  test('config is parsed defensively', () => {
    assert.deepEqual(readPreflightConfig({} as NodeJS.ProcessEnv), { enabled: true, timeoutMs: 20000, limit: 20 });
    assert.deepEqual(readPreflightConfig({ INDEX_PREFLIGHT: 'OFF', INDEX_PREFLIGHT_TIMEOUT_MS: '5000', INDEX_PREFLIGHT_LIMIT: '7' } as unknown as NodeJS.ProcessEnv), {
      enabled: false,
      timeoutMs: 5000,
      limit: 7,
    });
    assert.equal(readPreflightConfig({ INDEX_PREFLIGHT_TIMEOUT_MS: 'abc', INDEX_PREFLIGHT_LIMIT: '-1' } as unknown as NodeJS.ProcessEnv).timeoutMs, 20000);
  });

  test('formatDuplicateError caps the ids it prints', () => {
    const ids = Array.from({ length: 30 }, () => String(oid()));
    const line = formatDuplicateError({
      name: 'Family.x', model: 'Family', fields: ['tenantId', 'mahallId'], status: 'duplicates',
      duplicateGroups: 3, conflictingIds: ids, groups: [], truncated: true,
    });
    assert.match(line, /has 3\+ duplicate groups/);
    assert.match(line, /\(\+10 more\)/);
  });
});

describe('static checks: the preflight only reads', () => {
  const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const WRITE_OPERATIONS =
    /\b(deleteMany|deleteOne|updateMany|updateOne|replaceOne|dropIndex|dropIndexes|dropCollection|dropDatabase|insertMany|insertOne|bulkWrite|findOneAndUpdate|findOneAndDelete|findOneAndReplace|findByIdAndUpdate|findByIdAndDelete|createIndex|createIndexes|ensureIndexes|syncIndexes|cleanIndexes|remove|save|create)\s*\(|\$out\b|\$merge\b/;

  for (const file of ['../services/indexPreflight.ts', '../utils/indexMonitor.ts', '../scripts/checkIndexes.ts']) {
    test(`${path.basename(file)} contains no write, delete or index-changing operation`, () => {
      const code = strip(fs.readFileSync(path.resolve(__dirname, file), 'utf8'));
      const hit = WRITE_OPERATIONS.exec(code);
      assert.equal(hit, null, `found ${hit && hit[0]}`);
    });
  }

  test('the operator script connects with autoIndex and autoCreate off and loads dotenv only as the entry point', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../scripts/checkIndexes.ts'), 'utf8');
    assert.match(source, /autoIndex:\s*false/);
    assert.match(source, /autoCreate:\s*false/);
    const code = strip(source);
    const loads = code.match(/require\('dotenv'\)|from 'dotenv'/g) || [];
    assert.equal(loads.length, 1);
    assert.ok(code.indexOf("require('dotenv')") > code.indexOf('require.main === module'), 'dotenv is loaded inside the entry-point guard');
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
    assert.equal(pkg.scripts['check:indexes'], 'ts-node src/scripts/checkIndexes.ts');
  });
});

});
