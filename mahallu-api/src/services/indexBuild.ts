import mongoose from 'mongoose';
import { getUniqueIndexRegistry, readPreflightConfig, runStartupIndexPreflight } from './indexPreflight';
import type { PreflightReport } from './indexPreflight';
import {
  describeIndexError,
  indexNameOf,
  recordGatedResult,
  recordOtherIndexResult,
  resetGatedResults,
  setIndexBuildMode,
  setIndexBuildPhase,
} from '../utils/indexMonitor';
import type { IndexBuildMode, IndexStatus, IndexSummary } from '../utils/indexMonitor';

/**
 * GATED index build: the duplicate preflight decides which unique indexes may be built.
 *
 * The problem this solves: with Mongoose's default `autoIndex`, every index is built the moment the
 * connection opens - concurrently with (not after) the duplicate preflight - so the preflight gated
 * nothing, and readiness could imply uniqueness that existing duplicate data prevents.
 *
 * Gated mode (INDEX_BUILD_MODE=gated, the default outside development/test):
 *   1. the connection is opened with autoIndex OFF (config/database.ts), so nothing is built yet;
 *   2. the READ-ONLY preflight (services/indexPreflight.ts) reports duplicates per unique index;
 *   3. this module then builds, one index at a time, with Mongoose's own `Model.createIndexes({ toCreate })`
 *      (it only ever CREATES; it never drops or rewrites an index - `syncIndexes` is deliberately NOT used):
 *        - unique index, preflight clean            -> built, then verified by listing the collection's indexes
 *        - unique index, duplicates found           -> NOT built, recorded blocked-by-duplicates
 *        - unique index, preflight inconclusive     -> NOT built (fail closed), recorded unknown
 *        - build raised an error (e.g. a duplicate appeared after the check) -> recorded build-failed
 *        - every non-unique index (performance, TTL, collation) -> built normally
 *   4. the result of each unique index is recorded in utils/indexMonitor.ts; /api/ready reports it.
 *
 * An index counts as `enforced` only after the collection's own index list shows it with the expected
 * options. Nothing is ever deleted, updated or dropped, and no duplicate is ever "chosen" or "resolved".
 */

export type { IndexBuildMode };

/** development and test keep Mongoose's automatic behaviour; everything else is gated. */
export const readIndexBuildMode = (env: NodeJS.ProcessEnv = process.env): IndexBuildMode => {
  const raw = String(env.INDEX_BUILD_MODE || '').trim().toLowerCase();
  if (raw === 'auto' || raw === 'gated') return raw;
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  return nodeEnv === 'development' || nodeEnv === 'test' ? 'auto' : 'gated';
};

const DEFAULT_WAIT_MS = 120_000;

/** How long startup waits for the build before it starts listening anyway (INDEX_BUILD_WAIT_MS; 0 = do not wait). */
export const readIndexBuildWaitMs = (env: NodeJS.ProcessEnv = process.env): number => {
  const raw = env.INDEX_BUILD_WAIT_MS;
  if (raw === undefined || String(raw).trim() === '') return DEFAULT_WAIT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_WAIT_MS;
};

type IndexTuple = [Record<string, unknown>, Record<string, any> | undefined];

/** The part of a Mongoose model this module touches (so a test can supply a fake without a database). */
export interface BuildableModel {
  modelName: string;
  schema: { indexes(): IndexTuple[] | any[] };
  collection: { name: string; indexes(): Promise<any[]> };
  createIndexes(options?: { toCreate?: unknown[] }): Promise<unknown>;
}

export interface UniqueBuildResult {
  /** `<Model>.<indexName>` */
  name: string;
  model: string;
  index: string;
  status: IndexStatus;
  detail?: string;
}

export interface GatedBuildResult {
  startedAt: string;
  finishedAt: string;
  unique: UniqueBuildResult[];
  summary: IndexSummary;
  otherIndexes: { built: number; failed: number };
}

