// First import on purpose: this registers a global Mongoose plugin, and a
// plugin only reaches schemas compiled after it is registered.
import './config/schemaGuards';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import type { Server } from 'http';
import { connectDatabase } from './config/database';
import { createApp, appState } from './app';
import { checkBootEnvironment } from './config/security';
import { createShutdown } from './utils/gracefulShutdown';
import { prepareIndexBuild, runStartupIndexStep } from './services/indexBuild';
import { runStartupSequence } from './services/startupSequence';
import { logTransactionMode } from './utils/transaction';
import { seedCategories } from './utils/seedCategories';
import { startVarisangyaReminderScheduler } from './services/varisangyaNotificationService';
import { startCommitteeTermScheduler } from './services/committeeTermService';

// Load environment variables from the correct path
// When running with ts-node, __dirname is src/, so go up one level
// When running compiled code, __dirname is dist/, so go up two levels
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Verify environment variables are loaded
const requiredEnv = ['MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error('❌ ERROR: Required environment variables are missing:', missingEnv.join(', '));
  console.error('Checked path:', envPath);
  console.error('Current __dirname:', __dirname);
  process.exit(1);
}

// Refuse to start with a configuration that is unsafe outside development; warn about the rest.
const bootCheck = checkBootEnvironment(process.env);
bootCheck.warnings.forEach((warning) => console.warn(`⚠️  ${warning}`));
if (bootCheck.fatal.length > 0) {
  bootCheck.fatal.forEach((problem) => console.error(`❌ ${problem}`));
  process.exit(1);
}

// Log environment presence (without secrets)
console.info('🔍 Environment check:');
console.info('NODE_ENV:', process.env.NODE_ENV);
console.info('MONGODB_URI exists:', !!process.env.MONGODB_URI);

const PORT = process.env.PORT || 5000;

/** Assigned once the HTTP server is listening; used to shut down cleanly. */
let server: Server | undefined;
const stopJobs: Array<() => void> = [];

const lifecycle = createShutdown({
  get server() {
    return server;
  },
  stopJobs,
  closeDatabase: () => mongoose.connection.close(),
  markNotReady: () => {
    appState.shuttingDown = true;
  },
  timeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000,
});

/*
 * Nothing used to catch a promise that rejected outside a request.
 *
 * Since Node 15 an unhandled rejection terminates the process by default, so a
 * stray `.then()` in a scheduler, a background write, or a fire-and-forget
 * notification could take the whole API down and every Mahallu with it. These
 * handlers keep the server serving and put the real failure in the log.
 */
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  // An exception this far out leaves the process in an unknown state, so the
  // only safe move is to stop taking new work and let the supervisor restart.
  console.error('[uncaughtException]', error);
  void lifecycle.shutdown('uncaughtException').finally(() => process.exit(1));
  setTimeout(() => process.exit(1), 10000).unref();
});

// A deploy or restart sends SIGTERM (Ctrl+C sends SIGINT): drain, stop jobs, close the database, exit.
['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.on(signal, () => {
    void lifecycle.shutdownAndExit(signal);
  });
});

const start = async () => {
  // The order is fixed in services/startupSequence.ts (and pinned by a test):
  //   1. attach the index monitors and fix the index build mode (before connecting)
  //   2. connect (connectDatabase() exits the process if it fails). Outside development/test autoIndex is
  //      OFF, so connecting builds no index: the server used to build them all at once, concurrently with
  //      the duplicate preflight, so the preflight gated nothing.
  //   3. say once which money-flow mode is active (no hosts or URIs in the message)
  //   4. read-only duplicate preflight, then build every index it cleared (duplicates are logged with their
  //      ids and their unique index is NOT built); bounded by INDEX_BUILD_WAIT_MS, never throws or exits
  //   5. seed inert reference data (upsert-only, never overwrites an edit)
  //   6. only now listen, so /api/ready never claims uniqueness that is not verified
  await runStartupSequence({
    registerMonitors: () => {
      prepareIndexBuild(process.env);
    },
    connect: connectDatabase,
    logTopology: () => {
      logTransactionMode();
    },
    indexes: () => runStartupIndexStep(process.env),
    seed: () => {
      if (process.env.SEED_ON_STARTUP !== 'false') {
        seedCategories().catch((err) => console.error('Category seeding failed:', err.message));
      }
    },
    listen: listenForRequests,
  });
};

const listenForRequests = () => {
  const app = createApp();

  server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);

    // Background jobs start only once the API is actually serving. Run them on ONE instance:
    // set BACKGROUND_JOBS_ENABLED=false on every other instance (see docs/OPS_RUNBOOK.md).
    if (process.env.BACKGROUND_JOBS_ENABLED !== 'false') {
      // Monthly varisangya WhatsApp reminders
      stopJobs.push(startVarisangyaReminderScheduler());
      // Daily committee term-expiry notifications
      stopJobs.push(startCommitteeTermScheduler());
    }
  });

  // A port already in use used to surface as a bare stack trace and a dead process.
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Stop the other process or set a different PORT.`);
    } else {
      console.error('❌ Server failed to start:', error);
    }
    process.exit(1);
  });
};

start().catch((err) => {
  console.error('❌ Startup failed:', err);
  process.exit(1);
});
