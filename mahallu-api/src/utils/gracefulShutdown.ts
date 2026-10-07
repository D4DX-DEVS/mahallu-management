/**
 * Graceful shutdown.
 *
 * A deploy or restart sends SIGTERM. Without a handler the process died immediately: in-flight
 * requests were cut off, a half-finished WhatsApp broadcast or ledger write stopped mid-way, and the
 * Mongo connection was dropped without being closed. This stops taking new traffic first, lets
 * in-flight requests finish (bounded), stops the schedulers, closes the database, and only then exits.
 *
 * It is written against small interfaces so it can be tested without a real server or database.
 */
export interface ClosableServer {
  close(callback?: (err?: Error) => void): unknown;
  closeIdleConnections?: () => void;
  closeAllConnections?: () => void;
}

export interface ShutdownDeps {
  server: ClosableServer | undefined;
  /** Stop timers / background jobs. Each returns when stopped. */
  stopJobs?: Array<() => void | Promise<void>>;
  closeDatabase?: () => Promise<unknown>;
  /** Called first, so the readiness probe starts answering 503 and a load balancer drains this instance. */
  markNotReady?: () => void;
  timeoutMs?: number;
  exit?: (code: number) => void;
  log?: (message: string) => void;
}

export interface ShutdownResult {
  clean: boolean;
  reason?: string;
}

export const createShutdown = (deps: ShutdownDeps) => {
  const log = deps.log ?? ((m: string) => console.info(m));
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const timeoutMs = deps.timeoutMs ?? 10_000;
  let running: Promise<ShutdownResult> | null = null;

  const run = async (signal: string): Promise<ShutdownResult> => {
    log(`[shutdown] ${signal} received: draining`);
    deps.markNotReady?.();

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      log(`[shutdown] still busy after ${timeoutMs}ms: forcing connections closed`);
      deps.server?.closeAllConnections?.();
    }, timeoutMs);
    timer.unref?.();

    try {
      // 1. Stop accepting connections; idle keep-alive sockets would otherwise hold close() open.
      const closed = new Promise<void>((resolve, reject) => {
        if (!deps.server) return resolve();
        deps.server.close((err) => (err ? reject(err) : resolve()));
        deps.server.closeIdleConnections?.();
      });
      // 2. Background jobs must not start new work while requests drain.
      for (const stop of deps.stopJobs ?? []) await stop();
      await closed;
      // 3. Nothing is using the database any more.
      await deps.closeDatabase?.();
      clearTimeout(timer);
      log(timedOut ? '[shutdown] stopped after forcing connections' : '[shutdown] clean');
      return { clean: !timedOut };
    } catch (error: any) {
      clearTimeout(timer);
      log(`[shutdown] failed: ${error?.message ?? error}`);
      return { clean: false, reason: String(error?.message ?? error) };
    }
  };

  /** Idempotent: a second signal while draining joins the first instead of starting another. */
  const shutdown = (signal: string): Promise<ShutdownResult> => {
    if (!running) running = run(signal);
    return running;
  };

  /** Run the shutdown and exit the process with the matching status. */
  const shutdownAndExit = async (signal: string) => {
    const result = await shutdown(signal);
    exit(result.clean ? 0 : 1);
  };

  return { shutdown, shutdownAndExit };
};
