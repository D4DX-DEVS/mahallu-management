/**
 * Operator script: list data that would stop a unique index from being built. READ ONLY.
 *
 *   npm run check:indexes                 # human-readable report
 *   npm run check:indexes -- --json       # the same report as JSON (ids and key values only)
 *
 * Exit code: 0 = no duplicates and every check completed, 1 = duplicates found, 2 = a check could not
 * complete (nothing is known about that index), 3 = could not connect.
 *
 * What it does: connects with autoIndex and autoCreate OFF (so merely connecting never builds an index
 * or a collection), then runs ONE aggregation per unique index declared in the models and prints the
 * conflicting key and document ids. It never changes data or indexes, and prints no connection details.
 *
 * Where to point it: a RESTORED COPY of production is the safest target. Running it read-only against
 * production is also fine (it only reads; on a large collection each check is a collection scan, bounded
 * by INDEX_PREFLIGHT_TIMEOUT_MS, default 20s in total). Set CHECK_INDEXES_URI to name the database
 * explicitly; otherwise MONGODB_URI is used. .env is loaded ONLY when this file is run directly.
 *
 * It only reports. Building the clean indexes is the server's job at startup (services/indexBuild.ts,
 * INDEX_BUILD_MODE=gated): it uses this same read-only check as its gate and skips every unique index
 * that has duplicates. This script never builds, drops or changes anything.
 *
 * Resolving duplicates is a manual decision (which record is the real one?) and this script never does it.
 */
import mongoose from 'mongoose';
import { logPreflightReport, readPreflightConfig, runIndexPreflight } from '../services/indexPreflight';
import type { PreflightReport } from '../services/indexPreflight';

export const exitCodeFor = (report: PreflightReport): number => (report.duplicatesFound ? 1 : report.incomplete ? 2 : 0);

export async function main(argv: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const asJson = argv.includes('--json');
  const uri = env.CHECK_INDEXES_URI || env.MONGODB_URI;
  if (!uri) {
    console.error('Set CHECK_INDEXES_URI (or MONGODB_URI) to the database to check.');
    return 3;
  }
  try {
    // autoIndex/autoCreate false: connecting must not build anything.
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, autoIndex: false, autoCreate: false });
  } catch (err) {
    console.error(`Could not connect (${(err as Error)?.name || 'Error'}).`);
    return 3;
  }

  try {
    const config = readPreflightConfig(env);
    const report = await runIndexPreflight({ timeoutMs: config.timeoutMs, limit: config.limit });
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      logPreflightReport(report);
      for (const spec of report.specs.filter((s) => s.status === 'duplicates')) {
        for (const group of spec.groups) {
          console.log(`  ${spec.model} ${JSON.stringify(group.key)} x${group.count}: ${group.ids.join(', ')}`);
        }
      }
      console.log(report.ok ? 'OK: no duplicate data blocks any unique index.' : 'NOT OK: see above.');
    }
    return exitCodeFor(report);
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

if (require.main === module) {
  // Loaded only here, so importing this module (tests) never reads an environment file.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
  main().then(
    (code) => process.exit(code),
    () => process.exit(3)
  );
}
