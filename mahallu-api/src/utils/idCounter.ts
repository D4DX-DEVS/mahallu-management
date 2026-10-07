import Counter from '../models/Counter';

/**
 * Atomic number allocation for human-readable ids (certificate numbers, family / member ids,
 * case numbers).
 *
 * Why a counter instead of "count + 1" or "last created + 1":
 *   - two requests running together read the same count and are handed the same number;
 *   - a delete makes count + 1 land on a number that is still in use;
 *   - a number that is global (certificates) cannot be derived from one Mahallu's own rows.
 *
 * Design
 *   - One row per sequence key in `counters`, advanced only with a single atomic
 *     `findOneAndUpdate({ _id: key }, { $inc: { seq: n } }, { new: true })`.
 *   - A counter row never exists unseeded. When the key has no row yet, the first caller computes a
 *     seed (the highest number already used by existing data, so nothing already issued is ever
 *     handed out again) and inserts the row with `_id = key` (unique). Two first callers racing both
 *     compute the same seed; one insert wins, the other gets E11000 and simply takes its number with
 *     the normal atomic `$inc` on the row that now exists.
 *   - Rows are never decremented, so deleting a record never makes its number reusable.
 */

export interface NextSequenceOptions {
  /** Highest number already in use by existing data. Called at most once per key, on first use. */
  seed?: () => Promise<number>;
  /** Reserve a block of this many numbers (bulk import). The LAST number of the block is returned. Default 1. */
  by?: number;
}

export const isDuplicateKeyError = (err: unknown, field?: string): boolean => {
  const e = err as { code?: unknown; keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown>; message?: unknown };
  if (e?.code !== 11000 && e?.code !== 11001) return false;
  if (!field) return true;
  if (e.keyPattern && field in e.keyPattern) return true;
  if (e.keyValue && field in e.keyValue) return true;
  // Older drivers only put the index name in the message.
  return typeof e.message === 'string' && e.message.includes(field);
};

const safeBase = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/**
 * The next number of the sequence `key` (1, 2, 3 ... or seed + 1 on first use).
 * With `by > 1` the block `[result - by + 1, result]` is reserved and `result` is returned.
 */
export async function nextSequence(key: string, options: NextSequenceOptions = {}): Promise<number> {
  const by = Math.max(1, Math.floor(options.by ?? 1));
  const advance = async (): Promise<number | null> => {
    const doc: any = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: by } }, { new: true });
    return doc && typeof doc.seq === 'number' ? doc.seq : null;
  };

  const current = await advance();
  if (current !== null) return current;

  // First use of this key: start after whatever already exists.
  const base = safeBase(options.seed ? await options.seed() : 0);
  try {
    await Counter.create({ _id: key, seq: base + by });
    return base + by;
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    // Somebody else created the row between our two steps: take a number from it.
    const after = await advance();
    if (after === null) throw err;
    return after;
  }
}

/**
 * Highest N among rows whose `field` matches `pattern` (capture group 1 is the number).
 * Used only to seed a counter, so reading the matching ids once is acceptable.
 */
export async function maxNumericSuffix(
  model: { find: (filter: any) => any },
  filter: Record<string, unknown>,
  field: string,
  pattern: RegExp
): Promise<number> {
  const rows: any[] = await model.find({ ...filter, [field]: { $regex: pattern } }).select(field).lean();
  let max = 0;
  for (const row of rows || []) {
    const match = pattern.exec(String(row?.[field] ?? ''));
    const n = match ? parseInt(match[1], 10) : NaN;
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export interface SequencedCreateOptions {
  seed?: () => Promise<number>;
  /** The unique field whose E11000 means "that number is taken": only that error is retried. */
  field: string;
  attempts?: number;
}

/**
 * Take the next number and run `build(number)` (typically `doc.save()`); when the database reports
 * the number as already used (unique index on `field`), take the next number and try again. If the
 * unique index is not built the first attempt simply succeeds.
 */
export async function createWithSequence<T>(
  key: string,
  options: SequencedCreateOptions,
  build: (seq: number) => Promise<T>
): Promise<T> {
  const attempts = options.attempts ?? 5;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    const seq = await nextSequence(key, { seed: options.seed });
    try {
      return await build(seq);
    } catch (err) {
      if (!isDuplicateKeyError(err, options.field)) throw err;
      last = err;
    }
  }
  throw last;
}

/**
 * Reserve `count` consecutive numbers none of which is in `taken(candidates)`; used by bulk import,
 * which inserts many rows at once and so cannot retry one row at a time. Returns the first number.
 */
export async function reserveBlock(
  key: string,
  count: number,
  options: { seed?: () => Promise<number>; taken: (first: number, count: number) => Promise<boolean>; attempts?: number }
): Promise<number> {
  const attempts = options.attempts ?? 5;
  for (let i = 0; i < attempts; i++) {
    const last = await nextSequence(key, { seed: options.seed, by: count });
    const first = last - count + 1;
    if (!(await options.taken(first, count))) return first;
  }
  throw new Error('Could not reserve a block of ids');
}
