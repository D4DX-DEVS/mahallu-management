import { Request, Response, NextFunction } from 'express';
import { normalizeIndianPhone } from '../services/dxingService';

type Key = string;
type Entry = number[];

const attemptsStore: Map<Key, Entry> = new Map();

/**
 * In-memory attempt counting, keyed by IP plus whatever identifies the attempt.
 *
 * Single-process only — a second instance counts separately — which is fine for
 * what this is: a brake on scripted guessing, not a quota system. The store is
 * swept on write so a long-running process does not accumulate one entry per
 * address that ever tried.
 */
const SWEEP_EVERY = 500;
let writesSinceSweep = 0;

const sweep = (windowMs: number, now: number) => {
  for (const [key, timestamps] of attemptsStore) {
    if (timestamps.every((ts) => ts < now - windowMs)) attemptsStore.delete(key);
  }
};

const limiter = (
  windowMs: number,
  maxAttempts: number,
  identify: (req: Request) => string,
  message: string
) => (req: Request, res: Response, next: NextFunction) => {
  const key: Key = `${req.ip || 'unknown'}:${identify(req)}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const recent = (attemptsStore.get(key) || []).filter((ts) => ts >= windowStart);
  recent.push(now);
  attemptsStore.set(key, recent);

  if (++writesSinceSweep >= SWEEP_EVERY) {
    writesSinceSweep = 0;
    sweep(windowMs, now);
  }

  if (recent.length > maxAttempts) {
    return res.status(429).json({ success: false, message });
  }

  next();
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
  5 * 60 * 1000,
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
  10 * 60 * 1000,
  5,
  phoneKey,
  'Too many requests. Please wait a few minutes before asking for another code.'
);
