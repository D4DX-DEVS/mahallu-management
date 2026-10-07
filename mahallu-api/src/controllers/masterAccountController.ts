import { Response } from 'express';
import mongoose from 'mongoose';
import { InstituteAccount, MahalluAccount, Category, MasterWallet, Ledger, LedgerItem } from '../models/MasterAccount';
import Institute from '../models/Institute';
import { DevelopmentProject } from '../models/DevelopmentProject';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import {
  requireScope,
  requireWriteScope,
  tenantFilterFor,
  parseIdParam,
  parseDateRange,
  verifyRecordAccess,
  cleanBody,
  instituteForWrite,
  refsInScope,
  sendForeignRef,
  sendBadRequest,
  emptyPage,
  MSG,
  CallerScope,
} from '../utils/scope';

import { sendFailure } from '../utils/userMessages';
import { searchRegex } from '../utils/queryGuard';
import { round2 } from '../utils/money';

/**
 * Access control for the master-accounts module.
 *
 *  - Lists: tenant-scoped (and fail closed without a Mahallu). An institute account is always
 *    pinned to its OWN institute: `scope`, `instituteId` and `ledgerId` filters from the client are
 *    ignored/validated, never used to widen. Mahallu-level collections (wallets, Mahallu bank
 *    accounts) are not an institute's at all.
 *  - By id: the record must be in the caller's Mahallu and, for an institute account, their own
 *    institute (a Mahallu-level record, instituteId null, is not theirs).
 *  - Creates: tenantId always comes from the server; an institute account's instituteId is forced to
 *    its own; every referenced id must live in the same Mahallu (and institute) as the caller.
 *  - Updates: tenantId is never writable, and an institute account cannot re-parent a record.
 */

const notFound = (res: Response, what: string) =>
  res.status(404).json({ success: false, message: `We couldn't find that ${what}. It may have been removed.` });

/**
 * Which institute a list is restricted to.
 *  - institute role: always its own (client values ignored)
 *  - others: scope=mahallu -> Mahallu-level only; a valid instituteId narrows to it; otherwise all
 * Returns null after answering 400.
 */
const instituteListFilter = (
  req: AuthRequest,
  res: Response,
  caller: CallerScope,
  allowScope: boolean
): Record<string, any> | null => {
  if (caller.isInstitute) return { instituteId: caller.instituteId };
  if (allowScope && req.query.scope === 'mahallu') return { instituteId: null };
  const inst = parseIdParam(req.query.instituteId);
  if (!inst.ok) {
    sendBadRequest(res, MSG.badId);
    return null;
  }
  return inst.value ? { instituteId: inst.value } : {};
};

/** Optional `type` filter: a plain string only (never an operator object). */
const typeFilter = (req: AuthRequest): Record<string, any> =>
  typeof req.query.type === 'string' && req.query.type ? { type: req.query.type } : {};

/** Institute accounts have no Mahallu-level collections: refuse an institute account outright. */
const refuseInstituteRole = (res: Response, caller: CallerScope): boolean => {
  if (!caller.isInstitute) return false;
  res.status(403).json({ success: false, message: MSG.notYours });
  return true;
};

/**
 * Check the ids a create/update body links to. Responds 400 and returns false when one is foreign.
 * `instituteId` is skipped for an institute account (it is forced to their own, not read).
 */
const refsOk = async (
  res: Response,
  caller: CallerScope & { tenantId: string },
  body: Record<string, any>,
  fields: { ledgerId?: boolean; categoryId?: boolean; projectId?: boolean; instituteId?: boolean }
): Promise<boolean> => {
  const refs: any[] = [];
  if (fields.instituteId && !caller.isInstitute) refs.push({ model: Institute, id: body.instituteId, kind: 'institute' });
  if (fields.ledgerId) refs.push({ model: Ledger, id: body.ledgerId });
  if (fields.categoryId) refs.push({ model: Category, id: body.categoryId });
  if (fields.projectId) refs.push({ model: DevelopmentProject, id: body.projectId });
  if (!(await refsInScope(caller, caller.tenantId, refs))) {
    sendForeignRef(res);
    return false;
  }
  return true;
};

