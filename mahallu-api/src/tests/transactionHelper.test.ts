import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runAtomic, supportsTransactions, Compensations, CompensationFailedError } from '../utils/transaction';
import { UserFacingError } from '../utils/userMessages';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] transactionHelper', () => {

/**
 * runAtomic: one MongoDB transaction on a replica set / mongos, otherwise a compensated sequence.
 * Uses fake connections for both topologies; no database is touched.
 */

const topology = (type: string, readyState = 1) =>
  ({
    readyState,
    getClient: () => ({ topology: { description: { type } } }),
  }) as any;

/** A replica-set connection whose session runs withTransaction's callback `attempts` times at most. */
const replicaConnection = (opts: { onCommitFail?: Error; retries?: number; started?: string[] } = {}) => {
  const events: string[] = [];
  const session = {
    id: 'session-1',
    async withTransaction(fn: () => Promise<unknown>) {
      events.push('begin');
      const runs = 1 + (opts.retries || 0);
      for (let i = 0; i < runs; i++) {
        try {
          await fn();
          if (i < runs - 1) continue; // simulate a transient error: the driver runs the callback again
        } catch (err) {
          events.push('abort');
          throw err;
        }
      }
      if (opts.onCommitFail) {
        events.push('abort');
        throw opts.onCommitFail;
      }
      events.push('commit');
    },
    async endSession() {
      events.push('end');
    },
  };
  return {
    events,
    session,
    connection: {
      readyState: 1,
      getClient: () => ({ topology: { description: { type: 'ReplicaSetWithPrimary' } } }),
      startSession: async () => session,
    } as any,
  };
};

const standalone = () => ({ ...topology('Single'), startSession: async () => assert.fail('must not start a session') }) as any;

// the helper logs loudly when an undo fails (that is the point); keep the test output readable
const realConsoleError = console.error;
const realConsoleWarn = console.warn;
beforeEach(() => {
  console.error = () => undefined;
  console.warn = () => undefined;
});
afterEach(() => {
  console.error = realConsoleError;
  console.warn = realConsoleWarn;
  delete process.env.MONGO_TRANSACTIONS;
});

describe('supportsTransactions', () => {
  test('replica set with a primary and sharded clusters support them', () => {
    assert.equal(supportsTransactions(topology('ReplicaSetWithPrimary')), true);
    assert.equal(supportsTransactions(topology('Sharded')), true);
  });

  test('standalone, no primary, unknown, load balanced and a disconnected client do not', () => {
    for (const type of ['Single', 'ReplicaSetNoPrimary', 'Unknown', 'LoadBalanced']) {
      assert.equal(supportsTransactions(topology(type)), false, type);
    }
    assert.equal(supportsTransactions(topology('ReplicaSetWithPrimary', 0)), false);
  });

  test('a client that cannot be inspected is treated as standalone', () => {
    assert.equal(supportsTransactions({ readyState: 1, getClient: () => { throw new Error('boom'); } } as any), false);
    assert.equal(supportsTransactions({ readyState: 1 } as any), false);
  });

  test('MONGO_TRANSACTIONS=off forces the compensated path', () => {
    process.env.MONGO_TRANSACTIONS = 'off';
    assert.equal(supportsTransactions(topology('ReplicaSetWithPrimary')), false);
  });
});

