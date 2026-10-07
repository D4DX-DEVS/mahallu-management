import mongoose, { ClientSession } from 'mongoose';
import { Wallet, Transaction } from '../models/Collectible';
import Family from '../models/Family';
import Member from '../models/Member';
import { isDuplicateKeyError } from '../utils/idCounter';
import { searchRegex } from '../utils/queryGuard';
import { round2 } from '../utils/money';

/**
 * Wallet and wallet-journal (Transaction) operations.
 *
 * Rules every function here follows:
 *   - a balance only ever changes with ONE atomic `$inc` on the wallet document, never read-modify-save,
 *     so concurrent credits/debits cannot overwrite each other;
 *   - a debit is conditional (`balance >= amount`), so a wallet can never go negative;
 *   - journal rows (Transaction) carry an `entryKey`, so writing the same step twice (retry) is a no-op.
 *
 * WHICH WALLET. A wallet belongs to exactly one owner:
 *   - a payment that names a member (admin member payment, or any member self-submission, which also
 *     carries the family) credits that MEMBER's wallet            -> key `m:<memberId>`
 *   - a payment that names only a family credits the FAMILY wallet -> key `f:<familyId>`
 * The same rule is used by verify/create/update/delete (collectibleController) and by the member-facing
 * getOwnWallet / getOwnWalletTransactions, so they always resolve the same document. Before, the admin
 * side looked up {familyId, memberId} while the member side looked up {memberId}, so a wallet created by
 * one could be missed (and duplicated) by the other.
 */

export interface WalletOwner {
  tenantId: string | mongoose.Types.ObjectId;
  familyId?: string | mongoose.Types.ObjectId | null;
  memberId?: string | mongoose.Types.ObjectId | null;
}

const asOid = (value: string | mongoose.Types.ObjectId) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

/** The semantic filter, the unique key and the owner fields for a wallet; null if the payer has neither. */
export const walletKeyFor = (owner: WalletOwner) => {
  const tenantId = asOid(owner.tenantId);
  if (owner.memberId) {
    const memberId = asOid(owner.memberId);
    return {
      key: `m:${String(memberId)}`,
      filter: { tenantId, memberId } as Record<string, unknown>,
      fields: { memberId } as Record<string, unknown>,
    };
  }
  if (owner.familyId) {
    const familyId = asOid(owner.familyId);
    return {
      key: `f:${String(familyId)}`,
      // memberId: null also matches a wallet saved without the field (how family wallets were created)
      filter: { tenantId, familyId, memberId: null } as Record<string, unknown>,
      fields: { familyId } as Record<string, unknown>,
    };
  }
  return null;
};

/** The existing wallet for an owner (oldest if legacy duplicates exist), or null. Never creates. */
export async function findWallet(owner: WalletOwner, session?: ClientSession): Promise<any | null> {
  const spec = walletKeyFor(owner);
  if (!spec) return null;
  return Wallet.findOne(spec.filter).sort({ createdAt: 1 }).session(session ?? null);
}

/**
 * The owner's wallet, created if it does not exist, by ONE atomic upsert on the unique key, so
 * concurrent callers (admin verify racing a member opening the app) cannot create two. A duplicate-key
 * loser re-reads the winner's wallet. Run it OUTSIDE a transaction: an empty wallet is harmless if the
 * payment that needed it fails, and a duplicate-key error would abort the transaction.
 */
export async function findOrCreateWallet(owner: WalletOwner): Promise<any> {
  const spec = walletKeyFor(owner);
  if (!spec) throw new Error('A wallet needs a family or a member.');

  const existing = await findWallet(owner);
  if (existing) return existing;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const wallet = await Wallet.findOneAndUpdate(
        { tenantId: spec.filter.tenantId, key: spec.key },
        { $setOnInsert: { ...spec.fields, balance: 0 } },
        { upsert: true, new: true }
      );
      if (wallet) return wallet;
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      const winner = await findWallet(owner);
      if (winner) return winner;
    }
  }
  throw new Error('Could not find or create the wallet.');
}

/** Atomically add `amount` (> 0) to the balance. Returns the updated wallet, or null if it vanished. */
export async function creditWallet(
  walletId: mongoose.Types.ObjectId,
  amount: number,
  date?: Date,
  session?: ClientSession
): Promise<any | null> {
  assertAmount(amount);
  const set: Record<string, unknown> = {};
  if (date) set.lastTransactionDate = date;
  return Wallet.findOneAndUpdate(
    { _id: walletId },
    { $inc: { balance: amount }, ...(date ? { $set: set } : {}) },
    { new: true, session }
  );
}

