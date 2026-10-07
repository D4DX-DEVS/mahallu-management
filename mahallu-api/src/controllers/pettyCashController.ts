import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { PettyCash, PettyCashTransaction } from '../models/PettyCash';
import { postLedgerEntry } from '../services/ledgerPostingService';
import mongoose from 'mongoose';
import { parseAmountInRange, round2 } from '../utils/money';
import Institute from '../models/Institute';
import { Category } from '../models/MasterAccount';
import {
  requireScope,
  requireWriteScope,
  parseIdParam,
  isValidId,
  cleanBody,
  instituteForWrite,
  refsInScope,
  sendForeignRef,
  sendBadRequest,
  MSG,
  CallerScope,
} from '../utils/scope';

import { sendFailure } from '../utils/userMessages';
import { reportReconciliationRequired, runUndos, sendReconciliationRequired } from '../utils/reconciliation';

/**
 * Access control for petty cash.
 *  - Every lookup is pinned to the caller's Mahallu in the query itself (fail closed without one)
 *    and, for an institute account, to its own institute, so another Mahallu's or another
 *    institute's fund answers "not found" and is never touched. A client instituteId/?instituteId
 *    is ignored for the institute role.
 *  - Create: tenantId from the server, instituteId forced to the caller's own for an institute
 *    account, and a named institute / expense category must belong to the same Mahallu (+ institute).
 * Money:
 *  - Create takes a whitelist (custodian, institute, float): the balance starts at the float and
 *    the status at 'active', whatever the body said.
 *  - An expense takes the money first with ONE conditional update (`currentBalance >= amount`, `$inc`),
 *    so parallel expenses can never overdraw the fund, and only then writes the transaction; if that
 *    write fails the amount is given back.
 *  - Replenishment claims the fund (balance reset only if nobody moved it meanwhile) and claims each
 *    unposted expense with a conditional update before posting it, so a double click posts nothing twice.
 *  - Finance policy is unchanged: the float is posted as an expense at creation and each expense is
 *    posted again at replenishment (see the accountant note in the engineering report).
 */

/** Smaller than a paisa: absorbs binary noise in a stored balance (0.30000000000000004) without letting a real overdraw through. */
const BALANCE_EPSILON = 0.001;

const toObjectId = (id: string) => isValidId(id) ? new mongoose.Types.ObjectId(id) : null;

const FUND_NOT_FOUND = "We couldn't find that petty cash fund. It may have been removed.";

/** { tenantId, instituteId? } every petty cash query must carry. null = a 403 was already sent. */
const accessFilter = (req: AuthRequest, res: Response): { caller: CallerScope; filter: Record<string, any> } | null => {
  const caller = requireScope(req, res);
  if (!caller) return null;
  const filter: Record<string, any> = {};
  if (caller.tenantId) filter.tenantId = caller.tenantId;
  if (caller.isInstitute) filter.instituteId = caller.instituteId;
  return { caller, filter };
};

/**
 * Get all petty cash funds
 */
export const getAllPettyCash = async (req: AuthRequest, res: Response) => {
  try {
    const access = accessFilter(req, res);
    if (!access) return;
    const query: any = { ...access.filter };
    if (!access.caller.isInstitute) {
      const inst = parseIdParam(req.query.instituteId);
      if (!inst.ok) return sendBadRequest(res, MSG.badId);
      if (inst.value) query.instituteId = inst.value;
    }

    const funds = await PettyCash.find(query)
      .populate('instituteId', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: funds });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the petty cash right now. Please try again.');
  }
};

/**
 * Get single petty cash fund
 */
export const getPettyCash = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const access = accessFilter(req, res);
    if (!access) return;
    const fundId = toObjectId(id);
    if (!fundId) return res.status(404).json({ success: false, message: FUND_NOT_FOUND });
    const query: any = { _id: fundId, ...access.filter };

    const fund = await PettyCash.findOne(query).populate('instituteId', 'name');
    if (!fund) {
      return res.status(404).json({ success: false, message: FUND_NOT_FOUND });
    }
    res.json({ success: true, data: fund });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the petty cash right now. Please try again.');
  }
};

/**
 * Create petty cash fund + initial float transaction + ledger entry
 */