/** The caller, pinned to the Mahallu of the record being edited (already verified as theirs). */
const inRecordTenant = (caller: CallerScope, existing: { tenantId?: any }): CallerScope & { tenantId: string } => ({
  ...caller,
  tenantId: String(existing.tenantId),
});

/**
 * Fields only the system writes. On a ledger item they say where an entry came from (an auto-posted
 * salary / petty cash / zakat entry carries its source and sourceId; a manual one must never be able to
 * pose as one and be 'reversed' later), and accountId would point it at a bank account.
 */
const SYSTEM_ITEM_FIELDS = ['source', 'sourceId', 'accountId', 'accountType', 'auto'];

/**
 * Defence in depth behind sanitizeRequest: a body key that is a Mongo operator ('$inc', '$set') or a path
 * ('balance.x') is never part of a write, so it cannot reach findByIdAndUpdate / new Model() even if the
 * request-level scrub were bypassed.
 */
const dropOperatorKeys = (data: Record<string, any>): Record<string, any> => {
  for (const key of Object.keys(data)) if (key.startsWith('$') || key.includes('.')) delete data[key];
  return data;
};

/**
 * Money is moved by the books, not by an edit: an account or wallet balance can be set once, as the
 * opening balance on create (validated >= 0 by the route), and is never writable afterwards.
 */
const updateOnlyStrip = ['balance'];

/** Build a create body: client tenantId dropped, institute forced for an institute account. */
const createBody = (req: AuthRequest, caller: CallerScope & { tenantId: string }, withInstitute: boolean) => {
  const data = dropOperatorKeys(cleanBody(req.body, caller, SYSTEM_ITEM_FIELDS));
  data.tenantId = caller.tenantId;
  if (withInstitute) {
    const forced = instituteForWrite(caller, data.instituteId);
    if (forced === undefined) delete data.instituteId;
    else data.instituteId = forced;
  } else {
    delete data.instituteId;
  }
  return data;
};

/** Update body: tenantId never; instituteId only for roles above institute. */
const updateBody = (req: AuthRequest, caller: CallerScope, withInstitute: boolean) => {
  const data = dropOperatorKeys(cleanBody(req.body, caller, [...SYSTEM_ITEM_FIELDS, ...updateOnlyStrip]));
  if (!withInstitute) delete data.instituteId;
  return data;
};

/**
 * aggregate() does not cast like find() does: ids in the filter must be real ObjectIds to match anything.
 * (instituteId: null stays null: that is how a Mahallu-level record is selected.)
 */
const forAggregate = (query: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = { ...query };
  for (const key of ['tenantId', 'instituteId', 'ledgerId']) {
    const value = out[key];
    if (typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value)) out[key] = new mongoose.Types.ObjectId(value);
  }
  return out;
};

/** Total balance and count over the WHOLE filtered set, not the page the client is looking at. */
const balanceSummary = async (Model: any, query: Record<string, any>) => {
  const [row] = await Model.aggregate([
    { $match: forAggregate(query) },
    { $group: { _id: null, totalBalance: { $sum: '$balance' }, count: { $sum: 1 } } },
  ]);
  return { totalBalance: round2(row?.totalBalance || 0), count: row?.count || 0 };
};

// Institute Accounts
const INSTITUTE_ACCOUNT_SEARCH_FIELDS = ['accountName', 'bankName', 'accountNumber', 'ifscCode'];