/**
 * Atomically subtract `amount` (> 0) ONLY IF the balance covers it. Returns the updated wallet, or null
 * when the balance is too low (or the wallet is gone): nothing is changed in that case.
 */
export async function debitWallet(
  walletId: mongoose.Types.ObjectId,
  amount: number,
  date?: Date,
  session?: ClientSession
): Promise<any | null> {
  assertAmount(amount);
  return Wallet.findOneAndUpdate(
    { _id: walletId, balance: { $gte: amount } },
    { $inc: { balance: -amount }, ...(date ? { $set: { lastTransactionDate: date } } : {}) },
    { new: true, session }
  );
}

function assertAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('A wallet change needs an amount greater than zero.');
}

export interface JournalEntry {
  tenantId: string | mongoose.Types.ObjectId;
  walletId: mongoose.Types.ObjectId;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  referenceId: mongoose.Types.ObjectId;
  referenceType: 'varisangya' | 'zakat';
  kind: 'payment' | 'adjustment' | 'reversal';
  /** Unique per tenant: writing the same key twice returns the first row and adds nothing. */
  entryKey: string;
}

/**
 * Write one journal row, idempotently by (tenantId, entryKey).
 *
 * The journal is APPEND-ONLY: editing a verified payment adds an `adjustment` row for the difference and
 * deleting one adds a `reversal` row. Nothing is edited or removed, so the history of what happened to a
 * wallet is always complete and the rows always sum to the balance. (Rows are only removed by the undo
 * of a step that failed in the same request.)
 */
export async function recordTransaction(entry: JournalEntry, session?: ClientSession): Promise<any> {
  const { tenantId, entryKey, ...rest } = entry;
  const tenant = asOid(tenantId);
  return Transaction.findOneAndUpdate(
    { tenantId: tenant, entryKey },
    { $setOnInsert: rest },
    { upsert: true, new: true, session }
  );
}

/** Undo of recordTransaction, for a step that failed in the same request. */
export async function removeTransaction(
  tenantId: string | mongoose.Types.ObjectId,
  entryKey: string,
  session?: ClientSession
): Promise<void> {
  await Transaction.deleteOne({ tenantId: asOid(tenantId), entryKey }, { session });
}

/**
 * Was a wallet credit ever journaled for this payment? Used by delete/update so only effects that really
 * happened are reversed: a verify that was interrupted before crediting has no row, and deleting that
 * payment must not debit a wallet that was never credited. Rows written before entryKey existed carry
 * (referenceType, referenceId), which is matched too.
 */
export async function hasPaymentCredit(
  tenantId: string | mongoose.Types.ObjectId,
  referenceType: 'varisangya' | 'zakat',
  referenceId: mongoose.Types.ObjectId,
  session?: ClientSession
): Promise<boolean> {
  const found = await Transaction.exists({
    tenantId: asOid(tenantId),
    referenceType,
    referenceId,
    type: 'credit',
  }).session(session ?? null);
  return !!found;
}

// ---------------------------------------------------------------------------------------------------
// Wallet balances for EVERY family / member of a Mahallu (paginated, one query)
// ---------------------------------------------------------------------------------------------------

export type WalletListType = 'family' | 'member';

export interface WalletListRow {
  /** Absent for a family / member that has no wallet yet (its balance is 0). */
  walletId?: string;
  familyId?: string;
  memberId?: string;
  name: string;
  mahallId?: string;
  /** Members only: the house the member belongs to. */
  familyName?: string;
  balance: number;
  lastTransactionDate?: string | null;
}

export interface WalletListSummary {
  /** Sum of every balance in the filtered set (all pages), 2 decimals. */
  totalBalance: number;
  /** Families / members in the filtered set, with or without a wallet. */
  count: number;
  /** How many of them actually have a wallet document. */
  walletCount: number;
  /** How many of them have a balance above zero. */
  activeCount: number;
}

const EMPTY_WALLET_SUMMARY: WalletListSummary = { totalBalance: 0, count: 0, walletCount: 0, activeCount: 0 };

/**
 * The aggregation behind the wallet list. It starts from the Family (or Member) collection of ONE tenant,
 * so people without a wallet still appear (balance 0) and the page count covers all of them, and
 * left-joins the wallet with a single `$lookup` (no per-row query).
 *
 * The join uses the SAME semantic filter as `findWallet` (tenant + familyId with no memberId, or tenant +
 * memberId) instead of the `key` field: wallets created before keys existed have no key. If legacy
 * duplicates exist the oldest wins, exactly like findWallet. The tenant is checked on both sides of the
 * join, so another Mahallu's wallet can never be counted.
 *
 * `$facet` returns the requested page and the totals over the WHOLE filtered set in the same round trip.
 */
