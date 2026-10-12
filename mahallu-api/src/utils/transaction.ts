import mongoose, { ClientSession } from 'mongoose';

let transactionsSupported: boolean | undefined;

const isTxnUnsupported = (err: any): boolean =>
  err?.code === 20 ||
  /Transaction numbers are only allowed|replica set|does not support transactions|IllegalOperation/i.test(String(err?.message || ''));

/**
 * Run `work` inside a Mongo transaction when the deployment supports it (replica set / Atlas).
 * On a standalone server the work runs without a session: callers receive `session = undefined`
 * and must order their writes so a failure part-way leaves a consistent state (best effort),
 * which is how the lifecycle services are written.
 */
export async function withOptionalTransaction<T>(work: (session: ClientSession | undefined) => Promise<T>): Promise<T> {
  if (transactionsSupported === false) return work(undefined);
  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    transactionsSupported = true;
    return result!;
  } catch (err: any) {
    if (transactionsSupported === undefined && isTxnUnsupported(err)) {
      transactionsSupported = false;
      return work(undefined);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

/** Error carrying an HTTP status and machine-readable code, mapped by controllers. */
export class HttpError extends Error {
  status: number;
  code?: string;
  extra?: Record<string, any>;
  constructor(status: number, message: string, code?: string, extra?: Record<string, any>) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const sendError = (res: any, err: any) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message, ...(err.code ? { code: err.code } : {}), ...(err.extra || {}) });
  }
  return res.status(500).json({ success: false, message: err?.message || 'Unexpected error' });
};
