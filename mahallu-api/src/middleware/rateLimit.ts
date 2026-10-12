import { Request, Response, NextFunction } from 'express';
import { normalizeIndianPhone } from '../services/dxingService';

type Key = string;
type Entry = number[];

const attemptsStore: Map<Key, Entry> = new Map();

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 8; // per phone+ip within window

export const verifyOtpRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const phone = (req.body?.phone as string) || '';
  let normalizedPhone = 'unknown';

  try {
    normalizedPhone = normalizeIndianPhone(phone).normalized;
  } catch {
    // let validation handler deal with bad phone numbers
  }

  const key: Key = `${req.ip || 'unknown'}:${normalizedPhone}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const attempts = attemptsStore.get(key) || [];
  const recentAttempts = attempts.filter((ts) => ts >= windowStart);
  recentAttempts.push(now);
  attemptsStore.set(key, recentAttempts);

  if (recentAttempts.length > MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: 'Too many OTP verification attempts. Please try again later.',
    });
  }

  next();
};

// Password login brute-force protection: per ip+phone within window.
const loginAttemptsStore: Map<Key, Entry> = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

export const loginRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/\D/g, '').slice(-10) : 'unknown';
  const key: Key = `${req.ip || 'unknown'}:${phone}`;
  const now = Date.now();
  const recent = (loginAttemptsStore.get(key) || []).filter((ts) => ts >= now - LOGIN_WINDOW_MS);
  recent.push(now);
  loginAttemptsStore.set(key, recent);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (loginAttemptsStore.size > 5000) {
    for (const [k, v] of loginAttemptsStore) {
      if (!v.some((ts) => ts >= now - LOGIN_WINDOW_MS)) loginAttemptsStore.delete(k);
    }
  }

  if (recent.length > LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
    });
  }
  next();
};