export const buildWalletListPipeline = (opts: {
  type: WalletListType;
  tenantId: string | mongoose.Types.ObjectId;
  search?: unknown;
  skip: number;
  limit: number;
}): Record<string, any>[] => {
  const tenantId = asOid(opts.tenantId);
  const isMember = opts.type === 'member';
  const term = searchRegex(opts.search);

  const match: Record<string, any> = { tenantId };
  if (isMember) match.status = { $ne: 'deleted' };
  if (term) {
    match.$or = (isMember ? ['name', 'nameMl', 'mahallId'] : ['houseName', 'houseNameMl', 'mahallId', 'familyHead']).map(
      (field) => ({ [field]: term })
    );
  }

  const walletMatch = isMember
    ? [{ $eq: ['$tenantId', tenantId] }, { $eq: ['$memberId', '$$ownerId'] }]
    : [
        { $eq: ['$tenantId', tenantId] },
        { $eq: ['$familyId', '$$ownerId'] },
        { $eq: [{ $ifNull: ['$memberId', null] }, null] },
      ];

  const ownerKey = isMember ? 'memberId' : 'familyId';
  const project: Record<string, any> = {
    _id: 0,
    [ownerKey]: '$_id',
    name: isMember ? '$name' : '$houseName',
    mahallId: 1,
    walletId: '$wallet._id',
    balance: { $ifNull: ['$wallet.balance', 0] },
    lastTransactionDate: '$wallet.lastTransactionDate',
  };
  if (isMember) {
    project.familyId = '$familyId';
    project.familyName = '$familyName';
  }

  return [
    { $match: match },
    {
      $lookup: {
        from: Wallet.collection.name,
        let: { ownerId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: walletMatch } } },
          { $sort: { createdAt: 1, _id: 1 } },
          { $limit: 1 },
          { $project: { _id: 1, balance: 1, lastTransactionDate: 1 } },
        ],
        as: 'wallet',
      },
    },
    { $unwind: { path: '$wallet', preserveNullAndEmptyArrays: true } },
    { $project: project },
    {
      $facet: {
        rows: [
          { $sort: { balance: -1, name: 1, [ownerKey]: 1 } },
          { $skip: opts.skip },
          { $limit: opts.limit },
        ],
        summary: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalBalance: { $sum: '$balance' },
              walletCount: { $sum: { $cond: [{ $eq: [{ $type: '$walletId' }, 'objectId'] }, 1, 0] } },
              activeCount: { $sum: { $cond: [{ $gt: ['$balance', 0] }, 1, 0] } },
            },
          },
        ],
      },
    },
  ];
};

/** One page of wallet balances for the tenant's families or members, plus whole-set totals. */
export async function listWalletBalances(opts: {
  type: WalletListType;
  tenantId: string | mongoose.Types.ObjectId;
  search?: unknown;
  page: number;
  limit: number;
}): Promise<{ rows: WalletListRow[]; total: number; summary: WalletListSummary }> {
  const skip = (opts.page - 1) * opts.limit;
  const pipeline = buildWalletListPipeline({ ...opts, skip, limit: opts.limit });
  const Model: any = opts.type === 'member' ? Member : Family;
  const [result] = await Model.aggregate(pipeline, { allowDiskUse: true });

  const totals = result?.summary?.[0];
  const summary: WalletListSummary = totals
    ? {
        totalBalance: round2(Number(totals.totalBalance) || 0),
        count: Number(totals.count) || 0,
        walletCount: Number(totals.walletCount) || 0,
        activeCount: Number(totals.activeCount) || 0,
      }
    : { ...EMPTY_WALLET_SUMMARY };

  const rows: WalletListRow[] = (result?.rows ?? []).map((row: any) => ({
    ...(row.walletId ? { walletId: String(row.walletId) } : {}),
    ...(row.familyId ? { familyId: String(row.familyId) } : {}),
    ...(row.memberId ? { memberId: String(row.memberId) } : {}),
    name: row.name ?? '',
    ...(row.mahallId ? { mahallId: row.mahallId } : {}),
    ...(row.familyName ? { familyName: row.familyName } : {}),
    balance: round2(Number(row.balance) || 0),
    lastTransactionDate: row.lastTransactionDate ?? null,
  }));
  return { rows, total: summary.count, summary };
}
