import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CompensationFailedError,
  RECONCILIATION_MESSAGE,
  detectTransactionMode,
  isTransactionUnsupported,
  logTransactionMode,
  resetTransactionModeState,
  runAtomic,
  supportsTransactions,
} from '../utils/transaction';
import { UserFacingError } from '../utils/userMessages';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] transactionMode', () => {

/**
 * Which path runAtomic takes for each topology, with fake connections and sessions (no database).
 */

const servers = (...types: string[]) => new Map(types.map((type, i) => [`host${i}:27017`, { type }]));

/** A mutable fake connection: tests can change `topology` between calls, like a driver that finishes discovery. */
const fakeConnection = (initial: { type?: string; servers?: Map<string, { type: string }> } = { type: 'ReplicaSetWithPrimary' }, readyState = 1) => {
  const state = { topology: initial, readyState, sessions: 0, events: [] as string[], behaviour: 'ok' as 'ok' | 'unsupported-before-fn' | 'unsupported-after-fn' };
  const session = {
    async withTransaction(fn: () => Promise<unknown>) {
      state.events.push('begin');
      if (state.behaviour === 'unsupported-before-fn') {
        throw Object.assign(new Error('Transaction numbers are only allowed on a replica set member or mongos'), { code: 20, codeName: 'IllegalOperation' });
      }
      try {
        await fn();
      } catch (err) {
        state.events.push('abort');
        throw err;
      }
      if (state.behaviour === 'unsupported-after-fn') {
        throw Object.assign(new Error('Transaction numbers are only allowed on a replica set member or mongos'), { code: 20 });
      }
      state.events.push('commit');
    },
    async endSession() {
      state.events.push('end');
    },
  };
  const connection: any = {
    get readyState() {
      return state.readyState;
    },
    getClient: () => ({ topology: { description: state.topology } }),
    startSession: async () => {
      state.sessions += 1;
      return session;
    },
  };
  return { state, session, connection };
};

const realError = console.error;
const realWarn = console.warn;
const realConsoleInfo = console.info;
let errors: string[] = [];
let warnings: string[] = [];
beforeEach(() => {
  errors = [];
  warnings = [];
  console.error = (...args: any[]) => void errors.push(args.map(String).join(' '));
  console.warn = (...args: any[]) => void warnings.push(args.map(String).join(' '));
  console.info = () => undefined;
  resetTransactionModeState();
});
afterEach(() => {
  console.error = realError;
  console.warn = realWarn;
  console.info = realConsoleInfo;
  delete process.env.MONGO_TRANSACTIONS;
});

