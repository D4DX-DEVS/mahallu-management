import mongoose, { ClientSession } from 'mongoose';
import { LedgerItem, Ledger, InstituteAccount, MahalluAccount } from '../models/MasterAccount';
import { ReconciliationRequiredError, reportReconciliationRequired } from '../utils/reconciliation';

export type LedgerSource = 'salary' | 'varisangya' | 'zakat' | 'petty_cash' | 'manual' | 'welfare' | 'zakat_distribution';

/** Sources that post one entry per source document and can therefore be reversed by (source, sourceId). */
export const REVERSIBLE_SOURCES = ['salary', 'varisangya', 'zakat', 'zakat_distribution', 'welfare', 'petty_cash'] as const;
export type ReversibleSource = (typeof REVERSIBLE_SOURCES)[number];

interface PostLedgerEntryParams {
  tenantId: string | mongoose.Types.ObjectId;
  instituteId?: string | mongoose.Types.ObjectId;
  ledgerName: string;
  ledgerType: 'income' | 'expense';
  amount: number;
  description: string;
  date: Date;
  source: LedgerSource;
  sourceId: mongoose.Types.ObjectId;
  paymentMethod?: string;
  referenceNo?: string;
  categoryName?: string;
}

export interface LedgerOptions {
  /** Pass the session of the surrounding transaction (undefined when the cluster has none). */
  session?: ClientSession;
}

export interface PostLedgerResult {
  /** false when an entry for (source, sourceId) already existed: nothing was posted or incremented. */
  created: boolean;
  itemId?: mongoose.Types.ObjectId;
  accountId?: mongoose.Types.ObjectId;
}

export interface ReverseLedgerOptions extends LedgerOptions {
  /** Restrict the reversal to this tenant (callers that know it should pass it). */
  tenantId?: string | mongoose.Types.ObjectId;
}

const oid = (value: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

const isDuplicateKey = (err: unknown): boolean => {
  const code = (err as { code?: unknown })?.code;
  return code === 11000 || code === 11001;
};

/**
 * Find or create a ledger by name and type for the given tenant.
 * This avoids requiring pre-configuration of ledgers for auto-posting.
 *
 * - A Mahallu-level lookup (no institute) matches `instituteId: null` EXACTLY, so it can never pick an
 *   institute's ledger of the same name.
 * - Creation is an atomic upsert on that key, and the ledger carries `auto: true` which the unique
 *   partial index covers, so two requests creating it together end up with one ledger. The loser of
 *   the race (duplicate-key error) simply reads the winner's. Without the index (build failed) the
 *   upsert still avoids the common read-then-insert race, and the oldest match is always the one used.
 * - Ledgers are created outside any transaction on purpose: an empty ledger is harmless to keep if the
 *   payment that needed it fails, and a duplicate-key error inside a transaction would abort it.
 */
async function findOrCreateLedger(
  tenantId: mongoose.Types.ObjectId,
  instituteId: mongoose.Types.ObjectId | undefined,
  name: string,
  type: 'income' | 'expense'
): Promise<mongoose.Types.ObjectId> {
  const key = { tenantId, instituteId: instituteId || null, name, type };

  const existing: any = await Ledger.findOne(key).sort({ createdAt: 1 }).lean();
  if (existing) return existing._id as mongoose.Types.ObjectId;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ledger: any = await Ledger.findOneAndUpdate(
        key,
        { $setOnInsert: { description: `Auto-created ledger for ${type} - ${name}`, auto: true } },
        { upsert: true, new: true }
      );
      if (ledger) return ledger._id as mongoose.Types.ObjectId;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      const winner: any = await Ledger.findOne(key).sort({ createdAt: 1 }).lean();
      if (winner) return winner._id as mongoose.Types.ObjectId;
    }
  }
  throw new Error(`Could not find or create the "${name}" ledger.`);
}

type AccountRef = { id: mongoose.Types.ObjectId; type: 'institute' | 'mahallu' };

