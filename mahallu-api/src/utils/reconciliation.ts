import mongoose from 'mongoose';
import type { Response } from 'express';
import { ReconciliationIssue } from '../models/ReconciliationIssue';
import { UserFacingError } from './userMessages';

/**
 * "An undo failed": the one place that records it.
 *
 * Money flows are several writes in a row (wallet, journal, ledger, the payment itself). When a later
 * step fails the earlier ones are undone; when an UNDO fails too, the data may be half-written and a
 * person has to look. `reportReconciliationRequired`:
 *
 *   1. writes ONE structured JSON line, `[RECONCILIATION REQUIRED] {...}`, with ids, the flow and step
 *      and a short scrubbed error class + message (no secrets, no phone numbers, no e-mail addresses);
 *   2. persists a durable `ReconciliationIssue` (the log is lost on restart, the record is not), as a
 *      best-effort write that cannot throw into the caller and is time-limited so it never delays the
 *      original error response;
 *   3. is idempotent per (tenant, flow, entity id, step) while the issue is open (an upsert guarded by a
 *      partial unique index), so a retry storm produces one record with a counter.
 *
 * The caller must then answer with an explicit error that tells the user the record needs administrator
 * review (`ReconciliationRequiredError` / `sendReconciliationRequired`), never a success.
 *
 * This module must not import utils/transaction.ts (transaction.ts imports this one).
 */

export const RECONCILIATION_MESSAGE =
  "We couldn't finish this action, and part of it could not be undone automatically. " +
  'This record needs administrator review: please check the record before using or retrying it, and contact your administrator.';

/** An operation failed and its undo failed too. Its message is shown to the user as-is. */
export class ReconciliationRequiredError extends UserFacingError {
  readonly reconciliationRequired = true;
  readonly failedSteps: string[];
  readonly originalError: unknown;

  constructor(original: unknown, failedSteps: string[] = []) {
    super(RECONCILIATION_MESSAGE, 500);
    this.name = 'ReconciliationRequiredError';
    this.failedSteps = failedSteps;
    this.originalError = original;
  }
}

/** Answer 500 with the administrator-review message (for handlers that answer directly). */
export const sendReconciliationRequired = (res: Response): Response =>
  res.status(500).json({ success: false, reconciliationRequired: true, message: RECONCILIATION_MESSAGE });

// ---------------------------------------------------------------------------------------------------
// Scrubbing: defensive, so that whatever an error message or state holds, the log and the record do not
// carry contact details or credentials.
// ---------------------------------------------------------------------------------------------------

const MAX_REASON = 200;
const MAX_STATE_KEYS = 20;
const MAX_STATE_VALUE = 120;
const SENSITIVE_STATE_KEY = /phone|mobile|email|name|password|passwd|secret|token|address|aadhaar|otp|authorization|cookie/i;

