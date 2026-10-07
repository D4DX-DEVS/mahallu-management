import mongoose from 'mongoose';
import Counter from '../models/Counter';
import { nextSequence } from '../utils/idCounter';

/**
 * Receipt numbers for varisangya and zakat payments.
 *
 * Before: `max(existing numeric receiptNo) + 1` computed per request. Two requests read the same max
 * and issued the same number; a client could submit any receiptNo unchecked; a stored value such as
 * "99999999999" made `$toInt` throw and broke numbering for the whole tenant.
 *
 * Now: one atomic counter per (kind, tenant) (`receipt:<kind>:<tenantId>`), seeded ONCE from the highest
 * existing number that is a plain 1-9 digit string (longer digit strings are ignored, so `$toInt` can
 * never overflow). Numbers already in use are skipped (exists check, bounded attempts). The counter
 * never goes backwards, so a number is never reissued; a failed save leaves a gap, which is the price of
 * never handing out the same number twice.
 */

export type ReceiptKind = 'varisangya' | 'zakat';

/** Numbering starts after this when a tenant has no numeric receipt yet (unchanged from before). */
export const RECEIPT_START = 14000;
/** Only these existing receipt numbers count for seeding. 9 digits always fits `$toInt`. */
export const SAFE_NUMERIC_RECEIPT = /^\d{1,9}$/;
/** What a client may supply as its own receipt number. */
export const CLIENT_RECEIPT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,31}$/;
const MAX_ATTEMPTS = 10;

const tenantObjectId = (tenantId: string | mongoose.Types.ObjectId) =>
  tenantId instanceof mongoose.Types.ObjectId ? tenantId : new mongoose.Types.ObjectId(String(tenantId));

export const receiptCounterKey = (kind: ReceiptKind, tenantId: string | mongoose.Types.ObjectId) =>
  `receipt:${kind}:${String(tenantId)}`;

/** Highest existing numeric receipt for the tenant (never lower than RECEIPT_START). */
export async function seedReceiptNumber(
  model: { aggregate: (pipeline: any[]) => any },
  tenantId: string | mongoose.Types.ObjectId
): Promise<number> {
  const rows: any[] = await model.aggregate([
    { $match: { tenantId: tenantObjectId(tenantId), receiptNo: { $regex: SAFE_NUMERIC_RECEIPT } } },
    { $group: { _id: null, max: { $max: { $toInt: '$receiptNo' } } } },
  ]);
  const max = Number(rows?.[0]?.max);
  return Math.max(RECEIPT_START, Number.isFinite(max) ? max : 0);
}

/**
 * Reserve the next free receipt number for this tenant and kind.
 * Throws after MAX_ATTEMPTS only if the counter keeps landing on taken numbers (data far ahead of it).
 */
export async function allocateReceiptNo(
  kind: ReceiptKind,
  model: { aggregate: (pipeline: any[]) => any; exists: (filter: any) => any },
  tenantId: string | mongoose.Types.ObjectId
): Promise<string> {
  const key = receiptCounterKey(kind, tenantId);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const n = await nextSequence(key, { seed: () => seedReceiptNumber(model, tenantId) });
    const candidate = String(n);
    const taken = await model.exists({ tenantId: tenantObjectId(tenantId), receiptNo: candidate });
    if (!taken) return candidate;
  }
  throw new Error('Could not allocate a receipt number.');
}

/**
 * The number the next payment will most likely get. INFORMATIONAL ONLY: it is not reserved, so a payment
 * saved by someone else in between takes it and the saved payment gets the following one. Read-only.
 */
export async function peekNextReceiptNo(
  kind: ReceiptKind,
  model: { aggregate: (pipeline: any[]) => any },
  tenantId: string | mongoose.Types.ObjectId
): Promise<string> {
  const counter: any = await Counter.findById(receiptCounterKey(kind, tenantId)).lean();
  if (counter && typeof counter.seq === 'number') return String(counter.seq + 1);
  return String((await seedReceiptNumber(model, tenantId)) + 1);
}
