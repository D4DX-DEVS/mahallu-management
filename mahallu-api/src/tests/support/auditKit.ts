import mongoose from 'mongoose';
import { ReconciliationIssue } from '../../models/ReconciliationIssue';
import { FakeStore, Installed, installFake } from './fakeMongo';

/**
 * Shared pieces of the finance audit suites (no database is ever touched).
 *
 *   HOSTILE_TEXT / SECRET_MARKERS   an error message that carries a Mongo URI with credentials, a bearer token, an
 *                                   e-mail address and two phone numbers, and the fragments that must never be
 *                                   found in a log line, a stored record or a response
 *   run()                           call an Express-style handler and keep EVERYTHING it logged (console.error is
 *                                   captured, not muted), with the `[RECONCILIATION REQUIRED]` lines parsed
 *   connectReconciliationStore()    a stateful in-memory ReconciliationIssue collection (the real schema's partial
 *                                   unique index is enforced) and a mongoose connection that reports "connected",
 *                                   which is what makes the reporter store a record
 */

export const HOSTILE_TEXT =
  'boom mongodb+srv://svc:S3cretPw@cluster0.hostile.example.net/prod?retryWrites=true token=tok_live_ABCDEF123 ' +
  'Authorization: Bearer eyJhbGciOiJI.eyJzdWIiOiJ4.sigsigsigsig contact a.hostile@example.org phone +91 98765 43210 or 9876543210';

export const SECRET_MARKERS = [
  'S3cretPw',
  'cluster0.hostile',
  'tok_live_ABCDEF123',
  'eyJhbGciOiJI',
  'sigsigsigsig',
  'a.hostile@example.org',
  '98765 43210',
  '9876543210',
];

/** An error whose message is HOSTILE_TEXT. */
export const hostileError = (name = 'Error'): Error => Object.assign(new Error(HOSTILE_TEXT), { name });

export interface Run {
  status: number;
  body: any;
  /** every console.error line the handler (and everything under it) wrote */
  errors: string[];
  /** the parsed `[RECONCILIATION REQUIRED] {...}` lines */
  reconciliation: Array<Record<string, any>>;
}

const PREFIX = '[RECONCILIATION REQUIRED] ';

/** Run `fn` while keeping what it writes with console.error; resolves with the value or the error it raised. */
export async function capture<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: unknown; errors: string[]; reconciliation: Array<Record<string, any>> }> {
  const errors: string[] = [];
  const real = { error: console.error, warn: console.warn, info: console.info };
  console.error = (...args: any[]) => void errors.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '));
  console.warn = () => undefined;
  console.info = () => undefined;
  let value: T | undefined;
  let error: unknown;
  try {
    value = await fn();
  } catch (err) {
    error = err;
  } finally {
    console.error = real.error;
    console.warn = real.warn;
    console.info = real.info;
  }
  const reconciliation = errors.filter((line) => line.startsWith(PREFIX)).map((line) => JSON.parse(line.slice(PREFIX.length)));
  return { value, error, errors, reconciliation };
}

export async function run(handler: (req: any, res: any) => any, req: Record<string, any> = {}): Promise<Run> {
  const out: Run = { status: 200, body: undefined, errors: [], reconciliation: [] };
  const res: any = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: any) {
      out.body = body;
      return res;
    },
  };
  const fullReq: any = {
    params: {},
    body: {},
    query: {},
    headers: {},
    method: 'TEST',
    originalUrl: '/test',
    ...req,
    user: { role: 'mahall', ...(req.user || {}) },
  };
  res.req = fullReq;

  const real = { error: console.error, warn: console.warn, info: console.info };
  console.error = (...args: any[]) => void out.errors.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '));
  console.warn = () => undefined;
  console.info = () => undefined;
  try {
    await handler(fullReq, res);
  } finally {
    console.error = real.error;
    console.warn = real.warn;
    console.info = real.info;
  }
  out.reconciliation = out.errors
    .filter((line) => line.startsWith(PREFIX))
    .map((line) => JSON.parse(line.slice(PREFIX.length)));
  return out;
}

/** Make `mongoose.connection.readyState` read 1 (connected) until the returned function is called. */
const pretendConnected = (): (() => void) => {
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, get: () => 1 });
  return () => {
    delete (mongoose.connection as any).readyState;
  };
};

export interface IssueStore {
  store: FakeStore;
  restore: () => void;
}

export function connectReconciliationStore(): IssueStore {
  const unplug = pretendConnected();
  const installed: Installed = installFake(ReconciliationIssue);
  return {
    store: installed.store,
    restore: () => {
      installed.restore();
      unplug();
    },
  };
}

/** Concatenation of everything a test must prove free of secrets. */
export const everythingLogged = (result: Run, store?: FakeStore): string =>
  [
    ...result.errors.filter((line) => line.startsWith(PREFIX)),
    JSON.stringify(store?.docs ?? []),
    JSON.stringify(result.body ?? null),
  ].join('\n');
