import { body, param, query, ValidationChain } from 'express-validator';
import { MAX_AMOUNT, parseMoney } from '../utils/money';

/**
 * Chains shared by every router, so the same rule reads the same way and is
 * written once.
 *
 * Roughly half the routers had no validation at all. Their handlers put path
 * and query values straight into a Mongo filter, so a malformed `:id` reached
 * Mongoose as a cast failure and a `?page=-1` reached the driver as a negative
 * skip. `idParam` and `listQuery` are the two that belong on almost every
 * route; the field helpers below cover what create and update bodies carry.
 */

/** The largest money value this product handles. Keeps `1e308` out of a Number field. */
export { MAX_AMOUNT };

/** Dates before this are a typo or a probe, never a record. */
export const EARLIEST_DATE = '1900-01-01';

/** Dates after this are the same. Ten years out covers every legitimate plan. */
const latestPlausibleDate = (): Date => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 10);
  return date;
};

/**
 * A path id. `label` names the thing in the user's words, so a bad link reads
 * "We couldn't find that family." rather than a cast error.
 */
export const idParam = (name = 'id', label = 'record'): ValidationChain =>
  param(name)
    .isMongoId()
    .withMessage(`We couldn't find that ${label}. It may have been removed.`);

/** Page, limit and search — the query every list endpoint accepts. */
export const listQuery = (): ValidationChain[] => [
  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 100000 })
    .withMessage('Please choose a valid page.'),
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 100 })
    .withMessage('Please request between 1 and 100 items at a time.'),
  query('search')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Please enter a search term.')
    .isLength({ max: 100 })
    .withMessage('Please use a shorter search term.'),
];

/** An id passed as a query filter rather than in the path. */
export const idQuery = (name: string, label: string): ValidationChain =>
  query(name)
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage(`Please choose a valid ${label}.`);

/** A query filter restricted to a known set. */
export const enumQuery = (name: string, allowed: readonly string[], label: string): ValidationChain =>
  query(name)
    .optional({ values: 'falsy' })
    .isIn(allowed as string[])
    .withMessage(`Please choose a valid ${label}.`);

/** A required short line of text — a name, a title, a code. */
export const requiredText = (
  field: string,
  label: string,
  { min = 1, max = 200 }: { min?: number; max?: number } = {}
): ValidationChain =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`Please enter the ${label}.`)
    .bail()
    .isLength({ min, max })
    .withMessage(
      min > 1
        ? `Please keep the ${label} between ${min} and ${max} characters.`
        : `Please keep the ${label} to ${max} characters or less.`
    );

/**
 * The same field when it is optional.
 *
 * `values: 'falsy'` is deliberate: a form that clears a field sends `''`, and
 * that should mean "no value", not "a zero-length value that fails minimum
 * length".
 */
export const optionalText = (
  field: string,
  label: string,
  max = 200
): ValidationChain =>
  body(field)
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max })
    .withMessage(`Please keep the ${label} to ${max} characters or less.`);

/**
 * A bank account number: digits only, any length up to `max`.
 *
 * It is an identifier, not a quantity, so it is checked as text and never
 * coerced to a number - `0012345678` is a real account number and has to come
 * back out as `0012345678`. A JSON number is refused for the same reason: by
 * the time one arrives its leading zeros are already gone. Nothing is stripped
 * or rewritten; a value with a letter, space, dash or dot is rejected.
 */
export const accountNumberField = (
  field = 'accountNumber',
  label = 'account number',
  max = 200
): ValidationChain =>
  body(field)
    .optional({ values: 'falsy' })
    .isString()
    .withMessage(`Please enter the ${label} using digits only.`)
    .bail()
    .trim()
    .matches(/^[0-9]+$/)
    .withMessage(`Please enter the ${label} using digits only.`)
    .bail()
    .isLength({ max })
    .withMessage(`Please keep the ${label} to ${max} characters or less.`);

/** A longer free-text field — notes, a description, minutes. */
export const optionalLongText = (field: string, label: string, max = 5000): ValidationChain =>
  optionalText(field, label, max);

/** A reference to another record in a body. */
export const optionalRef = (field: string, label: string): ValidationChain =>
  body(field)
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage(`Please choose a valid ${label}.`);

