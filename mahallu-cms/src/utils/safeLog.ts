/**
 * Error logging that cannot leak credentials.
 *
 * `console.error('x', err)` on an axios error prints the whole object, including
 * `config.headers.Authorization` (the bearer token), the request body and the
 * response body. `logError` keeps only what is useful for debugging a failure:
 * the context, the message, the HTTP status and the request path.
 */

export interface SafeErrorInfo {
  message: string;
  status?: number;
  code?: string;
  method?: string;
  /** Path only: no host, no query string (search terms can be personal data). */
  url?: string;
}

const stripQuery = (url: unknown): string | undefined => {
  if (typeof url !== 'string' || !url) return undefined;
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
};

export function describeError(err: unknown): SafeErrorInfo {
  if (err && typeof err === 'object') {
    const e = err as {
      message?: unknown;
      code?: unknown;
      response?: { status?: unknown };
      config?: { url?: unknown; method?: unknown };
    };
    return {
      message: typeof e.message === 'string' ? e.message : 'Unknown error',
      status: typeof e.response?.status === 'number' ? e.response.status : undefined,
      code: typeof e.code === 'string' ? e.code : undefined,
      method: typeof e.config?.method === 'string' ? e.config.method.toUpperCase() : undefined,
      url: stripQuery(e.config?.url),
    };
  }
  return { message: typeof err === 'string' ? err : 'Unknown error' };
}

/** Drop-in for `console.error(context, err)` that never prints headers, config or bodies. */
export function logError(context: string, err: unknown): void {
  console.error(context, describeError(err));
}
