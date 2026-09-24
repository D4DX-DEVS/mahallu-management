/**
 * Guards for anything that reaches a Mongo query straight from a request.
 *
 * Two holes this closes.
 *
 * Operator injection — Express parses `?status[$ne]=x` into an *object*, and
 * ~50 controllers do `query.status = req.query.status`. The filter then carries
 * an operator the caller chose, not a value. `asFilterValue` refuses anything
 * that is not a plain scalar.
 *
 * Regex injection — 30-odd list endpoints build `{ $regex: search }` from the
 * raw `search` param. `?search=(` is an invalid pattern and answers 500;
 * `?search=(a+)+$` is a backtracking bomb the database runs on every document.
 * `searchRegex` escapes the input and caps its length, so a search term is only
 * ever a literal substring match.
 */

/** Longest search term worth running. Beyond this it is a payload, not a search. */
const MAX_SEARCH_LENGTH = 100;

/** Every character with meaning to the regex engine, made literal. */
export const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A case-insensitive "contains" match for a user-typed term, or `undefined`
 * when there is nothing to search for. The result is always a literal.
 */
export const searchRegex = (
  input: unknown
): { $regex: string; $options: string } | undefined => {
  if (typeof input !== 'string') return undefined;
  const term = input.trim().slice(0, MAX_SEARCH_LENGTH);
  if (!term) return undefined;
  return { $regex: escapeRegex(term), $options: 'i' };
};

/**
 * A query-string value safe to use as a filter value.
 *
 * Returns `undefined` for objects and arrays — the shapes `qs` produces from
 * `field[$ne]=` and `field[]=` — so an injected operator drops the filter
 * rather than widening it.
 */
export const asFilterValue = (input: unknown): string | undefined => {
  if (typeof input === 'string') {
    const value = input.trim();
    return value.length > 0 && value.length <= 200 ? value : undefined;
  }
  if (typeof input === 'number' || typeof input === 'boolean') return String(input);
  return undefined;
};

/** The value only when it is one of `allowed`; otherwise `undefined`. */
export const asEnumValue = <T extends string>(
  input: unknown,
  allowed: readonly T[]
): T | undefined => {
  const value = asFilterValue(input);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
};

/** A 24-character hex id, or `undefined` — never a value Mongoose would throw casting. */
export const asObjectId = (input: unknown): string | undefined => {
  const value = asFilterValue(input);
  return value && /^[a-fA-F0-9]{24}$/.test(value) ? value : undefined;
};

/**
 * A finite number inside `[min, max]`, or `undefined`.
 * `''`, `'abc'`, `NaN`, `Infinity` and `1e999` all fall out here rather than
 * reaching a schema field typed Number.
 */
export const asNumber = (
  input: unknown,
  { min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {}
): number | undefined => {
  if (input === null || input === undefined || input === '') return undefined;
  if (typeof input === 'object') return undefined;
  const value = Number(input);
  if (!Number.isFinite(value)) return undefined;
  return value >= min && value <= max ? value : undefined;
};

/** A real calendar date, or `undefined` — never `Invalid Date`. */
export const asDate = (input: unknown): Date | undefined => {
  if (typeof input !== 'string' && !(input instanceof Date) && typeof input !== 'number') {
    return undefined;
  }
  const date = new Date(input as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * The escaped, length-capped literal to put in a `$regex` filter.
 * Anything that is not a string yields a pattern that matches nothing, so an
 * injected object cannot turn a search into "return everything".
 */
export const regexLiteral = (input: unknown): string =>
  typeof input === 'string'
    ? escapeRegex(input.trim().slice(0, MAX_SEARCH_LENGTH))
    : '(?!)';
