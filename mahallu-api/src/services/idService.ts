import mongoose, { ClientSession } from 'mongoose';
import Family from '../models/Family';
import Member from '../models/Member';
import { nextSequence, maxSuffix, bumpSequenceTo } from './counterService';

const FID_RE = /^FID(\d+)$/i;

/**
 * Next free Family ID (FID<n>) for a tenant, from an atomic counter.
 * `exists` check + retry guards against ids that were typed in by hand or imported
 * with a number the counter has not seen (no unique index is added: existing data stays untouched).
 */
export async function nextFamilyMahallId(tenantId: string | mongoose.Types.ObjectId, session?: ClientSession): Promise<string> {
  const key = `family:${tenantId}`;
  const seed = async () => {
    const rows = await Family.find({ tenantId, mahallId: /^FID\d+$/i }).select('mahallId').lean();
    return maxSuffix(rows.map((r) => r.mahallId), FID_RE);
  };
  for (let attempt = 0; attempt < 25; attempt++) {
    const n = await nextSequence(key, seed);
    const candidate = `FID${n}`;
    const taken = await Family.exists({ tenantId, mahallId: candidate }).session(session || null);
    if (!taken) return candidate;
    // Someone used this number out of band; make sure the counter moves past all existing ids.
    await bumpSequenceTo(key, await seed());
  }
  throw new Error('Could not allocate a unique family ID, please try again');
}

/** Reserve `count` consecutive family ids (bulk import). */
export async function reserveFamilyMahallIds(tenantId: string | mongoose.Types.ObjectId, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) ids.push(await nextFamilyMahallId(tenantId));
  return ids;
}

/** Next Member ID inside a family: <familyMahallId>-<n>, counter per family. */
export async function nextMemberMahallId(
  family: { _id: mongoose.Types.ObjectId | string; mahallId?: string; tenantId?: any },
  session?: ClientSession
): Promise<string | undefined> {
  if (!family.mahallId) return undefined;
  const prefix = family.mahallId;
  const key = `member:${family._id}`;
  const re = new RegExp(`-(\\d+)$`);
  const seed = async () => {
    const rows = await Member.find({ familyId: family._id }).select('mahallId').lean();
    // Never fewer than the head-count (old logic used count+1) so numbering stays monotonic.
    return Math.max(rows.length, maxSuffix(rows.map((r) => r.mahallId), re));
  };
  for (let attempt = 0; attempt < 25; attempt++) {
    const n = await nextSequence(key, seed);
    const candidate = `${prefix}-${n}`;
    const taken = await Member.exists({ familyId: family._id, mahallId: candidate }).session(session || null);
    if (!taken) return candidate;
    await bumpSequenceTo(key, await seed());
  }
  throw new Error('Could not allocate a unique member ID, please try again');
}