export interface GatedBuildOptions {
  /** Test seam. Default: every model registered with Mongoose, sorted by name. */
  models?: BuildableModel[];
  /** The preflight verdicts. Without one (and preflightRan true) every unique index is unknown. */
  report?: PreflightReport;
  /**
   * false = the preflight was switched off (INDEX_PREFLIGHT=off): unique indexes are then built UNCHECKED.
   * That is safe - a unique build that meets duplicates just fails and is recorded build-failed - and it is
   * the same as Mongoose's own automatic behaviour, but the result is still verified before it counts.
   */
  preflightRan?: boolean;
  log?: Pick<Console, 'error' | 'warn' | 'info'>;
  now?: () => number;
}

interface Declared {
  name: string;
  fields: Record<string, unknown>;
  options: Record<string, any>;
  unique: boolean;
}

const declaredIndexes = (model: BuildableModel): Declared[] => {
  const tuples = (model.schema.indexes() || []) as IndexTuple[];
  return tuples.map(([fields, options]) => ({
    name: indexNameOf(fields, options?.name),
    fields,
    options: options || {},
    unique: !!options && !!options.unique,
  }));
};

const stable = (value: unknown): string =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
      ? Object.keys(v as object)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = (v as Record<string, unknown>)[k];
            return acc;
          }, {})
      : v
  );

/** Does the collection's own index list hold this unique index with the options the schema declares? */
export const indexListingMatches = (listing: any[], decl: Pick<Declared, 'name' | 'fields' | 'options'>): boolean => {
  const found = (listing || []).find((entry) => entry && entry.name === decl.name);
  if (!found || !found.unique) return false;
  const wanted = Object.entries(decl.fields).map(([field, dir]) => `${field}:${String(dir)}`);
  const actual = Object.entries(found.key || {}).map(([field, dir]) => `${field}:${String(dir)}`);
  if (wanted.join('|') !== actual.join('|')) return false;
  if (decl.options.sparse && !found.sparse) return false;
  const partial = decl.options.partialFilterExpression;
  if (partial ? stable(found.partialFilterExpression) !== stable(partial) : found.partialFilterExpression !== undefined) return false;
  const collation = decl.options.collation;
  if (collation) {
    if (!found.collation || found.collation.locale !== collation.locale) return false;
    if (collation.strength !== undefined && found.collation.strength !== collation.strength) return false;
  }
  return true;
};

const isDuplicateKey = (err: unknown): boolean => {
  const e = err as { code?: unknown; codeName?: unknown } | null;
  return e?.code === 11000 || e?.codeName === 'DuplicateKey';
};

const defaultModels = (): BuildableModel[] => {
  // getUniqueIndexRegistry() loads every model module and attaches the index monitors.
  getUniqueIndexRegistry();
  return mongoose
    .modelNames()
    .sort()
    .map((name) => mongoose.model(name) as unknown as BuildableModel);
};

const summarize = (unique: UniqueBuildResult[]): IndexSummary => {
  const count = (status: IndexStatus) => unique.filter((entry) => entry.status === status).length;
  return {
    total: unique.length,
    enforced: count('enforced'),
    blockedByDuplicates: count('blocked-by-duplicates'),
    buildFailed: count('build-failed'),
    unknown: count('unknown'),
  };
};

/**
 * Build the indexes, skipping every unique index the preflight did not clear. Never throws. Order: for every
 * model (by name) its unique indexes, each verified; then every non-unique index of every model.
 */
