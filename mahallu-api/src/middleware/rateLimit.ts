import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { normalizeIndianPhone } from '../services/dxingService';

type Key = string;
type Entry = number[];

/**
 * In-memory attempt counting, keyed by IP plus whatever identifies the attempt.
 *
 * Every limiter owns its OWN store and its own window. They used to share one map keyed only by
 * `ip:identity`, so a login attempt, a send-otp and a verify-otp for the same number all landed in one
 * timestamp list and each limiter counted the others' traffic against its own budget (and a sweep with
 * one limiter's window could drop entries another limiter still needed). Keeping the stores apart means
 * each endpoint's documented limit applies to that endpoint alone.
 *
 * Single-process only - a second instance counts separately - which is fine for what this is: a brake on
 * scripted guessing, not a quota system. A store is swept on write so a long-running process does not
 * accumulate one entry per address that ever tried.
 */
const SWEEP_EVERY = 500;

const limiter = (
  name: string,
  windowMs: number,
  maxAttempts: number,
  identify: (req: Request) => string,
  message: string
) => {
  const store: Map<Key, Entry> = new Map();
  let writesSinceSweep = 0;

  const sweep = (now: number) => {
    for (const [key, timestamps] of store) {
      if (timestamps.every((ts) => ts < now - windowMs)) store.delete(key);
    }
  };

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const key: Key = `${req.ip || 'unknown'}:${identify(req)}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const recent = (store.get(key) || []).filter((ts) => ts >= windowStart);
    recent.push(now);
    store.set(key, recent);

    if (++writesSinceSweep >= SWEEP_EVERY) {
      writesSinceSweep = 0;
      sweep(now);
    }

    if (recent.length > maxAttempts) {
      return res.status(429).json({ success: false, message });
    }

    next();
  };

  // Read by tests and tooling only; not part of the request path.
  (middleware as any).limiterName = name;
  (middleware as any).storeSize = () => store.size;
  return middleware;
};

/** The phone on the request, normalised, so `+91…` and `0…` count as one. */
const phoneKey = (req: Request): string => {
  const phone = (req.body?.phone as string) || '';
  try {
    return normalizeIndianPhone(phone).normalized;
  } catch {
    // Let the validation handler answer a malformed number; still rate-limit it.
    return typeof phone === 'string' ? phone.slice(0, 20) : 'unknown';
  }
};

export const verifyOtpRateLimiter = limiter(
  'verify-otp',
  2 * 60 * 1000,
  8,
  phoneKey,
  'Too many attempts. Please wait a few minutes and try again.'
);

/**
 * Password sign-in had no limit at all: a 4-digit-PIN-style password could be
 * walked through end to end against a known phone number, as fast as the API
 * would answer. Ten tries per number per five minutes leaves a person who has
 * genuinely forgotten their password room to think, and takes scripted guessing
 * off the table.
 */
export const loginRateLimiter = limiter(
  'login',
  5 * 60 * 1000,
  10,
  phoneKey,
  'Too many sign-in attempts. Please wait a few minutes and try again.'
);

/**
 * Sending an OTP costs money and reaches someone's phone. Limited harder than
 * verifying one, and on the same key, so a loop cannot bill the Mahallu for
 * messages or turn the API into an SMS bomber aimed at one number.
 */
export const sendOtpRateLimiter = limiter(
  'send-otp',
  10 * 60 * 1000,
  5,
  phoneKey,
  'Too many requests. Please wait a few minutes before asking for another code.'
);

/**
 * Public, unauthenticated certificate lookup: a brake on scripted enumeration of certificate numbers.
 * Counted per client IP: the key is `req.ip` plus a constant, so visitors with different addresses do
 * not share a bucket (there is nothing else to key on). Behind a proxy this needs TRUST_PROXY set
 * correctly, otherwise every visitor shares the proxy's address.
 */
export const publicVerifyRateLimiter = limiter(
  'public-verify',
  60 * 1000,
  30,
  () => 'public-verify',
  'Too many verification requests. Please wait a minute and try again.'
);

/** The authenticated caller's own user id — this route runs after authMiddleware. */
const authUserKey = (req: Request): string => (req as any).user?._id?.toString() || 'unknown';

/**
 * Switch-account is behind a valid session already, so it's a much lower-risk
 * target than the unauthenticated OTP/login endpoints above — but it still
 * takes a client-supplied id and checks it against a DB record, so it gets
 * the same brake against a script walking ids looking for a phone match.
 */
export const switchAccountRateLimiter = limiter(
  'switch-account',
  5 * 60 * 1000,
  10,
  authUserKey,
  'Too many account-switch attempts. Please wait a few minutes and try again.'
);

/**
 * The phone claim of the sign-in step's pre-auth token, read WITHOUT verifying it. That is enough for a
 * rate-limit key: a token whose payload was edited no longer verifies, so rotating the claim only ever
 * produces requests that the handler rejects on the signature.
 */
const preAuthKey = (req: Request): string => {
  const token = req.body?.preAuthToken;
  if (typeof token !== 'string' || !token) return 'unknown';
  try {
    const claims: any = jwt.decode(token);
    return typeof claims?.phone === 'string' && claims.phone ? claims.phone.slice(0, 20) : 'unknown';
  } catch {
    return 'unknown';
  }
};

/**
 * `POST /auth/select-account` is unauthenticated: it trades a pre-auth token (valid for five minutes
 * and not single-use) plus a client-supplied account id for a session. Ten tries per phone and address
 * per five minutes is plenty for a person choosing a role and stops a replayed token from being used
 * to walk account ids.
 */
export const selectAccountRateLimiter = limiter(
  'select-account',
  5 * 60 * 1000,
  10,
  preAuthKey,
  'Too many attempts. Please wait a few minutes and sign in again.'
);
