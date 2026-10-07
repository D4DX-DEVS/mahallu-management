import { Request, Response } from 'express';
import User from '../models/User';
import Family from '../models/Family';
import Member from '../models/Member';
import { LedgerItem, InstituteAccount } from '../models/MasterAccount';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';

import { sendFailure } from '../utils/userMessages';
import { requireScope } from '../utils/scope';

/** The longest window the activity timeline will compute; it loops once per day and aggregates over it. */
export const MAX_TIMELINE_DAYS = 90;
const DEFAULT_TIMELINE_DAYS = 7;
const INVALID_DAYS_MESSAGE = `Please choose a number of days between 1 and ${MAX_TIMELINE_DAYS}.`;

/**
 * `?days=`: missing -> 7; a whole number 1..90 -> that number; anything else (0, negative, decimal,
 * text, exponent form like 1e9, more than 90, repeated params / arrays, objects) -> null (answer 400).
 * It used to be parseInt with no ceiling, so ?days=1000000000 held the event loop in a billion-step loop.
 */
export const parseTimelineDays = (value: unknown): number | null => {
  if (value === undefined) return DEFAULT_TIMELINE_DAYS;
  if (typeof value !== 'string' || !/^[0-9]{1,3}$/.test(value)) return null;
  const days = parseInt(value, 10);
  return days >= 1 && days <= MAX_TIMELINE_DAYS ? days : null;
};

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const tenantId = req.tenantId; // Now includes x-tenant-id header for super admin viewing as tenant
    const isSuperAdmin = req.isSuperAdmin;

    // Build query based on user role
    // Scoped to role 'mahall' - the Total Users card drills into the Mahall
    // Users list (/users/mahall), which only ever shows that role.
    const userQuery: any = { role: 'mahall' };
    const familyQuery: any = {};
    // Live members only. isDead is the reliable signal - status isn't
    // consistently set on older records, so don't filter on it here.
    const memberQuery: any = { isDead: { $ne: true } };

    // Apply tenant filter
    if (tenantId) {
      userQuery.tenantId = tenantId;
      familyQuery.tenantId = tenantId;
      memberQuery.tenantId = tenantId;
    }

    // Get counts
    const [totalUsers, totalFamilies, totalMembers, activeUsers, inactiveUsers] = await Promise.all([
      User.countDocuments(userQuery),
      Family.countDocuments(familyQuery),
      Member.countDocuments(memberQuery),
      User.countDocuments({ ...userQuery, status: 'active' }),
      User.countDocuments({ ...userQuery, status: 'inactive' }),
    ]);

    // Get gender distribution
    const [maleCount, femaleCount] = await Promise.all([
      Member.countDocuments({ ...memberQuery, gender: 'male' }),
      Member.countDocuments({ ...memberQuery, gender: 'female' }),
    ]);

    // Get status distribution for families
    const [approvedFamilies, pendingFamilies, unapprovedFamilies] = await Promise.all([
      Family.countDocuments({ ...familyQuery, status: 'approved' }),
      Family.countDocuments({ ...familyQuery, status: 'pending' }),
      Family.countDocuments({ ...familyQuery, status: 'unapproved' }),
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
        },
        families: {
          total: totalFamilies,
          approved: approvedFamilies,
          pending: pendingFamilies,
          unapproved: unapprovedFamilies,
        },
        members: {
          total: totalMembers,
          male: maleCount,
          female: femaleCount,
        },
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the dashboard statistics right now. Please try again.');
  }
};

export const getRecentFamilies = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const tenantId = req.tenantId; // Now includes x-tenant-id header for super admin viewing as tenant
    // An institute account has no access to family records (house names, Mahallu ids), so the dashboard
    // widget gets an empty list rather than the whole Mahallu's latest registrations. Empty (not 403)
    // because the dashboard loads this alongside the other widgets and must still render.
    if (req.user?.role === 'institute' && !req.isSuperAdmin) {
      return res.json({ success: true, data: [] });
    }
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 5));

    const query: any = {};
    // Apply tenant filter
    if (tenantId) {
      query.tenantId = tenantId;
    }

    const families = await Family.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('houseName mahallId createdAt status')
      .lean();

    res.json({
      success: true,
      data: families.map((f: any) => ({ ...f, familyName: f.houseName })),
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the recent families right now. Please try again.');
  }
};