export const runGatedIndexBuild = async (options: GatedBuildOptions = {}): Promise<GatedBuildResult> => {
  const log = options.log ?? console;
  const now = options.now ?? Date.now;
  const preflightRan = options.preflightRan !== false;
  const startedAt = new Date(now()).toISOString();
  const unique: UniqueBuildResult[] = [];
  const other = { built: 0, failed: 0 };

  setIndexBuildPhase('building');
  resetGatedResults();

  const verdicts = new Map<string, 'clean' | 'duplicates' | 'unknown'>();
  for (const spec of options.report?.specs ?? []) verdicts.set(spec.name, spec.status);

  const record = (model: string, index: string, status: IndexStatus, detail?: string) => {
    unique.push({ name: `${model}.${index}`, model, index, status, ...(detail ? { detail } : {}) });
    recordGatedResult(model, index, status, detail);
  };

  let models: BuildableModel[] = [];
  try {
    models = options.models ?? defaultModels();
  } catch (err) {
    log.error(`[indexes] gated build could not list the models (${describeIndexError(err).text}); no index was built.`);
  }

  const plans = models.map((model) => {
    let declared: Declared[] = [];
    try {
      declared = declaredIndexes(model);
    } catch (err) {
      log.error(`[indexes] could not read the indexes of ${model.modelName} (${describeIndexError(err).text}); none were built.`);
    }
    return { model, declared };
  });

  // Pass 1: unique indexes, only where the preflight cleared them.
  for (const { model, declared } of plans) {
    const built: Declared[] = [];
    for (const decl of declared.filter((d) => d.unique)) {
      const name = `${model.modelName}.${decl.name}`;
      const verdict = preflightRan ? verdicts.get(name) ?? 'unknown' : 'clean';
      if (verdict === 'duplicates') {
        record(model.modelName, decl.name, 'blocked-by-duplicates', 'not built: duplicate data (see the preflight error above)');
        log.error(`[indexes] NOT BUILT: ${name} is blocked by duplicate data; resolve it manually (ids are in the preflight error), then restart.`);
        continue;
      }
      if (verdict === 'unknown') {
        record(model.modelName, decl.name, 'unknown', 'not built: the duplicate check did not complete');
        log.warn(`[indexes] NOT BUILT: ${name} - the duplicate check did not complete, so it is not built (fail closed). Re-run after raising INDEX_PREFLIGHT_TIMEOUT_MS.`);
        continue;
      }
      try {
        await model.createIndexes({ toCreate: [[decl.fields, decl.options]] });
        built.push(decl);
      } catch (err) {
        const text = describeIndexError(err).text;
        const detail = isDuplicateKey(err) ? `duplicate key while building (data changed since the preflight): ${text}` : text;
        record(model.modelName, decl.name, 'build-failed', detail);
        log.error(
          `[indexes] INDEX BUILD FAILED: ${name} - ${detail}. Uniqueness is NOT enforced for it until this is resolved ` +
            '(run `npm run check:indexes` against a restored copy to list conflicting ids), then restart.'
        );
      }
    }
    if (built.length === 0) continue;
    // Enforced only when the collection itself shows the index with the expected options.
    let listing: any[] | undefined;
    try {
      listing = await model.collection.indexes();
    } catch (err) {
      listing = undefined;
      log.warn(`[indexes] could not list the indexes of ${model.modelName} to verify them (${describeIndexError(err).text}).`);
    }
    for (const decl of built) {
      if (listing && indexListingMatches(listing, decl)) record(model.modelName, decl.name, 'enforced');
      else {
        record(model.modelName, decl.name, 'unknown', listing ? 'built, but the index list does not show it as expected' : 'built, but could not be verified');
        log.warn(`[indexes] ${model.modelName}.${decl.name} was built but could not be verified; it is reported as not enforced.`);
      }
    }
  }

  // Pass 2: every non-unique index (performance, TTL, collations). They cannot be blocked by duplicates.
  for (const { model, declared } of plans) {
    for (const decl of declared.filter((d) => !d.unique)) {
      try {
        await model.createIndexes({ toCreate: [[decl.fields, decl.options]] });
        other.built += 1;
        recordOtherIndexResult(true);
      } catch (err) {
        other.failed += 1;
        recordOtherIndexResult(false);
        log.warn(`[indexes] could not build ${model.modelName}.${decl.name} (${describeIndexError(err).text}); queries stay correct but may be slower.`);
      }
    }
  }

  const summary = summarize(unique);
  setIndexBuildPhase('complete');
  log.info(
    `[indexes] gated build finished: unique enforced ${summary.enforced}/${summary.total}, blocked by duplicates ${summary.blockedByDuplicates}, ` +
      `failed ${summary.buildFailed}, unknown ${summary.unknown}; other indexes built ${other.built}, failed ${other.failed}.`
  );
  return { startedAt, finishedAt: new Date(now()).toISOString(), unique, summary, otherIndexes: other };
};

let inFlight: Promise<unknown> | undefined;

/** Test seams for the two steps; the defaults are the real preflight and the real build. */
export interface StartupIndexDeps {
  preflight?: (env: NodeJS.ProcessEnv) => Promise<PreflightReport | undefined>;
  build?: (options: GatedBuildOptions) => Promise<GatedBuildResult>;
}

