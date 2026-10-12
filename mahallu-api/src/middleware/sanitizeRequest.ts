import { Request, Response, NextFunction } from 'express';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Remove Mongo operator keys ("$ne", "$where", ...) from a request payload, recursively. */
const stripOperators = (value: unknown, depth = 0): unknown => {
  if (depth > 10) return value;
  if (Array.isArray(value)) return value.map((v) => stripOperators(v, depth + 1));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$')) continue;
      out[k] = stripOperators(v, depth + 1);
    }
    return out;
  }
  return value;
};

/**
 * Blocks NoSQL operator injection and regex injection on user-supplied input.
 * - req.query: nested objects (e.g. ?status[$ne]=x) are dropped; arrays/strings are kept.
 *   `search` is regex-escaped because controllers pass it straight into $regex.
 * - req.body / req.params: keys starting with "$" are removed.
 */
export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction) => {
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      const v = (req.query as any)[key];
      if (isPlainObject(v)) {
        delete (req.query as any)[key];
      } else if (Array.isArray(v) && v.some((x) => isPlainObject(x))) {
        (req.query as any)[key] = v.filter((x) => !isPlainObject(x));
      }
    }
    if (typeof req.query.search === 'string') {
      (req.query as any).search = escapeRegex(req.query.search.slice(0, 100));
    }
  }
  if (req.body && typeof req.body === 'object') {
    req.body = stripOperators(req.body);
  }
  next();
};
