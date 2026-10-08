import { Response } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import { Varisangya, Zakat, Wallet, Transaction, RECEIVED_PAYMENT_STATUS, isReceivedPayment } from '../models/Collectible';
import Family from '../models/Family';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { postLedgerEntry, reverseLedgerEntry } from '../services/ledgerPostingService';
import { sendFailure, UserFacingError } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';
import { parseAmountInRange, round2 } from '../utils/money';
import { isDuplicateKeyError } from '../utils/idCounter';
import { runAtomic, Compensations } from '../utils/transaction';
import {
  CallerScope,
  MSG,
  isValidId,
  refsInScope,
  requireScope,
  sendBadRequest,
  sendForeignRef,
  tenantFilterFor,
  verifyRecordAccess,
} from '../utils/scope';
import {
  CLIENT_RECEIPT_PATTERN,
  allocateReceiptNo,
  peekNextReceiptNo,
  type ReceiptKind,
} from '../services/receiptNumberService';
import {
  creditWallet,
  debitWallet,
  findOrCreateWallet,
  findWallet,
  hasPaymentCredit,
  listWalletBalances,
  recordTransaction,
  removeTransaction,
  walletKeyFor,
} from '../services/walletService';
import {
  computeFamilyDues,
  sendVarisangyaReceipt,
  sendZakatReceipt,
} from '../services/varisangyaNotificationService';

/*
 * Varisangya and zakat collections: how money moves, and what keeps it consistent.
 *
 * A payment is PENDING (a member submitted it; nothing has been received yet) or VERIFIED (money is
 * received). Only VERIFIED payments have effects: wallet credit + journal row (varisangya) and the
 * ledger entry / bank balance. Editing or deleting a pending payment touches none of that.
 *
 * Every state change runs through `runAtomic` (utils/transaction.ts): in one MongoDB transaction when
 * the cluster is a replica set / mongos, and otherwise as a sequence of atomic single-document steps,
 * each registering an undo, which are replayed in reverse if a later step fails. A failure is reported
 * to the caller (never swallowed), after the undo. Ledger posting is NOT best-effort anywhere here.
 *
 *   verify  claim `pending -> verified` with one findOneAndUpdate (exactly one caller wins; the rest get
 *           409), then wallet credit, journal row, ledger entry. Any failure undoes the steps and puts the
 *           payment back to pending.
 *   create  (admin) insert as pending, then run the SAME verify path, so there is exactly one code path
 *           that ever produces a verified payment. A failure removes the row again; a crash in between
 *           leaves a harmless pending row that a retry with the same clientRequestId completes.
 *   update  pending: fields only. verified: optimistic claim on the current amount, then wallet delta
 *           (guarded, never negative), an `adjustment` journal row, ledger reverse + re-post.
 *   delete  claim by deleting the row (one winner), then wallet debit + `reversal` journal row + ledger
 *           reversal; failure re-inserts the row and undoes the rest.
 */

const toObjectId = (id: unknown) =>
  mongoose.Types.ObjectId.isValid(String(id)) ? new mongoose.Types.ObjectId(String(id)) : undefined;

// ---------------------------------------------------------------------------
// Kind descriptors
// ---------------------------------------------------------------------------

type PaymentKind = ReceiptKind; // 'varisangya' | 'zakat'

interface KindSpec {
  name: PaymentKind;
  Model: mongoose.Model<any>;
  hasWallet: boolean;
  ledgerName: string;
  /** Body fields an update may change (everything else is ignored). */
  updatable: readonly string[];
  /** Updatable fields that change what the ledger entry says. */
  ledgerFields: readonly string[];
  notFound: string;
}

const VARISANGYA: KindSpec = {
  name: 'varisangya',
  Model: Varisangya as unknown as mongoose.Model<any>,
  hasWallet: true,
  ledgerName: 'Varisangya Collections',
  updatable: ['amount', 'paymentDate', 'paymentMethod', 'remarks', 'remarksMl'],
  ledgerFields: ['amount', 'paymentDate', 'paymentMethod'],
  notFound: "We couldn't find that varisangya payment. It may have been removed.",
};

const ZAKAT: KindSpec = {
  name: 'zakat',
  Model: Zakat as unknown as mongoose.Model<any>,
  hasWallet: false,
  ledgerName: 'Zakat Collections',
  updatable: ['payerName', 'amount', 'paymentDate', 'paymentMethod', 'category', 'remarks', 'remarksMl'],
  ledgerFields: ['payerName', 'amount', 'paymentDate', 'paymentMethod'],
  notFound: "We couldn't find that zakat payment. It may have been removed.",
};

const ledgerParams = (spec: KindSpec, doc: any) => ({
  tenantId: doc.tenantId,
  ledgerName: spec.ledgerName,
  ledgerType: 'income' as const,
  amount: doc.amount,
  description:
    spec.name === 'varisangya'
      ? `Varisangya payment - Receipt ${doc.receiptNo || 'N/A'}`
      : `Zakat payment from ${doc.payerName} - Receipt ${doc.receiptNo || 'N/A'}`,
  date: doc.paymentDate,
  source: spec.name,
  sourceId: doc._id as mongoose.Types.ObjectId,
  paymentMethod: doc.paymentMethod,
  referenceNo: doc.receiptNo,
});

const walletOwnerOf = (doc: any) => ({ tenantId: doc.tenantId, familyId: doc.familyId, memberId: doc.memberId });
const hasWalletOwner = (spec: KindSpec, doc: any) => spec.hasWallet && !!walletKeyFor(walletOwnerOf(doc));

const actorId = (req: AuthRequest) => toObjectId((req.user as any)?._id);

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

const CLIENT_REQUEST_ID = /^[A-Za-z0-9_\-:.]{8,64}$/;

const parseDateInput = (value: unknown): Date | null => {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
};

const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' ? value.trim().slice(0, max) : undefined;

