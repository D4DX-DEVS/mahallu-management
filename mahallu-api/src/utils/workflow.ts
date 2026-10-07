import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { round2, parseMoney } from './money';

export { round2 };

/**
 * Small helpers shared by the money workflows (qard, welfare, relief, scholarship awards,
 * marriage assistance).
 *
 * Status codes used by every transition / status endpoint of these modules:
 *   400  the input itself is wrong (bad enum, bad amount, missing required detail)
 *   403  the caller's role may not do this
 *   404  the record does not exist in the caller's Mahallu
 *   409  the record is in the wrong state: an illegal transition, "already processed",
 *        a money field that is locked, or a concurrent change won the race
 */

/** True when two money values are the same to the paisa. */
export const sameMoney = (a: unknown, b: unknown): boolean =>
  round2(Number(a ?? 0)) === round2(Number(b ?? 0));

/** True when `value` is a plain money amount: a finite number or numeric string with at most 2 decimals. */
export const isMoney = (value: unknown): boolean => parseMoney(value) !== null;

/** Writes in these modules are Mahallu-admin work (a super admin acting for a Mahallu included). */
export const isMahallWriter = (req: AuthRequest): boolean =>
  !!req.isSuperAdmin || req.user?.role === 'mahall';

/** Answers 403 and returns false when the caller may not write; routes already say mahall-only. */
export const requireMahallWriter = (req: AuthRequest, res: Response): boolean => {
  if (isMahallWriter(req)) return true;
  res.status(403).json({
    success: false,
    message: "Your role doesn't have access to this. Please contact your Mahallu admin.",
  });
  return false;
};

export const sendConflict = (res: Response, message: string): Response =>
  res.status(409).json({ success: false, message });

export const sendNotFound = (res: Response, message: string): Response =>
  res.status(404).json({ success: false, message });

export const sendInvalid = (res: Response, message: string): Response =>
  res.status(400).json({ success: false, message });

/** Copy only the named fields that are present on the body (an allow-list, never a deny-list). */
export const pick = (body: any, fields: readonly string[]): Record<string, any> => {
  const out: Record<string, any> = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return out;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined) {
      out[field] = body[field];
    }
  }
  return out;
};

const idText = (value: unknown): string => String((value as any)?._id ?? value ?? '');

/** Did a body value actually change a stored value? Ids, dates, numbers and text compare by value. */
export const differs = (incoming: unknown, stored: unknown): boolean => {
  if (incoming === undefined) return false;
  if (typeof stored === 'number' || typeof incoming === 'number') {
    return !sameMoney(incoming, stored);
  }
  if (stored instanceof Date || incoming instanceof Date) {
    return new Date(incoming as any).getTime() !== new Date(stored as any).getTime();
  }
  return idText(incoming) !== idText(stored);
};
