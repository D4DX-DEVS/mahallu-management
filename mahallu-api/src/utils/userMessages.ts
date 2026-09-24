import { Response } from 'express';
import mongoose from 'mongoose';

/**
 * User-facing error copy for the API.
 *
 * Every response body used to carry `error.message` — Mongoose cast text,
 * duplicate-key dumps, `.env` variable names, driver failures — straight to
 * whoever was using the CMS or the mobile app. An exception string is written
 * for an engineer; a message is written for a person.
 *
 * `toUserMessage` turns a failure into something someone can act on, and
 * `sendFailure` keeps the real detail in the server log where it belongs.
 *
 * Copy rules (shared with the CMS `utils/errors.ts` and the app `ErrorCopy`):
 *   - say what happened, then what to do
 *   - never blame the person reading it
 *   - no exception text, no field paths, no internal names
 */

/** Field names as a person knows them, for duplicate-key and validation copy. */
const FIELD_LABELS: Record<string, string> = {
  phone: 'phone number',
  phoneNumber: 'phone number',
  email: 'email address',
  name: 'name',
  houseName: 'house name',
  houseNumber: 'house number',
  regNo: 'registration number',
  registrationNumber: 'registration number',
  certificateNo: 'certificate number',
  code: 'code',
  key: 'key',
  username: 'username',
  password: 'password',
  aadhaar: 'Aadhaar number',
  rationCardNo: 'ration card number',
  tenantId: 'Mahallu',
  mosqueId: 'mosque',
  familyId: 'family',
  memberId: 'member',
  instituteId: 'institute',
  categoryId: 'category',
  ledgerId: 'ledger',
  committeeId: 'committee',
  clusterId: 'cluster',
  schemeId: 'scheme',
  graveNo: 'grave number',
  dateOfBirth: 'date of birth',
  amount: 'amount',
};

/** "houseName" -> "house name"; falls back to a spaced-out version of the path. */
export function humanField(path?: string | null): string {
  if (!path) return '';
  const last = path.split('.').pop() as string;
  if (FIELD_LABELS[last]) return FIELD_LABELS[last];
  return last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\bId\b/gi, '')
    .trim()
    .toLowerCase();
}

/**
 * Anything carrying developer vocabulary, config names, paths or object syntax
 * is not shown. A short plain sentence written as a business rule is.
 */
const TECHNICAL_TOKENS =
  /(cast to|objectid|validation ?error|e11000|duplicate key|econnrefused|enotfound|etimedout|econnreset|mongo|mongoose|bson|prisma|redis|axios|multer|jwt|secret|dxing|onesignal|openrouter|firebase|cloudinary|smtp|api[_ ]?key|\.env\b|process\.env|undefined|\bnull\b|\bnan\b|stack|\bat\s+\w+[.(]|[{}[\]<>]|https?:\/\/|\berror:|\bexception\b|\.ts\b|\.js\b|[\\/](?:src|node_modules)[\\/]|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b)/i;

/** A backend string safe to show: short, sentence-like, no technical tokens. */
export function looksHumanReadable(message: unknown): message is string {
  if (typeof message !== 'string') return false;
  const text = message.trim();
  if (text.length === 0 || text.length > 200) return false;
  return !TECHNICAL_TOKENS.test(text);
}

/**
 * Thrown where a rule the user broke should reach them word for word.
 * Anything else that escapes a controller is replaced with friendly copy.
 */
export class UserFacingError extends Error {
  readonly statusCode: number;
  readonly isUserFacing = true;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'UserFacingError';
    this.statusCode = statusCode;
  }
}

const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
]);