const AMOUNT_MESSAGE = 'Please enter an amount greater than zero (at most two decimal places).';

/** Fields of an UPDATE body that an update may set, validated. Returns an error message instead on bad input. */
function parseUpdateChanges(spec: KindSpec, body: any): { changes: Record<string, any> } | { error: string } {
  const changes: Record<string, any> = {};
  const src = body && typeof body === 'object' ? body : {};
  for (const field of spec.updatable) {
    if (src[field] === undefined) continue;
    const value = src[field];
    if (field === 'amount') {
      const amount = parseAmountInRange(value, 0.01);
      if (amount === null) return { error: AMOUNT_MESSAGE };
      changes.amount = amount;
    } else if (field === 'paymentDate') {
      const date = parseDateInput(value);
      if (!date) return { error: 'Please choose a valid payment date.' };
      changes.paymentDate = date;
    } else if (field === 'payerName') {
      const name = text(value, 100);
      if (!name || name.length < 2) return { error: 'Please keep the payer name between 2 and 100 characters.' };
      changes.payerName = name;
    } else {
      if (value !== null && typeof value !== 'string') return { error: 'Please check the details and try again.' };
      changes[field] = value === null ? '' : String(value).trim().slice(0, 2000);
    }
  }
  return { changes };
}

// ---------------------------------------------------------------------------
// Request scoping
// ---------------------------------------------------------------------------

/** Who is writing and into which Mahallu. Null after answering 400/403. */
function writeContext(req: AuthRequest, res: Response): { caller: CallerScope; tenantId: string } | null {
  const caller = requireScope(req, res);
  if (!caller) return null;
  let tenantId = caller.tenantId;
  // A super admin who has not picked a Mahallu may name one in the body (as before).
  if (!tenantId && caller.isSuperAdmin && isValidId(req.body?.tenantId)) tenantId = req.body.tenantId;
  if (!tenantId) {
    sendBadRequest(res, MSG.noTenant);
    return null;
  }
  return { caller, tenantId };
}

const sendConflict = (res: Response, message: string) => res.status(409).json({ success: false, message });

// ---------------------------------------------------------------------------
// Effects of a VERIFIED payment (wallet, journal, ledger) and their undo
// ---------------------------------------------------------------------------

interface Ctx {
  session: ClientSession | undefined;
  comp: Compensations;
}

const payerDescription = async (doc: any): Promise<string> => {
  try {
    if (doc.familyId) {
      const family: any = await Family.findById(doc.familyId).select('houseName').lean();
      if (family?.houseName) return ` - ${family.houseName}`;
    } else if (doc.memberId) {
      const member: any = await Member.findById(doc.memberId).select('name').lean();
      if (member?.name) return ` - ${member.name}`;
    }
  } catch {
    /* the description is cosmetic; never fail a payment over it */
  }
  return '';
};

/** Undo of a wallet credit. Must succeed or be reported, so it throws when it could not apply. */
const undoCredit = (walletId: mongoose.Types.ObjectId, amount: number) => async () => {
  const wallet = await debitWallet(walletId, amount);
  if (!wallet) throw new Error('wallet balance could not be reduced to undo a credit');
};
const undoDebit = (walletId: mongoose.Types.ObjectId, amount: number) => async () => {
  const wallet = await creditWallet(walletId, amount);
  if (!wallet) throw new Error('wallet could not be credited to undo a debit');
};

async function applyPaymentEffects(spec: KindSpec, doc: any, { session, comp }: Ctx): Promise<void> {
  if (hasWalletOwner(spec, doc)) {
    // The wallet document is created outside the transaction on purpose (see findOrCreateWallet).
    const wallet = await findOrCreateWallet(walletOwnerOf(doc));
    const credited = await creditWallet(wallet._id, doc.amount, doc.paymentDate, session);
    if (!credited) throw new Error('The wallet could not be credited.');
    comp.push('wallet credit', undoCredit(wallet._id, doc.amount));

    const entryKey = `${spec.name}:${doc._id}:payment`;
    await recordTransaction(
      {
        tenantId: doc.tenantId,
        walletId: wallet._id,
        type: 'credit',
        amount: doc.amount,
        description: `Varisangya payment${await payerDescription(doc)} - ${doc.receiptNo || 'N/A'}`,
        referenceId: doc._id,
        referenceType: spec.name,
        kind: 'payment',
        entryKey,
      },
      session
    );
    comp.push('wallet journal row', () => removeTransaction(doc.tenantId, entryKey));
  }

  await postLedgerEntry(ledgerParams(spec, doc), { session });
  comp.push('ledger entry', () => reverseLedgerEntry(spec.name, doc._id, { tenantId: doc.tenantId }));
}

/**
 * pending -> verified, plus every effect. The single code path that produces a verified payment.
 * `tenantFilter` is `{ tenantId }` for a tenant-bound caller, `{}` for a super admin acting by id.
 */