export const requiredRef = (field: string, label: string): ValidationChain =>
  body(field)
    .notEmpty()
    .withMessage(`Please choose the ${label}.`)
    .bail()
    .isMongoId()
    .withMessage(`Please choose a valid ${label}.`);

/** Nothing was sent for this field: not given, null, or an empty / blank string. Zero is NOT blank. */
const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const rupees = (n: number) => n.toLocaleString('en-IN');

/**
 * A money field: rupees with at most two decimals, from `min` to `max`.
 *
 * - Optional (the default): an absent / null / empty value is skipped, but a
 *   provided 0 IS validated. (`optional({ values: 'falsy' })` treated 0 as
 *   absent, so a `min: 1` rule never ran on an update.)
 * - `required: true`: absent, null or empty is an error; 0 is checked against `min`.
 * - `min` is inclusive. `min: 0` accepts zero; use `min: 0.01` for "greater than zero".
 * - Rejects NaN, Infinity, exponent forms ('1e3'), booleans, arrays, a third
 *   decimal (10.999) and anything above `max` (default MAX_AMOUNT).
 * - A valid value is converted to a number so a handler never sums strings.
 */
export const amountField = (
  field: string,
  label: string,
  { required = false, min = 0, max = MAX_AMOUNT }: { required?: boolean; min?: number; max?: number } = {}
): ValidationChain => {
  const belowMin =
    min <= 0
      ? `The ${label} cannot be negative.`
      : min <= 0.01
        ? `The ${label} must be greater than zero.`
        : `The ${label} must be at least ${rupees(min)}.`;
  let chain = body(field);
  if (required) {
    chain = chain
      .custom((value) => {
        if (isBlank(value)) throw new Error(`Please enter the ${label}.`);
        return true;
      })
      .bail();
  } else {
    chain = chain.customSanitizer((value) => (isBlank(value) ? undefined : value)).if((value: unknown) => !isBlank(value));
  }
  return chain
    .custom((value) => {
      if (parseMoney(value) === null) {
        throw new Error(`Please enter a valid ${label} (a number with at most 2 decimal places).`);
      }
      return true;
    })
    .bail()
    .custom((value) => {
      const amount = parseMoney(value) as number;
      if (amount < min) throw new Error(belowMin);
      if (amount > max) throw new Error(`The ${label} cannot be more than ${rupees(max)}.`);
      return true;
    })
    .bail()
    .customSanitizer((value) => parseMoney(value) as number);
};

/**
 * A whole number inside a stated range. Same absent / zero semantics as
 * amountField: a provided 0 is checked against `min`.
 */
export const intField = (
  field: string,
  label: string,
  { required = false, min = 0, max = 1_000_000 }: { required?: boolean; min?: number; max?: number } = {}
): ValidationChain => {
  let chain = body(field);
  if (required) {
    chain = chain
      .custom((value) => {
        if (isBlank(value)) throw new Error(`Please enter the ${label}.`);
        return true;
      })
      .bail();
  } else {
    chain = chain.customSanitizer((value) => (isBlank(value) ? undefined : value)).if((value: unknown) => !isBlank(value));
  }
  return chain.custom((value) => {
    const whole =
      (typeof value === 'number' && Number.isInteger(value)) ||
      (typeof value === 'string' && /^-?\d+$/.test(value.trim()));
    if (!whole || Number(value) < min || Number(value) > max) {
      throw new Error(`Please enter a whole number between ${min} and ${max} for the ${label}.`);
    }
    return true;
  });
};

/**
 * An Indian bank IFSC code: four letters, a zero, then six letters or digits
 * (SBIN0001234). Trimmed and upper-cased, so ` sbin0001234 ` is stored as
 * `SBIN0001234`. An empty value is skipped.
 */
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ifscField = (field = 'ifscCode', label = 'IFSC code'): ValidationChain =>
  body(field)
    .optional({ values: 'falsy' })
    .isString()
    .withMessage(`Please enter a valid ${label}, like SBIN0001234.`)
    .bail()
    .trim()
    .toUpperCase()
    .matches(IFSC_PATTERN)
    .withMessage(`Please enter a valid ${label}, like SBIN0001234.`);

/**
 * A calendar date. Rejects `Invalid Date`, year 0001 and year 9999 alike —
 * all three reach a Date field happily and all three are wrong.
 */
