import mongoose, { ClientSession } from 'mongoose';
import { RECONCILIATION_MESSAGE, ReconciliationRequiredError, describeReason, reportFailedUndoSteps } from './reconciliation';

/**
 * All-or-nothing money flows that work on any MongoDB topology.
 *
 * The cluster may be a standalone server (no multi-document transactions) or a replica set / mongos
 * (transactions available). Code written for one must not break on the other, so:
 *
 *   - replica set or mongos  -> `fn` runs inside `session.withTransaction`; every write that passes
 *                               `{ session }` commits or rolls back together.
 *   - anything else          -> `fn` runs with `session === undefined` and NO transaction. The flow
 *                               is still correct because it uses atomic operators + idempotent claims
 *                               and registers an explicit undo for each step on the `comp` stack. If a
 *                               later step throws, the undos run in reverse order (best effort) and a
 *                               failed undo is surfaced as an error instead of being swallowed.
 *
 * Writers must therefore ALWAYS do both: pass `{ session }` (undefined-safe) AND `comp.push(...)` an
 * undo after each step. Inside a real transaction the undos are not used (the abort rolls everything
 * back), so they never run twice.
 *
 * `fn` may be invoked more than once on a replica set (the driver retries transient transaction
 * errors), so it must keep no state outside what it creates per call.
 *
 * Which path is taken is decided per call from the driver's topology description (`detectTransactionMode`):
 * nothing is cached, a topology that is not discovered yet counts as "no transactions" for that call only,
 * MONGO_TRANSACTIONS=off forces the compensated path, and a server that rejects transactions at runtime
 * (code 20 "Transaction numbers are only allowed...") falls back to the compensated path ONLY if no step had
 * run in the aborted attempt. The active mode is logged once (`logTransactionMode`), without any host or URI.
 *
 * When an undo fails the failure is recorded through utils/reconciliation.ts (log line + durable
 * ReconciliationIssue) and the caller gets a CompensationFailedError whose message says the record needs
 * administrator review. Pass `reconcile: { entity, entityId, tenantId }` so the record names what to review.
 */

export type StepUndo = () => Promise<unknown>;

/** Reverse-order undo stack for the non-transactional path. */
export class Compensations {
  private steps: Array<{ label: string; undo: StepUndo }> = [];
  private failedUndos: Array<{ label: string; error: unknown }> = [];

  /** Register how to undo the step that just succeeded. */
  push(label: string, undo: StepUndo): void {
    this.steps.push({ label, undo });
  }

  reset(): void {
    this.steps = [];
    this.failedUndos = [];
  }

  get size(): number {
    return this.steps.length;
  }

  /** Labels of the registered steps, oldest first. */
  get labels(): string[] {
    return this.steps.map((step) => step.label);
  }

  /** The undos that failed in the last rollback, with the error each raised. */
  get failures(): ReadonlyArray<{ label: string; error: unknown }> {
    return this.failedUndos;
  }

  /** Run every undo, newest first. A failing undo does not stop the rest. Returns labels that failed. */
  async rollback(): Promise<string[]> {
    const failed: string[] = [];
    this.failedUndos = [];
    const steps = this.steps.splice(0).reverse();
    for (const step of steps) {
      try {
        await step.undo();
      } catch (err) {
        failed.push(step.label);
        this.failedUndos.push({ label: step.label, error: err });
        // Class and a scrubbed message only: a driver error can carry a key value.
        console.error(`[compensation] could not undo "${step.label}": ${describeReason(err)}`);
      }
    }
    return failed;
  }
}

/**
 * Thrown when an operation failed AND at least one undo step also failed: the data may need a look.
 * Its message tells the user the record needs administrator review (RECONCILIATION_MESSAGE); the failure
 * is recorded through utils/reconciliation.ts by runAtomic before this is thrown.
 */
export class CompensationFailedError extends ReconciliationRequiredError {
  constructor(original: unknown, failedSteps: string[], description?: string) {
    super(original, failedSteps);
    this.name = 'CompensationFailedError';
    // The structured [RECONCILIATION REQUIRED] line and the durable record come from
    // reportReconciliationRequired (runAtomic calls it for every failed step).
    console.error(
      `[compensation] ${description || 'operation'} failed and these undo steps also failed: ${failedSteps.join(', ')}`
    );
  }
}

export { RECONCILIATION_MESSAGE };

interface ConnectionLike {
  readyState?: number;
  getClient?: () => any;
  startSession?: () => Promise<any>;
}

// ---------------------------------------------------------------------------------------------------
// Topology detection
// ---------------------------------------------------------------------------------------------------

export type TransactionMode = 'enabled' | 'disabled' | 'unknown';

export type TransactionModeReason =
  | 'replica-set'
  | 'sharded'
  | 'standalone'
  | 'load-balanced'
  | 'forced-off'
  | 'runtime-rejected'
  | 'not-connected'
  | 'no-primary'
  | 'topology-unknown';

