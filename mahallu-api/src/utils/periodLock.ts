import { Response } from 'express';
import mongoose from 'mongoose';
import { FinancialPeriod } from '../models/FinancialPeriod';

/** Thrown when a money record would be created, changed or removed inside a closed period. */
export class PeriodLockedError extends Error {
  statusCode = 423;
  code = 'PERIOD_CLOSED';
  periodId?: string;
  constructor(message: string, periodId?: string) {
    super(message);
    this.name = 'PeriodLockedError';
    this.periodId = periodId;
  }
}

const fmt = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

const toDate = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Throws PeriodLockedError (HTTP 423) when `date` falls inside a closed financial period.
 * No period document, an invalid/absent date, or an open period all mean "allowed".
 */
export async function assertPeriodOpen(
  tenantId: string | mongoose.Types.ObjectId | undefined | null,
  date: unknown
): Promise<void> {
  const d = toDate(date);
  if (!tenantId || !d) return;
  if (!mongoose.Types.ObjectId.isValid(String(tenantId))) return;

  const period = await FinancialPeriod.findOne({
    tenantId: new mongoose.Types.ObjectId(String(tenantId)),
    status: 'closed',
    startDate: { $lte: d },
    endDate: { $gte: d },
  })
    .select('name closedAt')
    .lean();

  if (period) {
    const closedOn = period.closedAt ? fmt(new Date(period.closedAt)) : 'an earlier date';
    throw new PeriodLockedError(
      `This period was closed on ${closedOn}. Reopen the period or post the entry in the current period.`,
      String(period._id)
    );
  }
}

/** Check several dates (e.g. the old and the new date of an edit). */
export async function assertPeriodsOpen(
  tenantId: string | mongoose.Types.ObjectId | undefined | null,
  dates: unknown[]
): Promise<void> {
  for (const d of dates) await assertPeriodOpen(tenantId, d);
}

/**
 * Controller convenience: resolves true when all dates are open; otherwise it sends the
 * 423 response itself and resolves false, so callers can simply `return`.
 *
 *   if (!(await ensurePeriodOpen(res, tenantId, [existing.date, req.body.date]))) return;
 */
export async function ensurePeriodOpen(
  res: Response,
  tenantId: string | mongoose.Types.ObjectId | undefined | null,
  dates: unknown | unknown[]
): Promise<boolean> {
  try {
    await assertPeriodsOpen(tenantId, Array.isArray(dates) ? dates : [dates]);
    return true;
  } catch (err: any) {
    if (err instanceof PeriodLockedError) {
      res.status(423).json({ success: false, code: err.code, message: err.message, periodId: err.periodId });
      return false;
    }
    throw err;
  }
}

/** For catch blocks: turn a PeriodLockedError into the 423 response. Returns true if handled. */
export function handlePeriodError(res: Response, err: any): boolean {
  if (err instanceof PeriodLockedError) {
    res.status(423).json({ success: false, code: err.code, message: err.message, periodId: err.periodId });
    return true;
  }
  return false;
}
