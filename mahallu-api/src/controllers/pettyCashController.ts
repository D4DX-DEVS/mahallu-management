import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { PettyCash, PettyCashTransaction } from '../models/PettyCash';
import { postLedgerEntry } from '../services/ledgerPostingService';
import mongoose from 'mongoose';

import { sendFailure } from '../utils/userMessages';

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
    sendFailure(res, error, 'We couldn\'t load the petty cash right now. Please try again.');
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
      return res.status(404).json({ success: false, message: "We couldn't find that petty cash fund. It may have been removed." });
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
    const data = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
      currentBalance: req.body.floatAmount || 0,
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
      await txn.save();

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
    const query: any = { _id: toObjectId(id) };
    if (req.tenantId) query.tenantId = req.tenantId;

    const fund = await PettyCash.findOne(query);
    if (!fund) {
      return res.status(404).json({ success: false, message: "We couldn't find that petty cash fund. It may have been removed." });
    }

    const { custodianName, status } = req.body;
    if (custodianName !== undefined) fund.custodianName = custodianName;
    if (status !== undefined) fund.status = status;
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
    const query: any = { pettyCashId: toObjectId(id) };
    if (req.tenantId) query.tenantId = req.tenantId;

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
    const queryFund: any = { _id: toObjectId(id), status: 'active' };
    if (req.tenantId) queryFund.tenantId = req.tenantId;

    const fund = await PettyCash.findOne(queryFund);
    if (!fund) {
      return res.status(404).json({ success: false, message: 'There is no active petty cash fund yet. Please create one first.' });
    }

    const { amount, description, categoryId, receiptNo, date } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter an amount greater than zero.' });
    }
    if (amount > fund.currentBalance) {
      return res.status(400).json({ success: false, message: "There isn't enough petty cash left for this amount." });
    }

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
    await txn.save();

    fund.currentBalance -= amount;
    await fund.save();

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
    const queryFund: any = { _id: toObjectId(id), status: 'active' };
    if (req.tenantId) queryFund.tenantId = req.tenantId;

    const fund = await PettyCash.findOne(queryFund);
    if (!fund) {
      return res.status(404).json({ success: false, message: 'There is no active petty cash fund yet. Please create one first.' });
    }

    const spentAmount = fund.floatAmount - fund.currentBalance;
    if (spentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'There are no expenses to replenish yet.' });
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
    await txn.save();

    // Post all expenses in this cycle to accounting ledger
    try {
      const unpostedExpenses = await PettyCashTransaction.find({
        pettyCashId: fund._id,
        type: 'expense',
        postedToLedger: { $ne: true },
      });

      for (const expense of unpostedExpenses) {
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
        expense.postedToLedger = true;
        await expense.save();
      }
    } catch (ledgerError) {
      console.error('Failed to post petty cash expenses to ledger:', ledgerError);
    }

    // Restore balance
    fund.currentBalance = fund.floatAmount;
    await fund.save();

    res.json({ success: true, data: txn, message: `Replenished ₹${spentAmount}` });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the petty cash. Please try again.');
  }
};