export const getActivityTimeline = async (req: AuthRequest, res: Response) => {
  try {
    // Validate before any query runs: a bad `days` costs nothing.
    const days = parseTimelineDays(req.query.days);
    if (days === null) {
      return res.status(400).json({ success: false, message: INVALID_DAYS_MESSAGE });
    }
    if (!requireScope(req, res)) return;
    const tenantId = req.tenantId; // Now includes x-tenant-id header for super admin viewing as tenant

    const query: any = {};
    // Apply tenant filter — aggregate $match bypasses Mongoose's automatic
    // query casting, so tenantId must be cast to ObjectId explicitly here.
    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily family registration counts
    const familyActivity = await Family.aggregate([
      {
        $match: {
          ...query,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Create timeline data for all days
    const timeline = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = dayNames[date.getDay()];
      
      const activity = familyActivity.find((a) => a._id === dateStr);
      
      timeline.push({
        name: dayName,
        date: dateStr,
        value: activity ? activity.count : 0,
      });
    }

    res.json({
      success: true,
      data: timeline,
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the activity timeline right now. Please try again.');
  }
};

export const getFinancialSummary = async (req: AuthRequest, res: Response) => {
  try {
    // Fails closed without a Mahallu; an institute account sees only its own institute's books
    // (never the Mahallu-level ledger or other institutes' balances), whatever the query says.
    const caller = requireScope(req, res);
    if (!caller) return;
    const tenantId = req.tenantId;
    const matchQuery: any = {};
    if (tenantId) matchQuery.tenantId = new mongoose.Types.ObjectId(tenantId);
    if (caller.isInstitute) matchQuery.instituteId = new mongoose.Types.ObjectId(caller.instituteId as string);

    // Current month range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Previous month range
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const monthMatch = {
      ...matchQuery,
      date: { $gte: monthStart, $lte: monthEnd },
    };

    const prevMonthMatch = {
      ...matchQuery,
      date: { $gte: prevMonthStart, $lte: prevMonthEnd },
    };

    // Monthly totals (current + previous)
    const [monthlyResult, prevMonthlyResult] = await Promise.all([
      LedgerItem.aggregate([
        { $match: monthMatch },
        { $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledger' } },
        { $unwind: '$ledger' },
        {
          $group: {
            _id: null,
            totalIncome: { $sum: { $cond: [{ $eq: ['$ledger.type', 'income'] }, '$amount', 0] } },
            totalExpense: { $sum: { $cond: [{ $eq: ['$ledger.type', 'expense'] }, '$amount', 0] } },
            transactionCount: { $sum: 1 },
          },
        },
      ]),
      LedgerItem.aggregate([
        { $match: prevMonthMatch },
        { $lookup: { from: 'ledgers', localField: 'ledgerId', foreignField: '_id', as: 'ledger' } },
        { $unwind: '$ledger' },
        {
          $group: {
            _id: null,
            totalIncome: { $sum: { $cond: [{ $eq: ['$ledger.type', 'income'] }, '$amount', 0] } },
          },
        },
      ]),
    ]);

    const monthly = monthlyResult[0] || { totalIncome: 0, totalExpense: 0, transactionCount: 0 };
    const prevMonthly = prevMonthlyResult[0] || { totalIncome: 0 };

    // Calculate month-over-month income growth percentage
    let incomeGrowthPercent: number | null = null;
    if (prevMonthly.totalIncome > 0) {
      incomeGrowthPercent = Math.round(((monthly.totalIncome - prevMonthly.totalIncome) / prevMonthly.totalIncome) * 100);
    } else if (monthly.totalIncome > 0) {
      incomeGrowthPercent = 100; // New income with no previous month baseline
    }

    // Bank balance
    const bankQuery: any = { status: 'active' };
    if (tenantId) bankQuery.tenantId = new mongoose.Types.ObjectId(tenantId);
    if (caller.isInstitute) bankQuery.instituteId = new mongoose.Types.ObjectId(caller.instituteId as string);

    const bankResult = await InstituteAccount.aggregate([
      { $match: bankQuery },
      { $group: { _id: null, totalBalance: { $sum: '$balance' }, accountCount: { $sum: 1 } } },
    ]);

    const bank = bankResult[0] || { totalBalance: 0, accountCount: 0 };

    res.json({
      success: true,
      data: {
        monthlyIncome: monthly.totalIncome,
        monthlyExpense: monthly.totalExpense,
        monthlyNet: monthly.totalIncome - monthly.totalExpense,
        incomeGrowthPercent,
        transactionCount: monthly.transactionCount,
        totalBankBalance: bank.totalBalance,
        bankAccountCount: bank.accountCount,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the financial summary right now. Please try again.');
  }
};
