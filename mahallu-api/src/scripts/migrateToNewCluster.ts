/**
 * One-shot cluster migration: copies every collection (documents + indexes) of the
 * source database (MONGODB_URI) into the target cluster (MONGODB_URI_NEW).
 *
 * - Only WRITES to the target; the source is never modified.
 * - Re-runnable: target collections are dropped and recopied for a clean, exact copy.
 * - Verifies document counts per collection at the end.
 *
 * Usage: npx ts-node src/scripts/migrateToNewCluster.ts
 */
import dotenv from 'dotenv';
dotenv.config();
import { MongoClient } from 'mongodb';

const BATCH = 1000;

async function main() {
  const srcUri = process.env.MONGODB_URI;
  const dstUri = process.env.MONGODB_URI_NEW;
  if (!srcUri || !dstUri) {
    throw new Error('MONGODB_URI and MONGODB_URI_NEW must both be set in .env');
  }

  const src = new MongoClient(srcUri);
  const dst = new MongoClient(dstUri);
  await Promise.all([src.connect(), dst.connect()]);

  const srcDb = src.db(); // db name comes from the URI path (mahallu-management)
  const dstDb = dst.db();
  console.log(`Source DB: ${srcDb.databaseName} → Target DB: ${dstDb.databaseName}`);

  const collections = (await srcDb.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'));
  console.log(`Collections to migrate: ${collections.length}`);

  const failures: string[] = [];

  for (const name of collections) {
    const srcCol = srcDb.collection(name);
    const dstCol = dstDb.collection(name);
    const total = await srcCol.countDocuments();

    // Clean target for an exact copy (re-runnable)
    await dstCol.drop().catch(() => undefined);

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
        .catch((e: any) => console.warn(`  index ${idxName} on ${name}: ${e.message}`));
    }

    const dstCount = await dstCol.countDocuments();
    const ok = dstCount === total;
    if (!ok) failures.push(name);
    console.log(`${ok ? '✅' : '❌'} ${name}: ${dstCount}/${total} docs, ${indexes.length} indexes`);
  }

  await Promise.all([src.close(), dst.close()]);

  if (failures.length > 0) {
    console.error(`\nMIGRATION INCOMPLETE — count mismatch in: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('\n✅ Migration complete — all collection counts match.');
}

main().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
