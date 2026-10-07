/**
 * The order in which the server starts. It lives here (not inline in src/index.ts) so the order is one
 * small, testable function: a test drives it with fakes and records the call order.
 *
 *   1. registerMonitors  attach the index monitors and fix the index build mode (before connecting)
 *   2. connect           open the connection (gated mode: autoIndex OFF, so nothing is built yet)
 *   3. logTopology       say once which transaction mode the cluster allows
 *   4. indexes           READ-ONLY duplicate preflight, then (gated mode) the explicit build of every
 *                        index the preflight cleared; bounded by INDEX_BUILD_WAIT_MS
 *   5. seed              inert reference data (optional)
 *   6. listen            only now does the HTTP server answer, so /api/ready can never claim
 *                        enforcement that is not verified
 */
export interface StartupSteps {
  registerMonitors: () => void;
  connect: () => Promise<void>;
  logTopology: () => void;
  indexes: () => Promise<void>;
  seed?: () => void;
  listen: () => void;
}

export const STARTUP_ORDER = ['registerMonitors', 'connect', 'logTopology', 'indexes', 'seed', 'listen'] as const;

export const runStartupSequence = async (steps: StartupSteps): Promise<void> => {
  steps.registerMonitors();
  await steps.connect();
  steps.logTopology();
  await steps.indexes();
  steps.seed?.();
  steps.listen();
};