export const createPettyCash = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireWriteScope(req, res);
    if (!caller) return;

    const body = cleanBody(req.body, caller);
    const forcedInstitute = instituteForWrite(caller, body.instituteId);
    if (forcedInstitute !== undefined) body.instituteId = forcedInstitute;
    if (!caller.isInstitute) {
      if (!(await refsInScope(caller, caller.tenantId, [{ model: Institute, id: body.instituteId, kind: 'institute' }]))) {
        return sendForeignRef(res);
      }
    }

    const floatAmount = parseAmountInRange(body.floatAmount, 0.01);
    if (floatAmount === null) {
      return sendBadRequest(res, 'Please enter a float amount greater than zero (up to 2 decimal places).');
    }
    if (typeof body.custodianName !== 'string' || body.custodianName.trim().length < 2) {
      return sendBadRequest(res, 'Please enter the custodian’s name.');
    }

    // Whitelist: the balance, status and anything else a client adds are ours to set, not theirs.
    const data = {
      instituteId: body.instituteId,
      custodianName: body.custodianName.trim(),
      floatAmount,
      tenantId: caller.tenantId,
      currentBalance: floatAmount,
      status: 'active',
    };

    const fund = new PettyCash(data);
    await fund.save();

    // Create initial float transaction
    if (fund.floatAmount > 0) {
      const txn = new PettyCashTransaction({
        tenantId: fund.tenantId,
        instituteId: fund.instituteId,
        pettyCashId: fund._id,
        type: 'float',
        amount: fund.floatAmount,
        description: `Initial petty cash float - ${fund.custodianName}`,
        date: new Date(),
        createdBy: req.user?._id,
      });
      try {
        await txn.save();
      } catch (txnError) {
        // A fund with a balance but no float transaction would never reconcile: take the fund back.
        const { failed } = await runUndos(
          { flow: 'petty cash create', entity: 'PettyCash', entityId: fund._id, tenantId: fund.tenantId, state: { floatAmount: fund.floatAmount } },
          [{ label: 'remove new petty cash fund', undo: () => PettyCash.findByIdAndDelete(fund._id) }],
          txnError
        );
        if (failed.length > 0) return sendReconciliationRequired(res);
        throw txnError;
      }

      // Post to ledger as expense (cash withdrawn from bank)
      try {
        await postLedgerEntry({
          tenantId: String(fund.tenantId),
          instituteId: String(fund.instituteId),
          ledgerName: 'Petty Cash',
          ledgerType: 'expense',
          amount: fund.floatAmount,
          description: `Petty cash float - ${fund.custodianName}`,
          date: new Date(),
          source: 'petty_cash' as any, // Use existing enum, petty cash entries
          sourceId: fund._id as any,
          paymentMethod: 'cash',
        });
      } catch (ledgerError) {
        console.error('Failed to post petty cash float to ledger:', ledgerError);
        // There is no retry for the float entry, so it is recorded for an administrator, and the answer says so
        // instead of looking like a plain success.
        await reportReconciliationRequired({
          flow: 'petty cash create',
          entity: 'PettyCash',
          entityId: fund._id,
          tenantId: fund.tenantId,
          step: 'post float to ledger',
          reason: ledgerError,
          state: { floatAmount: fund.floatAmount, ledgerPosted: false },
        });
        const created = await PettyCash.findById(fund._id).populate('instituteId', 'name');
        return res.status(201).json({
          success: true,
          data: created,
          ledgerPending: 1,
          message: 'The petty cash fund was created, but its float could not be posted to the accounts. An administrator needs to review it.',
        });
      }
    }

    const populated = await PettyCash.findById(fund._id).populate('instituteId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the petty cash. Please try again.');
  }
};

/**
 * Update petty cash fund details (not balance)
 */
export const updatePettyCash = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const access = accessFilter(req, res);
    if (!access) return;
    const fundId = toObjectId(id);
    if (!fundId) return res.status(404).json({ success: false, message: FUND_NOT_FOUND });
    const query: any = { _id: fundId, ...access.filter };

    const fund = await PettyCash.findOne(query);
    if (!fund) {
      return res.status(404).json({ success: false, message: FUND_NOT_FOUND });
    }

    // Only the custodian and the status are editable; the float and balance move through the money endpoints.
    const { custodianName, status } = req.body || {};
    if (custodianName !== undefined) {
      if (typeof custodianName !== 'string' || custodianName.trim().length < 2) {
        return sendBadRequest(res, 'Please enter the custodian’s name.');
      }
      fund.custodianName = custodianName.trim();
    }
    if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') return sendBadRequest(res, 'Please choose a valid status.');
      fund.status = status;
    }
    await fund.save();

    const populated = await PettyCash.findById(fund._id).populate('instituteId', 'name');
    res.json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the petty cash. Please try again.');
  }
};

