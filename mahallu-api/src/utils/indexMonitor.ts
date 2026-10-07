import type { Model } from 'mongoose';

/**
 * Whether each UNIQUE index the code declares really exists in the database.
 *
 * The app declares unique indexes in the models and relies on them (receipt numbers, Mahallu ids, case
 * numbers, idempotency keys, ledger postings...). MongoDB refuses to build a unique index over data that
 * already holds duplicates, and Mongoose reports that only through the model's 'index' event. Without a
 * monitor the app would carry on and look as if uniqueness were guaranteed when it is not.
 *
 * This module is the single place that remembers the answer:
 *
 *   enforced               the build finished without error
 *   blocked-by-duplicates  the startup preflight (services/indexPreflight.ts) found duplicate keys, so
 *                          the build cannot succeed until somebody resolves them
 *   build-failed           Mongoose reported an error while building it
 *   unknown                nothing known yet (build not finished, autoIndex off, preflight not run)
 *
 * Nothing here talks to the database and nothing here logs a document value: only model and index names,
 * the error class and the driver error code.
 */

export type IndexStatus = 'enforced' | 'blocked-by-duplicates' | 'build-failed' | 'unknown';

export interface IndexStateEntry {
  model: string;
  index: string;
  fields: string[];
  status: IndexStatus;
  /** Short, non-sensitive detail (error class / duplicate group count). Never a document value. */
  detail?: string;
}

interface BuildResult {
  ok: boolean;
  /** The index named by the driver error, when it could be read from it. */
  failedIndex?: string;
  detail?: string;
}

const monitored = new Map<string, Model<any>>();
const attached = new WeakSet<object>();
const builds = new Map<string, BuildResult>();
const preflight = new Map<string, { result: 'clean' | 'duplicates' | 'error'; groups: number }>();

/**
 * How the unique indexes are built (services/indexBuild.ts):
 *   auto   Mongoose builds every index itself when the connection opens (development / test). The state
 *          comes from Mongoose's 'index' events, as before.
 *   gated  autoIndex is OFF. The server builds the indexes explicitly AFTER the duplicate preflight, and
 *          records the outcome of each unique index here (recordGatedResult). In this mode the 'index'
 *          events are ignored: a model's event says nothing about a spec that was deliberately skipped.
 */
export type IndexBuildMode = 'auto' | 'gated';
export type IndexBuildPhase = 'pending' | 'preflight' | 'building' | 'complete';

let buildMode: IndexBuildMode = 'auto';
let buildPhase: IndexBuildPhase = 'pending';
const gatedResults = new Map<string, { status: IndexStatus; detail?: string }>();
/** Non-unique (performance, TTL) indexes the gated build tried: counts only, never names in a response. */
const otherIndexes = { built: 0, failed: 0 };

const key = (model: string, index: string) => `${model}|${index}`;

/** MongoDB's default index name: `tenantId_1_mahallId_1`. */
export const indexNameOf = (fields: Record<string, unknown>, explicit?: unknown): string =>
  typeof explicit === 'string' && explicit
    ? explicit
    : Object.entries(fields)
        .map(([field, direction]) => `${field}_${direction}`)
        .join('_');

export interface UniqueIndexDeclaration {
  index: string;
  fields: string[];
  options: Record<string, any>;
}

/** The unique indexes a model's schema declares (derived, so it cannot drift from the schema). */
export const uniqueIndexesOf = (model: Model<any>): UniqueIndexDeclaration[] => {
  const declared = (model.schema.indexes() || []) as Array<[Record<string, unknown>, Record<string, any> | undefined]>;
  return declared
    .filter(([, options]) => !!options && !!options.unique)
    .map(([fields, options]) => ({
      index: indexNameOf(fields, options?.name),
      fields: Object.keys(fields),
      options: options as Record<string, any>,
    }));
};

/** Error class, driver code and (if present) the index name; never the message, which can hold a key value. */
export const describeIndexError = (err: unknown): { text: string; failedIndex?: string } => {
  const e = err as { name?: string; code?: number | string; codeName?: string; message?: string; errmsg?: string } | null;
  const cls = String(e?.name || 'Error').slice(0, 40);
  const code = e?.code !== undefined ? String(e.code).slice(0, 12) : undefined;
  const codeName = e?.codeName ? String(e.codeName).slice(0, 40) : undefined;
  const source = String(e?.errmsg || e?.message || '');
  const named = /index:\s+([A-Za-z0-9_.$-]{1,128})/.exec(source);
  const parts = [cls, code ? `code ${code}` : undefined, codeName].filter(Boolean);
  return { text: parts.join(' '), failedIndex: named ? named[1] : undefined };
};

/** Handle one 'index' event of a model. Exported so it can be driven directly. */
export const handleIndexEvent = (modelName: string, err?: unknown): void => {
  // Gated mode: the explicit, verified per-index result is the only source of truth.
  if (buildMode === 'gated') return;
  if (!err) {
    builds.set(modelName, { ok: true });
    return;
  }
  const { text, failedIndex } = describeIndexError(err);
  builds.set(modelName, { ok: false, failedIndex, detail: text });
  console.error(
    `[indexes] INDEX BUILD FAILED: ${modelName}${failedIndex ? ` (${failedIndex})` : ''} - ${text}. ` +
      'Uniqueness is NOT enforced for it until this is resolved (usually old duplicate data: run `npm run check:indexes` ' +
      'against a restored copy to list the conflicting ids), then restart.'
  );
};