export const getAllInstituteAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const tenant = tenantFilterFor(req, res);
    if (!tenant) return;
    const institute = instituteListFilter(req, res, caller, false);
    if (!institute) return;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenant, ...institute };
    // `search` is applied here (not in the browser) so the list, its totals and an export of every page
    // all see the same filtered set. The term is escaped: it is only ever a literal substring match.
    const term = searchRegex(req.query.search);
    if (term) {
      query.$or = INSTITUTE_ACCOUNT_SEARCH_FIELDS.map((field) => ({ [field]: term }));
    }

    const [accounts, total, summary] = await Promise.all([
      InstituteAccount.find(query)
        .populate('instituteId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      InstituteAccount.countDocuments(query),
      balanceSummary(InstituteAccount, query),
    ]);

    // `summary` covers every account matching the filter, so a Total Balance card is right on any page.
    res.json({ ...createPaginationResponse(accounts, total, page, limit), summary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the institute accounts right now. Please try again.');
  }
};

export const createInstituteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireWriteScope(req, res);
    if (!caller) return;

    const accountData = createBody(req, caller, true);
    if (!(await refsOk(res, caller, accountData, { instituteId: true }))) return;

    const account = new InstituteAccount(accountData);
    await account.save();
    const populated = await InstituteAccount.findById(account._id).populate('instituteId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the institute account. Please try again.');
  }
};

// Categories
export const getAllCategories = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const tenant = tenantFilterFor(req, res);
    if (!tenant) return;
    const institute = instituteListFilter(req, res, caller, true);
    if (!institute) return;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenant, ...typeFilter(req), ...institute };

    const [categories, total] = await Promise.all([
      Category.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Category.countDocuments(query),
    ]);

    res.json(createPaginationResponse(categories, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the categories right now. Please try again.');
  }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireWriteScope(req, res);
    if (!caller) return;

    const categoryData = createBody(req, caller, true);
    if (!(await refsOk(res, caller, categoryData, { instituteId: true }))) return;

    const category = new Category(categoryData);
    await category.save();
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the category. Please try again.');
  }
};

// Master Wallets (Mahallu-level: not an institute account's)
export const getAllWallets = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const tenant = tenantFilterFor(req, res);
    if (!tenant) return;
    const { page, limit, skip } = getPaginationParams(req);
    if (caller.isInstitute) return res.json(emptyPage(page, limit));
    const query: any = { ...tenant, ...typeFilter(req) };

    const [wallets, total, summary] = await Promise.all([
      MasterWallet.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      MasterWallet.countDocuments(query),
      balanceSummary(MasterWallet, query),
    ]);

    res.json({ ...createPaginationResponse(wallets, total, page, limit), summary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the wallets right now. Please try again.');
  }
};

export const createWallet = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireWriteScope(req, res);
    if (!caller) return;
    if (refuseInstituteRole(res, caller)) return;

    const walletData = createBody(req, caller, false);

    const wallet = new MasterWallet(walletData);
    await wallet.save();
    res.status(201).json({ success: true, data: wallet });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the wallet. Please try again.');
  }
};

// Ledgers
export const getAllLedgers = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const tenant = tenantFilterFor(req, res);
    if (!tenant) return;
    const institute = instituteListFilter(req, res, caller, true);
    if (!institute) return;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenant, ...typeFilter(req), ...institute };

    const [ledgers, total] = await Promise.all([
      Ledger.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Ledger.countDocuments(query),
    ]);

    res.json(createPaginationResponse(ledgers, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the ledgers right now. Please try again.');
  }
};

export const createLedger = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireWriteScope(req, res);
    if (!caller) return;

    const ledgerData = createBody(req, caller, true);
    if (!(await refsOk(res, caller, ledgerData, { instituteId: true }))) return;

    const ledger = new Ledger(ledgerData);
    await ledger.save();
    res.status(201).json({ success: true, data: ledger });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the ledger. Please try again.');
  }
};