export interface TransactionModeInfo {
  /** enabled: use transactions. disabled: a definitive "no" for now. unknown: not discovered yet (treated as "no" for that call). */
  mode: TransactionMode;
  reason: TransactionModeReason;
}

/** A server that refused a transaction at runtime is not asked again for this long. */
const RUNTIME_REJECT_BACKOFF_MS = 60_000;
const runtimeRejected = new WeakMap<object, number>();

const serverTypes = (description: any): string[] => {
  const servers = description?.servers;
  if (!servers) return [];
  const values: any[] = typeof servers.values === 'function' ? Array.from(servers.values()) : Object.values(servers);
  return values.map((server) => String(server?.type));
};

/**
 * What the connection can do RIGHT NOW. Pure and cheap: nothing about the topology is cached, so a
 * topology that is not discovered yet is simply re-checked on the next call and a wrong "standalone"
 * answer can never stick.
 *
 *   replica set with a primary, sharded cluster (mongos), or a direct connection to a primary / mongos
 *       -> enabled
 *   standalone server, load balancer, MONGO_TRANSACTIONS=off, a server that refused a transaction recently
 *       -> disabled
 *   not connected yet, topology not discovered yet, replica set mid-election (no primary)
 *       -> unknown (the caller runs the compensated path for this call only)
 */
export const detectTransactionMode = (
  connection: ConnectionLike = mongoose.connection,
  now: number = Date.now()
): TransactionModeInfo => {
  if (String(process.env.MONGO_TRANSACTIONS || '').trim().toLowerCase() === 'off') {
    return { mode: 'disabled', reason: 'forced-off' };
  }
  try {
    const rejectedAt = runtimeRejected.get(connection as object);
    if (rejectedAt !== undefined && now - rejectedAt < RUNTIME_REJECT_BACKOFF_MS) {
      return { mode: 'disabled', reason: 'runtime-rejected' };
    }
    if (connection.readyState !== 1) return { mode: 'unknown', reason: 'not-connected' };
    const description = connection.getClient?.()?.topology?.description;
    switch (description?.type) {
      case 'ReplicaSetWithPrimary':
        return { mode: 'enabled', reason: 'replica-set' };
      case 'Sharded':
        return { mode: 'enabled', reason: 'sharded' };
      case 'LoadBalanced':
        return { mode: 'disabled', reason: 'load-balanced' };
      case 'ReplicaSetNoPrimary':
        return { mode: 'unknown', reason: 'no-primary' };
      case 'Single': {
        const servers = serverTypes(description);
        if (servers.includes('RSPrimary')) return { mode: 'enabled', reason: 'replica-set' };
        if (servers.includes('Mongos')) return { mode: 'enabled', reason: 'sharded' };
        // A single server that has not answered yet is not yet known to be a standalone one.
        if (servers.length > 0 && servers.every((t) => t === 'Unknown')) return { mode: 'unknown', reason: 'topology-unknown' };
        return { mode: 'disabled', reason: 'standalone' };
      }
      default:
        return { mode: 'unknown', reason: 'topology-unknown' };
    }
  } catch {
    return { mode: 'unknown', reason: 'topology-unknown' };
  }
};

/** True only when transactions will be used for this call. */
export const supportsTransactions = (connection: ConnectionLike = mongoose.connection): boolean =>
  detectTransactionMode(connection).mode === 'enabled';

const DISABLED_SUFFIX = 'financial flows rely on atomic updates, idempotency keys and compensation';
const MODE_MESSAGES: Partial<Record<TransactionModeReason, string>> = {
  'replica-set': 'MongoDB transactions: ENABLED (replica set)',
  sharded: 'MongoDB transactions: ENABLED (sharded cluster / mongos)',
  standalone: `MongoDB transactions: DISABLED (standalone: ${DISABLED_SUFFIX})`,
  'load-balanced': `MongoDB transactions: DISABLED (load-balanced deployment: ${DISABLED_SUFFIX})`,
  'forced-off': `MongoDB transactions: DISABLED (MONGO_TRANSACTIONS=off: ${DISABLED_SUFFIX})`,
  'runtime-rejected': `MongoDB transactions: DISABLED (the server rejected a transaction: ${DISABLED_SUFFIX})`,
};

let lastLoggedReason: string | undefined;
let loggedUnknown = false;

/**
 * Log which mode is active, once per change (never a URI or host). Called at startup and by every
 * runAtomic, so a topology that was not discovered at startup is reported as soon as it is known.
 */
