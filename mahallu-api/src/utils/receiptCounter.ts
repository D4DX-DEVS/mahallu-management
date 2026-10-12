import mongoose from 'mongoose';
import Tenant from '../models/Tenant';

/**
 * Atomic per-tenant, per-financial-year receipt numbering.
 *
 * Format: PREFIX/2026-27/00042  (Indian financial year, April to March, Asia/Kolkata).
 * Counters live in the shared `counters` collection: { _id: 'receipt:<tenantId>:<type>:<fy>', seq }.
 * Existing receipt numbers are never touched. A counter is created lazily the first time it is
 * needed and is seeded from the highest suffix already used with the same PREFIX/FY.
 */
export type ReceiptType = 'varisangya' | 'zakat';

export const DEFAULT_PREFIX: Record<ReceiptType, string> = { varisangya: 'VAR', zakat: 'ZAK' };

/** Indian FY label for a date, e.g. 2026-10-12 -> "2026-27", 2027-02-01 -> "2026-27". */
export const financialYearLabel = (date: Date = new Date()): string => {
  // Shift to IST so a receipt issued just after midnight on 1 April lands in the new year.
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const month = ist.getUTCMonth(); // 0 = Jan
  const startYear = month >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

const counters = () => mongoose.connection.collection('counters') as any;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPrefix = async (tenantId: string, type: ReceiptType): Promise<string> => {
  try {
    const tenant: any = await Tenant.findById(tenantId).select('settings.receiptPrefixes').lean();
    const configured = String(tenant?.settings?.receiptPrefixes?.[type] || '').trim().toUpperCase();
    if (/^[A-Z0-9]{1,8}$/.test(configured)) return configured;
  } catch {
    /* fall through to default */
  }
  return DEFAULT_PREFIX[type];
};

export const formatReceiptNo = (prefix: string, fy: string, seq: number) =>
  `${prefix}/${fy}/${String(seq).padStart(5, '0')}`;

const counterKey = (tenantId: string, type: ReceiptType, fy: string) => `receipt:${tenantId}:${type}:${fy}`;

/** Highest numeric suffix already used with this PREFIX/FY (0 when none). */
const currentMaxSuffix = async (Model: any, tenantId: string, prefix: string, fy: string): Promise<number> => {
  const re = new RegExp(`^${escapeRegex(prefix)}/${escapeRegex(fy)}/(\\d+)$`);
  const rows = await Model.find({ tenantId: new mongoose.Types.ObjectId(tenantId), receiptNo: re })
    .select('receiptNo')
    .lean();
  let max = 0;
  for (const r of rows) {
    const m = re.exec(r.receiptNo || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
};

const ensureCounter = async (Model: any, tenantId: string, type: ReceiptType, prefix: string, fy: string) => {
  const key = counterKey(tenantId, type, fy);
  const existing = await counters().findOne({ _id: key });
  if (existing) return existing.seq as number;
  const seed = await currentMaxSuffix(Model, tenantId, prefix, fy);
  try {
    await counters().updateOne({ _id: key }, { $setOnInsert: { seq: seed } }, { upsert: true });
  } catch (err: any) {
    if (err?.code !== 11000) throw err; // another request created it first: fine
  }
  return seed;
};

/** What the next receipt number will look like (does not consume the counter). */
export const peekNextReceiptNo = async (Model: any, type: ReceiptType, tenantId: string, now = new Date()) => {
  const prefix = await getPrefix(tenantId, type);
  const fy = financialYearLabel(now);
  const seq = await ensureCounter(Model, tenantId, type, prefix, fy);
  return formatReceiptNo(prefix, fy, seq + 1);
};

/** Atomically allocate the next receipt number. Skips numbers already taken (e.g. entered manually). */
export const allocateReceiptNo = async (Model: any, type: ReceiptType, tenantId: string, now = new Date()) => {
  const prefix = await getPrefix(tenantId, type);
  const fy = financialYearLabel(now);
  await ensureCounter(Model, tenantId, type, prefix, fy);
  const key = counterKey(tenantId, type, fy);
  for (let i = 0; i < 50; i++) {
    const res: any = await counters().findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { returnDocument: 'after' });
    const doc = res && Object.prototype.hasOwnProperty.call(res, 'value') ? res.value : res;
    const receiptNo = formatReceiptNo(prefix, fy, doc.seq);
    const taken = await Model.exists({ tenantId: new mongoose.Types.ObjectId(tenantId), receiptNo });
    if (!taken) return receiptNo;
  }
  throw new Error('Could not allocate a receipt number. Please try again.');
};

export const isDuplicateKeyError = (err: any) => err && (err.code === 11000 || err.code === 11001);