// Ledger Items
export const getLedgerItems = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const tenant = tenantFilterFor(req, res);
    if (!tenant) return;
    const institute = instituteListFilter(req, res, caller, true);
    if (!institute) return;
    const ledger = parseIdParam(req.query.ledgerId);
    const dates = parseDateRange(req.query);
    if (!ledger.ok) return sendBadRequest(res, MSG.badId);
    if (!dates.ok) return sendBadRequest(res, dates.message);

    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenant, ...institute };
    // For an institute account the tenant + own-institute filter is what stops a foreign ledgerId
    // from returning anything; the id itself only narrows further.
    if (ledger.value) query.ledgerId = ledger.value;
    if (dates.range) query.date = { ...dates.range };

    const [items, total, totals] = await Promise.all([
      LedgerItem.find(query)
        .populate('ledgerId', 'name')
        .populate('categoryId', 'name')
        .sort({ date: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      LedgerItem.countDocuments(query),
      // Income / expense over the WHOLE filtered set (same classification as the posting service: the item's own type).
      LedgerItem.aggregate([
        { $match: forAggregate(query) },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);
    const sumOf = (type: string) => round2((totals as any[]).find((t) => t._id === type)?.total || 0);
    const totalIncome = sumOf('income');
    const totalExpense = sumOf('expense');

    res.json({
      ...createPaginationResponse(items, total, page, limit),
      summary: { totalIncome, totalExpense, net: round2(totalIncome - totalExpense), count: total },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the ledger items right now. Please try again.');
  }
};

/**
 * An entry's income/expense type must be its ledger's. Reports classify by the item's own type (as the
 * posting service does), so an expense entry in an income ledger would otherwise be counted one way in the
 * ledger and the other in the books. Answers 400 and returns false on a mismatch.
 */
const itemTypeMatchesLedger = async (res: Response, ledgerId: unknown, type: unknown): Promise<boolean> => {
  if (!ledgerId || !type) return true;
  const ledger: any = await Ledger.findById(ledgerId as any).select('type').lean();
  if (ledger?.type && ledger.type !== type) {
    sendBadRequest(
      res,
      `This entry is ${type === 'income' ? 'an income' : 'an expense'} but the ledger you chose is for ${ledger.type === 'income' ? 'income' : 'expenses'}. Please choose a matching ledger or type.`
    );
    return false;
  }
  return true;
};

export const createLedgerItem = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireWriteScope(req, res);
    if (!caller) return;

    const itemData = createBody(req, caller, true);
    if (!(await refsOk(res, caller, itemData, { instituteId: true, ledgerId: true, categoryId: true, projectId: true }))) return;
    if (!(await itemTypeMatchesLedger(res, itemData.ledgerId, itemData.type))) return;

    // Whatever the body said, a hand-made entry is a manual one.
    itemData.source = 'manual';
    const item = new LedgerItem(itemData);
    await item.save();
    const populated = await LedgerItem.findById(item._id)
      .populate('ledgerId', 'name')
      .populate('categoryId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the ledger item. Please try again.');
  }
};

// ============ UPDATE OPERATIONS ============

export const updateInstituteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const existing = await InstituteAccount.findById(req.params.id);
    if (!existing) return notFound(res, 'institute account');
    if (!verifyRecordAccess(req, res, existing, 'InstituteAccount')) return;

    const data = updateBody(req, caller, true);
    if (!(await refsOk(res, inRecordTenant(caller, existing), data, { instituteId: true }))) return;

    const account = await InstituteAccount.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
      .populate('instituteId', 'name');
    res.json({ success: true, data: account });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the institute account. Please try again.');
  }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const existing = await Category.findById(req.params.id);
    if (!existing) return notFound(res, 'category');
    if (!verifyRecordAccess(req, res, existing, 'Category')) return;

    const data = updateBody(req, caller, true);
    if (!(await refsOk(res, inRecordTenant(caller, existing), data, { instituteId: true }))) return;

    const category = await Category.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    res.json({ success: true, data: category });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the category. Please try again.');
  }
};

export const updateWallet = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const existing = await MasterWallet.findById(req.params.id);
    if (!existing) return notFound(res, 'wallet');
    if (!verifyRecordAccess(req, res, existing, 'MasterWallet', { instituteField: false })) return;

    const wallet = await MasterWallet.findByIdAndUpdate(req.params.id, updateBody(req, caller, false), { new: true, runValidators: true });
    res.json({ success: true, data: wallet });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the wallet. Please try again.');
  }
};

