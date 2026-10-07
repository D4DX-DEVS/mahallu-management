import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import { verifyTenantOwnership } from './tenantCheck';

/**
 * Who a request may see, decided from the SERVER-derived identity and nothing the client sent.
 *
 *   super_admin  any Mahallu (the one in req.tenantId when "viewing as", otherwise all)
 *   mahall       their whole Mahallu: the Mahallu-level books and every institute's
 *   institute    their OWN institute's records only. Mahallu-level records (instituteId null) and
 *                sibling institutes' records are never theirs.
 *   survey / member  tenant-scoped like mahall; the routers decide whether they get in at all
 *
 * The institute comes from `req.user.instituteId` (set by authMiddleware from the account, or from
 * the signed impersonation claim), never from `req.query`, `req.body` or an `x-institute-id` header.
 * Query/body values may only NARROW what a role can already see; for the institute role they are
 * ignored outright.
 */

export const MSG = {
  noTenant: 'Please select a Mahallu before continuing.',
  noInstitute: "This account isn't linked to an institute yet. Please contact your administrator.",
  notYours: "You don't have permission to access this. Please contact your Mahallu admin.",
  badId: 'Please choose a valid option and try again.',
  badDate: 'Please enter valid dates.',
  badDateOrder: 'The start date must be on or before the end date.',
  foreignRef: 'One of the selected items belongs to another Mahallu or institute.',
} as const;

const HEX_ID = /^[a-fA-F0-9]{24}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A 24-character hex id given as a string (a 12-char string or a number is not accepted). */
export const isValidId = (value: unknown): value is string =>
  typeof value === 'string' && HEX_ID.test(value);

/** `_id` of a populated document, or the id itself. */
const idOf = (value: any): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const raw = value._id !== undefined && value._id !== null ? value._id : value;
  return String(raw);
};

export interface CallerScope {
  isSuperAdmin: boolean;
  role?: string;
  /** req.tenantId, already server-derived (own tenant, or a super admin's selected one). */
  tenantId?: string;
  isInstitute: boolean;
  /** Only set for the institute role: the institute that account belongs to. */
  instituteId?: string;
}

export const getCallerScope = (req: AuthRequest): CallerScope => {
  const role = req.user?.role as string | undefined;
  const isInstitute = role === 'institute';
  const rawInstitute = req.user?.instituteId;
  const instituteId = isInstitute && rawInstitute ? idOf(rawInstitute) : undefined;
  return {
    isSuperAdmin: !!req.isSuperAdmin,
    role,
    tenantId: req.tenantId ? String(req.tenantId) : undefined,
    isInstitute,
    instituteId: instituteId && HEX_ID.test(instituteId) ? instituteId : undefined,
  };
};

const deny = (res: Response, status: number, message: string): null => {
  res.status(status).json({ success: false, message });
  return null;
};

/**
 * The caller's scope, or null after answering 403.
 * Fails closed: anyone but a super admin with no Mahallu, and an institute account with no
 * institute, are refused instead of being given an unscoped query.
 */
export const requireScope = (req: AuthRequest, res: Response): CallerScope | null => {
  const caller = getCallerScope(req);
  if (!caller.isSuperAdmin && !caller.tenantId) return deny(res, 403, MSG.noTenant);
  if (caller.isInstitute && !caller.isSuperAdmin && !caller.instituteId) return deny(res, 403, MSG.noInstitute);
  return caller;
};

/** requireScope, and also 400 when there is no Mahallu to write into (a super admin who hasn't picked one). */
export const requireWriteScope = (req: AuthRequest, res: Response): (CallerScope & { tenantId: string }) | null => {
  const caller = requireScope(req, res);
  if (!caller) return null;
  if (!caller.tenantId) return deny(res, 400, MSG.noTenant);
  return caller as CallerScope & { tenantId: string };
};

/**
 * `{ tenantId }` for a list/aggregate filter. A super admin who has not chosen a Mahallu may name
 * one with ?tenantId=; otherwise they see all. Anyone else is pinned to their own.
 * Returns null after answering 403/400.
 */
export const tenantFilterFor = (req: AuthRequest, res: Response): Record<string, any> | null => {
  const caller = requireScope(req, res);
  if (!caller) return null;
  if (caller.tenantId) return { tenantId: caller.tenantId };
  const raw = (req.query as any)?.tenantId;
  if (raw === undefined || raw === '') return {};
  if (!isValidId(raw)) return deny(res, 400, MSG.badId);
  return { tenantId: raw };
};

export type ParsedId = { ok: true; value?: string } | { ok: false };

/** An optional id from req.query. Absent or '' is "not given"; anything not a 24-hex string is invalid. */
export const parseIdParam = (value: unknown): ParsedId => {
  if (value === undefined || value === '') return { ok: true };
  if (!isValidId(value)) return { ok: false };
  return { ok: true, value };
};

/** A comma-separated list of ids and, optionally, literal keywords (e.g. "mahallu,<id>,<id>"). */
export const parseIdList = (
  value: unknown,
  keywords: string[] = []
): { ok: true; ids: string[]; keywords: string[] } | { ok: false } => {
  if (value === undefined || value === '') return { ok: true, ids: [], keywords: [] };
  if (typeof value !== 'string' || value.length > 2000) return { ok: false };
  const ids: string[] = [];
  const found: string[] = [];
  for (const part of value.split(',').map((p) => p.trim()).filter(Boolean)) {
    if (keywords.includes(part)) found.push(part);
    else if (isValidId(part)) ids.push(part);
    else return { ok: false };
  }
  return { ok: true, ids, keywords: found };
};

