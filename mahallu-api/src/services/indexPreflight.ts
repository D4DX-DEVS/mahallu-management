import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { recordPreflightResult, registerIndexMonitor, uniqueIndexesOf } from '../utils/indexMonitor';

/**
 * READ-ONLY check for data that would stop a unique index from being built.
 *
 * MongoDB cannot build a unique index over existing duplicates. The models declare many unique indexes
 * (Mahallu ids, receipt numbers, case numbers, idempotency keys, ledger postings...). Before relying on
 * them, this service asks the database - with ONE aggregation per index - which keys occur more than once
 * and reports only the key and the `_id`s of the conflicting documents.
 *
 * Guarantees:
 *   - the list of indexes is DERIVED from the loaded model schemas (`Model.schema.indexes()`), so it
 *     cannot drift from what the models really declare;
 *   - it only reads. The one command it issues is an aggregation; it never changes data or indexes;
 *   - it returns ids and key values only (a short denylist redacts contact details, e.g. a phone number
 *     that is part of a key), never whole documents;
 *   - it never throws: a failed check is reported as status 'unknown'.
 *
 * Operators run it through `npm run check:indexes` (src/scripts/checkIndexes.ts); the server runs it once
 * at startup (src/index.ts) and logs one actionable error per conflicting index.
 */

export interface IndexSpec {
  /** Display name: `<Model>.<indexName>`. */
  name: string;
  model: string;
  indexName: string;
  collection: string;
  fields: string[];
  partialFilterExpression?: Record<string, unknown>;
  collation?: Record<string, unknown>;
}

export interface DuplicateGroup {
  /** The conflicting key (field -> value). Contact-type fields are redacted. */
  key: Record<string, string>;
  count: number;
  /** `_id`s of (up to maxIds of) the conflicting documents. */
  ids: string[];
}

export interface FindDuplicatesResult {
  groups: DuplicateGroup[];
  /** More conflicting groups exist than `limit`. */
  truncated: boolean;
}

export interface SpecReport {
  name: string;
  model: string;
  fields: string[];
  status: 'clean' | 'duplicates' | 'unknown';
  duplicateGroups: number;
  conflictingIds: string[];
  groups: DuplicateGroup[];
  truncated: boolean;
  /** Error class only, when status is 'unknown'. */
  error?: string;
}

export interface PreflightReport {
  /** No duplicates found AND every check completed. */
  ok: boolean;
  duplicatesFound: boolean;
  /** At least one check could not complete (its status is 'unknown'). */
  incomplete: boolean;
  checkedAt: string;
  specs: SpecReport[];
}

const DEFAULT_LIMIT = 20;
const MAX_IDS_PER_GROUP = 10;
const DEFAULT_TIMEOUT_MS = 20_000;

/** Key fields that are contact details: reported as '[redacted]' even when they are part of a unique key. */
const REDACTED_FIELD = /^(phone|mobile|email|whatsapp|password|token|otp|aadhaar|pan)/i;

/**
 * Service modules that declare a Mongoose model of their own (outside src/models). They are loaded too, so
 * their unique indexes are checked. A test fails if another file outside src/models declares one.
 */
export const EXTRA_MODEL_MODULES = ['varisangyaNotificationService'];

/** Import every model so each one is registered with Mongoose. New model files are picked up automatically. */
export const loadAllModels = (): void => {
  const dir = path.resolve(__dirname, '../models');
  for (const file of fs.readdirSync(dir)) {
    if (!/\.(ts|js)$/.test(file) || /\.d\.ts$/.test(file)) continue;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require(path.join(dir, file));
  }
  for (const name of EXTRA_MODEL_MODULES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(path.join(__dirname, name));
    } catch (err) {
      console.error(`[indexes] could not load ${name} to list its unique indexes (${(err as Error)?.name || 'Error'}).`);
    }
  }
};

/**
 * The registry: one spec per unique index declared by any model schema, derived from the schemas.
 * Also registers every such model with the index monitor.
 */
export const getUniqueIndexRegistry = (): IndexSpec[] => {
  loadAllModels();
  const specs: IndexSpec[] = [];
  for (const modelName of mongoose.modelNames().sort()) {
    const model = mongoose.model(modelName);
    const declared = uniqueIndexesOf(model);
    if (declared.length === 0) continue;
    registerIndexMonitor(model);
    for (const decl of declared) {
      const options = decl.options;
      let partial = options.partialFilterExpression as Record<string, unknown> | undefined;
      // A sparse index skips documents that carry none of its fields.
      if (!partial && options.sparse) {
        partial = { $or: decl.fields.map((field) => ({ [field]: { $exists: true } })) };
      }
      specs.push({
        name: `${modelName}.${decl.index}`,
        model: modelName,
        indexName: decl.index,
        collection: model.collection.name,
        fields: decl.fields,
        ...(partial ? { partialFilterExpression: partial } : {}),
        ...(options.collation ? { collation: options.collation as Record<string, unknown> } : {}),
      });
    }
  }
  return specs;
};