export const updateLedger = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const existing = await Ledger.findById(req.params.id);
    if (!existing) return notFound(res, 'ledger');
    if (!verifyRecordAccess(req, res, existing, 'Ledger')) return;

    const data = updateBody(req, caller, true);
    if (!(await refsOk(res, inRecordTenant(caller, existing), data, { instituteId: true }))) return;

    const ledger = await Ledger.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    res.json({ success: true, data: ledger });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the ledger. Please try again.');
  }
};

export const updateLedgerItem = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const existing = await LedgerItem.findById(req.params.id);
    if (!existing) return notFound(res, 'ledger item');
    if (!verifyRecordAccess(req, res, existing, 'LedgerItem')) return;

    // Prevent editing auto-posted entries
    if (existing.source && existing.source !== 'manual') {
      return res.status(400).json({
        success: false,
        message: `This entry was created automatically from ${existing.source}. Please edit the original transaction instead.`,
      });
    }

    const data = updateBody(req, caller, true);
    if (!(await refsOk(res, inRecordTenant(caller, existing), data, { instituteId: true, ledgerId: true, categoryId: true, projectId: true }))) return;
    if (data.ledgerId !== undefined || data.type !== undefined) {
      if (!(await itemTypeMatchesLedger(res, data.ledgerId ?? existing.ledgerId, data.type ?? existing.type))) return;
    }

    const item = await LedgerItem.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
      .populate('ledgerId', 'name')
      .populate('categoryId', 'name');
    res.json({ success: true, data: item });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the ledger item. Please try again.');
  }
};

// ============ DELETE OPERATIONS ============

const hasBalance = (account: { balance?: any }): boolean => round2(Number(account.balance || 0)) !== 0;

/**
 * An account or wallet is not deleted while it carries money or while it is what the books post to.
 *  - a non-zero balance is refused outright (the money would vanish from every report);
 *  - the LAST account of an institute (or of the Mahallu, for a Mahallu account) is refused while that
 *    side has ledger entries, because postings move 'the first active account' and would have nowhere to go.
 * Answers 409 and returns true when refused.
 */
const refuseAccountDelete = async (
  res: Response,
  account: { _id?: any; tenantId?: any; instituteId?: any; balance?: any },
  Model: any,
  what: string
): Promise<boolean> => {
  if (hasBalance(account)) {
    res.status(409).json({
      success: false,
      message: `This ${what} still has a balance of ₹${round2(Number(account.balance)).toLocaleString('en-IN')}, so it can't be deleted. Settle the balance first.`,
    });
    return true;
  }
  const books: Record<string, any> = { tenantId: account.tenantId, instituteId: account.instituteId ?? null };
  const [siblings, entries] = await Promise.all([
    Model.countDocuments({ ...books, _id: { $ne: account._id } }),
    LedgerItem.countDocuments(books),
  ]);
  if (siblings === 0 && entries > 0) {
    res.status(409).json({
      success: false,
      message: `This is the only ${what} for records that already have ${entries} ledger ${entries === 1 ? 'entry' : 'entries'}, so it can't be deleted.`,
    });
    return true;
  }
  return false;
};

export const deleteInstituteAccount = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const existing = await InstituteAccount.findById(req.params.id);
    if (!existing) return notFound(res, 'institute account');
    if (!verifyRecordAccess(req, res, existing, 'InstituteAccount')) return;

    if (await refuseAccountDelete(res, existing, InstituteAccount, 'institute account')) return;

    await InstituteAccount.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Institute account deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the institute account. Please try again.');
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const existing = await Category.findById(req.params.id);
    if (!existing) return notFound(res, 'category');
    if (!verifyRecordAccess(req, res, existing, 'Category')) return;

    // Check if category is used in any ledger items
    const usedInItems = await LedgerItem.countDocuments({ categoryId: req.params.id });
    if (usedInItems > 0) {
      return res.status(400).json({
        success: false,
        message: `This category is used in ${usedInItems} ledger item(s), so it can't be deleted.`,
      });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the category. Please try again.');
  }
};

