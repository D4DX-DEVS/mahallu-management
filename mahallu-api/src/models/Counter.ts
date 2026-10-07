import mongoose, { Schema } from 'mongoose';

/**
 * One row per numbering sequence, e.g. `cert:nikah:2026` or `family:<tenantId>`.
 * Rows are only ever advanced with an atomic `$inc` (see utils/idCounter.ts), so two requests can
 * never be handed the same number.
 */
export interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, timestamps: false }
);

export default mongoose.model<ICounter>('Counter', CounterSchema);