/**
 * Get transactions for a petty cash fund
 */
export const getPettyCashTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const access = accessFilter(req, res);
    if (!access) return;
    const fundId = toObjectId(id);
    if (!fundId) return res.status(404).json({ success: false, message: FUND_NOT_FOUND });

    // The fund itself must be the caller's before its transactions are listed.
    const fund = await PettyCash.findOne({ _id: fundId, ...access.filter });
    if (!fund) {
      return res.status(404).json({ success: false, message: FUND_NOT_FOUND });
    }
    const query: any = { pettyCashId: fundId, ...access.filter };

    const transactions = await PettyCashTransaction.find(query)
      .populate('categoryId', 'name')
      .populate('createdBy', 'name')
      .sort({ date: -1, createdAt: -1 });

    res.json({ success: true, data: transactions });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the petty cash transactions right now. Please try again.');
  }
};

/**
 * Record a petty cash expense
 */
export const recordExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const access = accessFilter(req, res);
    if (!access) return;
    const fundId = toObjectId(id);
    const noActiveFund = { success: false, message: 'There is no active petty cash fund yet. Please create one first.' };
    if (!fundId) return res.status(404).json(noActiveFund);
    const queryFund: any = { _id: fundId, status: 'active', ...access.filter };

    const fund = await PettyCash.findOne(queryFund);
    if (!fund) {
      return res.status(404).json(noActiveFund);
    }

    const { amount, description, categoryId, receiptNo, date } = req.body;

    // The expense category must live in this fund's Mahallu (and, for an institute account, institute).
    if (!(await refsInScope(access.caller, String(fund.tenantId), [{ model: Category, id: categoryId }]))) {
      return sendForeignRef(res);
    }

    const expenseAmount = parseAmountInRange(amount, 0.01);
    if (expenseAmount === null) {
      return res.status(400).json({ success: false, message: 'Please enter an amount greater than zero (up to 2 decimal places).' });
    }
    if (typeof description !== 'string' || description.trim().length === 0) {
      return sendBadRequest(res, 'Please enter a description for the expense.');
    }
    const expenseDate = date ? new Date(date) : new Date();
    if (Number.isNaN(expenseDate.getTime())) {
      return sendBadRequest(res, 'Please choose a valid expense date.');
    }

    // Take the money first, in ONE conditional update: the balance must still cover the amount at
    // the moment it is decremented, so parallel expenses can never overdraw the fund.
    const debited = await PettyCash.findOneAndUpdate(
      { _id: fund._id, ...access.filter, status: 'active', currentBalance: { $gte: expenseAmount - BALANCE_EPSILON } },
      { $inc: { currentBalance: -expenseAmount } },
      { new: true }
    );
    if (!debited) {
      return res.status(400).json({ success: false, message: "There isn't enough petty cash left for this amount." });
    }

    const txn = new PettyCashTransaction({
      tenantId: fund.tenantId,
      instituteId: fund.instituteId,
      pettyCashId: fund._id,
      type: 'expense',
      amount: expenseAmount,
      description: description.trim(),
      categoryId: categoryId || undefined,
      receiptNo,
      date: expenseDate,
      createdBy: req.user?._id,
    });
    try {
      await txn.save();
    } catch (txnError) {
      // The money was taken but no expense was recorded: give it back.
      const { failed } = await runUndos(
        { flow: 'petty cash expense', entity: 'PettyCash', entityId: fund._id, tenantId: fund.tenantId, state: { amountTaken: expenseAmount, expenseRecorded: false } },
        [{ label: 'give petty cash amount back', undo: () => PettyCash.updateOne({ _id: fund._id }, { $inc: { currentBalance: expenseAmount } }) }],
        txnError
      );
      if (failed.length > 0) return sendReconciliationRequired(res);
      throw txnError;
    }

    res.status(201).json({ success: true, data: txn });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the expense. Please try again.');
  }
};

/**
 * Replenish petty cash (restore to float amount) + post expense ledger entry for spent amount
 */
