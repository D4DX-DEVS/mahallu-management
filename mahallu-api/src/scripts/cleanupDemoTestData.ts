/**
 * Removes the TEST documents that development agents left in the demo tenant
 * "ZAAD Demo Mahallu" (code ZDM001). Default is a DRY RUN that only prints counts.
 *
 *   npx ts-node src/scripts/cleanupDemoTestData.ts            # dry run
 *   npx ts-node src/scripts/cleanupDemoTestData.ts --apply    # delete
 *
 * Scope is limited to tenant ZDM001 and to documents identified by name/remark/id:
 * - archived families whose houseName contains "ZZT" (and their members, wallets, transactions, receipts)
 * - receipts with remarks "TEST-ZZ" and three named test receipts
 * - campaigns whose name contains "ZZTEST" (with contributions and udhiya bookings)
 * - one test cash closing, one test collector wallet, orphan announcement delivery rows
 * Nothing outside the demo tenant is touched. The seeded demo data (see demo-seed-manifest.json) is not touched.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';

dotenv.config();
const APPLY = process.argv.includes('--apply');
const O = (s: string) => new mongoose.Types.ObjectId(s);

(async () => {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const demo: any = await db.collection('tenants').findOne({ code: 'ZDM001' });
  if (!demo) throw new Error('Demo tenant ZDM001 not found');
  const t = demo._id;

  const run = async (name: string, filter: any) => {
    const col = db.collection(name);
    if (!APPLY) {
      console.log(`DRY  ${name}: would delete ${await col.countDocuments(filter)}`);
    } else {
      const r = await col.deleteMany(filter);
      console.log(`DONE ${name}: deleted ${r.deletedCount}`);
    }
  };

  const famIds = (await db.collection('families').find({ tenantId: t, houseName: /ZZT/i, isArchived: true }).project({ _id: 1 }).toArray()).map((f: any) => f._id);
  const testWallet = O('6acca178da88057c93174274');
  const wIds = (await db.collection('wallets').find({ tenantId: t, $or: [{ familyId: { $in: famIds } }, { _id: testWallet }] }).project({ _id: 1 }).toArray()).map((w: any) => w._id);
  const cIds = (await db.collection('campaigns').find({ tenantId: t, name: /ZZTEST/i }).project({ _id: 1 }).toArray()).map((c: any) => c._id);

  await run('transactions', { tenantId: t, walletId: { $in: wIds } });
  await run('wallets', { _id: { $in: wIds }, tenantId: t });
  await run('varisangyas', {
    tenantId: t,
    $or: [
      { remarks: 'TEST-ZZ' },
      { _id: { $in: ['6acca4a4168c8f9620022001', '6accafb3dcc7b44547e3a382', '6accafb8dcc7b44547e3a39f'].map(O) } },
      { familyId: { $in: famIds } },
    ],
  });
  await run('zakats', { tenantId: t, remarks: 'TEST-ZZ' });
  await run('campaigncontributions', { tenantId: t, campaignId: { $in: cIds } });
  await run('udhiyabookings', { tenantId: t, campaignId: { $in: cIds } });
  await run('campaigns', { _id: { $in: cIds }, tenantId: t });
  await run('cashclosings', { _id: O('6acca2541b0e14eb7f2b27e2'), tenantId: t });
  await run('announcementdeliveries', { announcementId: O('6acca2751b0e14eb7f2b28af') });
  await run('members', { tenantId: t, familyId: { $in: famIds } });
  await run('families', { _id: { $in: famIds }, tenantId: t });

  console.log(
    'Demo tenant now:',
    'families', await db.collection('families').countDocuments({ tenantId: t }),
    'members', await db.collection('members').countDocuments({ tenantId: t }),
    '(seed was 28 families, 101 members)'
  );
  if (!APPLY) console.log('Dry run only. Re-run with --apply to delete.');
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
