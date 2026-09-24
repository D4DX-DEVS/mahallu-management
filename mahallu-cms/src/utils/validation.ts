import { z } from 'zod';

/**
 * The rules a form applies, written once and shared by both kinds of form in
 * this app: the react-hook-form pages that take a zod schema, and the
 * `useState` pages that check on submit.
 *
 * Every limit here is the same number the API enforces
 * (`mahallu-api/src/validations/common.ts`). That is the point of the file. A
 * form that stops at 100 characters while the API stops at 200 is a hidden
 * inconsistency; a form that has no limit while the API has one is a submission
 * that fails only after the user has typed everything and pressed Save.
 *
 * Copy follows the same rules as the API's: say what is wrong, then what to do.
 */

/* ── the limits, shared with the API ───────────────────────────────────── */

export const LIMITS = {
  name: { min: 2, max: 100 },
  title: { min: 2, max: 200 },
  shortText: { max: 200 },
  notes: { max: 2000 },
  description: { max: 3000 },
  longText: { max: 5000 },
  search: { max: 100 },
  email: { max: 254 },
  password: { min: 6, max: 128 },
  amount: { min: 0, max: 100_000_000 },
  age: { min: 0, max: 120 },
  percent: { min: 0, max: 100 },
} as const;

/** Matches the API: exactly ten digits, no spaces, no country code. */
export const PHONE_PATTERN = /^[0-9]{10}$/;

/** A Mongo id as it reaches the client. */
export const ID_PATTERN = /^[a-fA-F0-9]{24}$/;

/** "2024" or "2024-25", the two shapes the API accepts. */
export const ACADEMIC_YEAR_PATTERN = /^\d{4}(-\d{2,4})?$/;

const EARLIEST_DATE = new Date('1900-01-01');

/* ── zod pieces, for the react-hook-form pages ─────────────────────────── */

export const phoneSchema = z
  .string()
  .regex(PHONE_PATTERN, 'Please enter a 10-digit phone number.');

export const optionalPhoneSchema = z
  .string()
  .optional()
  .refine((value) => !value || PHONE_PATTERN.test(value), {
    message: 'Please enter a 10-digit phone number.',
  });

export const emailSchema = z
  .string()
  .max(LIMITS.email.max, 'Please enter a shorter email address.')
  .email('Please enter a valid email address.')
  .optional()
  .or(z.literal(''));

/** A required line of text. Trims first, so spaces alone are not an answer. */
export const requiredString = (label = 'this field', max = LIMITS.shortText.max) =>
  z
    .string()
    .trim()
    .min(1, `Please enter the ${label}.`)
    .max(max, `Please keep the ${label} to ${max} characters or less.`);

/** A person's or record's name — the API's 2-to-100 rule. */
export const nameSchema = (label = 'name') =>
  z
    .string()
    .trim()
    .min(1, `Please enter the ${label}.`)
    .min(LIMITS.name.min, `Please keep the ${label} between ${LIMITS.name.min} and ${LIMITS.name.max} characters.`)
    .max(LIMITS.name.max, `Please keep the ${label} between ${LIMITS.name.min} and ${LIMITS.name.max} characters.`);

export const optionalString = (label = 'this field', max = LIMITS.shortText.max) =>
  z
    .string()
    .max(max, `Please keep the ${label} to ${max} characters or less.`)
    .optional()
    .or(z.literal(''));

/**
 * A number typed into a text input.
 *
 * An empty box is `''`, which `Number('')` turns into `0` — how a blank amount
 * became a zero-rupee record. Blank stays blank here; only a real number passes.
 */
export const numberFromInput = (
  label: string,
  { min = 0, max = LIMITS.amount.max, required = false }: { min?: number; max?: number; required?: boolean } = {}
) =>
  z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return undefined;
      const parsed = typeof value === 'string' ? Number(value.trim()) : value;
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    },
    required
      ? z
          .number({ invalid_type_error: `Please enter a valid ${label}.`, required_error: `Please enter the ${label}.` })
          .min(min, `Please enter a valid ${label}.`)
          .max(max, `Please enter a valid ${label}.`)
      : z
          .number({ invalid_type_error: `Please enter a valid ${label}.` })
          .min(min, `Please enter a valid ${label}.`)
          .max(max, `Please enter a valid ${label}.`)
          .optional()
  );

/* ── plain checks, for the pages that validate on submit ───────────────── */

/** One message per field, in the order the fields were declared. */
export type FieldErrors = Record<string, string>;

