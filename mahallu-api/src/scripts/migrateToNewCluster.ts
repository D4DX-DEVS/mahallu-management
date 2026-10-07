/**
 * One-shot cluster migration: copies every collection (documents + indexes) of the
 * source database (MONGODB_URI) into the target cluster (MONGODB_URI_NEW).
 *
 * - Only WRITES to the target; the source is never modified.
 * - DRY RUN by default: connects, reads, and prints what it WOULD do. Nothing is written or dropped
 *   until it is started with --apply.
 * - Refuses to run when both URIs point at the same host + database (that would wipe the source).
 * - With --apply, refuses when a target collection already holds documents, unless --drop-target is
 *   also given (then those collections are dropped and recopied for a clean, exact copy).
 * - Never prints a connection string: only host and database names.
 * - Verifies document counts per collection at the end.
 *
 * Usage:
 *   npx ts-node src/scripts/migrateToNewCluster.ts                       (dry run)
 *   npx ts-node src/scripts/migrateToNewCluster.ts --apply               (empty target only)
 *   npx ts-node src/scripts/migrateToNewCluster.ts --apply --drop-target (replace non-empty target collections)
 */
import { MongoClient } from 'mongodb';

const BATCH = 1000;

export interface MigrationTarget {
  /** Lower-cased host list, default port removed, sorted: "cluster0.example.net" or "a:1,b:2". */
  host: string;
  /** Database name (the driver's default, "test", when the URI names none). */
  db: string;
}

/**
 * Host and database a MongoDB URI points at. Credentials, options and the scheme are dropped, so the
 * result is safe to print and to compare. Returns null for something that is not a MongoDB URI.
 */
export const describeTarget = (uri: string | undefined): MigrationTarget | null => {
  if (typeof uri !== 'string') return null;
  const match = /^mongodb(?:\+srv)?:\/\/(.*)$/i.exec(uri.trim());
  if (!match) return null;
  const rest = match[1];
  const pathStart = rest.search(/[/?]/);
  const authority = pathStart === -1 ? rest : rest.slice(0, pathStart);
  const tail = pathStart === -1 ? '' : rest.slice(pathStart);
  // Credentials end at the LAST '@' of the authority (a password may carry an encoded '@').
  const hostPart = authority.slice(authority.lastIndexOf('@') + 1).trim().toLowerCase();
  if (!hostPart) return null;
  const host = hostPart
    .split(',')
    .map((h) => h.trim().replace(/:27017$/, ''))
    .filter(Boolean)
    .sort()
    .join(',');
  const rawDb = (tail.startsWith('/') ? tail.slice(1) : '').split('?')[0] || '';
  let dbName = rawDb;
  try {
    dbName = decodeURIComponent(rawDb);
  } catch {
    // keep the raw text: it is only used to compare and to print a name
  }
  dbName = dbName || 'test';
  return host ? { host, db: dbName } : null;
};

const sameServer = (a: MigrationTarget, b: MigrationTarget): boolean => {
  const aHosts = new Set(a.host.split(','));
  return b.host.split(',').some((h) => aHosts.has(h));
};

export interface MigrationGuardInput {
  sourceUri?: string;
  targetUri?: string;
  /** --apply was given; without it the run is a dry run. */
  apply: boolean;
  /** --drop-target was given. */
  dropTarget: boolean;
  /** Names of the target collections that already hold documents (only known once connected). */
  nonEmptyTargetCollections?: string[];
}

export type MigrationGuardResult =
  | { ok: true; mode: 'dry-run' | 'apply' }
  | { ok: false; reason: string };

/**
 * Whether the migration may proceed, and in which mode. Pure: no I/O, so it is unit-tested.
 * Order matters: a run that would touch the source is refused before anything else is considered.
 */
export const evaluateMigrationGuard = (input: MigrationGuardInput): MigrationGuardResult => {
  const source = describeTarget(input.sourceUri);
  const target = describeTarget(input.targetUri);
  if (!input.sourceUri || !input.targetUri) {
    return { ok: false, reason: 'MONGODB_URI and MONGODB_URI_NEW must both be set.' };
  }
  if (!source || !target) {
    return { ok: false, reason: 'MONGODB_URI and MONGODB_URI_NEW must both be MongoDB connection strings.' };
  }
  if (sameServer(source, target) && source.db === target.db) {
    return {
      ok: false,
      reason: `Refusing to run: the source and the target are the same database (${target.db} on ${target.host}). Copying onto itself would wipe the source.`,
    };
  }
  if (!input.apply) return { ok: true, mode: 'dry-run' };

  const nonEmpty = input.nonEmptyTargetCollections ?? [];
  if (nonEmpty.length > 0 && !input.dropTarget) {
    return {
      ok: false,
      reason: `Refusing to run: the target already holds data in ${nonEmpty.length} collection(s) (${nonEmpty.join(', ')}). Start from an empty target, or add --drop-target to replace them.`,
    };
  }
  return { ok: true, mode: 'apply' };
};

