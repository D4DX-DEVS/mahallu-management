import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Varisangya, Zakat, Wallet, Transaction } from '../models/Collectible';
import Family from '../models/Family';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { postLedgerEntry, reverseLedgerEntry } from '../services/ledgerPostingService';
import { stripImmutable } from '../utils/sanitizeUpdate';
import {
  computeFamilyDues,
  sendVarisangyaReceipt,
  sendZakatReceipt,
} from '../services/varisangyaNotificationService';

const toObjectId = (id: string) =>
  mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;

const getNextReceiptNo = async (Model: typeof Varisangya | typeof Zakat, tenantId: string) => {
  const normalizedTenantId = mongoose.Types.ObjectId.isValid(tenantId)
    ? new mongoose.Types.ObjectId(tenantId)
    : tenantId;
  const [latest] = await Model.aggregate([
    {
      $match: {
        tenantId: normalizedTenantId,
        receiptNo: { $regex: /^\d+$/ },
      },
    },
    {
      $addFields: {
        receiptNoNum: { $toInt: '$receiptNo' },
      },
    },
    { $sort: { receiptNoNum: -1 } },
    { $limit: 1 },
  ]);

  const lastNumber = latest?.receiptNoNum || 14000;
  return String(lastNumber + 1);
};

// Varisangya
export const getAllVarisangyas = async (req: AuthRequest, res: Response) => {
  try {
    const { familyId, memberId, tenantId, dateFrom, dateTo } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    console.log('[Varisangya API] Request URL:', req.originalUrl);
    console.log('[Varisangya API] req.query:', JSON.stringify(req.query));

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (familyId) query.familyId = familyId;
    if (memberId) query.memberId = memberId;

    const fromStr = (Array.isArray(dateFrom) ? dateFrom[0] : dateFrom) as string | undefined;
    const toStr = (Array.isArray(dateTo) ? dateTo[0] : dateTo) as string | undefined;

    const parseDate = (s: string): { y: number; m: number; d: number } | null => {
      const parts = s.trim().split('-').map(Number);
      if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
      const [a, b, c] = parts;
      if (a > 31 || a >= 1000) return { y: a, m: b, d: c };
      if (c > 31 || c >= 1000) return { y: c, m: b, d: a };
      return null;
    };

    let dateFilter: { $gte?: Date; $lte?: Date } | null = null;
    if (fromStr || toStr) {
      const fromParsed = fromStr ? parseDate(fromStr) : null;
      const toParsed = toStr ? parseDate(toStr) : null;
      if (fromParsed || toParsed) {
        dateFilter = {};
        if (fromParsed) {
          dateFilter.$gte = new Date(Date.UTC(fromParsed.y, fromParsed.m - 1, fromParsed.d, 0, 0, 0, 0));
        }
        if (toParsed) {
          dateFilter.$lte = new Date(Date.UTC(toParsed.y, toParsed.m - 1, toParsed.d, 23, 59, 59, 999));
        }
        console.log('[Varisangya API] Date filter:', { $gte: dateFilter.$gte?.toISOString(), $lte: dateFilter.$lte?.toISOString() });
      }
    }

    if (dateFilter) {
      query.paymentDate = dateFilter;
    }

    const finalQuery = { ...query };
    console.log('[Varisangya API] Final query passed to find:', JSON.stringify(finalQuery, (_, v) => (v instanceof Date ? v.toISOString() : v)));

    const [varisangyas, total] = await Promise.all([
      Varisangya.find(finalQuery)
        .populate('familyId', 'houseName')
        .populate({ path: 'memberId', select: 'name familyName', populate: { path: 'familyId', select: 'houseName' } })
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit),
      Varisangya.countDocuments(finalQuery),
    ]);

    console.log('[Varisangya API] Result:', { returned: varisangyas.length, total, sampleDates: varisangyas.slice(0, 2).map((v: any) => v.paymentDate?.toISOString?.()) });
    res.json(createPaginationResponse(varisangyas, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getNextReceiptNumber = async (req: AuthRequest, res: Response) => {
  try {
    const { type, tenantId } = req.query as { type?: string; tenantId?: string };
    const finalTenantId = req.tenantId || (tenantId && req.isSuperAdmin ? tenantId : undefined);

    if (!finalTenantId && !req.isSuperAdmin) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (type !== 'varisangya' && type !== 'zakat') {
      return res.status(400).json({ success: false, message: 'Invalid receipt type' });
    }

    const model = type === 'varisangya' ? Varisangya : Zakat;
    const receiptNo = await getNextReceiptNo(model, finalTenantId as string);

    res.json({ success: true, data: { receiptNo } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Live dues: expected (grade amount x months elapsed this year) vs paid, per family
export const getFamilyDues = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
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

    const summary = {
      totalFamilies: dues.length,
      familiesWithDues: dues.filter((d) => d.dueAmount > 0).length,
      totalExpected: dues.reduce((s, d) => s + d.expectedAmount, 0),
      totalPaid: dues.reduce((s, d) => s + d.paidAmount, 0),
      totalDue: dues.reduce((s, d) => s + d.dueAmount, 0),
    };

    res.json({ success: true, data: { dues, summary } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createVarisangya = async (req: AuthRequest, res: Response) => {
  try {
    const varisangyaData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!varisangyaData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    if (!varisangyaData.receiptNo) {
      varisangyaData.receiptNo = await getNextReceiptNo(Varisangya, varisangyaData.tenantId);
    }

    const varisangya = new Varisangya(varisangyaData);
    await varisangya.save();

    // Update wallet if familyId or memberId exists
    if (varisangya.familyId || varisangya.memberId) {
      let wallet = await Wallet.findOne({
        tenantId: varisangya.tenantId,
        familyId: varisangya.familyId,
        memberId: varisangya.memberId,
      });

      if (!wallet) {
        wallet = new Wallet({
          tenantId: varisangya.tenantId,
          familyId: varisangya.familyId,
          memberId: varisangya.memberId,
          balance: 0,
        });
      }

      wallet.balance += varisangya.amount;
      wallet.lastTransactionDate = varisangya.paymentDate;
      await wallet.save();

      // Build description with payer name
      let payerInfo = '';
      if (varisangya.familyId) {
        const family = await Family.findById(varisangya.familyId).select('houseName').lean();
        if (family?.houseName) payerInfo = ` - ${family.houseName}`;
      } else if (varisangya.memberId) {
        const member = await Member.findById(varisangya.memberId).select('name').lean();
        if (member?.name) payerInfo = ` - ${member.name}`;
      }

      // Create transaction
      await Transaction.create({
        tenantId: varisangya.tenantId,
        walletId: wallet._id,
        type: 'credit',
        amount: varisangya.amount,
        description: `Varisangya payment${payerInfo} - ${varisangya.receiptNo || 'N/A'}`,
        referenceId: varisangya._id,
        referenceType: 'varisangya',
      });
    }

    // Auto-post to accounting ledger
    try {
      await postLedgerEntry({
        tenantId: varisangya.tenantId,
        ledgerName: 'Varisangya Collections',
        ledgerType: 'income',
        amount: varisangya.amount,
        description: `Varisangya payment - Receipt ${varisangya.receiptNo || 'N/A'}`,
        date: varisangya.paymentDate,
        source: 'varisangya',
        sourceId: varisangya._id as any,
        paymentMethod: varisangya.paymentMethod,
        referenceNo: varisangya.receiptNo,
      });
    } catch (ledgerError) {
      console.error('Failed to auto-post varisangya to ledger:', ledgerError);
    }

    // WhatsApp digital receipt (fire-and-forget)
    void sendVarisangyaReceipt(varisangya);

    res.status(201).json({ success: true, data: varisangya });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateVarisangya = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body as { amount?: number; paymentDate?: string; paymentMethod?: string; remarks?: string };
    if (!id || !toObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Valid varisangya ID is required' });
    }

    const query: any = { _id: toObjectId(id) };
    if (req.tenantId) query.tenantId = req.tenantId;

    const existing = await Varisangya.findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Varisangya payment not found' });
    }

    const oldAmount = existing.amount;
    const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;

    if (updates.amount !== undefined) existing.amount = updates.amount;
    if (updates.paymentDate !== undefined) existing.paymentDate = new Date(updates.paymentDate);
    if (updates.paymentMethod !== undefined) existing.paymentMethod = updates.paymentMethod;
    if (updates.remarks !== undefined) existing.remarks = updates.remarks;
    await existing.save();

    if (existing.familyId || existing.memberId) {
      if (newAmount !== oldAmount) {
        const wallet = await Wallet.findOne({
          tenantId: existing.tenantId,
          familyId: existing.familyId,
          memberId: existing.memberId,
        });
        if (wallet) {
          wallet.balance = (wallet.balance || 0) - oldAmount + newAmount;
          wallet.lastTransactionDate = existing.paymentDate;
          await wallet.save();
        }
      }
    }

    // Re-post ledger entry if amount changed
    if (newAmount !== oldAmount) {
      try {
        await reverseLedgerEntry('varisangya', existing._id as any);
        await postLedgerEntry({
          tenantId: existing.tenantId,
          ledgerName: 'Varisangya Collections',
          ledgerType: 'income',
          amount: newAmount,
          description: `Varisangya payment - Receipt ${existing.receiptNo || 'N/A'}`,
          date: existing.paymentDate,
          source: 'varisangya',
          sourceId: existing._id as any,
          paymentMethod: existing.paymentMethod,
          referenceNo: existing.receiptNo,
        });
      } catch (ledgerError) {
        console.error('Failed to update varisangya ledger entry:', ledgerError);
      }
    }

    const updated = await Varisangya.findById(existing._id)
      .populate('familyId', 'houseName')
      .populate({ path: 'memberId', select: 'name familyName', populate: { path: 'familyId', select: 'houseName' } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteVarisangya = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || !toObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Valid varisangya ID is required' });
    }

    const query: any = { _id: toObjectId(id) };
    if (req.tenantId) query.tenantId = req.tenantId;

    const existing = await Varisangya.findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Varisangya payment not found' });
    }

    // Reverse wallet balance
    if (existing.familyId || existing.memberId) {
      const wallet = await Wallet.findOne({
        tenantId: existing.tenantId,
        familyId: existing.familyId,
        memberId: existing.memberId,
      });
      if (wallet) {
        wallet.balance = (wallet.balance || 0) - existing.amount;
        await wallet.save();
      }
    }

    // Reverse ledger entry
    try {
      await reverseLedgerEntry('varisangya', existing._id as any);
    } catch (ledgerError) {
      console.error('Failed to reverse varisangya ledger entry:', ledgerError);
    }

    await Varisangya.findByIdAndDelete(existing._id);
    res.json({ success: true, message: 'Varisangya payment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Zakat
export const getAllZakats = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, search } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (search) {
      query.payerName = { $regex: search, $options: 'i' };
    }

    const [zakats, total] = await Promise.all([
      Zakat.find(query)
        .populate('payerId', 'name')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit),
      Zakat.countDocuments(query),
    ]);

    res.json(createPaginationResponse(zakats, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createZakat = async (req: AuthRequest, res: Response) => {
  try {
    const zakatData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!zakatData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    if (!zakatData.receiptNo) {
      zakatData.receiptNo = await getNextReceiptNo(Zakat, zakatData.tenantId);
    }

    const zakat = new Zakat(zakatData);
    await zakat.save();

    // Auto-post to accounting ledger
    try {
      await postLedgerEntry({
        tenantId: zakat.tenantId,
        ledgerName: 'Zakat Collections',
        ledgerType: 'income',
        amount: zakat.amount,
        description: `Zakat payment from ${zakat.payerName} - Receipt ${zakat.receiptNo || 'N/A'}`,
        date: zakat.paymentDate,
        source: 'zakat',
        sourceId: zakat._id as any,
        paymentMethod: zakat.paymentMethod,
        referenceNo: zakat.receiptNo,
      });
    } catch (ledgerError) {
      console.error('Failed to auto-post zakat to ledger:', ledgerError);
    }

    // WhatsApp digital receipt (fire-and-forget)
    void sendZakatReceipt(zakat);

    res.status(201).json({ success: true, data: zakat });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateZakat = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || !toObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Valid zakat ID is required' });
    }

    const query: any = { _id: toObjectId(id) };
    if (req.tenantId) query.tenantId = req.tenantId;

    const existing = await Zakat.findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Zakat payment not found' });
    }

    const amountChanged = req.body.amount && req.body.amount !== existing.amount;

    Object.assign(existing, stripImmutable(req.body));
    await existing.save();

    // Re-post ledger entry if amount changed
    if (amountChanged) {
      try {
        await reverseLedgerEntry('zakat', existing._id as any);
        await postLedgerEntry({
          tenantId: existing.tenantId,
          ledgerName: 'Zakat Collections',
          ledgerType: 'income',
          amount: existing.amount,
          description: `Zakat payment from ${existing.payerName} - Receipt ${existing.receiptNo || 'N/A'}`,
          date: existing.paymentDate,
          source: 'zakat',
          sourceId: existing._id as any,
          paymentMethod: existing.paymentMethod,
          referenceNo: existing.receiptNo,
        });
      } catch (ledgerError) {
        console.error('Failed to update zakat ledger entry:', ledgerError);
      }
    }

    const updated = await Zakat.findById(existing._id).populate('payerId', 'name');
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteZakat = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || !toObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Valid zakat ID is required' });
    }

    const query: any = { _id: toObjectId(id) };
    if (req.tenantId) query.tenantId = req.tenantId;

    const existing = await Zakat.findOne(query);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Zakat payment not found' });
    }

    // Reverse ledger entry
    try {
      await reverseLedgerEntry('zakat', existing._id as any);
    } catch (ledgerError) {
      console.error('Failed to reverse zakat ledger entry:', ledgerError);
    }

    await Zakat.findByIdAndDelete(existing._id);
    res.json({ success: true, message: 'Zakat payment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Wallet – only add tenantId when set; cast familyId/memberId to ObjectId so query matches MongoDB
export const getWallet = async (req: AuthRequest, res: Response) => {
  try {
    const rawFamilyId = Array.isArray(req.query.familyId) ? req.query.familyId[0] : req.query.familyId;
    const rawMemberId = Array.isArray(req.query.memberId) ? req.query.memberId[0] : req.query.memberId;
    const query: any = {};
    const rawTenantId = req.tenantId || (Array.isArray(req.query.tenantId) ? req.query.tenantId[0] : req.query.tenantId);
    const tenantIdStr = rawTenantId != null ? String(rawTenantId) : '';
    if (tenantIdStr) {
      query.tenantId = mongoose.Types.ObjectId.isValid(tenantIdStr)
        ? new mongoose.Types.ObjectId(tenantIdStr)
        : rawTenantId;
    }
    const familyIdStr = rawFamilyId != null ? String(rawFamilyId) : '';
    if (familyIdStr) {
      query.familyId = mongoose.Types.ObjectId.isValid(familyIdStr)
        ? new mongoose.Types.ObjectId(familyIdStr)
        : rawFamilyId;
    }
    const memberIdStr = rawMemberId != null ? String(rawMemberId) : '';
    if (memberIdStr) {
      query.memberId = mongoose.Types.ObjectId.isValid(memberIdStr)
        ? new mongoose.Types.ObjectId(memberIdStr)
        : rawMemberId;
    }

    const wallet = await Wallet.findOne(query);
    if (!wallet) {
      return res.json({ success: true, data: { balance: 0 } });
    }
    res.json({ success: true, data: wallet });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Transactions – cast walletId to ObjectId so it matches MongoDB's stored type
export const getWalletTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { walletId } = req.params;
    if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
      return res.json({ success: true, data: [] });
    }
    const transactions = await Transaction.find({
      walletId: new mongoose.Types.ObjectId(walletId),
    })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: transactions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