export type DateRange = { ok: true; range?: { $gte?: Date; $lte?: Date } } | { ok: false; message: string };

/**
 * startDate / endDate from req.query. Both must be real dates. A date-only endDate ("2025-03-31")
 * covers that whole day, so entries made at any time on the last day are included.
 */
export const parseDateRange = (query: any): DateRange => {
  const { startDate, endDate } = query || {};
  const range: { $gte?: Date; $lte?: Date } = {};
  if (startDate !== undefined && startDate !== '') {
    if (typeof startDate !== 'string') return { ok: false, message: MSG.badDate };
    const ms = Date.parse(startDate);
    if (Number.isNaN(ms)) return { ok: false, message: MSG.badDate };
    range.$gte = new Date(ms);
  }
  if (endDate !== undefined && endDate !== '') {
    if (typeof endDate !== 'string') return { ok: false, message: MSG.badDate };
    const ms = Date.parse(endDate);
    if (Number.isNaN(ms)) return { ok: false, message: MSG.badDate };
    range.$lte = new Date(DATE_ONLY.test(endDate) ? ms + DAY_MS - 1 : ms);
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) return { ok: false, message: MSG.badDateOrder };
  return { ok: true, range: range.$gte || range.$lte ? range : undefined };
};

/**
 * By-id access check: the record must be in the caller's Mahallu and, for an institute account, in
 * the caller's own institute. `instituteField: false` marks Mahallu-level collections that have no
 * institute at all (wallets, Mahallu bank accounts): an institute account is never their owner.
 * A record whose instituteId is null/missing belongs to the Mahallu, not to an institute.
 * Answers 403 and returns false when refused.
 */
export const verifyRecordAccess = (
  req: AuthRequest,
  res: Response,
  record: { tenantId?: any; instituteId?: any } | null | undefined,
  name: string,
  opts: { instituteField?: boolean } = {}
): boolean => {
  if (!record) {
    res.status(403).json({ success: false, message: MSG.notYours });
    return false;
  }
  if (!verifyTenantOwnership(req, res, record.tenantId, name)) return false;
  const caller = getCallerScope(req);
  if (caller.isInstitute) {
    const owned =
      opts.instituteField !== false &&
      !!caller.instituteId &&
      idOf(record.instituteId) === caller.instituteId;
    if (!owned) {
      res.status(403).json({
        success: false,
        message: `${name} does not belong to your institute or you don't have permission to access it`,
      });
      return false;
    }
  }
  return true;
};

/**
 * The institute a create/update must carry: the caller's own for an institute account (whatever the
 * body said), otherwise whatever the body named (validated separately with refsInScope).
 */
export const instituteForWrite = (caller: CallerScope, bodyInstituteId: unknown): unknown =>
  caller.isInstitute ? caller.instituteId : bodyInstituteId;

/** Body without server-owned fields: tenantId always, instituteId too for the institute role. */
export const cleanBody = (body: any, caller: CallerScope, extraStrip: string[] = []): Record<string, any> => {
  const clean: Record<string, any> = { ...(body && typeof body === 'object' && !Array.isArray(body) ? body : {}) };
  for (const field of ['tenantId', '_id', 'id', 'createdAt', 'updatedAt', '__v', ...extraStrip]) delete clean[field];
  if (caller.isInstitute) delete clean.instituteId;
  return clean;
};

type RefSpec = {
  model: mongoose.Model<any>;
  id: unknown;
  /** 'owned' (default): the document has tenantId + instituteId. 'institute': the document IS an Institute. */
  kind?: 'owned' | 'institute';
};

/**
 * Every referenced id must exist in the caller's Mahallu and, for an institute account, in the
 * caller's own institute. Absent refs (undefined / null / '') pass; callers decide if one is required.
 * A malformed or foreign id fails, so a body can never link to someone else's record.
 */
export const refsInScope = async (caller: CallerScope, tenantId: string, refs: RefSpec[]): Promise<boolean> => {
  for (const ref of refs) {
    if (ref.id === undefined || ref.id === null || ref.id === '') continue;
    if (!isValidId(ref.id)) return false;
    const doc: any = await (ref.model as any).findById(ref.id).select('tenantId instituteId').lean();
    if (!doc || idOf(doc.tenantId) !== String(tenantId)) return false;
    if (caller.isInstitute) {
      const owner = ref.kind === 'institute' ? idOf(doc._id) : idOf(doc.instituteId);
      if (!caller.instituteId || owner !== caller.instituteId) return false;
    }
  }
  return true;
};

/** Plain 400 for a rejected reference. */
export const sendForeignRef = (res: Response): void => {
  res.status(400).json({ success: false, message: MSG.foreignRef });
};

export const sendBadRequest = (res: Response, message: string): void => {
  res.status(400).json({ success: false, message });
};

/** Empty paginated list, for Mahallu-level collections asked by an institute account. */
export const emptyPage = (page: number, limit: number) => ({
  success: true,
  data: [] as any[],
  pagination: { page, limit, skip: (page - 1) * limit, total: 0, totalPages: 0 },
});