/** Error text with any connection string removed, so a failure never prints credentials. */
const redact = (text: string): string => text.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[connection string hidden]');

async function main() {
  // Loaded here, not at import time, so importing this file (tests) never reads the environment file.
  (await import('dotenv')).config();

  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const dropTarget = argv.includes('--drop-target');
  const srcUri = process.env.MONGODB_URI;
  const dstUri = process.env.MONGODB_URI_NEW;

  // Cheap refusal first: no connection is opened for a run that can never be allowed.
  const early = evaluateMigrationGuard({ sourceUri: srcUri, targetUri: dstUri, apply, dropTarget });
  if (!early.ok) throw new Error(early.reason);

  const srcInfo = describeTarget(srcUri)!;
  const dstInfo = describeTarget(dstUri)!;
  console.log(`Source: ${srcInfo.db} on ${srcInfo.host}`);
  console.log(`Target: ${dstInfo.db} on ${dstInfo.host}`);
  console.log(apply ? `Mode: APPLY${dropTarget ? ' (--drop-target)' : ''}` : 'Mode: DRY RUN (nothing will be written; add --apply to copy)');

  const src = new MongoClient(srcUri as string);
  const dst = new MongoClient(dstUri as string);
  await Promise.all([src.connect(), dst.connect()]);

  try {
    const srcDb = src.db(); // db name comes from the URI path
    const dstDb = dst.db();

    const collections = (await srcDb.listCollections().toArray())
      .map((c) => c.name)
      .filter((n) => !n.startsWith('system.'));
    console.log(`Collections to migrate: ${collections.length}`);

    const existingTarget = new Set((await dstDb.listCollections().toArray()).map((c) => c.name));
    const nonEmptyTarget: string[] = [];
    for (const name of collections) {
      if (existingTarget.has(name) && (await dstDb.collection(name).estimatedDocumentCount()) > 0) {
        nonEmptyTarget.push(name);
      }
    }

    const decision = evaluateMigrationGuard({
      sourceUri: srcUri,
      targetUri: dstUri,
      apply,
      dropTarget,
      nonEmptyTargetCollections: nonEmptyTarget,
    });
    if (!decision.ok) throw new Error(decision.reason);

    if (decision.mode === 'dry-run') {
      for (const name of collections) {
        const total = await srcDb.collection(name).countDocuments();
        const note = nonEmptyTarget.includes(name) ? ' (target already has data: needs --drop-target)' : '';
        console.log(`would copy ${name}: ${total} docs${note}`);
      }
      console.log('\nDry run only: nothing was written. Run again with --apply to copy.');
      return;
    }

    const failures: string[] = [];

    for (const name of collections) {
      const srcCol = srcDb.collection(name);
      const dstCol = dstDb.collection(name);
      const total = await srcCol.countDocuments();

      // Only reached for an empty target collection, or with --drop-target: clean it for an exact copy.
      if (existingTarget.has(name)) await dstCol.drop().catch(() => undefined);

      let copied = 0;
      let buffer: any[] = [];
      const cursor = srcCol.find({});
      for await (const doc of cursor) {
        buffer.push(doc);
        if (buffer.length >= BATCH) {
          await dstCol.insertMany(buffer, { ordered: false });
          copied += buffer.length;
          buffer = [];
        }
      }
      if (buffer.length > 0) {
        await dstCol.insertMany(buffer, { ordered: false });
        copied += buffer.length;
      }

      // Recreate indexes (skip the automatic _id index)
      const indexes = (await srcCol.indexes()).filter((i) => i.name !== '_id_');
      for (const idx of indexes) {
        const { key, name: idxName, unique, sparse, expireAfterSeconds, partialFilterExpression } = idx as any;
        await dstCol
          .createIndex(key, {
            name: idxName,
            ...(unique ? { unique } : {}),
            ...(sparse ? { sparse } : {}),
            ...(expireAfterSeconds !== undefined ? { expireAfterSeconds } : {}),
            ...(partialFilterExpression ? { partialFilterExpression } : {}),
          })
          .catch((e: any) => console.warn(`  index ${idxName} on ${name}: ${redact(String(e?.message ?? e))}`));
      }

      const dstCount = await dstCol.countDocuments();
      const ok = dstCount === total && copied === total;
      if (!ok) failures.push(name);
      console.log(`${ok ? 'OK ' : 'ERR'} ${name}: ${dstCount}/${total} docs, ${indexes.length} indexes`);
    }

    if (failures.length > 0) {
      console.error(`\nMIGRATION INCOMPLETE - count mismatch in: ${failures.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    console.log('\nMigration complete - all collection counts match.');
  } finally {
    await Promise.all([src.close(), dst.close()]);
  }
}

// Runs only when started directly (ts-node ...), never when imported by a test.
if (require.main === module) {
  main().catch((e) => {
    console.error('Migration failed:', redact(String(e?.message ?? e)));
    process.exit(1);
  });
}