export const logTransactionMode = (
  connection: ConnectionLike = mongoose.connection,
  log: Pick<Console, 'info' | 'warn'> = console
): TransactionModeInfo => {
  const info = detectTransactionMode(connection);
  if (info.mode === 'unknown') {
    if (!loggedUnknown) {
      loggedUnknown = true;
      log.warn(
        'MongoDB transactions: UNDETERMINED (topology not discovered yet; the compensated path is used until it is known)'
      );
    }
    return info;
  }
  if (info.reason !== lastLoggedReason) {
    lastLoggedReason = info.reason;
    log.info(MODE_MESSAGES[info.reason] || `MongoDB transactions: ${info.mode.toUpperCase()}`);
  }
  return info;
};

/** Forget what was logged, and any runtime rejection of the given connection (tests only). */
export const resetTransactionModeState = (connection?: object): void => {
  lastLoggedReason = undefined;
  loggedUnknown = false;
  if (connection) runtimeRejected.delete(connection);
};

/** The server rejected the transaction itself ("Transaction numbers are only allowed on a replica set member or mongos"). */
export const isTransactionUnsupported = (err: unknown): boolean => {
  const e = err as { code?: number; codeName?: string; message?: string };
  const message = String(e?.message);
  return (
    (e?.code === 20 && /transaction/i.test(message)) ||
    (e?.codeName === 'IllegalOperation' && /transaction numbers/i.test(message)) ||
    /transaction numbers are only allowed on a replica set member or mongos/i.test(message)
  );
};

export interface AtomicOptions {
  /** For log lines only (and the issue's flow when `reconcile.flow` is not given). */
  description?: string;
  /** Test seam: a connection-like object. Defaults to the mongoose connection. */
  connection?: ConnectionLike;
  /**
   * What the record is, so a failed undo is stored as a ReconciliationIssue for the right Mahallu and
   * record. Without it the issue is still logged and stored, but under the description and the entity id
   * 'unknown'.
   */
  reconcile?: { flow?: string; entity: string; entityId?: unknown; tenantId?: unknown };
}

const reconciliationBase = (options: AtomicOptions) => ({
  flow: options.reconcile?.flow || options.description || 'unknown flow',
  entity: options.reconcile?.entity || 'unknown',
  entityId: options.reconcile?.entityId,
  tenantId: options.reconcile?.tenantId,
});

/**
 * Run `fn` atomically where the cluster allows it, and compensated where it does not. See file header.
 * `fn` receives the session (or undefined) and the compensation stack.
 */
export async function runAtomic<T>(
  fn: (session: ClientSession | undefined, comp: Compensations) => Promise<T>,
  options: AtomicOptions = {}
): Promise<T> {
  const comp = new Compensations();
  const connection = options.connection ?? mongoose.connection;

  if (logTransactionMode(connection).mode === 'enabled') {
    let session: any;
    try {
      session = await (connection as any).startSession();
      let result!: T;
      await session.withTransaction(async () => {
        comp.reset();
        result = await fn(session as ClientSession, comp);
      });
      return result;
    } catch (err) {
      if (!isTransactionUnsupported(err)) throw err;
      // The server cannot run transactions after all (the topology looked right, the server disagrees).
      if (comp.size > 0) {
        // A step already ran inside the aborted attempt. Writes made through the session were rolled
        // back, but a step that did not use the session may have stuck, and replaying the undo list could
        // undo something that was rolled back. So do not guess, do not run it again: hand it to an admin.
        console.error(`[transaction] ${options.description || 'operation'}: transaction rejected after a step had run; not retried.`);
        const labels = comp.labels;
        await reportFailedUndoSteps(
          { ...reconciliationBase(options), reason: err, state: { stepsDone: labels.join(' > ') } },
          labels.map((label) => `${label} (transaction rejected)`)
        );
        throw new CompensationFailedError(err, labels, options.description);
      }
      // Nothing ran inside the attempt, so running `fn` again without a transaction is safe.
      runtimeRejected.set(connection as object, Date.now());
      console.warn(`[transaction] ${options.description || 'operation'}: transactions unavailable, running compensated.`);
      logTransactionMode(connection);
    } finally {
      if (session) {
        try {
          await session.endSession();
        } catch {
          /* ending a session is best effort */
        }
      }
    }
  }

  comp.reset();
  try {
    return await fn(undefined, comp);
  } catch (err) {
    // Remember which steps had completed (oldest first) so an administrator can see what to check.
    const stepsDone = comp.labels;
    const failed = await comp.rollback();
    if (failed.length > 0) {
      const base = {
        ...reconciliationBase(options),
        state: { stepsDone: stepsDone.join(' > '), undoFailed: failed.join(' | ') },
      };
      await Promise.all(
        comp.failures.map((failure) =>
          reportFailedUndoSteps(
            { ...base, reason: `undo failed (${describeReason(failure.error)}) after: ${describeReason(err)}` },
            [failure.label]
          )
        )
      );
      throw new CompensationFailedError(err, failed, options.description);
    }
    throw err;
  }
}