describe('detectTransactionMode', () => {
  test('replica set with a primary, sharded cluster, and a direct connection to a primary or mongos: enabled', () => {
    assert.deepEqual(detectTransactionMode(fakeConnection({ type: 'ReplicaSetWithPrimary' }).connection), { mode: 'enabled', reason: 'replica-set' });
    assert.deepEqual(detectTransactionMode(fakeConnection({ type: 'Sharded' }).connection), { mode: 'enabled', reason: 'sharded' });
    assert.deepEqual(detectTransactionMode(fakeConnection({ type: 'Single', servers: servers('RSPrimary') }).connection), { mode: 'enabled', reason: 'replica-set' });
    assert.deepEqual(detectTransactionMode(fakeConnection({ type: 'Single', servers: servers('Mongos') }).connection), { mode: 'enabled', reason: 'sharded' });
  });

  test('standalone and load balanced: definitively disabled', () => {
    assert.deepEqual(detectTransactionMode(fakeConnection({ type: 'Single', servers: servers('Standalone') }).connection), { mode: 'disabled', reason: 'standalone' });
    assert.deepEqual(detectTransactionMode(fakeConnection({ type: 'Single' }).connection), { mode: 'disabled', reason: 'standalone' });
    assert.deepEqual(detectTransactionMode(fakeConnection({ type: 'LoadBalanced' }).connection), { mode: 'disabled', reason: 'load-balanced' });
  });

  test('not discovered yet, election in progress, not connected, uninspectable: unknown (never a definitive standalone)', () => {
    assert.equal(detectTransactionMode(fakeConnection({ type: 'Unknown' }).connection).mode, 'unknown');
    assert.equal(detectTransactionMode(fakeConnection({ type: undefined }).connection).mode, 'unknown');
    assert.equal(detectTransactionMode(fakeConnection({ type: 'ReplicaSetNoPrimary' }).connection).mode, 'unknown');
    assert.equal(detectTransactionMode(fakeConnection({ type: 'Single', servers: servers('Unknown') }).connection).mode, 'unknown');
    assert.equal(detectTransactionMode(fakeConnection({ type: 'ReplicaSetWithPrimary' }, 0).connection).mode, 'unknown');
    assert.equal(detectTransactionMode({ readyState: 1, getClient: () => { throw new Error('boom'); } } as any).mode, 'unknown');
    assert.equal(detectTransactionMode({ readyState: 1 } as any).mode, 'unknown');
  });

  test('MONGO_TRANSACTIONS=off forces disabled whatever the topology; other values change nothing', () => {
    const rs = fakeConnection({ type: 'ReplicaSetWithPrimary' }).connection;
    process.env.MONGO_TRANSACTIONS = 'off';
    assert.deepEqual(detectTransactionMode(rs), { mode: 'disabled', reason: 'forced-off' });
    process.env.MONGO_TRANSACTIONS = ' OFF ';
    assert.equal(detectTransactionMode(rs).mode, 'disabled');
    process.env.MONGO_TRANSACTIONS = 'on';
    assert.equal(detectTransactionMode(rs).mode, 'enabled');
    delete process.env.MONGO_TRANSACTIONS;
    assert.equal(supportsTransactions(rs), true);
  });

  test('the detection is not cached: a topology that finishes discovery is picked up on the next call', () => {
    const { connection, state } = fakeConnection({ type: 'Unknown' });
    assert.equal(detectTransactionMode(connection).mode, 'unknown');
    assert.equal(detectTransactionMode(connection).mode, 'unknown');
    state.topology = { type: 'ReplicaSetWithPrimary' };
    assert.equal(detectTransactionMode(connection).mode, 'enabled');
  });
});