describe('runAtomic on a replica set', () => {
  test('runs fn inside withTransaction with the session and returns its value', async () => {
    const { connection, events, session } = replicaConnection();
    let seen: unknown;
    const result = await runAtomic(async (s) => {
      seen = s;
      return 42;
    }, { connection });
    assert.equal(result, 42);
    assert.equal(seen, session);
    assert.deepEqual(events, ['begin', 'commit', 'end']);
  });

  test('a throwing fn aborts, the session is ended, and the undo stack is NOT replayed (the abort already rolled back)', async () => {
    const { connection, events } = replicaConnection();
    let undone = false;
    await assert.rejects(
      runAtomic(async (_s, comp) => {
        comp.push('step', async () => { undone = true; });
        throw new Error('later step failed');
      }, { connection }),
      /later step failed/
    );
    assert.equal(undone, false);
    assert.deepEqual(events, ['begin', 'abort', 'end']);
  });

  test('when the driver retries the callback the undo stack starts empty each time', async () => {
    const { connection } = replicaConnection({ retries: 2 });
    const sizes: number[] = [];
    await runAtomic(async (_s, comp) => {
      sizes.push(comp.size);
      comp.push('x', async () => undefined);
    }, { connection });
    assert.deepEqual(sizes, [0, 0, 0]);
  });

  test('a server that rejects transactions makes it fall back to the compensated path and run fn once without a session', async () => {
    const unsupported = Object.assign(new Error('Transaction numbers are only allowed on a replica set member or mongos'), { code: 20 });
    let sessionEnded = false;
    const connection = {
      readyState: 1,
      getClient: () => ({ topology: { description: { type: 'ReplicaSetWithPrimary' } } }),
      startSession: async () => ({
        async withTransaction() { throw unsupported; },
        async endSession() { sessionEnded = true; },
      }),
    } as any;
    const seen: unknown[] = [];
    const out = await runAtomic(async (s) => { seen.push(s); return 'ok'; }, { connection });
    assert.equal(out, 'ok');
    assert.deepEqual(seen, [undefined]);
    assert.equal(sessionEnded, true);
  });

  test('any other transaction error is rethrown', async () => {
    const { connection } = replicaConnection({ onCommitFail: new Error('write conflict') });
    await assert.rejects(runAtomic(async () => 1, { connection }), /write conflict/);
  });
});

describe('runAtomic on a standalone server (no transactions)', () => {
  test('runs fn with no session and returns the value; nothing is undone on success', async () => {
    let undone = 0;
    let seen: unknown = 'unset';
    const out = await runAtomic(async (session, comp) => {
      seen = session;
      comp.push('step', async () => { undone++; });
      return 'done';
    }, { connection: standalone() });
    assert.equal(out, 'done');
    assert.equal(seen, undefined);
    assert.equal(undone, 0);
  });

  test('a failure replays the undo steps newest first, then rethrows the ORIGINAL error', async () => {
    const order: string[] = [];
    const boom = new UserFacingError('Not enough balance.', 409);
    await assert.rejects(
      runAtomic(async (_s, comp) => {
        comp.push('first', async () => { order.push('first'); });
        comp.push('second', async () => { order.push('second'); });
        comp.push('third', async () => { order.push('third'); });
        throw boom;
      }, { connection: standalone() }),
      (err: unknown) => err === boom
    );
    assert.deepEqual(order, ['third', 'second', 'first']);
  });

  test('an undo that fails does not stop the others and is reported as an error that needs a look', async () => {
    const order: string[] = [];
    const original = new Error('ledger down');
    await assert.rejects(
      runAtomic(async (_s, comp) => {
        comp.push('wallet credit', async () => { order.push('wallet credit'); });
        comp.push('journal row', async () => { throw new Error('cannot remove'); });
        comp.push('ledger entry', async () => { order.push('ledger entry'); });
        throw original;
      }, { connection: standalone(), description: 'unit test' }),
      (err: any) => {
        assert.ok(err instanceof CompensationFailedError);
        assert.ok(err instanceof UserFacingError, 'its message is shown to the user, not swallowed');
        assert.deepEqual(err.failedSteps, ['journal row']);
        assert.equal(err.originalError, original);
        assert.equal(err.reconciliationRequired, true);
        assert.equal(err.statusCode, 500);
        return true;
      }
    );
    // the failed undo did not prevent the remaining ones
    assert.deepEqual(order, ['ledger entry', 'wallet credit']);
  });

  test('a disconnected / unknown connection also takes the compensated path', async () => {
    const out = await runAtomic(async (s) => s, { connection: topology('Single', 0) });
    assert.equal(out, undefined);
  });
});

describe('Compensations', () => {
  test('rollback empties the stack and returns the labels that failed', async () => {
    const comp = new Compensations();
    comp.push('a', async () => undefined);
    comp.push('b', async () => { throw new Error('x'); });
    assert.equal(comp.size, 2);
    assert.deepEqual(await comp.rollback(), ['b']);
    assert.equal(comp.size, 0);
    assert.deepEqual(await comp.rollback(), []);
  });
});
});
