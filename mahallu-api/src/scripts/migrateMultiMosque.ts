/**
 * One-off migration for the multi-mosque feature.
 *
 * 1. Drops the old unique index on MosqueProfile.tenantId. That index predates
 *    multi-mosque support (one profile per tenant) and Mongoose never drops
 *    stale indexes on its own — leaving it in place would block creating a
 *    second mosque for any tenant with a duplicate-key error.
 * 2. Backfills Asset.mosqueId: for every tenant that already has exactly one
 *    mosque profile (the common case, since only one was allowed before this
 *    feature), assigns that mosque to all of the tenant's existing assets
 *    that don't yet have a mosqueId. Tenants with zero or multiple mosque
 *    profiles are left alone — those assets stay unassigned until a person
 *    picks a mosque for them.
 *
 * Re-runnable: safe to run more than once.
 *
 * Usage: npx ts-node src/scripts/migrateMultiMosque.ts
 */
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import MosqueProfile from '../models/MosqueProfile';
import { Asset } from '../models/Asset';

async function main() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) throw new Error('MONGODB_URI must be set in .env');

  await mongoose.connect(mongoURI);
  console.log('Connected to', mongoose.connection.db?.databaseName);

  const collection = mongoose.connection.collection('mosqueprofiles');
  const indexes = await collection.indexes();
  const staleIndex = indexes.find((i) => i.key && i.key.tenantId === 1 && i.unique);
  if (staleIndex?.name) {
    await collection.dropIndex(staleIndex.name);
    console.log(`Dropped stale unique index "${staleIndex.name}" on mosqueprofiles.tenantId`);
  } else {
    console.log('No stale unique index found on mosqueprofiles.tenantId — nothing to drop');
  }

  const tenantsWithOneMosque = await MosqueProfile.aggregate([
    { $group: { _id: '$tenantId', mosqueIds: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: 1 } },
  ]);

  let backfilled = 0;
  for (const { _id: tenantId, mosqueIds } of tenantsWithOneMosque) {
    const result = await Asset.updateMany(
      { tenantId, mosqueId: { $exists: false } },
      { $set: { mosqueId: mosqueIds[0] } }
    );
    backfilled += result.modifiedCount;
  }
  console.log(`Backfilled mosqueId on ${backfilled} asset(s) across ${tenantsWithOneMosque.length} tenant(s)`);

  await mongoose.connection.close();
  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