export interface FieldRule {
  /** Shown in the message: "Please enter the amount." */
  label: string;
  required?: boolean;
  min?: number;
  max?: number;
  /** Text length bounds, for string fields. */
  minLength?: number;
  maxLength?: number;
  type?: 'text' | 'number' | 'integer' | 'phone' | 'email' | 'date' | 'id' | 'academicYear';
  /** Values a select is allowed to hold. */
  oneOf?: readonly string[];
  /** Refuse a date later than today — a date of birth, a payment date. */
  noFuture?: boolean;
  /** Name of the field this one must not fall before. */
  notBefore?: string;
  notBeforeLabel?: string;
  /** Anything the rules above cannot express. Return a message to fail. */
  custom?: (value: unknown, values: Record<string, unknown>) => string | undefined;
}

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/** The one check for a single field. Returns a message, or `undefined` when fine. */
export function checkField(
  value: unknown,
  rule: FieldRule,
  values: Record<string, unknown> = {}
): string | undefined {
  const { label } = rule;

  if (isBlank(value)) {
    if (rule.required) {
      const choosing = rule.type === 'id' || rule.oneOf;
      return choosing ? `Please choose the ${label}.` : `Please enter the ${label}.`;
    }
    return rule.custom?.(value, values);
  }

  const text = typeof value === 'string' ? value.trim() : value;

  switch (rule.type) {
    case 'phone':
      if (!PHONE_PATTERN.test(String(text))) return `Please enter a 10-digit ${label}.`;
      break;

    case 'email': {
      const address = String(text);
      if (address.length > LIMITS.email.max) return `Please enter a shorter ${label}.`;
      // Deliberately close to the API's rule: one @, something either side, a dot in the domain.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) return `Please enter a valid ${label}.`;
      break;
    }

    case 'id':
      if (!ID_PATTERN.test(String(text))) return `Please choose a valid ${label}.`;
      break;

    case 'academicYear':
      if (!ACADEMIC_YEAR_PATTERN.test(String(text))) {
        return 'Please enter the academic year as 2024 or 2024-25.';
      }
      break;

    case 'number':
    case 'integer': {
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) return `Please enter a valid ${label}.`;
      if (rule.type === 'integer' && !Number.isInteger(parsed)) {
        return `Please enter a whole number for the ${label}.`;
      }
      if (rule.min !== undefined && parsed < rule.min) return `Please enter a valid ${label}.`;
      const max = rule.max ?? LIMITS.amount.max;
      if (parsed > max) return `Please enter a valid ${label}.`;
      break;
    }

    case 'date': {
      const date = new Date(String(text));
      if (Number.isNaN(date.getTime())) return `Please choose a valid ${label}.`;
      if (date < EARLIEST_DATE) return `Please choose a valid ${label}.`;
      if (rule.noFuture) {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        if (date > endOfToday) return `The ${label} cannot be in the future.`;
      }
      if (rule.notBefore) {
        const other = values[rule.notBefore];
        if (!isBlank(other)) {
          const start = new Date(String(other));
          if (!Number.isNaN(start.getTime()) && date < start) {
            return `The ${label} cannot be before the ${rule.notBeforeLabel ?? 'start date'}.`;
          }
        }
      }
      break;
    }

    default: {
      const length = String(text).length;
      const minLength = rule.minLength ?? 0;
      const maxLength = rule.maxLength ?? LIMITS.shortText.max;
      if (length < minLength) {
        return `Please keep the ${label} between ${minLength} and ${maxLength} characters.`;
      }
      if (length > maxLength) {
        return `Please keep the ${label} to ${maxLength} characters or less.`;
      }
    }
  }

  if (rule.oneOf && !rule.oneOf.includes(String(text))) {
    return `Please choose a valid ${label}.`;
  }

  return rule.custom?.(text, values);
}

/**
 * Checks a whole form and returns a message per failing field.
 *
 * Use it in a submit handler:
 *
 *   const errors = validateForm(form, RULES);
 *   if (hasErrors(errors)) { setErrors(errors); return; }
 */
export function validateForm<T extends Record<string, unknown>>(
  values: T,
  rules: Partial<Record<keyof T & string, FieldRule>>
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, rule] of Object.entries(rules) as [string, FieldRule][]) {
    const message = checkField(values[field], rule, values);
    if (message) errors[field] = message;
  }
  return errors;
}

export const hasErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

/** The first message, for a form that shows one banner rather than per-field text. */
export const firstError = (errors: FieldErrors): string | null =>
  Object.values(errors)[0] ?? null;

/**
 * Trims strings and drops blanks before sending.
 *
 * A cleared field should reach the API as absent, not as `''` — an empty string
 * is a value, and on an update it overwrites what was there.
 */
export function cleanPayload<T extends Record<string, unknown>>(values: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') continue;
      out[key] = trimmed;
      continue;
    }
    out[key] = value;
  }
  return out as Partial<T>;
}

/* -- uploaded files ---------------------------------------------------- */

/** What each upload point accepts, matching the API's multer filters. */
export const UPLOAD_LIMITS = {
  image: {
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxBytes: 5 * 1024 * 1024,
    describe: 'a JPEG, PNG, WebP or GIF image',
  },
  document: {
    types: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 10 * 1024 * 1024,
    describe: 'a PDF, JPEG, PNG or WebP file',
  },
} as const;

/**
 * Checks a chosen file before it is uploaded, and returns a message when it
 * cannot be. The API refuses the same file, but only after it has been sent -
 * which on a phone is a long wait to be told the wrong thing was picked.
 */
export function checkUploadedFile(
  file: File | null | undefined,
  kind: keyof typeof UPLOAD_LIMITS
): string | undefined {
  if (!file) return 'Please choose a file to upload.';

  const limit = UPLOAD_LIMITS[kind];
  const mb = Math.round(limit.maxBytes / (1024 * 1024));

  if (file.size === 0) return 'That file is empty. Please choose another one.';
  if (file.size > limit.maxBytes) {
    return `That file is too large. Please choose a file under ${mb} MB.`;
  }
  if (!(limit.types as readonly string[]).includes(file.type)) {
    return `That file type isn’t supported. Please choose ${limit.describe}.`;
  }
  return undefined;
}
