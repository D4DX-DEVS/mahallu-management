import mongoose, { ClientSession } from 'mongoose';
import Member from '../models/Member';
import { DeathRegistration } from '../models/Registration';
import { Compensations } from '../utils/transaction';

/**
 * A death registration changes the member only once an admin APPROVES it:
 *
 *   create (admin or member app)  record saved as pending; the member is untouched
 *   approve                       member.status 'inactive', isDead, dateOfDeath, deathRecordId
 *   reject / correction           member untouched
 *   approved -> anything else     member reactivated, but only if member.deathRecordId is THIS record
 *
 * A member may have at most one open (pending, correction_required or approved) death record.
 */

/** Statuses that block a second death record for the same member. */
export const OPEN_DEATH_STATUSES = ['pending', 'correction_required', 'approved'] as const;

export const DUPLICATE_DEATH_MESSAGE = 'A death registration for this member is already pending or approved.';

/** Is there another open death record for this member? `excludeId` skips the record being updated. */
export const hasOpenDeathRecord = async (
  tenantId: unknown,
  deceasedId: unknown,
  excludeId?: unknown
): Promise<boolean> => {
  if (!deceasedId) return false;
  const found = await DeathRegistration.exists({
    tenantId,
    deceasedId,
    status: { $in: OPEN_DEATH_STATUSES as unknown as string[] },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  return !!found;
};

interface DeathRecordLike {
  _id: unknown;
  tenantId: unknown;
  deceasedId?: unknown;
  deathDate?: Date;
}

/** Mark the record's member deceased. Scoped by Mahallu; registers an undo restoring the previous values. */
export const applyDeathToMember = async (
  record: DeathRecordLike,
  session: ClientSession | undefined,
  comp: Compensations
): Promise<void> => {
  if (!record.deceasedId) return;
  const before: any = await Member.findOneAndUpdate(
    { _id: record.deceasedId, tenantId: record.tenantId },
    { $set: { isDead: true, status: 'inactive', dateOfDeath: record.deathDate, deathRecordId: record._id } },
    { new: false, session }
  );
  if (!before) return;
  comp.push('member marked deceased', () =>
    Member.updateOne(
      { _id: before._id, tenantId: record.tenantId },
      before.deathRecordId
        ? { $set: { isDead: before.isDead, status: before.status, dateOfDeath: before.dateOfDeath, deathRecordId: before.deathRecordId } }
        : { $set: { isDead: before.isDead ?? false, status: before.status }, $unset: { dateOfDeath: 1, deathRecordId: 1 } }
    )
  );
};

/** Reactivate the member, only when this record is the one that marked them deceased. */
export const revertDeathOnMember = async (
  record: DeathRecordLike,
  session: ClientSession | undefined,
  comp: Compensations
): Promise<void> => {
  if (!record.deceasedId) return;
  const recordId = new mongoose.Types.ObjectId(String(record._id));
  const before: any = await Member.findOneAndUpdate(
    { _id: record.deceasedId, tenantId: record.tenantId, deathRecordId: recordId },
    { $set: { isDead: false, status: 'active' }, $unset: { dateOfDeath: 1, deathRecordId: 1 } },
    { new: false, session }
  );
  if (!before) return;
  comp.push('member reactivated', () =>
    Member.updateOne(
      { _id: before._id, tenantId: record.tenantId },
      { $set: { isDead: before.isDead, status: before.status, dateOfDeath: before.dateOfDeath, deathRecordId: recordId } }
    )
  );
};
