import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { PettyCash, PettyCashTransaction } from '../models/PettyCash';
import { LedgerItem } from '../models/MasterAccount';
import { postLedgerEntry } from '../services/ledgerPostingService';
import mongoose from 'mongoose';
import { ensurePeriodOpen } from '../utils/periodLock';

const toObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;

/**
 * Get all petty cash funds
 */
export const getAllPettyCash = async (req: AuthRequest, res: Response) => {
  try {
    const query: any = {};
    if (req.tenantId) query.tenantId = req.tenantId;
    if (req.query.instituteId) query.instituteId = req.query.instituteId;

    const funds = await PettyCash.find(query)
      .populate('instituteId', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: funds });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get single petty cash fund
 */
export const getPettyCash = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const query: any = { _id: toObjectId(id) };
    if (req.tenantId) query.tenantId = req.tenantId;

    const fund = await PettyCash.findOne(query).populate('instituteId', 'name');
    if (!fund) {
      return res.status(404).json({ success: false, message: 'Petty cash fund not found' });
    }
    res.json({ success: true, data: fund });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create petty cash fund + initial float transaction + ledger entry
 */
export const createPettyCash = async (req: AuthRequest, res: Response) => {
  try {
    const data = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
      currentBalance: req.body.floatAmount || 0,
    };

    if (!(await ensurePeriodOpen(res, data.tenantId, new Date()))) return;

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
      await txn.save();

      // The float is a transfer of cash from the bank to the custodian, not spending: nothing is posted
      // to the ledger here. Spending reaches the ledger when expenses are posted on replenishment.
    }

    const populated = await PettyCash.findById(fund._id).populate('instituteId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update petty cash fund details (not balance)
 */
export const updatePettyCash = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const query: any = { _id: toObjectId(id) };
    if (req.tenantId) query.tenantId = req.tenantId;

    const fund = await PettyCash.findOne(query);
    if (!fund) {
      return res.status(404).json({ success: false, message: 'Petty cash fund not found' });
    }

    const { custodianName, status } = req.body;
    if (custodianName !== undefined) fund.custodianName = custodianName;
    if (status !== undefined) fund.status = status;
    await fund.save();

    const populated = await PettyCash.findById(fund._id).populate('instituteId', 'name');
    res.json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get transactions for a petty cash fund
 */
export const getPettyCashTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const query: any = { pettyCashId: toObjectId(id) };
    if (req.tenantId) query.tenantId = req.tenantId;

    const transactions = await PettyCashTransaction.find(query)
      .populate('categoryId', 'name')
      .populate('createdBy', 'name')
      .sort({ date: -1, createdAt: -1 });

    res.json({ success: true, data: transactions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Record a petty cash expense
 */
export const recordExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const queryFund: any = { _id: toObjectId(id), status: 'active' };
    if (req.tenantId) queryFund.tenantId = req.tenantId;

    const fund = await PettyCash.findOne(queryFund);
    if (!fund) {
      return res.status(404).json({ success: false, message: 'Active petty cash fund not found' });
    }

    const { amount, description, categoryId, receiptNo, date } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be positive' });
    }
    if (amount > fund.currentBalance) {
      return res.status(400).json({ success: false, message: 'Insufficient petty cash balance' });
    }

    if (!(await ensurePeriodOpen(res, fund.tenantId, date ? new Date(date) : new Date()))) return;

    const txn = new PettyCashTransaction({
      tenantId: fund.tenantId,
      instituteId: fund.instituteId,
      pettyCashId: fund._id,
      type: 'expense',
      amount,
      description,
      categoryId: categoryId || undefined,
      receiptNo,
      date: date ? new Date(date) : new Date(),
      createdBy: req.user?._id,
    });
    // Atomic debit: the balance check and the decrement happen in one operation (no read-modify-write race)
    const debited = await PettyCash.findOneAndUpdate(
      { _id: fund._id, currentBalance: { $gte: amount } },
      { $inc: { currentBalance: -amount } },
      { new: true }
    );
    if (!debited) {
      return res.status(400).json({ success: false, message: 'Insufficient petty cash balance' });
    }
    try {
      await txn.save();
    } catch (err) {
      await PettyCash.updateOne({ _id: fund._id }, { $inc: { currentBalance: amount } });
      throw err;
    }

    res.status(201).json({ success: true, data: txn });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Replenish petty cash (restore to float amount) + post expense ledger entry for spent amount
 */
export const replenishPettyCash = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const queryFund: any = { _id: toObjectId(id), status: 'active' };
    if (req.tenantId) queryFund.tenantId = req.tenantId;

    const fund = await PettyCash.findOne(queryFund);
    if (!fund) {
      return res.status(404).json({ success: false, message: 'Active petty cash fund not found' });
    }

    const spentAmount = fund.floatAmount - fund.currentBalance;
    if (spentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'No expenses to replenish' });
    }

    // Expenses not yet in the ledger (postedAt is set when posted; older rows are matched by their ledger item)
    const candidates = await PettyCashTransaction.find({
      tenantId: fund.tenantId,
      pettyCashId: fund._id,
      type: 'expense',
      postedAt: { $exists: false },
    });
    const unposted: any[] = [];
    for (const e of candidates) {
      const already = await LedgerItem.exists({ source: 'petty_cash', sourceId: e._id });
      if (already) await PettyCashTransaction.updateOne({ _id: e._id }, { $set: { postedAt: new Date() } });
      else unposted.push(e);
    }

    // Period lock up front: today (replenishment) and every expense date about to be posted
    if (!(await ensurePeriodOpen(res, fund.tenantId, [new Date(), ...unposted.map((e) => e.date)]))) return;

    for (const expense of unposted) {
      try {
        await postLedgerEntry({
          tenantId: String(fund.tenantId),
          instituteId: String(fund.instituteId),
          ledgerName: 'Petty Cash Expenses',
          ledgerType: 'expense',
          amount: expense.amount,
          description: expense.description,
          date: expense.date,
          source: 'petty_cash' as any,
          sourceId: expense._id as any,
          paymentMethod: 'cash',
          referenceNo: expense.receiptNo,
        });
        await PettyCashTransaction.updateOne({ _id: expense._id }, { $set: { postedAt: new Date() } });
      } catch (ledgerError: any) {
        // Already-posted expenses stay marked, so a retry continues where this stopped
        return res.status(500).json({ success: false, message: `Could not post expense "${expense.description}" to the ledger: ${ledgerError.message}` });
      }
    }

    // Restore balance atomically (only the amount actually spent)
    const restored = await PettyCash.findOneAndUpdate(
      { _id: fund._id, currentBalance: fund.currentBalance },
      { $inc: { currentBalance: spentAmount } },
      { new: true }
    );
    if (!restored) {
      return res.status(409).json({ success: false, message: 'The fund changed while replenishing. Refresh and try again.' });
    }

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
    await txn.save();

    res.json({ success: true, data: txn, message: `Replenished ₹${spentAmount}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
