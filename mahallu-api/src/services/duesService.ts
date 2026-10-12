/**
 * Varisangya dues engine.
 *
 * Two layers:
 *  1. `computeDuesFromTotals` - PURE function (no DB, no clock). Unit-testable with fixtures.
 *  2. `computeFamilyDues` / `queryDues` - load families, tenant settings and payments, then call (1).
 *
 * Model (month-based ledger, all months in Asia/Kolkata):
 *  - A family is billed `monthlyAmount` for every calendar month from its billing start up to and
 *    including the current month.
 *  - Billing start = first day of the month the family was created, so a family that joined in
 *    September owes nothing for January-August. A tenant can set `settings.varisangyaBillingStart`
 *    ('YYYY-MM'); when set it REPLACES the per-family start for every family (use it for mahallus that
 *    imported old families on one day but really billed from an earlier month). Without an override,
 *    the start is also pulled back to the family's first recorded payment month (see familyBillingStart).
 *  - Lookback is capped at 5 years (60 months) so arrears from ancient history do not grow forever.
 *    Only payments dated inside the same window are counted.
 *  - Money paid is allocated oldest-month-first. With paid total P and monthly amount m,
 *    floor(P/m) months are fully settled, and the remainder partially settles the next month.
 *  - Paying more than has been billed is an advance: floor(excess/m) months "paid ahead".
 *  - A payment counts if it is not pending/rejected/cancelled (APPROVED_FILTER) and is recorded either
 *    against the family (familyId) or against a member of that family (memberId).
 */
import mongoose from 'mongoose';
import { Varisangya, APPROVED_FILTER } from '../models/Collectible';
import Family from '../models/Family';
import Member from '../models/Member';
import Tenant from '../models/Tenant';
import { ACTIVE_FAMILY_FILTER } from '../utils/archiveFilters';

export const MAX_LOOKBACK_MONTHS = 60;
export type DuesStatus = 'clear' | 'due' | 'overdue' | 'ahead';

/** A calendar month as a single sortable integer: year * 12 + (month 0-11). */
export type MonthIndex = number;
export const toMonthIndex = (year: number, month0: number): MonthIndex => year * 12 + month0;
export const monthKey = (idx: MonthIndex): string => {
  const y = Math.floor(idx / 12);
  return `${y}-${String((idx % 12) + 1).padStart(2, '0')}`;
};
export const parseMonthKey = (s: unknown): MonthIndex | undefined => {
  const m = typeof s === 'string' ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(s) : null;
  return m ? toMonthIndex(Number(m[1]), Number(m[2]) - 1) : undefined;
};

/** Calendar parts of an instant in Asia/Kolkata (IST has no DST: fixed +05:30). */
export const istParts = (d: Date = new Date()) => {
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  return { year: ist.getUTCFullYear(), month0: ist.getUTCMonth(), day: ist.getUTCDate(), hour: ist.getUTCHours() };
};
export const monthIndexOf = (d: Date): MonthIndex => {
  const p = istParts(d);
  return toMonthIndex(p.year, p.month0);
};
/** UTC instant of 00:00 IST on the first day of a month. */
export const monthStartDate = (idx: MonthIndex): Date =>
  new Date(Date.UTC(Math.floor(idx / 12), idx % 12, 1) - 330 * 60 * 1000);

export interface DuesInput {
  monthlyAmount: number;
  /** First billable month (family start or tenant override). */
  billingStart: MonthIndex;
  /** Current month. */
  currentMonth: MonthIndex;
  /** Sum of all counted payments (family + member level) inside the lookback window. */
  totalPaid: number;
}

export interface DuesResult {
  monthlyAmount: number;
  monthsBilled: number;
  totalBilled: number;
  totalPaid: number;
  /** Outstanding amount including the current month (what the family owes today). */
  arrears: number;
  /** Outstanding amount for months before the current one (strictly overdue). */
  overdueAmount: number;
  aheadMonths: number;
  /** 'YYYY-MM' of the oldest month not fully settled, or null. */
  oldestUnpaidMonth: string | null;
  /** Amount still missing on the oldest unpaid month (equals monthlyAmount when nothing was paid toward it). */
  oldestMonthBalance: number;
  /** Last fully settled month ('YYYY-MM'), including advance months, or null. */
  paidUpTo: string | null;
  status: DuesStatus;
}