/** A key value as short text: ids as hex, dates as ISO, strings capped. Never an object dump. */
const keyText = (field: string, value: unknown): string => {
  if (REDACTED_FIELD.test(field)) return '[redacted]';
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 77)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = typeof (value as { toHexString?: unknown }).toHexString === 'function' ? String(value) : '[object]';
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

export interface FindDuplicatesOptions {
  /** Max conflicting key groups to return (default 20). */
  limit?: number;
  /** Server-side time limit for the aggregation. */
  maxTimeMS?: number;
}

/**
 * Keys that occur more than once among the documents the index covers. ONE read-only aggregation:
 * match the partial filter, group by the key fields, keep groups with count > 1, project ids only.
 * Throws if the aggregation fails (runIndexPreflight turns that into status 'unknown').
 */
export const findDuplicates = async (spec: IndexSpec, options: FindDuplicatesOptions = {}): Promise<FindDuplicatesResult> => {
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT));
  const model = mongoose.model(spec.model);
  const keyDoc: Record<string, string> = {};
  spec.fields.forEach((field, i) => {
    keyDoc[`k${i}`] = `$${field}`;
  });

  const pipeline: Record<string, unknown>[] = [];
  if (spec.partialFilterExpression) pipeline.push({ $match: spec.partialFilterExpression });
  pipeline.push(
    { $group: { _id: keyDoc, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit + 1 },
    { $project: { _id: 1, count: 1, ids: { $slice: ['$ids', MAX_IDS_PER_GROUP] } } }
  );

  const rows = (await model.aggregate(pipeline as any[], {
    allowDiskUse: true,
    ...(options.maxTimeMS ? { maxTimeMS: options.maxTimeMS } : {}),
    ...(spec.collation ? { collation: spec.collation } : {}),
  } as any)) as Array<{ _id: Record<string, unknown>; count: number; ids: unknown[] }>;

  const truncated = rows.length > limit;
  const groups = rows.slice(0, limit).map((row) => {
    const key: Record<string, string> = {};
    spec.fields.forEach((field, i) => {
      key[field] = keyText(field, row._id?.[`k${i}`]);
    });
    return { key, count: Number(row.count), ids: (row.ids || []).map((id) => String(id)) };
  });
  return { groups, truncated };
};

export interface PreflightOptions extends FindDuplicatesOptions {
  /** Overall time budget for every check together (default 20s). */
  timeoutMs?: number;
  /** Test seam: check these instead of the derived registry. */
  specs?: IndexSpec[];
}

const withDeadline = <T>(work: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('preflight deadline reached'), { name: 'PreflightTimeout' })), Math.max(1, ms));
    if (typeof timer.unref === 'function') timer.unref();
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

/** Check every unique index. Never throws. */
export const runIndexPreflight = async (options: PreflightOptions = {}): Promise<PreflightReport> => {
  const started = Date.now();
  const budget = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const reports: SpecReport[] = [];
  let specs: IndexSpec[] = [];
  try {
    specs = options.specs ?? getUniqueIndexRegistry();
  } catch (err) {
    console.error(`[indexes] preflight could not list the unique indexes (${(err as Error)?.name || 'Error'}).`);
  }

  for (const spec of specs) {
    const remaining = budget - (Date.now() - started);
    const base = { name: spec.name, model: spec.model, fields: spec.fields };
    if (remaining <= 0) {
      recordPreflightResult(spec.model, spec.indexName, 'error');
      reports.push({ ...base, status: 'unknown', duplicateGroups: 0, conflictingIds: [], groups: [], truncated: false, error: 'PreflightTimeout' });
      continue;
    }
    try {
      const found = await withDeadline(
        findDuplicates(spec, { limit: options.limit, maxTimeMS: Math.min(options.maxTimeMS ?? remaining, remaining) }),
        remaining
      );
      const conflictingIds = found.groups.flatMap((group) => group.ids);
      const status = found.groups.length > 0 ? 'duplicates' : 'clean';
      recordPreflightResult(spec.model, spec.indexName, status, found.groups.length);
      reports.push({
        ...base,
        status,
        duplicateGroups: found.groups.length,
        conflictingIds,
        groups: found.groups,
        truncated: found.truncated,
      });
    } catch (err) {
      recordPreflightResult(spec.model, spec.indexName, 'error');
      reports.push({
        ...base,
        status: 'unknown',
        duplicateGroups: 0,
        conflictingIds: [],
        groups: [],
        truncated: false,
        error: String((err as { name?: string })?.name || 'Error').slice(0, 40),
      });
    }
  }

  const duplicatesFound = reports.some((report) => report.status === 'duplicates');
  const incomplete = reports.some((report) => report.status === 'unknown') || (specs.length === 0 && !options.specs);
  return { ok: !duplicatesFound && !incomplete, duplicatesFound, incomplete, checkedAt: new Date().toISOString(), specs: reports };
};