/** Shared copy so the same situation reads the same way everywhere. */
export const MESSAGES = {
  server: 'Something went wrong on our side. Please try again in a moment.',
  network: "We couldn't reach a service we need right now. Please try again in a moment.",
  sessionExpired: 'Your session has ended. Please sign in again to continue.',
  signInRequired: 'Please sign in to continue.',
  permissionDenied: "You don't have permission to do this. Please contact your Mahallu admin.",
  mahalluRequired: 'Please select a Mahallu before continuing.',
  invalidInput: 'Some details are missing or incorrect. Please check the form and try again.',
  duplicate: 'A record with these details already exists. Please check for a duplicate.',
  tooManyAttempts: 'Too many attempts. Please wait a minute and try again.',
  fileTooLarge: 'That file is too large. Please choose a file under 5 MB.',
  fileMissing: 'Please choose a file to upload.',
} as const;

/** "We couldn't find that member. It may have been removed." */
export function notFoundMessage(entity: string): string {
  return "We couldn't find that " + entity + '. It may have been removed.';
}

/** Full technical detail, kept server-side only. */
export function logFailure(context: string, error: unknown): void {
  console.error('[' + context + ']', error);
}

/** The status that actually fits the failure, when we can tell. */
export function statusForError(error: unknown, fallbackStatus = 500): number {
  const err = error as { code?: unknown; name?: string; statusCode?: number };

  if (error instanceof UserFacingError) return error.statusCode;
  if (error instanceof mongoose.Error.ValidationError) return 400;
  if (error instanceof mongoose.Error.CastError) return 404;
  if (err?.code === 11000 || err?.code === 11001) return 409;
  if (
    err?.name === 'TokenExpiredError' ||
    err?.name === 'JsonWebTokenError' ||
    err?.name === 'NotBeforeError'
  ) {
    return 401;
  }
  if (err?.name === 'MulterError') return err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;

  return fallbackStatus;
}

/**
 * The message to show. `fallback` is the copy for this specific action —
 * "We couldn't save the family. Please try again." — used whenever the
 * underlying failure has nothing a person could act on.
 */
export function toUserMessage(error: unknown, fallback: string = MESSAGES.server): string {
  const err = error as {
    code?: unknown;
    name?: string;
    message?: unknown;
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
  };

  if (error instanceof UserFacingError) return error.message;

  // Duplicate key: name the field, so the fix is obvious.
  if (err?.code === 11000 || err?.code === 11001) {
    const field = humanField(Object.keys(err.keyPattern ?? err.keyValue ?? {})[0]);
    return field
      ? 'A record with this ' + field + ' already exists. Please use a different ' + field + '.'
      : MESSAGES.duplicate;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const first = Object.values(error.errors)[0] as { path?: string; kind?: string } | undefined;
    const field = humanField(first?.path);
    if (first?.kind === 'required' && field) {
      return 'Please enter the ' + field + '.';
    }
    return field ? 'Please check the ' + field + ' and try again.' : MESSAGES.invalidInput;
  }

  if (error instanceof mongoose.Error.CastError) {
    return "We couldn't find what you were looking for. It may have been removed.";
  }

  if (
    err?.name === 'TokenExpiredError' ||
    err?.name === 'JsonWebTokenError' ||
    err?.name === 'NotBeforeError'
  ) {
    return MESSAGES.sessionExpired;
  }

  if (err?.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') return MESSAGES.fileTooLarge;
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return "That file type isn't supported. Please choose a different file.";
    }
    return "We couldn't upload that file. Please try again.";
  }

  if (typeof err?.code === 'string' && NETWORK_CODES.has(err.code)) return MESSAGES.network;

  // A rule written for a person — a business message thrown by a controller.
  if (looksHumanReadable(err?.message)) return err.message as string;

  return fallback;
}

/**
 * Log the real failure, answer with copy the user can act on.
 *
 * `fallback` describes this action in the user's words. `fallbackStatus` is
 * used only when the failure itself doesn't imply a better one.
 */
export function sendFailure(
  res: Response,
  error: unknown,
  fallback: string = MESSAGES.server,
  fallbackStatus = 500
): Response {
  const req = (res as unknown as { req?: { method?: string; originalUrl?: string } }).req;
  logFailure((req?.method ?? 'REQ') + ' ' + (req?.originalUrl ?? ''), error);
  return res
    .status(statusForError(error, fallbackStatus))
    .json({ success: false, message: toUserMessage(error, fallback) });
}