/** Pure dues calculation for a single family. Never returns negative numbers. */
export const computeDuesFromTotals = (input: DuesInput): DuesResult => {
  const m = Math.max(0, Number(input.monthlyAmount) || 0);
  const paid = Math.max(0, Number(input.totalPaid) || 0);
  const start = Math.max(input.billingStart, input.currentMonth - (MAX_LOOKBACK_MONTHS - 1));
  const monthsBilled = Math.max(0, input.currentMonth - start + 1);

  // No amount configured for this grade: nothing can be due; report credit as-is.
  if (m === 0 || monthsBilled === 0) {
    return {
      monthlyAmount: m, monthsBilled: 0, totalBilled: 0, totalPaid: paid, arrears: 0, overdueAmount: 0,
      aheadMonths: 0, oldestUnpaidMonth: null, oldestMonthBalance: 0, paidUpTo: null, status: 'clear',
    };
  }

  const totalBilled = m * monthsBilled;
  const arrears = Math.max(0, totalBilled - paid);
  const settledMonths = Math.floor(paid / m); // oldest-first allocation
  const aheadMonths = Math.max(0, settledMonths - monthsBilled);

  let oldestUnpaid: MonthIndex | null = null;
  let oldestMonthBalance = 0;
  if (settledMonths < monthsBilled) {
    oldestUnpaid = start + settledMonths;
    oldestMonthBalance = m - (paid - settledMonths * m); // partial payment leaves part of m
  }
  // Overdue = everything billed before the current month that is not settled.
  const pastMonths = monthsBilled - 1;
  const overdueAmount = Math.max(0, m * pastMonths - paid);

  const status: DuesStatus =
    arrears === 0 ? (aheadMonths >= 1 ? 'ahead' : 'clear') : overdueAmount > 0 ? 'overdue' : 'due';

  return {
    monthlyAmount: m,
    monthsBilled,
    totalBilled,
    totalPaid: paid,
    arrears,
    overdueAmount,
    aheadMonths,
    oldestUnpaidMonth: oldestUnpaid === null ? null : monthKey(oldestUnpaid),
    oldestMonthBalance,
    paidUpTo: settledMonths > 0 ? monthKey(start + settledMonths - 1) : null,
    status,
  };
};

// ---------------------------------------------------------------------------
// DB layer
// ---------------------------------------------------------------------------

export interface FamilyDue extends DuesResult {
  familyId: string;
  houseName: string;
  familyHead?: string;
  contactNo?: string;
  wardNumber?: string;
  varisangyaGrade?: string;
  // Backwards-compatible aliases used by the original Live Dues page
  expectedAmount: number;
  paidAmount: number;
  dueAmount: number;
}

export const monthlyAmountFor = (
  grade: string | undefined,
  tenant: { settings?: { varisangyaAmount?: number; varisangyaGrades?: Array<{ name: string; amount: number }> } }
): number => {
  const grades = tenant.settings?.varisangyaGrades || [];
  const match = grade ? grades.find((g) => g.name === grade) : undefined;
  return match?.amount ?? tenant.settings?.varisangyaAmount ?? 0;
};

/**
 * Without a tenant override a family is billed from the month it was created, but never later than its
 * first recorded payment: a family cannot owe less history than it has already paid for. This keeps
 * imported/legacy families (created today, paying since last year) from showing huge "paid ahead" credit.
 */
export const familyBillingStart = (createdAt: Date, firstPayment?: Date): MonthIndex => {
  const created = monthIndexOf(new Date(createdAt));
  return firstPayment ? Math.min(created, monthIndexOf(firstPayment)) : created;
};