const MAX_LOGGED_IDS = 20;

/** One actionable line per conflicting index. Ids and key names only. */
export const formatDuplicateError = (report: SpecReport): string => {
  const ids = report.conflictingIds.slice(0, MAX_LOGGED_IDS);
  const more = report.conflictingIds.length > ids.length ? ` (+${report.conflictingIds.length - ids.length} more)` : '';
  const groups = `${report.duplicateGroups}${report.truncated ? '+' : ''}`;
  return (
    `[indexes] UNIQUE INDEX NOT SAFE: ${report.model} (${report.fields.join(', ')}) has ${groups} duplicate groups; ` +
    `ids: ${ids.join(', ')}${more}; resolve manually, then restart. Uniqueness is NOT enforced until then.`
  );
};

/** Print a report the way the startup and the operator script both show it. */
export const logPreflightReport = (report: PreflightReport, log: Pick<Console, 'error' | 'warn' | 'info'> = console): void => {
  for (const spec of report.specs) {
    if (spec.status === 'duplicates') log.error(formatDuplicateError(spec));
    else if (spec.status === 'unknown') {
      log.warn(`[indexes] could not verify ${spec.model} (${spec.fields.join(', ')}): ${spec.error || 'unknown error'}. Its uniqueness state is unknown.`);
    }
  }
  const clean = report.specs.filter((spec) => spec.status === 'clean').length;
  log.info(`[indexes] preflight: ${clean}/${report.specs.length} unique indexes have no duplicate data.`);
};

export interface PreflightConfig {
  enabled: boolean;
  timeoutMs: number;
  limit: number;
}

/** INDEX_PREFLIGHT=off skips the startup check; INDEX_PREFLIGHT_TIMEOUT_MS and INDEX_PREFLIGHT_LIMIT tune it. */
export const readPreflightConfig = (env: NodeJS.ProcessEnv = process.env): PreflightConfig => {
  const number = (raw: string | undefined, fallback: number) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
  };
  return {
    enabled: String(env.INDEX_PREFLIGHT || '').toLowerCase() !== 'off',
    timeoutMs: number(env.INDEX_PREFLIGHT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    limit: number(env.INDEX_PREFLIGHT_LIMIT, DEFAULT_LIMIT),
  };
};

/** Startup entry point: bounded, logs, and never throws or exits. */
export const runStartupIndexPreflight = async (env: NodeJS.ProcessEnv = process.env): Promise<PreflightReport | undefined> => {
  const config = readPreflightConfig(env);
  // Register the monitors even when the check is skipped, so build failures are still tracked.
  try {
    getUniqueIndexRegistry();
  } catch {
    /* reported by runIndexPreflight below */
  }
  if (!config.enabled) {
    console.info('[indexes] startup preflight skipped (INDEX_PREFLIGHT=off).');
    return undefined;
  }
  try {
    const report = await runIndexPreflight({ timeoutMs: config.timeoutMs, limit: config.limit });
    logPreflightReport(report);
    return report;
  } catch (err) {
    console.error(`[indexes] preflight failed (${(err as Error)?.name || 'Error'}); uniqueness state is unknown.`);
    return undefined;
  }
};

/**
 * Attach the index monitor to every model with a unique index. Call it BEFORE connecting: Mongoose
 * builds indexes (and emits its 'index' event) as soon as the connection opens.
 */
export const registerAllIndexMonitors = (): void => {
  try {
    getUniqueIndexRegistry();
  } catch (err) {
    console.error(`[indexes] could not attach the index monitors (${(err as Error)?.name || 'Error'}).`);
  }
};