export const replenishPettyCash = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const access = accessFilter(req, res);
    if (!access) return;
    const fundId = toObjectId(id);
    const noActiveFund = { success: false, message: 'There is no active petty cash fund yet. Please create one first.' };
    if (!fundId) return res.status(404).json(noActiveFund);
    const queryFund: any = { _id: fundId, status: 'active', ...access.filter };

    const fund = await PettyCash.findOne(queryFund);
    if (!fund) {
      return res.status(404).json(noActiveFund);
    }

    const spentAmount = round2(fund.floatAmount - fund.currentBalance);
    if (spentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'There are no expenses to replenish yet.' });
    }

    // Claim the replenishment: the balance is reset to the float only if nobody has moved it since
    // it was read. Of two simultaneous clicks exactly one wins; the other changes nothing.
    const claimed = await PettyCash.findOneAndUpdate(
      { _id: fund._id, ...access.filter, status: 'active', currentBalance: fund.currentBalance },
      { $set: { currentBalance: fund.floatAmount } },
      { new: true }
    );
    if (!claimed) {
      return res.status(409).json({
        success: false,
        message: 'This petty cash fund just changed (another expense or replenishment was recorded). Please reload it and try again.',
      });
    }

    // Create replenishment transaction
    const txn = new PettyCashTransaction({
      tenantId: fund.tenantId,
      instituteId: fund.instituteId,
      pettyCashId: fund._id,
      type: 'replenishment',
      amount: spentAmount,
      description: `Petty cash replenishment - ${fund.custodianName} (₹${spentAmount})`,
      date: new Date(),
      createdBy: req.user?._id,
    });
    try {
      await txn.save();
    } catch (txnError) {
      const { failed } = await runUndos(
        { flow: 'petty cash replenish', entity: 'PettyCash', entityId: fund._id, tenantId: fund.tenantId, state: { amountAdded: spentAmount, replenishmentRecorded: false } },
        [{ label: 'undo petty cash replenishment', undo: () => PettyCash.updateOne({ _id: fund._id }, { $inc: { currentBalance: -spentAmount } }) }],
        txnError
      );
      if (failed.length > 0) return sendReconciliationRequired(res);
      throw txnError;
    }

    // Post every expense of this cycle to the accounting ledger. Each is claimed with a conditional
    // update before it is posted, so it is posted once however many requests run. An expense whose
    // posting fails is released and stays unposted for the next replenishment; it is counted in the answer.
    let postingFailures = 0;
    let releaseFailures = 0;
    const unpostedExpenses = await PettyCashTransaction.find({
      pettyCashId: fund._id,
      ...access.filter,
      type: 'expense',
      postedToLedger: { $ne: true },
    });
    for (const expense of unpostedExpenses) {
      const claim = await PettyCashTransaction.findOneAndUpdate(
        { _id: expense._id, postedToLedger: { $ne: true } },
        { $set: { postedToLedger: true } }
      );
      if (!claim) continue; // another request already took it
      try {
        await postLedgerEntry({
          tenantId: String(fund.tenantId),
          instituteId: String(fund.instituteId),
          ledgerName: 'Petty Cash Expenses',
          ledgerType: 'expense',
          amount: expense.amount,
          description: expense.description,
          date: expense.date,
          source: 'petty_cash' as any, // petty cash expenses posted to ledger
          sourceId: expense._id as any,
          paymentMethod: 'cash',
          referenceNo: expense.receiptNo,
        });
      } catch (ledgerError) {
        postingFailures += 1;
        console.error('Failed to post petty cash expense to ledger:', ledgerError);
        const released = await runUndos(
          { flow: 'petty cash replenish', entity: 'PettyCashTransaction', entityId: expense._id, tenantId: fund.tenantId, state: { amount: expense.amount, ledgerPosted: false } },
          [{ label: 'release expense claim', undo: () => PettyCashTransaction.updateOne({ _id: expense._id }, { $set: { postedToLedger: false } }) }],
          ledgerError
        );
        // Flagged as posted but not in the ledger, and it will not be picked up again: needs an administrator.
        if (released.failed.length > 0) releaseFailures += 1;
      }
    }

    if (releaseFailures > 0) {
      // The replenishment itself is recorded; the expense postings are what need review.
      return sendReconciliationRequired(res);
    }

    if (postingFailures > 0) {
      return res.json({
        success: true,
        data: txn,
        ledgerPending: postingFailures,
        message: `Replenished ₹${spentAmount}. ${postingFailures} expense(s) could not be posted to the accounts yet and will be retried at the next replenishment.`,
      });
    }
    res.json({ success: true, data: txn, message: `Replenished ₹${spentAmount}` });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the petty cash. Please try again.');
  }
};
