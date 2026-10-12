import mongoose, { Schema } from 'mongoose';

/**
 * Atomic per-key counters stored in the shared `counters` collection.
 *
 * Key namespaces (so independent features never collide in the same collection):
 *   family:<tenantId>      -> numeric part of Family.mahallId  (FID<n>)
 *   member:<familyId>      -> numeric suffix of Member.mahallId (<familyMahallId>-<n>)
 *   nikah:<tenantId>:<yr>  -> nikah certificate sequence
 *   death:<tenantId>:<yr>  -> death certificate sequence
 *   receipt:...            -> reserved for the receipts feature
 *
 * A counter is seeded lazily from the highest numeric suffix already present, so existing
 * data is never renumbered and no migration is needed.
 */
interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  { _id: { type: String }, seq: { type: Number, default: 0 } },
  { collection: 'counters', versionKey: false, strict: false }
);

// Another module may register the same collection under this name already.
const Counter: mongoose.Model<ICounter> =
  (mongoose.models.Counter as mongoose.Model<ICounter>) ||
  mongoose.model<ICounter>('Counter', CounterSchema);

/**
 * Returns the next integer for `key`. `seed` is only called the first time the key is
 * used and must return the highest number already in use (0 when none).
 */
export async function nextSequence(key: string, seed?: () => Promise<number>): Promise<number> {
  const existing = await Counter.findById(key).lean();
  if (!existing) {
    const start = seed ? await seed() : 0;
    try {
      // $setOnInsert only: if two requests race here, one insert wins and the other is a no-op.
      await Counter.updateOne({ _id: key }, { $setOnInsert: { seq: start } }, { upsert: true });
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }
  }
  const doc = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
  return doc!.seq;
}

/** Make sure the counter is at least `value` (used after seeding discrepancies / imports). */
export async function bumpSequenceTo(key: string, value: number): Promise<void> {
  await Counter.updateOne({ _id: key }, { $max: { seq: value } }, { upsert: true });
}

/** Highest trailing integer found in `field` values that match `pattern` (first capture group). */
export function maxSuffix(values: Array<string | undefined | null>, pattern: RegExp): number {
  let max = 0;
  for (const v of values) {
    const m = v ? String(v).match(pattern) : null;
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}
