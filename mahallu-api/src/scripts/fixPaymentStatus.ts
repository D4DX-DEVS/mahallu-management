/**
 * One-time fix: give every varisangya / zakat payment an explicit status.
 *
 * Rows written before the status field existed have none (the schema default reads them as 'verified').
 * For those rows only:
 *   - admin-created (source missing or 'admin'), or with a receiptNo, or already verified -> 'verified'
 *   - member-submitted with no receiptNo and never verified                                -> 'pending'
 *
 * Rows that already have a status are NOT changed: a 'pending' row may still be waiting for its wallet /
 * ledger effects, and marking it verified here would skip them. Pending rows that carry a receiptNo
 * are only reported, for an admin to verify or delete through the app.
 *
 * Usage (dry run unless --apply; one Mahallu with --tenant, every Mahallu only with --all):
 *   npx ts-node src/scripts/fixPaymentStatus.ts --tenant <tenantId>
 *   npx ts-node src/scripts/fixPaymentStatus.ts --tenant <tenantId> --apply
 *   npx ts-node src/scripts/fixPaymentStatus.ts --all --apply
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { Varisangya, Zakat } from '../models/Collectible';

dotenv.config();

const argValue = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const NO_STATUS = { $or: [{ status: { $exists: false } }, { status: null }] };
const HAS_RECEIPT = { receiptNo: { $type: 'string', $ne: '' } };
const NEVER_VERIFIED = { $or: [{ verifiedAt: { $exists: false } }, { verifiedAt: null }] };

async function main() {
  const apply = process.argv.includes('--apply');
  const tenant = argValue('--tenant');
  const all = process.argv.includes('--all');

  if (!tenant && !all) {
    console.error('Pass --tenant <tenantId> (try the test Mahallu first) or --all.');
    process.exit(1);
  }
  if (tenant && !mongoose.Types.ObjectId.isValid(tenant)) {
    console.error('That --tenant is not a valid id.');
    process.exit(1);
  }

  try {
    await connectDatabase();
    const scope = tenant ? { tenantId: new mongoose.Types.ObjectId(tenant) } : {};
    console.log(`\n${apply ? 'Applying' : 'Dry run'} (${tenant ? `Mahallu ${tenant}` : 'every Mahallu'}):`);

    for (const [name, Model] of [['varisangya', Varisangya], ['zakat', Zakat]] as const) {
      const M = Model as unknown as mongoose.Model<any>;
      const toPending = { $and: [scope, NO_STATUS, { source: 'member' }, { $nor: [HAS_RECEIPT] }, NEVER_VERIFIED] };
      const toVerified = { $and: [scope, NO_STATUS, { $nor: [toPending] }] };
      const pendingWithReceipt = { $and: [scope, { status: 'pending' }, HAS_RECEIPT] };

      const [pendingCount, verifiedCount, odd] = await Promise.all([
        M.countDocuments(toPending),
        M.countDocuments(toVerified),
        M.find(pendingWithReceipt).select('_id tenantId receiptNo').lean(),
      ]);

      console.log(`\n${name}:`);
      console.log(`  no status -> verified: ${verifiedCount}`);
      console.log(`  no status -> pending:  ${pendingCount}`);
      if (odd.length) {
        console.log(`  left alone, pending but has a receipt number (verify or delete in the app): ${odd.length}`);
        for (const row of odd as any[]) console.log(`    ${row._id}  receipt ${row.receiptNo}  (tenant ${row.tenantId})`);
      }

      if (apply) {
        // Pending first: the verified filter excludes exactly these rows, so the order keeps them apart.
        await M.updateMany(toPending, { $set: { status: 'pending' } });
        await M.updateMany(toVerified, { $set: { status: 'verified' } });
      }
    }

    console.log(apply ? '\n✅ Done.' : '\nDry run only - no changes written. Re-run with --apply to make them.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();