describe('runAtomic by topology', () => {
  test('replica set: withTransaction is used and the session is passed to fn', async () => {
    const { connection, state, session } = fakeConnection({ type: 'ReplicaSetWithPrimary' });
    let seen: unknown;
    const out = await runAtomic(async (s) => {
      seen = s;
      return 'done';
    }, { connection });
    assert.equal(out, 'done');
    assert.equal(seen, session);
    assert.deepEqual(state.events, ['begin', 'commit', 'end']);
  });

  test('sharded (mongos) uses a transaction too', async () => {
    const { connection, state } = fakeConnection({ type: 'Sharded' });
    await runAtomic(async () => 1, { connection });
    assert.equal(state.sessions, 1);
  });

  test('standalone: no session is started and fn gets none', async () => {
    const { connection, state } = fakeConnection({ type: 'Single', servers: servers('Standalone') });
    let seen: unknown = 'unset';
    await runAtomic(async (s) => {
      seen = s;
    }, { connection });
    assert.equal(seen, undefined);
    assert.equal(state.sessions, 0);
  });

  test('unknown topology: no session for that call, and the next call re-detects and uses a transaction once the topology is known', async () => {
    const { connection, state } = fakeConnection({ type: 'Unknown' });
    let first: unknown = 'unset';
    await runAtomic(async (s) => {
      first = s;
    }, { connection });
    assert.equal(first, undefined);
    assert.equal(state.sessions, 0);

    state.topology = { type: 'ReplicaSetWithPrimary' };
    let second: unknown = 'unset';
    await runAtomic(async (s) => {
      second = s;
    }, { connection });
    assert.ok(second && second !== 'unset', 'a session this time');
    assert.equal(state.sessions, 1);
  });

  test('MONGO_TRANSACTIONS=off: even a replica set runs compensated, with no session', async () => {
    process.env.MONGO_TRANSACTIONS = 'off';
    const { connection, state } = fakeConnection({ type: 'ReplicaSetWithPrimary' });
    let seen: unknown = 'unset';
    await runAtomic(async (s) => {
      seen = s;
    }, { connection });
    assert.equal(seen, undefined);
    assert.equal(state.sessions, 0);
  });

  test('the server rejects transactions at runtime (code 20) before anything ran: falls back to the compensated path, once, without a session', async () => {
    const { connection, state } = fakeConnection({ type: 'ReplicaSetWithPrimary' });
    state.behaviour = 'unsupported-before-fn';
    const seen: unknown[] = [];
    const out = await runAtomic(async (s) => {
      seen.push(s);
      return 'ok';
    }, { connection });
    assert.equal(out, 'ok');
    assert.deepEqual(seen, [undefined]);
    assert.ok(state.events.includes('end'), 'the session was ended');
    assert.ok(warnings.some((w) => /transactions unavailable/.test(w)));

    // the rejection is remembered for a while: the next call does not even start a session
    const sessionsBefore = state.sessions;
    await runAtomic(async () => 1, { connection });
    assert.equal(state.sessions, sessionsBefore);
    // ...but only for a while: a later check asks the topology again
    assert.equal(detectTransactionMode(connection, Date.now() + 10 * 60_000).mode, 'enabled');
  });

  test('code 20 AFTER a step already ran: no blind retry, no replayed undo; an administrator is told', async () => {
    const { connection, state } = fakeConnection({ type: 'ReplicaSetWithPrimary' });
    state.behaviour = 'unsupported-after-fn';
    let runs = 0;
    let undone = false;
    await assert.rejects(
      runAtomic(async (_s, comp) => {
        runs += 1;
        comp.push('wallet credit', async () => { undone = true; });
        return 1;
      }, { connection, description: 'unit flow', reconcile: { flow: 'unit flow', entity: 'Thing', entityId: '507f1f77bcf86cd799439011' } }),
      (err: any) => {
        assert.ok(err instanceof CompensationFailedError);
        assert.equal(err.message, RECONCILIATION_MESSAGE);
        assert.match(err.message, /administrator/i);
        return true;
      }
    );
    assert.equal(runs, 1, 'fn was not run a second time');
    assert.equal(undone, false, 'the undo list was not replayed');
    const line = errors.find((e) => e.startsWith('[RECONCILIATION REQUIRED]'));
    assert.ok(line, 'a structured reconciliation line was written');
    assert.match(line!, /"flow":"unit flow"/);
    assert.match(line!, /wallet credit \(transaction rejected\)/);
  });

  test('any other transaction error is rethrown unchanged and nothing falls back', async () => {
    const { connection, state } = fakeConnection({ type: 'ReplicaSetWithPrimary' });
    const boom = new Error('write conflict');
    let runs = 0;
    await assert.rejects(
      runAtomic(async () => { runs += 1; throw boom; }, { connection }),
      (err: unknown) => err === boom
    );
    assert.equal(runs, 1);
    assert.equal(state.sessions, 1);
  });

  test('inside a transaction the undo list is NOT replayed (the abort rolls everything back)', async () => {
    const { connection } = fakeConnection({ type: 'ReplicaSetWithPrimary' });
    let undone = 0;
    await assert.rejects(
      runAtomic(async (_s, comp) => {
        comp.push('a', async () => { undone += 1; });
        throw new Error('later step failed');
      }, { connection }),
      /later step failed/
    );
    assert.equal(undone, 0);
  });

  test('on the non-transaction path the undo runs newest first and the original error comes back', async () => {
    const { connection } = fakeConnection({ type: 'Single', servers: servers('Standalone') });
    const order: string[] = [];
    const boom = new UserFacingError('Not enough balance.', 409);
    await assert.rejects(
      runAtomic(async (_s, comp) => {
        comp.push('one', async () => { order.push('one'); });
        comp.push('two', async () => { order.push('two'); });
        comp.push('three', async () => { order.push('three'); });
        throw boom;
      }, { connection }),
      (err: unknown) => err === boom
    );
    assert.deepEqual(order, ['three', 'two', 'one']);
  });

  test('an undo that fails is never dropped silently: the rest still run, the error tells the user an administrator must review it', async () => {
    const { connection } = fakeConnection({ type: 'Single', servers: servers('Standalone') });
    const order: string[] = [];
    await assert.rejects(
      runAtomic(async (_s, comp) => {
        comp.push('first', async () => { order.push('first'); });
        comp.push('second', async () => { throw new Error('cannot undo, phone 9876543210, mongodb://user:pw@db.internal/x'); });
        comp.push('third', async () => { order.push('third'); });
        throw new Error('step 4 failed');
      }, { connection, description: 'unit', reconcile: { flow: 'unit flow', entity: 'Thing', entityId: '507f1f77bcf86cd799439011', tenantId: '507f1f77bcf86cd799439012' } }),
      (err: any) => {
        assert.ok(err instanceof CompensationFailedError);
        assert.deepEqual(err.failedSteps, ['second']);
        assert.match(err.message, /administrator review/i);
        return true;
      }
    );
    assert.deepEqual(order, ['third', 'first']);
    const line = errors.find((e) => e.startsWith('[RECONCILIATION REQUIRED]'))!;
    assert.ok(line);
    assert.ok(!line.includes('9876543210') && !line.includes('db.internal') && !line.includes('user:pw'), 'no phone numbers or URIs in the structured line');
    assert.ok(!errors.some((e) => e.includes('9876543210') || e.includes('db.internal')), 'nor in any other error line');
  });
});