export interface StartupIndexOutcome {
  mode: IndexBuildMode;
  report?: PreflightReport;
  build?: GatedBuildResult;
}

/**
 * Preflight, then (gated mode) the build. Never throws. Re-runnable: call it again to re-check and
 * re-build; a call made while one is running joins it.
 *   auto  : today's behaviour. Mongoose builds the indexes itself; the preflight only reports.
 *   gated : preflight -> explicit build -> verified state. INDEX_PREFLIGHT=off builds every index UNCHECKED.
 */
export const runStartupIndexes = (
  env: NodeJS.ProcessEnv = process.env,
  deps: StartupIndexDeps = {}
): Promise<StartupIndexOutcome> => {
  if (inFlight) return inFlight as Promise<StartupIndexOutcome>;
  const preflight = deps.preflight ?? runStartupIndexPreflight;
  const build = deps.build ?? runGatedIndexBuild;
  const work = (async (): Promise<StartupIndexOutcome> => {
    const mode = readIndexBuildMode(env);
    setIndexBuildMode(mode);
    try {
      if (mode === 'auto') {
        setIndexBuildPhase('preflight');
        const report = await preflight(env);
        setIndexBuildPhase('complete');
        return { mode, report };
      }
      setIndexBuildPhase('preflight');
      const config = readPreflightConfig(env);
      const report = await preflight(env);
      if (!config.enabled) {
        console.warn('[indexes] INDEX_PREFLIGHT=off: unique indexes are built UNCHECKED; a build that meets duplicate data fails and is reported.');
      }
      const result = await build({ report, preflightRan: config.enabled });
      return { mode, report, build: result };
    } catch (err) {
      console.error(`[indexes] index startup failed (${describeIndexError(err).text}); unique indexes are reported as not enforced.`);
      setIndexBuildPhase('complete');
      return { mode };
    }
  })();
  inFlight = work;
  const clear = () => {
    if (inFlight === work) inFlight = undefined;
  };
  work.then(clear, clear);
  return work;
};

/** Resolve with `done: false` if `work` is still running after `ms`. The timer never keeps the process alive. */
export const waitUpTo = <T>(work: Promise<T>, ms: number): Promise<{ done: boolean; value?: T }> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ done: false }), Math.max(0, ms));
    if (typeof timer.unref === 'function') timer.unref();
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve({ done: true, value });
      },
      () => {
        clearTimeout(timer);
        resolve({ done: true });
      }
    );
  });

/**
 * The startup step: run the preflight + build and wait for it, bounded by INDEX_BUILD_WAIT_MS. If it is
 * still running the server starts listening anyway; /api/ready then says `indexesEnforced: false` until
 * every unique index is verified. Never throws.
 */
export const runStartupIndexStep = async (env: NodeJS.ProcessEnv = process.env, deps: StartupIndexDeps = {}): Promise<void> => {
  const work = runStartupIndexes(env, deps);
  const waited = await waitUpTo(work, readIndexBuildWaitMs(env));
  if (!waited.done) {
    console.warn(
      `[indexes] index build still running after ${readIndexBuildWaitMs(env)} ms; the server starts now and /api/ready reports indexesEnforced:false until it finishes.`
    );
  }
};

/**
 * Called BEFORE connecting: attach the index monitors and fix the mode, so connectDatabase() opens the
 * connection with the right autoIndex and no 'index' event is missed.
 */
export const prepareIndexBuild = (env: NodeJS.ProcessEnv = process.env): IndexBuildMode => {
  const mode = readIndexBuildMode(env);
  setIndexBuildMode(mode);
  try {
    getUniqueIndexRegistry();
  } catch (err) {
    console.error(`[indexes] could not attach the index monitors (${describeIndexError(err).text}).`);
  }
  const raw = String(env.INDEX_BUILD_MODE || '').trim();
  if (raw && raw.toLowerCase() !== 'auto' && raw.toLowerCase() !== 'gated') {
    console.warn(`[indexes] INDEX_BUILD_MODE is not auto or gated; using ${mode}.`);
  }
  console.info(
    mode === 'gated'
      ? '[indexes] build mode: gated (autoIndex off; indexes are built after the duplicate preflight).'
      : '[indexes] build mode: auto (Mongoose builds the indexes itself; the preflight only reports).'
  );
  return mode;
};