export const dateField = (
  field: string,
  label: string,
  { required = false, allowFuture = true }: { required?: boolean; allowFuture?: boolean } = {}
): ValidationChain => {
  const chain = required
    ? body(field).notEmpty().withMessage(`Please choose the ${label}.`).bail()
    : body(field).optional({ values: 'falsy' });
  return chain
    .isISO8601()
    .withMessage(`Please choose a valid ${label}.`)
    .bail()
    .custom((value: string) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new Error(`Please choose a valid ${label}.`);
      if (date < new Date(EARLIEST_DATE)) throw new Error(`Please choose a valid ${label}.`);
      if (date > latestPlausibleDate()) throw new Error(`Please choose a valid ${label}.`);
      if (!allowFuture) {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        if (date > endOfToday) throw new Error(`The ${label} cannot be in the future.`);
      }
      return true;
    });
};

/**
 * `end` must not fall before `start`.
 *
 * Written against the *body*, so it runs after both fields have been checked
 * individually and only compares two values already known to be real dates.
 */
export const dateOrder = (
  startField: string,
  endField: string,
  message: string
): ValidationChain =>
  body(endField)
    .optional({ values: 'falsy' })
    .custom((value: string, { req }) => {
      const start = req.body?.[startField];
      if (!start) return true;
      const from = new Date(start);
      const to = new Date(value);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return true;
      if (to < from) throw new Error(message);
      return true;
    });

/** A 10-digit Indian mobile number. */
export const phoneField = (
  field: string,
  label = 'phone number',
  { required = false }: { required?: boolean } = {}
): ValidationChain => {
  const chain = required
    ? body(field).trim().notEmpty().withMessage(`Please enter the ${label}.`).bail()
    : body(field).optional({ values: 'falsy' }).trim();
  return chain.matches(/^[0-9]{10}$/).withMessage(`Please enter a 10-digit ${label}.`);
};

/** An email address, capped at the length a real address can be. */
export const emailField = (
  field = 'email',
  label = 'email address',
  { required = false }: { required?: boolean } = {}
): ValidationChain => {
  const chain = required
    ? body(field).trim().notEmpty().withMessage(`Please enter the ${label}.`).bail()
    : body(field).optional({ values: 'falsy' }).trim();
  // Length first: validator.js caps an address's local part at 64 characters, so
  // a 300-character string fails `isEmail` before a length rule placed after it
  // ever runs - and 'not a valid address' is the wrong thing to tell someone
  // whose address is merely too long.
  return chain
    .isLength({ max: 254 })
    .withMessage(`Please enter a shorter ${label}.`)
    .bail()
    .isEmail()
    .withMessage(`Please enter a valid ${label}.`);
};

/** A field restricted to a known set of values. */
export const enumField = (
  field: string,
  allowed: readonly string[],
  label: string,
  { required = false }: { required?: boolean } = {}
): ValidationChain => {
  const chain = required
    ? body(field).notEmpty().withMessage(`Please choose the ${label}.`).bail()
    : body(field).optional({ values: 'falsy' });
  return chain.isIn(allowed as string[]).withMessage(`Please choose a valid ${label}.`);
};

/** A yes/no field. */
export const boolField = (field: string, label: string): ValidationChain =>
  body(field)
    .optional()
    .isBoolean()
    .withMessage(`Please choose yes or no for the ${label}.`);

/** A list of record ids — attachments, selected members, tagged items. */
export const idArrayField = (
  field: string,
  label: string,
  max = 200
): ValidationChain =>
  body(field)
    .optional()
    .isArray({ max })
    .withMessage(`Please choose ${max} ${label} or fewer.`)
    .bail()
    .custom((values: unknown[]) => {
      if (values.some((v) => typeof v !== 'string' || !/^[a-fA-F0-9]{24}$/.test(v))) {
        throw new Error(`Please choose valid ${label}.`);
      }
      return true;
    });

/**
 * express-validator's normalizeEmail() with its defaults rewrites what the user typed:
 * it deletes the dots and the +tag of a Gmail address (a.b+x@gmail.com is saved as ab@gmail.com).
 * Only the case is normalised, so the address that is stored is the address that was entered.
 */
export const EMAIL_KEEP_AS_TYPED = {
  gmail_remove_dots: false,
  gmail_remove_subaddress: false,
  gmail_convert_googlemaildotcom: false,
  outlookdotcom_remove_subaddress: false,
  yahoo_remove_subaddress: false,
  icloud_remove_subaddress: false,
};
