/**
 * One-time fix after "a death record only deactivates the member once it is APPROVED".
 *
 * Creating a death registration used to mark the member dead and inactive straight away, so members
 * whose record is still pending, waiting for a correction, or was rejected are wrongly inactive. This:
 *
 *   1. reactivates members marked dead who have a death record but NO approved one
 *      (isDead false, status active);
 *   2. links members of an APPROVED death record to it (deathRecordId, dateOfDeath), so a later revert of
 *      that record can reactivate them. Their dead/inactive state is (re)applied as well.
 *
 * Members marked dead with no death record at all are left alone (an admin set that by hand).
 *
 * Usage (dry run unless --apply; one Mahallu with --tenant, every Mahallu only with --all):
 *   npx ts-node src/scripts/fixDeathRecordMembers.ts --tenant <tenantId>
 *   npx ts-node src/scripts/fixDeathRecordMembers.ts --tenant <tenantId> --apply
 *   npx ts-node src/scripts/fixDeathRecordMembers.ts --all --apply
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import Member from '../models/Member';
import { DeathRegistration } from '../models/Registration';

dotenv.config();

const argValue = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

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

    const records = await DeathRegistration.find({ ...scope, deceasedId: { $ne: null } })
      .select('tenantId deceasedId deathDate status updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    // Per member: the latest approved record, and whether any record exists at all.
    const approvedOf = new Map<string, any>();
    const withRecord = new Set<string>();
    for (const r of records as any[]) {
      const key = String(r.deceasedId);
      withRecord.add(key);
      if (r.status === 'approved' && !approvedOf.has(key)) approvedOf.set(key, r);
    }

    const toReactivate = await Member.find({
      ...scope,
      _id: { $in: [...withRecord].filter((id) => !approvedOf.has(id)).map((id) => new mongoose.Types.ObjectId(id)) },
      $or: [{ isDead: true }, { status: 'inactive' }],
    })
      .select('name tenantId status isDead')
      .lean();

    const toLink = await Member.find({
      ...scope,
      _id: { $in: [...approvedOf.keys()].map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select('name tenantId deathRecordId')
      .lean();
    const unlinked = (toLink as any[]).filter((m) => String(m.deathRecordId ?? '') !== String(approvedOf.get(String(m._id))._id));

    console.log(`\n${apply ? 'Applying' : 'Dry run'} (${tenant ? `Mahallu ${tenant}` : 'every Mahallu'}):`);
    console.log(`\n1. Reactivate ${toReactivate.length} member(s) whose death record is not approved:`);
    for (const m of toReactivate as any[]) console.log(`   ${m._id}  ${m.name}  (tenant ${m.tenantId}, was ${m.status}${m.isDead ? ', dead' : ''})`);
    console.log(`\n2. Link ${unlinked.length} member(s) to their approved death record:`);
    for (const m of unlinked) console.log(`   ${m._id}  ${m.name}  -> ${approvedOf.get(String(m._id))._id}`);

    if (apply) {
      if (toReactivate.length) {
        await Member.updateMany(
          { _id: { $in: (toReactivate as any[]).map((m) => m._id) } },
          { $set: { isDead: false, status: 'active' }, $unset: { dateOfDeath: 1, deathRecordId: 1 } }
        );
      }
      for (const m of unlinked) {
        const record = approvedOf.get(String(m._id));
        await Member.updateOne(
          { _id: m._id, tenantId: record.tenantId },
          { $set: { isDead: true, status: 'inactive', dateOfDeath: record.deathDate, deathRecordId: record._id } }
        );
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