/** The account an entry moves: the first active account (oldest first). Pinned on the item afterwards. */
async function resolveAccount(
  tenantId: mongoose.Types.ObjectId,
  instituteId: mongoose.Types.ObjectId | undefined,
  session?: ClientSession
): Promise<AccountRef | null> {
  if (instituteId) {
    const account: any = await InstituteAccount.findOne({ tenantId, instituteId, status: 'active' })
      .sort({ createdAt: 1 })
      .session(session ?? null);
    return account ? { id: account._id, type: 'institute' } : null;
  }
  const account: any = await MahalluAccount.findOne({ tenantId, status: 'active' })
    .sort({ createdAt: 1 })
    .session(session ?? null);
  return account ? { id: account._id, type: 'mahallu' } : null;
}

const accountModel = (type: 'institute' | 'mahallu') => (type === 'institute' ? InstituteAccount : MahalluAccount);

async function incrementAccount(account: AccountRef, change: number, session?: ClientSession): Promise<void> {
  if (change === 0) return;
  await (accountModel(account.type) as any).findOneAndUpdate(
    { _id: account.id },
    { $inc: { balance: change } },
    { session }
  );
}

/**
 * Post a ledger entry automatically when a transaction occurs.
 * Also updates the InstituteAccount / MahalluAccount balance if one is active.
 *
 * IDEMPOTENT per (source, sourceId): the item is written with an upsert keyed on that pair, and ONLY the
 * call that actually inserted it moves the account balance. A retry, a double click or a concurrent
 * duplicate therefore cannot double-post or double-increment. If the balance update fails after the
 * insert, the just-inserted item is removed again so a retry starts clean (and the error is thrown).
 *
 * Posting failures are NOT swallowed here: the promise rejects. A caller may catch and log if it
 * explicitly decides the ledger is best-effort for that flow (none of the collection flows do).
 *
 * `source: 'manual'` / a missing sourceId has no key to dedupe on and always inserts.
 */
export async function postLedgerEntry(
  params: PostLedgerEntryParams,
  options: LedgerOptions = {}
): Promise<PostLedgerResult> {
  const { session } = options;
  if (!Number.isFinite(params.amount) || params.amount < 0) {
    throw new Error('A ledger entry needs a valid amount.');
  }

  const tenantId = oid(params.tenantId);
  const instituteId = params.instituteId ? oid(params.instituteId) : undefined;

  const ledgerId = await findOrCreateLedger(tenantId, instituteId, params.ledgerName, params.ledgerType);
  const account = await resolveAccount(tenantId, instituteId, session);

  const fields: Record<string, unknown> = {
    tenantId,
    instituteId: instituteId || null,
    ledgerId,
    date: params.date,
    amount: params.amount,
    type: params.ledgerType,
    description: params.description,
    paymentMethod: params.paymentMethod,
    referenceNo: params.referenceNo,
    source: params.source,
    sourceId: params.sourceId,
  };
  if (account) {
    fields.accountId = account.id;
    fields.accountType = account.type;
  }

  let created = false;
  let item: any;

  if (params.source !== 'manual' && params.sourceId) {
    const { source, sourceId, ...rest } = fields;
    try {
      const result: any = await LedgerItem.findOneAndUpdate(
        { source, sourceId },
        { $setOnInsert: rest },
        { upsert: true, new: true, includeResultMetadata: true, session }
      );
      item = result?.value ?? null;
      created = result?.lastErrorObject?.updatedExisting === false;
    } catch (err) {
      // Lost the insert race to an identical post: it already did (or is doing) the balance update.
      if (!isDuplicateKey(err)) throw err;
      return { created: false };
    }
  } else {
    const [doc] = await LedgerItem.create([fields], { session });
    item = doc;
    created = true;
  }

  if (!created) return { created: false, itemId: item?._id, accountId: item?.accountId };

  if (account) {
    try {
      await incrementAccount(account, params.ledgerType === 'income' ? params.amount : -params.amount, session);
    } catch (err) {
      // Without a transaction the item is already stored: take it back so a retry can post cleanly.
      if (!session && item?._id) {
        try {
          await LedgerItem.deleteOne({ _id: item._id });
        } catch (cleanupErr) {
          // The entry is stored but the account balance never moved, and a retry would see the entry and
          // skip the balance update: the books and the account now disagree until somebody fixes it.
          await reportReconciliationRequired({
            flow: `ledger post (${params.source})`,
            entity: 'LedgerItem',
            entityId: item._id,
            tenantId,
            step: 'remove ledger entry after failed balance update',
            reason: cleanupErr,
            state: { source: params.source, sourceId: String(params.sourceId), amount: params.amount, balanceMoved: false },
          });
          throw new ReconciliationRequiredError(err, ['ledger entry removal']);
        }
      }
      throw err;
    }
  }

  return { created: true, itemId: item?._id, accountId: account?.id };
}

