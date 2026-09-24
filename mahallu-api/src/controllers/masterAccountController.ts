import { Request, Response } from 'express';
import { InstituteAccount, MahalluAccount, Category, MasterWallet, Ledger, LedgerItem } from '../models/MasterAccount';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { verifyTenantOwnership } from '../utils/tenantCheck';
import { stripImmutable } from '../utils/sanitizeUpdate';

import { sendFailure } from '../utils/userMessages';

// Institute Accounts
export const getAllInstituteAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const { instituteId, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (instituteId) query.instituteId = instituteId;

    const [accounts, total] = await Promise.all([
      InstituteAccount.find(query)
        .populate('instituteId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      InstituteAccount.countDocuments(query),
    ]);

    res.json(createPaginationResponse(accounts, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the institute accounts right now. Please try again.');
  }
};

export const createInstituteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const accountData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!accountData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

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
    const { type, instituteId, tenantId, scope } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (type) query.type = type;
    if (scope === 'mahallu') {
      query.instituteId = null;
    } else if (instituteId) {
      query.instituteId = instituteId;
    }

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
    const categoryData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!categoryData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const category = new Category(categoryData);
    await category.save();
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the category. Please try again.');
  }
};

// Master Wallets
export const getAllWallets = async (req: AuthRequest, res: Response) => {
  try {
    const { type, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (type) query.type = type;

    const [wallets, total] = await Promise.all([
      MasterWallet.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      MasterWallet.countDocuments(query),
    ]);

    res.json(createPaginationResponse(wallets, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the wallets right now. Please try again.');
  }
};

export const createWallet = async (req: AuthRequest, res: Response) => {
  try {
    const walletData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!walletData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

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
    const { type, instituteId, tenantId, scope } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (type) query.type = type;
    if (scope === 'mahallu') {
      query.instituteId = null;
    } else if (instituteId) {
      query.instituteId = instituteId;
    }

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
    const ledgerData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!ledgerData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

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
    const { ledgerId, instituteId, tenantId, startDate, endDate, scope } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (ledgerId) query.ledgerId = ledgerId;
    if (scope === 'mahallu') {
      query.instituteId = null;
    } else if (instituteId) {
      query.instituteId = instituteId;
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }

    const [items, total] = await Promise.all([
      LedgerItem.find(query)
        .populate('ledgerId', 'name')
        .populate('categoryId', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      LedgerItem.countDocuments(query),
    ]);

    res.json(createPaginationResponse(items, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the ledger items right now. Please try again.');
  }
};

export const createLedgerItem = async (req: AuthRequest, res: Response) => {
  try {
    const itemData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!itemData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

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
    const existing = await InstituteAccount.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that institute account. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'InstituteAccount')) return;

    const account = await InstituteAccount.findByIdAndUpdate(req.params.id, stripImmutable(req.body), { new: true, runValidators: true })
      .populate('instituteId', 'name');
    res.json({ success: true, data: account });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the institute account. Please try again.');
  }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Category.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that category. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'Category')) return;

    const category = await Category.findByIdAndUpdate(req.params.id, stripImmutable(req.body), { new: true, runValidators: true });
    res.json({ success: true, data: category });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the category. Please try again.');
  }
};

export const updateWallet = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await MasterWallet.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that wallet. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'MasterWallet')) return;

    const wallet = await MasterWallet.findByIdAndUpdate(req.params.id, stripImmutable(req.body), { new: true, runValidators: true });
    res.json({ success: true, data: wallet });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the wallet. Please try again.');
  }
};

export const updateLedger = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Ledger.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that ledger. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'Ledger')) return;

    const ledger = await Ledger.findByIdAndUpdate(req.params.id, stripImmutable(req.body), { new: true, runValidators: true });
    res.json({ success: true, data: ledger });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the ledger. Please try again.');
  }
};

export const updateLedgerItem = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await LedgerItem.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that ledger item. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'LedgerItem')) return;

    // Prevent editing auto-posted entries
    if (existing.source && existing.source !== 'manual') {
      return res.status(400).json({
        success: false,
        message: `This entry was created automatically from ${existing.source}. Please edit the original transaction instead.`,
      });
    }

    const item = await LedgerItem.findByIdAndUpdate(req.params.id, stripImmutable(req.body), { new: true, runValidators: true })
      .populate('ledgerId', 'name')
      .populate('categoryId', 'name');
    res.json({ success: true, data: item });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the ledger item. Please try again.');
  }
};

// ============ DELETE OPERATIONS ============

export const deleteInstituteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await InstituteAccount.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that institute account. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'InstituteAccount')) return;

    await InstituteAccount.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Institute account deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the institute account. Please try again.');
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Category.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that category. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'Category')) return;

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
    const existing = await MasterWallet.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that wallet. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'MasterWallet')) return;

    await MasterWallet.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Wallet deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the wallet. Please try again.');
  }
};

export const deleteLedger = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Ledger.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that ledger. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'Ledger')) return;

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
    const existing = await LedgerItem.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that ledger item. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'LedgerItem')) return;

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
// ──────────────────────────────────────────────────────────────────────────────

export const getAllMahalluAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    const [accounts, total] = await Promise.all([
      MahalluAccount.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      MahalluAccount.countDocuments(query),
    ]);

    res.json(createPaginationResponse(accounts, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the mahallu accounts right now. Please try again.');
  }
};

export const createMahalluAccount = async (req: AuthRequest, res: Response) => {
  try {
    const accountData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!accountData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }

    const account = new MahalluAccount(accountData);
    await account.save();
    res.status(201).json({ success: true, data: account });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the mahallu account. Please try again.');
  }
};

export const updateMahalluAccount = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await MahalluAccount.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that mahallu account. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'MahalluAccount')) return;

    const updated = await MahalluAccount.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
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
    const existing = await MahalluAccount.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that mahallu account. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'MahalluAccount')) return;

    await MahalluAccount.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Mahallu account deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the mahallu account. Please try again.');
  }
};