describe('the active mode is logged once, without hosts or URIs', () => {
  const capture = () => {
    const info: string[] = [];
    const warn: string[] = [];
    return { info, warn, log: { info: (m: string) => void info.push(m), warn: (m: string) => void warn.push(m) } as any };
  };

  test('replica set', () => {
    const { connection } = fakeConnection({ type: 'ReplicaSetWithPrimary' });
    const { info, log } = capture();
    logTransactionMode(connection, log);
    logTransactionMode(connection, log);
    logTransactionMode(connection, log);
    assert.deepEqual(info, ['MongoDB transactions: ENABLED (replica set)']);
  });

  test('standalone', () => {
    const { connection } = fakeConnection({ type: 'Single', servers: servers('Standalone') });
    const { info, log } = capture();
    logTransactionMode(connection, log);
    logTransactionMode(connection, log);
    assert.deepEqual(info, ['MongoDB transactions: DISABLED (standalone: financial flows rely on atomic updates, idempotency keys and compensation)']);
    assert.ok(!/host|mongodb:\/\/|27017/.test(info[0].replace('MongoDB transactions', '')));
  });

  test('forced off', () => {
    process.env.MONGO_TRANSACTIONS = 'off';
    const { info, log } = capture();
    logTransactionMode(fakeConnection().connection, log);
    assert.match(info[0], /DISABLED \(MONGO_TRANSACTIONS=off/);
  });

  test('unknown at startup warns once, and the definitive mode is logged as soon as it is known', () => {
    const { connection, state } = fakeConnection({ type: 'Unknown' });
    const { info, warn, log } = capture();
    logTransactionMode(connection, log);
    logTransactionMode(connection, log);
    assert.equal(warn.length, 1);
    assert.match(warn[0], /UNDETERMINED/);
    assert.equal(info.length, 0);
    state.topology = { type: 'Sharded' };
    logTransactionMode(connection, log);
    logTransactionMode(connection, log);
    assert.deepEqual(info, ['MongoDB transactions: ENABLED (sharded cluster / mongos)']);
  });

  test('runAtomic reports the mode on its first definitive detection', async () => {
    const { connection } = fakeConnection({ type: 'Single', servers: servers('Standalone') });
    const realInfo = console.info;
    const lines: string[] = [];
    console.info = (m: string) => void lines.push(String(m));
    try {
      await runAtomic(async () => 1, { connection });
      await runAtomic(async () => 1, { connection });
    } finally {
      console.info = realInfo;
    }
    assert.equal(lines.filter((l) => l.startsWith('MongoDB transactions: DISABLED (standalone')).length, 1);
  });
});

describe('isTransactionUnsupported', () => {
  test('recognises the server refusing transactions, and only that', () => {
    assert.equal(isTransactionUnsupported(Object.assign(new Error('Transaction numbers are only allowed on a replica set member or mongos'), { code: 20 })), true);
    assert.equal(isTransactionUnsupported(Object.assign(new Error('x transaction numbers y'), { codeName: 'IllegalOperation' })), true);
    assert.equal(isTransactionUnsupported(new Error('Transaction numbers are only allowed on a replica set member or mongos')), true);
    assert.equal(isTransactionUnsupported(Object.assign(new Error('something else'), { code: 20 })), false);
    assert.equal(isTransactionUnsupported(new Error('write conflict')), false);
    assert.equal(isTransactionUnsupported(undefined), false);
  });
});

});
