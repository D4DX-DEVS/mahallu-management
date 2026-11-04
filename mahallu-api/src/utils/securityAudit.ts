import mongoose from 'mongoose';
import { ActivityLog } from '../models/Social';
import { AuthRequest } from '../middleware/authMiddleware';

/**
 * One audit row for a security-sensitive account change, in the same ActivityLog the request logger
 * writes to. The request logger already records every call (with passwords and tokens redacted) under
 * a generic "create user"-style label; this adds a row that names what actually happened.
 *
 * `details` may say WHICH account and WHICH kind of change. It must never hold a password, a hash, a
 * token or a temporary secret: callers pass only identifiers and labels.
 */
export interface SecurityEvent {
  action: 'reset user password' | 'change user username' | 'create user with sign-in' | 'family member created';
  target: { id: unknown; role?: string; tenantId?: unknown };
  details?: Record<string, string | number | boolean | null | undefined>;
}

const asObjectId = (value: unknown): mongoose.Types.ObjectId | undefined => {
  if (!value) return undefined;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return undefined;
  }
};

/** Never throws: a failure to write the audit row is logged, and does not undo the change it describes. */
export const recordSecurityEvent = async (req: AuthRequest, event: SecurityEvent): Promise<void> => {
  try {
    await ActivityLog.create({
      action: event.action,
      entityType: 'user',
      entityId: asObjectId(event.target.id),
      tenantId: asObjectId(event.target.tenantId ?? req.tenantId),
      userId: asObjectId(req.user?._id),
      httpMethod: req.method || 'POST',
      endpoint: (req.originalUrl || req.url || '').split('?')[0],
      ipAddress: req.ip,
      statusCode: 200,
      details: { targetRole: event.target.role, ...event.details },
    });
  } catch (error: any) {
    console.error('[security-audit] could not record', event.action, error?.message);
  }
};