async function verifyPaymentCore(
  spec: KindSpec,
  id: mongoose.Types.ObjectId,
  tenantFilter: Record<string, any>,
  actor: mongoose.Types.ObjectId | undefined,
  ctx: Ctx
): Promise<any> {
  const { session, comp } = ctx;
  const Model = spec.Model;

  const claimed: any = await Model.findOneAndUpdate(
    { _id: id, status: 'pending', ...tenantFilter },
    { $set: { status: 'verified', verifiedAt: new Date(), ...(actor ? { verifiedBy: actor } : {}) } },
    { new: true, session }
  );
  if (!claimed) {
    const exists = await Model.exists({ _id: id, ...tenantFilter });
    throw exists
      ? new UserFacingError('This payment has already been processed.', 409)
      : new UserFacingError("We couldn't find a pending payment. It may have been removed.", 404);
  }
  comp.push('payment status', async () => {
    await Model.updateOne({ _id: id, status: 'verified' }, { $set: { status: 'pending' }, $unset: { verifiedBy: 1, verifiedAt: 1 } });
  });

  let doc = claimed;

  // Member submissions get their receipt number here (assigned when the admin verifies).
  if (!doc.receiptNo) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const receiptNo = await allocateReceiptNo(spec.name, Model as any, doc.tenantId);
      try {
        const withReceipt: any = await Model.findOneAndUpdate(
          { _id: id, receiptNo: { $in: [null, ''] } },
          { $set: { receiptNo } },
          { new: true, session }
        );
        doc = withReceipt || (await Model.findOne({ _id: id }).session(session ?? null)) || doc;
        break;
      } catch (err) {
        if (!isDuplicateKeyError(err, 'receiptNo') || attempt === 2 || session) throw err;
      }
    }
  }

  await applyPaymentEffects(spec, doc, ctx);

  // The payment may have been deleted while the steps above ran (no multi-document lock without a
  // transaction): if so the effects belong to nothing, so refuse and let the undo remove them.
  const stillThere = await Model.exists({ _id: id, status: 'verified' }).session(session ?? null);
  if (!stillThere) {
    throw new UserFacingError('This payment was changed while it was being processed. Please refresh and try again.', 409);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// Receipt number, summary helpers
// ---------------------------------------------------------------------------

const castIds = (filter: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(filter)) {
    out[key] =
      ['tenantId', 'familyId', 'memberId', 'payerId'].includes(key) && typeof value === 'string' && isValidId(value)
        ? new mongoose.Types.ObjectId(value)
        : value;
  }
  return out;
};

const isPending = { $eq: ['$status', 'pending'] };
const notReceived = { $in: ['$status', ['pending', 'rejected']] };

/** One aggregation that totals the WHOLE filtered set (not a page). */
export const buildSummaryPipeline = (match: Record<string, any>) => [
  { $match: castIds(match) },
  {
    $group: {
      _id: null,
      count: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
      verifiedAmount: { $sum: { $cond: [notReceived, 0, '$amount'] } },
      pendingAmount: { $sum: { $cond: [isPending, '$amount', 0] } },
      pendingCount: { $sum: { $cond: [isPending, 1, 0] } },
    },
  },
];

export interface CollectionSummary {
  count: number;
  /** Every payment in the filtered set, pending included (what the CMS "Total Amount" card has always shown). */
  totalAmount: number;
  verifiedAmount: number;
  pendingAmount: number;
  verifiedCount: number;
  pendingCount: number;
}

const emptySummary = (): CollectionSummary => ({
  count: 0,
  totalAmount: 0,
  verifiedAmount: 0,
  pendingAmount: 0,
  verifiedCount: 0,
  pendingCount: 0,
});

async function summarize(Model: mongoose.Model<any>, match: Record<string, any>): Promise<CollectionSummary> {
  const [row]: any[] = await Model.aggregate(buildSummaryPipeline(match));
  if (!row) return emptySummary();
  return {
    count: row.count,
    totalAmount: round2(row.totalAmount || 0),
    verifiedAmount: round2(row.verifiedAmount || 0),
    pendingAmount: round2(row.pendingAmount || 0),
    verifiedCount: row.count - (row.pendingCount || 0),
    pendingCount: row.pendingCount || 0,
  };
}

const parseDay = (s: string): { y: number; m: number; d: number } | null => {
  const parts = s.trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
  const [a, b, c] = parts;
  if (a > 31 || a >= 1000) return { y: a, m: b, d: c };
  if (c > 31 || c >= 1000) return { y: c, m: b, d: a };
  return null;
};

/** dateFrom / dateTo (YYYY-MM-DD or DD-MM-YYYY) as a paymentDate range, UTC day boundaries. */
function paymentDateRange(query: any): { $gte?: Date; $lte?: Date } | null {
  const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;
  const from = pick(query.dateFrom);
  const to = pick(query.dateTo);
  const fromParsed = typeof from === 'string' && from ? parseDay(from) : null;
  const toParsed = typeof to === 'string' && to ? parseDay(to) : null;
  if (!fromParsed && !toParsed) return null;
  const range: { $gte?: Date; $lte?: Date } = {};
  if (fromParsed) range.$gte = new Date(Date.UTC(fromParsed.y, fromParsed.m - 1, fromParsed.d, 0, 0, 0, 0));
  if (toParsed) range.$lte = new Date(Date.UTC(toParsed.y, toParsed.m - 1, toParsed.d, 23, 59, 59, 999));
  return range;
}

// ---------------------------------------------------------------------------
// Varisangya: list / receipt number / dues
// ---------------------------------------------------------------------------

/** The filter shared by the list and its summary, so the summary always covers the same rows. */
function varisangyaFilter(req: AuthRequest, scope: Record<string, any>, res: Response): Record<string, any> | null {
  const query: Record<string, any> = { ...scope };
  const { familyId, memberId } = req.query as Record<string, any>;

  if (familyId !== undefined && familyId !== '') {
    if (!isValidId(familyId)) return (sendBadRequest(res, MSG.badId), null);
    query.familyId = familyId;
  }
  if (memberId !== undefined && memberId !== '') {
    if (!isValidId(memberId)) return (sendBadRequest(res, MSG.badId), null);
    query.memberId = memberId;
  }

  // Presence filters: let the DB drop non-matching rows so paging stays correct.
  if (!query.familyId && req.query.hasFamily === 'true') query.familyId = { $ne: null };
  if (!query.memberId && req.query.hasMember === 'true') query.memberId = { $ne: null };

  const range = paymentDateRange(req.query);
  if (range) query.paymentDate = range;
  return query;
}

