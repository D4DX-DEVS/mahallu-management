import mongoose from 'mongoose';
import { Varisangya, Zakat } from '../models/Collectible';
import { CampaignContribution } from '../models/Campaign';
import { dayWindow } from '../utils/dayWindow';

export interface ExpectedCash {
  expectedCash: number;
  breakdown: { varisangya: number; zakat: number; campaigns: number; receiptCount: number };
  /** 'mahallu' = every cash receipt of the day; collector/user = only receipts tagged to them */
  attribution: 'mahallu' | 'collector' | 'user';
  note?: string;
}

const CASH = /^\s*cash\s*$/i;
// Money that counts: approved (legacy rows have no status). Cancelled receipts never count.
const COUNTS = { $nin: ['pending', 'rejected', 'cancelled'] };

const sumOf = async (Model: any, match: any) => {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, count: rows[0]?.count || 0 };
};

/**
 * Expected cash for a day = approved, cash-method receipts of that day.
 * Varisangya / zakat receipts have no collector field yet, so they can only be attributed
 * when `collectorId` or `createdBy` exists on the document (follow-up: set them on create).
 * Aggregations are used on purpose so those not-yet-in-schema fields can be matched.
 */
export const computeExpectedCash = async (
  tenantId: string,
  dateKey: string,
  scope: { collectorId?: string; userId?: string } = {}
): Promise<ExpectedCash> => {
  const { start, end } = dayWindow(dateKey);
  const t = new mongoose.Types.ObjectId(tenantId);
  const base: any = { tenantId: t, paymentDate: { $gte: start, $lt: end }, paymentMethod: { $regex: CASH }, status: COUNTS };
  const campBase: any = { tenantId: t, paymentDate: { $gte: start, $lt: end }, method: { $regex: CASH }, status: 'approved' };

  const attribution: ExpectedCash['attribution'] = scope.collectorId ? 'collector' : scope.userId ? 'user' : 'mahallu';
  if (scope.collectorId) {
    const c = new mongoose.Types.ObjectId(scope.collectorId);
    base.collectorId = c;
    campBase.collectorId = c;
  } else if (scope.userId) {
    const u = new mongoose.Types.ObjectId(scope.userId);
    base.createdBy = u;
    campBase.createdBy = u;
  }

  const [v, z, c] = await Promise.all([sumOf(Varisangya, base), sumOf(Zakat, base), sumOf(CampaignContribution, campBase)]);
  const result: ExpectedCash = {
    expectedCash: v.total + z.total + c.total,
    breakdown: { varisangya: v.total, zakat: z.total, campaigns: c.total, receiptCount: v.count + z.count + c.count },
    attribution,
  };
  if (attribution !== 'mahallu') {
    result.note =
      'Varisangya and zakat receipts do not record who collected them yet, so only receipts tagged to this collector or user are counted.';
  }
  return result;
};
