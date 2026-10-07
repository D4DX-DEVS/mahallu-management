import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ReconciliationIssue } from '../models/ReconciliationIssue';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { CallerScope, isValidId, requireScope, sendBadRequest, tenantFilterFor } from '../utils/scope';
import { sendFailure } from '../utils/userMessages';

/**
 * Administrator view of the money flows that need a person's attention (see utils/reconciliation.ts).
 *
 *   GET /api/reconciliation              open issues of the caller's Mahallu (?status=open|resolved|all, ?page, ?limit)
 *   PUT /api/reconciliation/:id/resolve  { note } closes one issue, recording who and why
 *
 * ADMIN ONLY: a super admin or a Mahallu admin ('mahall' role). Every other role is refused here as well
 * as at the route. Tenant-scoped in the query itself: a Mahallu admin only ever matches their own
 * Mahallu; a super admin sees every Mahallu unless they chose one ("view as" or ?tenantId=). Issues whose
 * Mahallu could not be determined (no tenantId) are visible to a super admin only.
 * Read-only apart from resolving: nothing here repairs data. The fix is a person's decision.
 */

const ADMIN_ONLY = 'Only an administrator can review these records.';
const NOT_FOUND = "We couldn't find that open record. It may already be resolved.";

const isAdmin = (caller: CallerScope): boolean => caller.isSuperAdmin || caller.role === 'mahall';

/** The caller's scope, or null after answering 403. */
const requireAdminScope = (req: AuthRequest, res: Response): CallerScope | null => {
  const caller = requireScope(req, res);
  if (!caller) return null;
  if (!isAdmin(caller)) {
    res.status(403).json({ success: false, message: ADMIN_ONLY });
    return null;
  }
  return caller;
};

const STATUSES = new Set(['open', 'resolved', 'all']);

export const listReconciliationIssues = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdminScope(req, res)) return;
    const tenant = tenantFilterFor(req, res);
    if (!tenant) return;

    const rawStatus = (req.query as any)?.status;
    const status = rawStatus === undefined || rawStatus === '' ? 'open' : rawStatus;
    if (typeof status !== 'string' || !STATUSES.has(status)) {
      return sendBadRequest(res, 'Please choose open, resolved or all.');
    }

    const query: Record<string, any> = { ...tenant };
    if (status !== 'all') query.status = status;

    const { page, limit, skip } = getPaginationParams(req);
    const [rows, total] = await Promise.all([
      ReconciliationIssue.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ReconciliationIssue.countDocuments(query),
    ]);
    res.json(createPaginationResponse(rows, total, page, limit));
  } catch (error) {
    sendFailure(res, error, "We couldn't load the records that need review. Please try again.");
  }
};

export const resolveReconciliationIssue = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireAdminScope(req, res);
    if (!caller) return;

    const { id } = req.params;
    if (!isValidId(id)) return res.status(404).json({ success: false, message: NOT_FOUND });

    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (note.length < 3 || note.length > 500) {
      return sendBadRequest(res, 'Please describe how this was resolved (3 to 500 characters).');
    }

    // Pinned to the caller's Mahallu in the query itself; a super admin with no Mahallu chosen matches any.
    const filter: Record<string, any> = { _id: id, status: 'open' };
    if (caller.tenantId) filter.tenantId = caller.tenantId;

    // One conditional update: of two simultaneous resolves exactly one wins.
    const resolved = await ReconciliationIssue.findOneAndUpdate(
      filter,
      { $set: { status: 'resolved', resolvedAt: new Date(), resolvedBy: (req.user as any)?._id, note } },
      { new: true }
    ).lean();
    if (!resolved) return res.status(404).json({ success: false, message: NOT_FOUND });

    res.json({ success: true, data: resolved });
  } catch (error) {
    sendFailure(res, error, "We couldn't update that record. Please try again.");
  }
};
