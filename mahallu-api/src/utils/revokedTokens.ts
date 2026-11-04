import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Signing out of ONE session.
 *
 * Logout used to bump the account's `tokenVersion`, which ends every session of the account on every
 * device (signing out of the web signed the phone out too). A session is now ended by remembering a
 * hash of ITS token on the user record until the token would have expired on its own anyway;
 * authMiddleware (which already loads the user on every request, so there is no extra query) rejects a
 * token whose hash is on that list. Password and phone changes still bump `tokenVersion`, which is the
 * right thing for them: they end every session.
 */

/** Most revoked tokens remembered per account. A token lives at most 7 days, so this is ample. */
export const MAX_REVOKED_TOKENS = 50;

export interface RevokedTokenEntry {
  h: string;
  exp: Date;
}

/** A one-way hash of a token: enough to recognise it, useless for signing in with. */
export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

/** The bearer token of a request, or null. */
export const bearerToken = (header: unknown): string | null => {
  if (typeof header !== 'string') return null;
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return token || null;
};

/** When a token stops being valid by itself (its `exp`), or null if it carries none. */
export const tokenExpiry = (token: string): Date | null => {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return decoded?.exp ? new Date(decoded.exp * 1000) : null;
};

/** Whether the account's revoked list holds this token. */
export const isTokenRevoked = (list: unknown, token: string): boolean => {
  if (!Array.isArray(list) || list.length === 0) return false;
  const h = hashToken(token);
  return list.some((entry: any) => entry && entry.h === h);
};