// Varisangya
export const getAllVarisangyas = async (req: AuthRequest, res: Response) => {
  try {
    const scope = tenantFilterFor(req, res);
    if (!scope) return;
    const query = varisangyaFilter(req, scope, res);
    if (!query) return;
    const { page, limit, skip } = getPaginationParams(req);

    const [varisangyas, total, summary] = await Promise.all([
      Varisangya.find(query)
        .populate('familyId', 'houseName')
        .populate({ path: 'memberId', select: 'name familyName', populate: { path: 'familyId', select: 'houseName' } })
        .sort({ paymentDate: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      Varisangya.countDocuments(query),
      summarize(Varisangya as any, query),
    ]);

    res.json({ ...createPaginationResponse(varisangyas, total, page, limit), summary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the varisangyas right now. Please try again.');
  }
};

export const getNextReceiptNumber = async (req: AuthRequest, res: Response) => {
  try {
    const scope = tenantFilterFor(req, res);
    if (!scope) return;
    const tenantId = scope.tenantId as string | undefined;
    if (!tenantId) return sendBadRequest(res, MSG.noTenant);

    const { type } = req.query as { type?: string };
    if (type !== 'varisangya' && type !== 'zakat') {
      return res.status(400).json({ success: false, message: 'Please choose a valid receipt type.' });
    }

    // Informational: not reserved. The saved payment gets the number the counter issues at that moment.
    const receiptNo = await peekNextReceiptNo(type, (type === 'varisangya' ? Varisangya : Zakat) as any, tenantId);
    res.json({ success: true, data: { receiptNo } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the next receipt number right now. Please try again.');
  }
};

// Live dues: expected (grade amount x months elapsed this year) vs paid, per family
export const getFamilyDues = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }

    let dues = await computeFamilyDues(tenantId);

    const search = (req.query.search as string | undefined)?.trim().toLowerCase();
    if (search) {
      dues = dues.filter(
        (d) =>
          d.houseName?.toLowerCase().includes(search) ||
          d.familyHead?.toLowerCase().includes(search)
      );
    }
    if (req.query.onlyPending === 'true') {
      dues = dues.filter((d) => d.dueAmount > 0);
    }
    dues.sort((a, b) => b.dueAmount - a.dueAmount);

    // Summary covers the whole filtered set, so it is computed before paging
    const summary = {
      totalFamilies: dues.length,
      familiesWithDues: dues.filter((d) => d.dueAmount > 0).length,
      totalExpected: dues.reduce((s, d) => s + d.expectedAmount, 0),
      totalPaid: dues.reduce((s, d) => s + d.paidAmount, 0),
      totalDue: dues.reduce((s, d) => s + d.dueAmount, 0),
    };

    // ponytail: dues are computed in memory, so paging is a slice, not a DB skip/limit
    const total = dues.length;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 10000);
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const page = Math.min(Math.max(parseInt(req.query.page as string) || 1, 1), totalPages);
    const pagedDues = dues.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: { dues: pagedDues, summary },
      pagination: { page, limit, total, totalPages },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the family dues right now. Please try again.');
  }
};

/**
 * GET /collectibles/summary - the Collections overview totals, over the whole tenant (optionally a date
 * range with dateFrom / dateTo), in two aggregations. Replaces fetching limit:1 and summing one row.
 */
export const getCollectionsSummary = async (req: AuthRequest, res: Response) => {
  try {
    const scope = tenantFilterFor(req, res);
    if (!scope) return;
    const match: Record<string, any> = { ...scope };
    const range = paymentDateRange(req.query);
    if (range) match.paymentDate = range;

    const [varisangya, zakat] = await Promise.all([
      summarize(Varisangya as any, match),
      summarize(Zakat as any, match),
    ]);
    const totals: CollectionSummary = {
      count: varisangya.count + zakat.count,
      totalAmount: round2(varisangya.totalAmount + zakat.totalAmount),
      verifiedAmount: round2(varisangya.verifiedAmount + zakat.verifiedAmount),
      pendingAmount: round2(varisangya.pendingAmount + zakat.pendingAmount),
      verifiedCount: varisangya.verifiedCount + zakat.verifiedCount,
      pendingCount: varisangya.pendingCount + zakat.pendingCount,
    };
    res.json({ success: true, data: { varisangya, zakat, totals } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the collections summary right now. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Create (admin)
// ---------------------------------------------------------------------------

/** A pending admin row older than this belongs to a request that died, so a retry may complete it. */
const RESUME_AFTER_MS = 30_000;

/** Same-key retries must describe the same payment, or the key is being reused for another one. */
const sameRequest = (spec: KindSpec, existing: any, input: { amount: number; ownerIds: Array<string | undefined> }) => {
  if (Number(existing.amount) !== input.amount) return false;
  const stored =
    spec.name === 'varisangya'
      ? [existing.familyId, existing.memberId, undefined]
      : [existing.payerId, undefined, undefined];
  return input.ownerIds.every((v, i) => String(stored[i] ?? '') === String(v ?? ''));
};

/** The payment for a repeated clientRequestId: finish it if an earlier attempt was interrupted, then return it. */
async function respondIdempotent(
  spec: KindSpec,
  existing: any,
  req: AuthRequest,
  res: Response,
  input: { amount: number; ownerIds: Array<string | undefined> }
) {
  if (!sameRequest(spec, existing, input)) {
    return sendConflict(res, 'That request id was already used for a different payment. Please start a new payment.');
  }
  let payment = existing;
  if (existing.status === 'pending' && existing.source === 'admin') {
    // A young pending row is most likely the first request still running: do not race it.
    if (Date.now() - new Date(existing.createdAt).getTime() < RESUME_AFTER_MS) {
      return sendConflict(res, 'This payment is still being saved. Please wait a moment and check the list before trying again.');
    }
    // An earlier attempt inserted the row and never finished verifying it (it died): complete it now.
    payment = await runAtomic(
      (session, comp) =>
        verifyPaymentCore(spec, existing._id, { tenantId: existing.tenantId }, actorId(req), { session, comp }),
      {
        description: `${spec.name} create (resume)`,
        reconcile: { entity: spec.name, entityId: existing._id, tenantId: existing.tenantId },
      }
    );
  }
  return res.status(200).json({ success: true, data: payment, idempotent: true });
}

async function createPayment(spec: KindSpec, req: AuthRequest, res: Response) {
  const ctx = writeContext(req, res);
  if (!ctx) return;
  const { caller, tenantId } = ctx;
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  const amount = parseAmountInRange(body.amount, 0.01);
  if (amount === null) return sendBadRequest(res, AMOUNT_MESSAGE);
  const paymentDate = parseDateInput(body.paymentDate);
  if (!paymentDate) return sendBadRequest(res, 'Please choose a valid payment date.');

  let clientRequestId: string | undefined;
  if (body.clientRequestId !== undefined && body.clientRequestId !== null && body.clientRequestId !== '') {
    if (typeof body.clientRequestId !== 'string' || !CLIENT_REQUEST_ID.test(body.clientRequestId)) {
      return sendBadRequest(res, 'The request id must be 8 to 64 letters, numbers, dashes or underscores.');
    }
    clientRequestId = body.clientRequestId;
  }

  let suppliedReceipt: string | undefined;
  if (body.receiptNo !== undefined && body.receiptNo !== null && String(body.receiptNo).trim() !== '') {
    suppliedReceipt = String(body.receiptNo).trim();
    if (!CLIENT_RECEIPT_PATTERN.test(suppliedReceipt)) {
      return sendBadRequest(res, 'The receipt number may use letters, numbers, dashes, dots and slashes (up to 32 characters).');
    }
  }

  // Server-owned fields (tenantId, status, source, verifiedBy/At, createdBy) are never taken from the body.
  const data: Record<string, any> = {
    _id: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    amount,
    paymentDate,
    paymentMethod: text(body.paymentMethod, 100),
    remarks: text(body.remarks, 2000),
    remarksMl: text(body.remarksMl, 2000),
    status: 'pending', // flipped to verified by verifyPaymentCore below, the one path that does so
    source: 'admin',
  };
  const createdBy = actorId(req);
  if (createdBy) data.createdBy = createdBy;
  if (clientRequestId) data.clientRequestId = clientRequestId;

  let ownerIds: Array<string | undefined>;
  if (spec.name === 'varisangya') {
    for (const field of ['familyId', 'memberId'] as const) {
      if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
        if (!isValidId(body[field])) return sendBadRequest(res, MSG.badId);
        data[field] = new mongoose.Types.ObjectId(body[field]);
      }
    }
    if (
      !(await refsInScope(caller, tenantId, [
        { model: Family as any, id: body.familyId },
        { model: Member as any, id: body.memberId },
      ]))
    ) {
      return sendForeignRef(res);
    }
    ownerIds = [body.familyId, body.memberId, undefined];
  } else {
    const payerName = text(body.payerName, 100);
    if (!payerName || payerName.length < 2) {
      return sendBadRequest(res, 'Please keep the payer name between 2 and 100 characters.');
    }
    data.payerName = payerName;
    data.category = text(body.category, 100);
    if (body.payerId !== undefined && body.payerId !== null && body.payerId !== '') {
      if (!isValidId(body.payerId)) return sendBadRequest(res, MSG.badId);
      data.payerId = new mongoose.Types.ObjectId(body.payerId);
    }
    if (!(await refsInScope(caller, tenantId, [{ model: Member as any, id: body.payerId }]))) {
      return sendForeignRef(res);
    }
    ownerIds = [body.payerId, undefined, undefined];
  }
  const idemInput = { amount, ownerIds };

  const Model = spec.Model;
  const tenantOid = data.tenantId as mongoose.Types.ObjectId;

  // Same clientRequestId again (double submit, retry after a timeout): no second payment, no second credit.
  if (clientRequestId) {
    const existing = await Model.findOne({ tenantId: tenantOid, clientRequestId });
    if (existing) return respondIdempotent(spec, existing, req, res, idemInput);
  }

  // A client-supplied receipt number is only accepted when this Mahallu has not used it.
  if (suppliedReceipt) {
    if (await Model.exists({ tenantId: tenantOid, receiptNo: suppliedReceipt })) {
      return sendConflict(res, 'That receipt number is already used. Please use a different one.');
    }
    data.receiptNo = suppliedReceipt;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    if (!suppliedReceipt) data.receiptNo = await allocateReceiptNo(spec.name, Model as any, tenantOid);
    try {
      const payment = await runAtomic(
        async (session, comp) => {
          await Model.create([data], { session });
          comp.push('payment row', async () => {
            await Model.deleteOne({ _id: data._id });
          });
          return verifyPaymentCore(spec, data._id, { tenantId: tenantOid }, createdBy, { session, comp });
        },
        { description: `${spec.name} create`, reconcile: { entity: spec.name, entityId: data._id, tenantId: tenantOid } }
      );

      void afterPaymentVerified(spec, payment);
      return res.status(201).json({ success: true, data: payment });
    } catch (err) {
      if (isDuplicateKeyError(err, 'clientRequestId') && clientRequestId) {
        const existing = await Model.findOne({ tenantId: tenantOid, clientRequestId });
        if (existing) return respondIdempotent(spec, existing, req, res, idemInput);
      }
      if (isDuplicateKeyError(err, 'receiptNo')) {
        if (suppliedReceipt) return sendConflict(res, 'That receipt number is already used. Please use a different one.');
        if (attempt < 2) continue; // an unexpected collision: take the next number
      }
      throw err;
    }
  }
}

/** Things that must never fail or delay the response: receipts and a member flag. */
function afterPaymentVerified(spec: KindSpec, payment: any): Promise<void> {
  if (spec.name === 'varisangya') return sendVarisangyaReceipt(payment);
  // Zakat flag: a convenience marker, deliberately best-effort (it is not money).
  return (async () => {
    if (payment.payerId) {
      try {
        await Member.updateOne({ _id: payment.payerId, tenantId: payment.tenantId }, { isZakatPayer: true });
      } catch (memberError) {
        console.error('Failed to flag member as zakat payer:', memberError);
      }
    }
    await sendZakatReceipt(payment);
  })();
}

export const createVarisangya = async (req: AuthRequest, res: Response) => {
  try {
    await createPayment(VARISANGYA, req, res);
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the varisangya. Please try again.');
  }
};

export const createZakat = async (req: AuthRequest, res: Response) => {
  try {
    await createPayment(ZAKAT, req, res);
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the zakat. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

async function verifyPayment(spec: KindSpec, req: AuthRequest, res: Response) {
  const scope = tenantFilterFor(req, res);
  if (!scope) return;
  const id = toObjectId(req.params.id);
  if (!id || !isValidId(req.params.id)) return sendBadRequest(res, MSG.badId);

  const payment = await runAtomic(
    (session, comp) => verifyPaymentCore(spec, id, scope, actorId(req), { session, comp }),
    { description: `${spec.name} verify`, reconcile: { entity: spec.name, entityId: id, tenantId: (scope as any).tenantId } }
  );
  void afterPaymentVerified(spec, payment);
  res.json({ success: true, data: payment, message: 'Payment verified' });
}

// PUT /collectibles/varisangya/:id/verify - admin confirms a member-submitted payment;
// wallet/ledger/receipt effects run only now, exactly once even if verified concurrently
export const verifyVarisangya = async (req: AuthRequest, res: Response) => {
  try {
    await verifyPayment(VARISANGYA, req, res);
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t verify the varisangya. Please try again.');
  }
};

// PUT /collectibles/zakat/:id/verify
export const verifyZakat = async (req: AuthRequest, res: Response) => {
  try {
    await verifyPayment(ZAKAT, req, res);
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t verify the zakat. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Reject
// ---------------------------------------------------------------------------

/** pending -> rejected. Nothing was received, so there are no effects and no receipt number. */
async function rejectPayment(spec: KindSpec, req: AuthRequest, res: Response) {
  const scope = tenantFilterFor(req, res);
  if (!scope) return;
  const id = toObjectId(req.params.id);
  if (!id || !isValidId(req.params.id)) return sendBadRequest(res, MSG.badId);

  const reason = typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
  const actor = actorId(req);
  const rejected = await spec.Model.findOneAndUpdate(
    { _id: id, status: 'pending', ...scope },
    {
      $set: {
        status: 'rejected',
        rejectedAt: new Date(),
        ...(reason ? { rejectionReason: reason } : {}),
        ...(actor ? { rejectedBy: actor } : {}),
      },
    },
    { new: true }
  );
  if (!rejected) {
    return (await spec.Model.exists({ _id: id, ...scope }))
      ? sendConflict(res, 'This payment has already been processed.')
      : res.status(404).json({ success: false, message: "We couldn't find a pending payment. It may have been removed." });
  }
  res.json({ success: true, data: rejected, message: 'Payment rejected' });
}

// PUT /collectibles/varisangya/:id/reject - { rejectionReason? }
export const rejectVarisangya = async (req: AuthRequest, res: Response) => {
  try {
    await rejectPayment(VARISANGYA, req, res);
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t reject the varisangya. Please try again.');
  }
};

// PUT /collectibles/zakat/:id/reject - { rejectionReason? }
export const rejectZakat = async (req: AuthRequest, res: Response) => {
  try {
    await rejectPayment(ZAKAT, req, res);
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t reject the zakat. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const populateFor = (spec: KindSpec, query: any) =>
  spec.name === 'varisangya'
    ? query
        .populate('familyId', 'houseName')
        .populate({ path: 'memberId', select: 'name familyName', populate: { path: 'familyId', select: 'houseName' } })
    : query.populate('payerId', 'name');

/** The fields of `doc` that `changes` actually alters. */
const changedFields = (doc: any, changes: Record<string, any>): string[] =>
  Object.keys(changes).filter((key) => {
    const before = doc[key];
    const after = changes[key];
    if (before instanceof Date || after instanceof Date) return new Date(before).getTime() !== new Date(after).getTime();
    return String(before ?? '') !== String(after ?? '');
  });

async function updatePayment(spec: KindSpec, req: AuthRequest, res: Response) {
  const scope = tenantFilterFor(req, res);
  if (!scope) return;
  const id = toObjectId(req.params.id);
  if (!id || !isValidId(req.params.id)) {
    return sendBadRequest(res, spec.name === 'varisangya' ? 'Please select a varisangya payment.' : 'Please select a zakat payment.');
  }

  const parsed = parseUpdateChanges(spec, req.body);
  if ('error' in parsed) return sendBadRequest(res, parsed.error);
  const { changes } = parsed;

  const Model = spec.Model;
  let existing: any = await Model.findOne({ _id: id, ...scope });
  if (!existing) return res.status(404).json({ success: false, message: spec.notFound });
  if (!verifyRecordAccess(req, res, existing, 'Payment', { instituteField: false })) return;

  const respondWith = async (docId: mongoose.Types.ObjectId) =>
    res.json({ success: true, data: await populateFor(spec, Model.findById(docId)) });

  if (Object.keys(changes).length === 0) return respondWith(id);

  // REJECTED: closed; nothing was received and nothing may change.
  if (existing.status === 'rejected') return sendConflict(res, "A rejected payment can't be changed.");

  // PENDING: nothing has been received, so only the stored fields change. No wallet, journal or ledger.
  if (existing.status === 'pending') {
    const updated: any = await Model.findOneAndUpdate(
      { _id: id, ...scope, status: 'pending' },
      { $set: changes },
      { new: true, runValidators: true }
    );
    if (updated) return respondWith(id);
    // It was verified between our read and write: continue with the verified path on fresh data.
    existing = await Model.findOne({ _id: id, ...scope });
    if (!existing) return res.status(404).json({ success: false, message: spec.notFound });
  }

  // VERIFIED (a missing status is an older, already-received payment).
  const changed = changedFields(existing, changes);
  if (changed.length === 0) return respondWith(id);
  const amountChanged = changed.includes('amount');
  const ledgerChanged = changed.some((field) => spec.ledgerFields.includes(field));
  const oldDoc = typeof existing.toObject === 'function' ? existing.toObject() : { ...existing };

  await runAtomic(
    async (session, comp) => {
      // Optimistic claim on the amount we read: a concurrent amount change makes this miss (409) instead
      // of both edits applying their own difference to the wallet.
      const updated: any = await Model.findOneAndUpdate(
        { _id: id, ...scope, status: RECEIVED_PAYMENT_STATUS, amount: oldDoc.amount },
        { $set: changes },
        { new: true, runValidators: true, session }
      );
      if (!updated) {
        throw new UserFacingError('This payment was changed by someone else. Please refresh and try again.', 409);
      }
      comp.push('payment fields', async () => {
        const restore: Record<string, any> = {};
        const unset: Record<string, 1> = {};
        for (const field of changed) {
          if (oldDoc[field] === undefined) unset[field] = 1;
          else restore[field] = oldDoc[field];
        }
        await Model.updateOne(
          { _id: id, amount: updated.amount },
          { ...(Object.keys(restore).length ? { $set: restore } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) }
        );
      });

      // Wallet: apply only the DIFFERENCE, and only if a credit was really journaled for this payment.
      if (amountChanged && hasWalletOwner(spec, updated) && (await hasPaymentCredit(updated.tenantId, spec.name, id, session))) {
        const delta = round2(updated.amount - oldDoc.amount);
        if (delta !== 0) {
          const wallet = await findOrCreateWallet(walletOwnerOf(updated));
          const credit = delta > 0;
          const moved = credit
            ? await creditWallet(wallet._id, delta, updated.paymentDate, session)
            : await debitWallet(wallet._id, -delta, updated.paymentDate, session);
          if (!moved) {
            throw new UserFacingError(
              "The wallet balance is lower than this reduction, so the amount can't be lowered. Please contact your administrator.",
              409
            );
          }
          comp.push('wallet adjustment', credit ? undoCredit(wallet._id, delta) : undoDebit(wallet._id, -delta));

          const entryKey = `${spec.name}:${id}:adj:${oldDoc.amount}:${updated.amount}:${Date.now()}`;
          await recordTransaction(
            {
              tenantId: updated.tenantId,
              walletId: wallet._id,
              type: credit ? 'credit' : 'debit',
              amount: Math.abs(delta),
              description: `Varisangya amount corrected from ${oldDoc.amount} to ${updated.amount} - ${updated.receiptNo || 'N/A'}`,
              referenceId: id,
              referenceType: spec.name,
              kind: 'adjustment',
              entryKey,
            },
            session
          );
          comp.push('wallet adjustment row', () => removeTransaction(updated.tenantId, entryKey));
        }
      }

      // Ledger: replace the posted entry (reverse + post) so amount, date and method stay in step.
      if (ledgerChanged) {
        const removed = await reverseLedgerEntry(spec.name, id, { session, tenantId: updated.tenantId });
        if (removed.length > 0) {
          comp.push('previous ledger entry', () => postLedgerEntry(ledgerParams(spec, oldDoc)).then(() => undefined));
        }
        await postLedgerEntry(ledgerParams(spec, updated), { session });
        comp.push('new ledger entry', () => reverseLedgerEntry(spec.name, id, { tenantId: updated.tenantId }));
      }
    },
    { description: `${spec.name} update`, reconcile: { entity: spec.name, entityId: id, tenantId: (scope as any).tenantId } }
  );

  return respondWith(id);
}

export const updateVarisangya = async (req: AuthRequest, res: Response) => {
  try {
    await updatePayment(VARISANGYA, req, res);
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the varisangya. Please try again.');
  }
};

export const updateZakat = async (req: AuthRequest, res: Response) => {
  try {
    await updatePayment(ZAKAT, req, res);
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the zakat. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

async function deletePayment(spec: KindSpec, req: AuthRequest, res: Response) {
  const scope = tenantFilterFor(req, res);
  if (!scope) return;
  const id = toObjectId(req.params.id);
  if (!id || !isValidId(req.params.id)) {
    return sendBadRequest(res, spec.name === 'varisangya' ? 'Please select a varisangya payment.' : 'Please select a zakat payment.');
  }
  const Model = spec.Model;

  const outcome = await runAtomic(
    async (session, comp) => {
      // Claiming = deleting: exactly one caller gets the document, so effects are reversed once.
      const removedDoc: any = await Model.findOneAndDelete({ _id: id, ...scope }, { session });
      if (!removedDoc) return 'missing' as const;
      const plain = typeof removedDoc.toObject === 'function' ? removedDoc.toObject() : { ...removedDoc };
      comp.push('payment row', async () => {
        await Model.create([plain]);
      });

      // A pending or rejected payment never had any effect: removing the row is all there is to do.
      if (!isReceivedPayment(removedDoc)) return 'deleted' as const;

      if (hasWalletOwner(spec, removedDoc) && (await hasPaymentCredit(removedDoc.tenantId, spec.name, id, session))) {
        const wallet = await findOrCreateWallet(walletOwnerOf(removedDoc));
        const debited = await debitWallet(wallet._id, removedDoc.amount, undefined, session);
        if (!debited) {
          throw new UserFacingError(
            "The wallet balance is lower than this payment, so it can't be deleted. Please contact your administrator.",
            409
          );
        }
        comp.push('wallet debit', undoDebit(wallet._id, removedDoc.amount));

        const entryKey = `${spec.name}:${id}:reversal`;
        await recordTransaction(
          {
            tenantId: removedDoc.tenantId,
            walletId: wallet._id,
            type: 'debit',
            amount: removedDoc.amount,
            description: `Varisangya payment deleted - ${removedDoc.receiptNo || 'N/A'}`,
            referenceId: id,
            referenceType: spec.name,
            kind: 'reversal',
            entryKey,
          },
          session
        );
        comp.push('wallet reversal row', () => removeTransaction(removedDoc.tenantId, entryKey));
      }

      const removedEntries = await reverseLedgerEntry(spec.name, id, { session, tenantId: removedDoc.tenantId });
      if (removedEntries.length > 0) {
        comp.push('ledger entry', () => postLedgerEntry(ledgerParams(spec, plain)).then(() => undefined));
      }
      return 'deleted' as const;
    },
    { description: `${spec.name} delete`, reconcile: { entity: spec.name, entityId: id, tenantId: (scope as any).tenantId } }
  );

  if (outcome === 'missing') return res.status(404).json({ success: false, message: spec.notFound });
  return res.json({
    success: true,
    message: spec.name === 'varisangya' ? 'Varisangya payment deleted' : 'Zakat payment deleted',
  });
}

export const deleteVarisangya = async (req: AuthRequest, res: Response) => {
  try {
    await deletePayment(VARISANGYA, req, res);
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the varisangya. Please try again.');
  }
};

export const deleteZakat = async (req: AuthRequest, res: Response) => {
  try {
    await deletePayment(ZAKAT, req, res);
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the zakat. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Zakat list
// ---------------------------------------------------------------------------

export const getAllZakats = async (req: AuthRequest, res: Response) => {
  try {
    const scope = tenantFilterFor(req, res);
    if (!scope) return;
    const { search } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: Record<string, any> = { ...scope };

    if (search) {
      query.payerName = { $regex: regexLiteral(search), $options: 'i' };
    }
    const range = paymentDateRange(req.query);
    if (range) query.paymentDate = range;

    const [zakats, total, summary] = await Promise.all([
      Zakat.find(query)
        .populate('payerId', 'name')
        .sort({ paymentDate: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      Zakat.countDocuments(query),
      summarize(Zakat as any, query),
    ]);

    res.json({ ...createPaginationResponse(zakats, total, page, limit), summary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the zakats right now. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Wallet reads
// ---------------------------------------------------------------------------

// Wallet. The tenant is the caller's own (a super admin may name one with ?tenantId=); there is no
// fallback to a client-supplied tenant for anyone else. A family wallet and a member wallet are
// different documents (see walletService), so asking for a family returns the family wallet only.
export const getWallet = async (req: AuthRequest, res: Response) => {
  try {
    const scope = tenantFilterFor(req, res);
    if (!scope) return;
    const tenantId = scope.tenantId as string | undefined;
    if (!tenantId) return sendBadRequest(res, MSG.noTenant);

    const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v);
    const familyId = pick(req.query.familyId);
    const memberId = pick(req.query.memberId);
    for (const value of [familyId, memberId]) {
      if (value !== undefined && value !== '' && !isValidId(value)) return sendBadRequest(res, MSG.badId);
    }
    if (!familyId && !memberId) return sendBadRequest(res, 'Please choose a family or a member.');

    const wallet = await findWallet({
      tenantId,
      familyId: (familyId as string) || undefined,
      memberId: (memberId as string) || undefined,
    });
    if (!wallet) {
      return res.json({ success: true, data: { balance: 0 } });
    }
    res.json({ success: true, data: wallet });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the wallet right now. Please try again.');
  }
};

/**
 * Wallet balances of EVERY family or member of the caller's Mahallu, one page at a time, with totals over
 * the whole filtered set. Driven from the Family / Member collection (so people without a wallet show
 * balance 0) and joined to wallets in one aggregation. Tenant: the caller's own, never a client one
 * (a super admin may name one with ?tenantId=, like the other wallet reads); an account with no Mahallu
 * is refused with 403 by tenantFilterFor.
 */
export const listWallets = async (req: AuthRequest, res: Response) => {
  try {
    const scope = tenantFilterFor(req, res);
    if (!scope) return;
    const tenantId = scope.tenantId as string | undefined;
    if (!tenantId) return sendBadRequest(res, MSG.noTenant);
    if (!isValidId(tenantId)) return sendBadRequest(res, MSG.badId);

    const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v);
    const type = pick(req.query.type);
    if (type !== 'family' && type !== 'member') {
      return sendBadRequest(res, 'Please choose whether to list family or member wallets.');
    }
    const search = pick(req.query.search);
    const { page, limit } = getPaginationParams(req);

    const { rows, total, summary } = await listWalletBalances({ type, tenantId, search, page, limit });
    res.json({ ...createPaginationResponse(rows, total, page, limit), summary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the wallets right now. Please try again.');
  }
};

/** Journal rows are long; without an explicit limit the endpoint returns up to this many per page. */
const DEFAULT_TRANSACTION_LIMIT = 50;

// Transactions: load the wallet first, verify it is the caller's, then page through its journal.
export const getWalletTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { walletId } = req.params;
    if (!walletId || !isValidId(walletId)) {
      return sendBadRequest(res, 'Please select a valid wallet.');
    }
    if (!requireScope(req, res)) return;

    const wallet: any = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: "We couldn't find that wallet. It may have been removed." });
    }
    // Wallets are Mahallu-level records: tenant ownership, and never an institute account.
    if (!verifyRecordAccess(req, res, wallet, 'Wallet', { instituteField: false })) return;

    const paging = getPaginationParams(req);
    const limit = req.query.limit ? paging.limit : DEFAULT_TRANSACTION_LIMIT;
    const skip = (paging.page - 1) * limit;
    const filter: Record<string, any> = { walletId: wallet._id, tenantId: wallet.tenantId };
    if (req.query.type === 'credit' || req.query.type === 'debit') filter.type = req.query.type;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments(filter),
    ]);
    res.json(createPaginationResponse(transactions, total, paging.page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the wallet transactions right now. Please try again.');
  }
};