/**
 * Watch a model's index build. Safe to call more than once for the same model.
 * Every model that declares a unique index is registered by services/indexPreflight.ts at startup;
 * a model may also register itself.
 */
export const registerIndexMonitor = (model: Model<any>): void => {
  monitored.set(model.modelName, model);
  if (attached.has(model)) return;
  attached.add(model);
  model.on('index', (err: unknown) => handleIndexEvent(model.modelName, err));
};

/** The preflight's verdict for one index (called by services/indexPreflight.ts). */
export const recordPreflightResult = (
  model: string,
  index: string,
  result: 'clean' | 'duplicates' | 'error',
  duplicateGroups = 0
): void => {
  preflight.set(key(model, index), { result, groups: duplicateGroups });
};

const statusFor = (modelName: string, decl: UniqueIndexDeclaration): { status: IndexStatus; detail?: string } => {
  if (buildMode === 'gated') {
    const gated = gatedResults.get(key(modelName, decl.index));
    if (gated) return gated;
    const pre = preflight.get(key(modelName, decl.index));
    if (pre?.result === 'duplicates') return { status: 'blocked-by-duplicates', detail: `${pre.groups} duplicate group(s)` };
    return { status: 'unknown' };
  }
  const build = builds.get(modelName);
  if (build?.ok) return { status: 'enforced' };
  const pre = preflight.get(key(modelName, decl.index));
  if (pre?.result === 'duplicates') {
    return { status: 'blocked-by-duplicates', detail: `${pre.groups} duplicate group(s)` };
  }
  if (build && !build.ok && (build.failedIndex === undefined || build.failedIndex === decl.index)) {
    return { status: 'build-failed', detail: build.detail };
  }
  return { status: 'unknown' };
};

/** Per unique index of every monitored model. */
export const getIndexState = (): IndexStateEntry[] => {
  const entries: IndexStateEntry[] = [];
  for (const [modelName, model] of monitored) {
    for (const decl of uniqueIndexesOf(model)) {
      const { status, detail } = statusFor(modelName, decl);
      entries.push({ model: modelName, index: decl.index, fields: decl.fields, status, ...(detail ? { detail } : {}) });
    }
  }
  return entries;
};

/** Counts only (no names, no ids): safe for a readiness response. */
export const getIndexCounts = (): { enforced: number; notEnforced: number } => {
  const state = getIndexState();
  const enforced = state.filter((entry) => entry.status === 'enforced').length;
  return { enforced, notEnforced: state.length - enforced };
};

export interface IndexSummary {
  /** Unique indexes registered with the monitor. */
  total: number;
  enforced: number;
  blockedByDuplicates: number;
  buildFailed: number;
  unknown: number;
}

/** Counts per status, derived from getIndexState(). Counts only: no names, no ids. */
export const getIndexSummary = (): IndexSummary => {
  const state = getIndexState();
  const count = (status: IndexStatus) => state.filter((entry) => entry.status === status).length;
  return {
    total: state.length,
    enforced: count('enforced'),
    blockedByDuplicates: count('blocked-by-duplicates'),
    buildFailed: count('build-failed'),
    unknown: count('unknown'),
  };
};

/**
 * True ONLY when at least one unique index is registered and every registered unique index is enforced.
 * Any blocked, failed or not-yet-verified index makes it false, so readiness never implies enforcement
 * that is not there.
 */
export const areAllIndexesEnforced = (): boolean => {
  const summary = getIndexSummary();
  return summary.total > 0 && summary.enforced === summary.total;
};

/** The readiness view: counts, the boolean, and how/where the build is. Nothing but counts and fixed words. */
export const getIndexReadiness = () => {
  const summary = getIndexSummary();
  return {
    indexesEnforced: summary.total > 0 && summary.enforced === summary.total,
    indexes: { ...summary, notEnforced: summary.total - summary.enforced },
    indexBuild: { mode: buildMode, phase: buildPhase, otherIndexes: { built: otherIndexes.built, failed: otherIndexes.failed } },
  };
};

export const setIndexBuildMode = (mode: IndexBuildMode): void => {
  buildMode = mode;
};
export const getIndexBuildMode = (): IndexBuildMode => buildMode;
export const setIndexBuildPhase = (phase: IndexBuildPhase): void => {
  buildPhase = phase;
};
export const getIndexBuildPhase = (): IndexBuildPhase => buildPhase;

/** The explicit result of one unique index in gated mode (services/indexBuild.ts). */
export const recordGatedResult = (model: string, index: string, status: IndexStatus, detail?: string): void => {
  gatedResults.set(key(model, index), { status, ...(detail ? { detail } : {}) });
};

/** Start of a (re-)run: forget the previous per-index results and counts. */
export const resetGatedResults = (): void => {
  gatedResults.clear();
  otherIndexes.built = 0;
  otherIndexes.failed = 0;
};

export const recordOtherIndexResult = (ok: boolean): void => {
  if (ok) otherIndexes.built += 1;
  else otherIndexes.failed += 1;
};

/** Model names that are registered with the monitor (tests use this). */
export const monitoredModelNames = (): string[] => [...monitored.keys()];

/** Forget everything (tests only). Listeners already attached to models stay attached. */
export const resetIndexState = (): void => {
  builds.clear();
  preflight.clear();
  gatedResults.clear();
  otherIndexes.built = 0;
  otherIndexes.failed = 0;
  buildMode = 'auto';
  buildPhase = 'pending';
};