export const scrubText = (input: unknown, max = MAX_REASON): string => {
  let text = String(input ?? '');
  // A 24-character ObjectId is set aside first: it must stay readable, and a run of digits inside it must not
  // be taken for a phone number.
  const ids: string[] = [];
  text = text.replace(/\b[a-fA-F0-9]{24}\b/g, (id) => `\u0001${ids.push(id) - 1}\u0001`);
  text = text
    .replace(/\bmongodb(?:\+srv)?:\/\/\S+/gi, '[uri]')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+@\S+/gi, '[uri]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g, '[token]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [token]')
    // "Authorization: Basic <credentials>" / "Authorization: Bearer [token]": the scheme AND the credential go
    .replace(/\bauthorization\b\s*[:=]\s*(?:(?:basic|bearer|digest|token)\s+)?\S+/gi, 'authorization=[redacted]')
    .replace(/\b(password|passwd|pwd|secret|token|api[_-]?key|otp)\b\s*[:=]\s*\S+/gi, '$1=[redacted]')
    // phone-like digit runs, also when glued to a word ("mobile9876543210")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '[number]')
    // long opaque strings (keys, hashes)
    .replace(/\b[A-Za-z0-9_+/=-]{32,}\b/g, '[redacted]');
  text = text
    .replace(/\u0001(\d+)\u0001/g, (_m, index) => ids[Number(index)] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
};

/** Driver and validation errors quote the offending VALUES in their message (a duplicate key, a cast value). */
const quotesValues = (err: Error): boolean =>
  /^(Mongo|Bulk|Validation|Cast|Strict|Document)/.test(err.name) ||
  typeof (err as { codeName?: unknown }).codeName === 'string' ||
  typeof (err as { keyValue?: unknown }).keyValue === 'object';

/**
 * "ErrorClass[code]: short scrubbed message". For driver / validation errors the message is dropped
 * (class, code and code name only), because it can quote a stored value such as a name or a key.
 */
export const describeReason = (reason: unknown): string => {
  if (reason instanceof Error) {
    const cls = reason.name && reason.name !== 'Error' ? reason.name : reason.constructor?.name || 'Error';
    const code = (reason as { code?: unknown }).code;
    const head = code !== undefined && (typeof code === 'number' || /^[A-Z0-9_]{2,30}$/i.test(String(code))) ? `${cls}[${code}]` : cls;
    if (quotesValues(reason)) {
      const codeName = (reason as { codeName?: unknown }).codeName;
      return typeof codeName === 'string' ? `${head} ${scrubText(codeName, 40)}` : head;
    }
    const message = scrubText(reason.message, MAX_REASON - head.length - 2);
    return message ? `${head}: ${message}` : head;
  }
  if (reason === undefined || reason === null) return 'unknown error';
  return scrubText(reason);
};

type StateValue = string | number | boolean | null;

export const scrubState = (state: unknown): Record<string, StateValue> | undefined => {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return undefined;
  const out: Record<string, StateValue> = {};
  for (const [key, value] of Object.entries(state as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_STATE_KEYS) break;
    if (!/^[A-Za-z0-9_.-]{1,40}$/.test(key) || SENSITIVE_STATE_KEY.test(key)) continue;
    if (value === null || typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number') out[key] = Number.isFinite(value) ? value : null;
    else if (typeof value === 'string') out[key] = scrubText(value, MAX_STATE_VALUE);
    else if (typeof (value as { toHexString?: unknown })?.toHexString === 'function') out[key] = String(value);
  }
  return Object.keys(out).length ? out : undefined;
};

const HEX_ID = /^[a-fA-F0-9]{24}$/;
const SAFE_ID = /^[\w:.-]{1,64}$/;

const cleanLabel = (value: unknown, fallback: string, max: number): string => {
  const text = scrubText(value, max).replace(/[^\w :./()+-]/g, '').trim();
  return text || fallback;
};

export interface ReconciliationInput {
  /** The business flow, e.g. 'salary create' or 'varisangya verify'. */
  flow: string;
  /** The kind of record, e.g. 'SalaryPayment'. */
  entity: string;
  /** The record's id (ObjectId text). Anything that is not a plain id is replaced by 'unknown'. */
  entityId?: unknown;
  tenantId?: unknown;
  /** The undo step that failed, e.g. 'wallet credit'. */
  step: string;
  /** The error that made the undo necessary or that the undo raised. Error object or text. */
  reason?: unknown;
  /** Small flat map describing what is half-done (ids, amounts). Contact-like keys are dropped. */
  state?: unknown;
}

export interface ReconciliationRecord {
  flow: string;
  entity: string;
  entityId: string;
  tenantId?: string;
  step: string;
  reason: string;
  state?: Record<string, StateValue>;
}

export const buildReconciliationRecord = (input: ReconciliationInput): ReconciliationRecord => {
  const rawId = input.entityId === undefined || input.entityId === null ? '' : String(input.entityId);
  const rawTenant = input.tenantId === undefined || input.tenantId === null ? '' : String(input.tenantId);
  const state = scrubState(input.state);
  return {
    flow: cleanLabel(input.flow, 'unknown flow', 120),
    entity: cleanLabel(input.entity, 'unknown', 80),
    entityId: SAFE_ID.test(rawId) ? rawId : 'unknown',
    ...(HEX_ID.test(rawTenant) ? { tenantId: rawTenant } : {}),
    step: cleanLabel(input.step, 'unknown step', 120),
    reason: describeReason(input.reason),
    ...(state ? { state } : {}),
  };
};

export interface ReconciliationDeps {
  /** Test seam: the model to persist with. */
  model?: Pick<typeof ReconciliationIssue, 'findOneAndUpdate'>;
  /** Test seam: is the database usable? Defaults to the Mongoose connection state. */
  isConnected?: () => boolean;
  /** Persist time limit in ms (default 3000). */
  timeoutMs?: number;
}

const withTimeout = <T>(work: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
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

/** Open-or-bump the one OPEN record for this failing step. */
const upsertIssue = async (model: NonNullable<ReconciliationDeps['model']>, record: ReconciliationRecord): Promise<void> => {
  const filter = {
    tenantId: record.tenantId ?? null,
    flow: record.flow,
    entityId: record.entityId,
    step: record.step,
    status: 'open',
  };
  const bump = { $set: { reason: record.reason, lastSeenAt: new Date() }, $inc: { occurrences: 1 } };
  try {
    await (model as any).findOneAndUpdate(
      filter,
      { ...bump, $setOnInsert: { entity: record.entity, ...(record.state ? { state: record.state } : {}) } },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Two reports raced to insert the same open record: the loser just bumps the winner's counter.
    if ((err as { code?: number })?.code !== 11000) throw err;
    await (model as any).findOneAndUpdate(filter, bump, { new: true });
  }
};

/**
 * Record that an undo failed. Never throws and never waits long: the caller's own error path continues.
 * Resolves with whether the durable record was written.
 */
export async function reportReconciliationRequired(
  input: ReconciliationInput,
  deps: ReconciliationDeps = {}
): Promise<{ logged: boolean; persisted: boolean }> {
  let record: ReconciliationRecord;
  try {
    record = buildReconciliationRecord(input);
  } catch {
    console.error('[RECONCILIATION REQUIRED] {"flow":"unknown","note":"a failed undo could not be described"}');
    return { logged: true, persisted: false };
  }

  try {
    console.error(`[RECONCILIATION REQUIRED] ${JSON.stringify({ ...record, at: new Date().toISOString() })}`);
  } catch {
    /* logging must not throw either */
  }

  try {
    const connected = deps.isConnected ? deps.isConnected() : mongoose.connection.readyState === 1;
    if (!connected) {
      console.error('[reconciliation] database not connected: the issue was logged but not stored.');
      return { logged: true, persisted: false };
    }
    await withTimeout(upsertIssue(deps.model ?? ReconciliationIssue, record), deps.timeoutMs ?? 3000);
    return { logged: true, persisted: true };
  } catch (err) {
    // Class only: the driver message can hold a key value.
    console.error(`[reconciliation] could not store the issue (${(err as Error)?.name || 'Error'}); the log line above is the only record.`);
    return { logged: true, persisted: false };
  }
}

/** One report per failed undo step (all awaited together; never throws). */
export async function reportFailedUndoSteps(
  base: Omit<ReconciliationInput, 'step'>,
  steps: string[],
  deps?: ReconciliationDeps
): Promise<void> {
  await Promise.all(steps.map((step) => reportReconciliationRequired({ ...base, step }, deps)));
}

export interface UndoStep {
  label: string;
  undo: () => Promise<unknown>;
}

/**
 * Run undo steps one after the other (a failing step does not stop the rest). Every step that fails is
 * reported through `reportReconciliationRequired`. Returns the labels that failed, so the handler can
 * answer with `sendReconciliationRequired` / `ReconciliationRequiredError` instead of a success or a
 * plain error. `cause` is the error that made the undo necessary.
 */
export async function runUndos(
  base: Omit<ReconciliationInput, 'step' | 'reason'>,
  steps: UndoStep[],
  cause?: unknown,
  deps?: ReconciliationDeps
): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  for (const step of steps) {
    try {
      await step.undo();
    } catch (err) {
      failed.push(step.label);
      await reportReconciliationRequired(
        { ...base, step: step.label, reason: `undo failed (${describeReason(err)}) after: ${describeReason(cause)}` },
        deps
      );
    }
  }
  return { failed };
}
