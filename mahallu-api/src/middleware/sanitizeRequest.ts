import { Request, Response, NextFunction } from 'express';

/**
 * Strips Mongo operator syntax out of every request before a route sees it.
 *
 * Express parses `?status[$ne]=x` and `{"phone": {"$gt": ""}}` into objects.
 * Controllers spread those straight into a filter or an update
 * (`query.status = req.query.status`, `findByIdAndUpdate(id, req.body)`), so
 * the caller — not the code — decides the operator. `?status[$ne]=deleted`
 * returns records a filter was written to hide, and `{"password":{"$ne":null}}`
 * is the classic login bypass.
 *
 * Two shapes are removed, at every depth:
 *   - keys beginning with `$`   — an operator
 *   - keys containing `.`       — a path into a subdocument, used to reach
 *                                 fields an update body was never meant to touch
 *
 * Values are left exactly as they are; only key names are judged. Field-level
 * validators still do the real work — this only removes the shapes that make a
 * *bypass* possible before any of them run.
 */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

/** Deletes operator keys in place, and reports whether anything was removed. */
const scrub = (value: unknown, depth = 0): boolean => {
  // A body nested deeper than this is not a form submission. Stop walking so a
  // deliberately deep payload cannot spend the request's whole CPU budget here.
  if (depth > 10) return false;

  let removed = false;

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (scrub(entry, depth + 1)) removed = true;
    }
    return removed;
  }

  if (!isPlainObject(value)) return false;

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
      removed = true;
      continue;
    }
    if (scrub(value[key], depth + 1)) removed = true;
  }

  return removed;
};

export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction) => {
  const touched = [
    scrub(req.body),
    scrub(req.query),
    scrub(req.params),
  ].some(Boolean);

  if (touched) {
    // Nothing legitimate in this product sends these. Worth seeing in the log.
    console.warn('[sanitizeRequest] operator syntax removed from', req.method, req.originalUrl);
  }

  next();
};