/** The account a stored item moved: the pinned one, else (older items) the first active one as before. */
async function accountForItem(entry: any, session?: ClientSession): Promise<AccountRef | null> {
  if (entry.accountId) {
    return {
      id: entry.accountId,
      type: entry.accountType === 'institute' || entry.accountType === 'mahallu'
        ? entry.accountType
        : entry.instituteId ? 'institute' : 'mahallu',
    };
  }
  return resolveAccount(
    entry.tenantId,
    entry.instituteId ? (entry.instituteId as mongoose.Types.ObjectId) : undefined,
    session
  );
}

/**
 * Reverse every ledger entry previously posted for (source, sourceId) and put the bank balance back.
 * Supports every auto-posting source (salary, varisangya, zakat, zakat_distribution, welfare, petty_cash).
 *
 * Each entry is first CLAIMED by deleting it (atomic, exactly one caller wins), and only the winner
 * adjusts the balance, on the account the entry was pinned to when it was posted (older entries without
 * a pinned account fall back to the first active account, as before). So two concurrent reversals, or a
 * retry, can never apply the balance change twice. If the balance update fails, the entry is put back
 * and the error is thrown.
 *
 * Returns the entries that were removed (empty when there was nothing to reverse).
 */
export async function reverseLedgerEntry(
  source: ReversibleSource,
  sourceId: mongoose.Types.ObjectId,
  options: ReverseLedgerOptions = {}
): Promise<any[]> {
  const { session } = options;
  if (!(REVERSIBLE_SOURCES as readonly string[]).includes(source)) {
    throw new Error(`Ledger entries from "${source}" cannot be reversed automatically.`);
  }

  const filter: Record<string, unknown> = { source, sourceId };
  if (options.tenantId) filter.tenantId = oid(options.tenantId);

  const entries: any[] = await LedgerItem.find(filter).session(session ?? null);
  const removed: any[] = [];

  for (const entry of entries) {
    const claimed: any = await LedgerItem.findOneAndDelete({ _id: entry._id }, { session });
    if (!claimed) continue; // somebody else reversed it

    try {
      const account = await accountForItem(claimed, session);
      if (account) {
        await incrementAccount(account, claimed.type === 'income' ? -claimed.amount : claimed.amount, session);
      }
    } catch (err) {
      if (!session) {
        try {
          const plain = typeof claimed.toObject === 'function' ? claimed.toObject() : claimed;
          await LedgerItem.create([plain]);
        } catch (restoreErr) {
          // The entry is gone but the account balance was not adjusted for it.
          await reportReconciliationRequired({
            flow: `ledger reversal (${source})`,
            entity: 'LedgerItem',
            entityId: claimed._id,
            tenantId: claimed.tenantId,
            step: 'restore ledger entry after failed reversal',
            reason: restoreErr,
            state: { source, sourceId: String(sourceId), amount: claimed.amount, balanceMoved: false },
          });
          throw new ReconciliationRequiredError(err, ['ledger entry restore']);
        }
      }
      throw err;
    }
    removed.push(claimed);
  }

  return removed;
}