export const deleteWallet = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const existing = await MasterWallet.findById(req.params.id);
    if (!existing) return notFound(res, 'wallet');
    if (!verifyRecordAccess(req, res, existing, 'MasterWallet', { instituteField: false })) return;

    if (hasBalance(existing)) {
      return res.status(409).json({
        success: false,
        message: `This wallet still holds ₹${round2(Number(existing.balance)).toLocaleString('en-IN')}, so it can't be deleted. Move the money out first.`,
      });
    }

    await MasterWallet.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Wallet deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the wallet. Please try again.');
  }
};

export const deleteLedger = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const existing = await Ledger.findById(req.params.id);
    if (!existing) return notFound(res, 'ledger');
    if (!verifyRecordAccess(req, res, existing, 'Ledger')) return;

    // Check if ledger has items
    const itemCount = await LedgerItem.countDocuments({ ledgerId: req.params.id });
    if (itemCount > 0) {
      return res.status(400).json({
        success: false,
        message: `This ledger has ${itemCount} item(s), so it can't be deleted.`,
      });
    }

    await Ledger.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Ledger deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the ledger. Please try again.');
  }
};

export const deleteLedgerItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const existing = await LedgerItem.findById(req.params.id);
    if (!existing) return notFound(res, 'ledger item');
    if (!verifyRecordAccess(req, res, existing, 'LedgerItem')) return;

    // Prevent deleting auto-posted entries
    if (existing.source && existing.source !== 'manual') {
      return res.status(400).json({
        success: false,
        message: `This entry was created automatically from ${existing.source}. Please delete the original transaction instead.`,
      });
    }

    await LedgerItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Ledger item deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the ledger item. Please try again.');
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Mahallu Accounts (tenant-level bank accounts — no instituteId)
// Mahallu-level books: mahall / super_admin only. An institute account gets an empty list and a
// 403 on everything by id, so the Mahallu's bank balances never reach an institute admin.
// ──────────────────────────────────────────────────────────────────────────────

export const getAllMahalluAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const tenant = tenantFilterFor(req, res);
    if (!tenant) return;
    const { page, limit, skip } = getPaginationParams(req);
    if (caller.isInstitute) return res.json(emptyPage(page, limit));
    const query: any = { ...tenant };

    const [accounts, total, summary] = await Promise.all([
      MahalluAccount.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      MahalluAccount.countDocuments(query),
      balanceSummary(MahalluAccount, query),
    ]);

    res.json({ ...createPaginationResponse(accounts, total, page, limit), summary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the mahallu accounts right now. Please try again.');
  }
};

export const createMahalluAccount = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireWriteScope(req, res);
    if (!caller) return;
    if (refuseInstituteRole(res, caller)) return;

    const account = new MahalluAccount(createBody(req, caller, false));
    await account.save();
    res.status(201).json({ success: true, data: account });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the mahallu account. Please try again.');
  }
};

export const updateMahalluAccount = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const existing = await MahalluAccount.findById(req.params.id);
    if (!existing) return notFound(res, 'mahallu account');
    if (!verifyRecordAccess(req, res, existing, 'MahalluAccount', { instituteField: false })) return;

    const updated = await MahalluAccount.findByIdAndUpdate(req.params.id, updateBody(req, caller, false), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the mahallu account. Please try again.');
  }
};

export const deleteMahalluAccount = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const existing = await MahalluAccount.findById(req.params.id);
    if (!existing) return notFound(res, 'mahallu account');
    if (!verifyRecordAccess(req, res, existing, 'MahalluAccount', { instituteField: false })) return;

    if (await refuseAccountDelete(res, existing, MahalluAccount, 'mahallu account')) return;

    await MahalluAccount.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Mahallu account deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the mahallu account. Please try again.');
  }
};