export const computeFamilyDues = async (
  tenantId: string | mongoose.Types.ObjectId,
  now: Date = new Date()
): Promise<FamilyDue[]> => {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  const tenant = await Tenant.findById(tid).select('settings').lean();
  if (!tenant) return [];

  const currentMonth = monthIndexOf(now);
  const windowStart = currentMonth - (MAX_LOOKBACK_MONTHS - 1);
  const override = parseMonthKey((tenant as any).settings?.varisangyaBillingStart);

  const [families, members] = await Promise.all([
    Family.find({ tenantId: tid, status: 'approved', ...ACTIVE_FAMILY_FILTER })
      .select('houseName familyHead contactNo wardNumber varisangyaGrade createdAt')
      .lean(),
    Member.find({ tenantId: tid, familyId: { $ne: null } }).select('familyId').lean(),
  ]);
  const memberFamily = new Map<string, string>(members.map((mm: any) => [String(mm._id), String(mm.familyId)]));

  // Payments inside the lookback window, summed per payer (family or member).
  const rows = await Varisangya.aggregate([
    {
      $match: {
        tenantId: tid,
        ...APPROVED_FILTER,
        paymentDate: { $gte: monthStartDate(windowStart) },
        $or: [{ familyId: { $ne: null } }, { memberId: { $ne: null } }],
      },
    },
    { $group: { _id: { f: '$familyId', m: '$memberId' }, paid: { $sum: '$amount' }, first: { $min: '$paymentDate' } } },
  ]);
  const paidByFamily = new Map<string, number>();
  const firstPaid = new Map<string, Date>(); // earliest counted payment per family
  for (const r of rows as any[]) {
    // A receipt with a familyId belongs to that family even if a memberId is also present.
    const fid = r._id.f ? String(r._id.f) : memberFamily.get(String(r._id.m));
    if (!fid) continue;
    paidByFamily.set(fid, (paidByFamily.get(fid) || 0) + r.paid);
    const prev = firstPaid.get(fid);
    if (r.first && (!prev || r.first < prev)) firstPaid.set(fid, r.first);
  }

  return families.map((f: any) => {
    const result = computeDuesFromTotals({
      monthlyAmount: monthlyAmountFor(f.varisangyaGrade, tenant as any),
      billingStart: override ?? familyBillingStart(f.createdAt || now, firstPaid.get(String(f._id))),
      currentMonth,
      totalPaid: paidByFamily.get(String(f._id)) || 0,
    });
    return {
      familyId: String(f._id),
      houseName: f.houseName,
      familyHead: f.familyHead,
      contactNo: f.contactNo,
      wardNumber: f.wardNumber,
      varisangyaGrade: f.varisangyaGrade,
      ...result,
      expectedAmount: result.totalBilled,
      paidAmount: result.totalPaid,
      dueAmount: result.arrears,
    };
  });
};

export interface DuesQuery {
  search?: string;
  onlyPending?: boolean;
  status?: DuesStatus;
}

const STATUS_ORDER: Record<DuesStatus, number> = { overdue: 0, due: 1, ahead: 2, clear: 3 };

/** Dues list + summary for the API. Status counts ignore the status filter so tabs can show totals. */
export const queryDues = async (tenantId: string, q: DuesQuery = {}) => {
  let dues = await computeFamilyDues(tenantId);

  const search = q.search?.trim().toLowerCase();
  if (search) {
    dues = dues.filter((d) => d.houseName?.toLowerCase().includes(search) || d.familyHead?.toLowerCase().includes(search));
  }
  if (q.onlyPending) dues = dues.filter((d) => d.dueAmount > 0);

  const counts = { all: dues.length, overdue: 0, due: 0, clear: 0, ahead: 0 };
  dues.forEach((d) => (counts[d.status] += 1));
  const base = dues; // summary and tab counts describe the whole (searched) book, not just the active tab
  if (q.status) dues = dues.filter((d) => d.status === q.status);

  dues.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.dueAmount - a.dueAmount);

  const totalExpected = base.reduce((s, d) => s + d.expectedAmount, 0);
  const totalPaid = base.reduce((s, d) => s + d.paidAmount, 0);
  const totalDue = base.reduce((s, d) => s + d.dueAmount, 0);
  const ward = new Map<string, number>();
  base.forEach((d) => {
    if (d.dueAmount > 0) ward.set(d.wardNumber || 'Unassigned', (ward.get(d.wardNumber || 'Unassigned') || 0) + d.dueAmount);
  });

  const summary = {
    totalFamilies: base.length,
    familiesWithDues: base.filter((d) => d.dueAmount > 0).length,
    totalExpected,
    totalPaid,
    totalDue,
    // additive fields
    totalOverdue: base.reduce((s, d) => s + d.overdueAmount, 0),
    familiesPaidAhead: base.filter((d) => d.aheadMonths > 0).length,
    // Share of billed money that has come in, capped at 100 per family so advance payers do not hide arrears
    collectionRate: totalExpected > 0
      ? Math.round((base.reduce((s, d) => s + Math.min(d.paidAmount, d.expectedAmount), 0) / totalExpected) * 100)
      : 0,
    statusCounts: counts,
    wardArrears: [...ward.entries()].map(([ward, amount]) => ({ ward, amount })).sort((a, b) => b.amount - a.amount),
  };
  return { dues, summary };
};
