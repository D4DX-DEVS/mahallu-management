/**
 * Where the CMS sends API requests.
 *
 * The URL used to fall back to `http://localhost:4000/api` whenever `VITE_API_URL` was missing, so a
 * production build made without the variable shipped a bundle that called the VISITOR's own machine
 * and failed with nothing in the build log to say why. The fallback now exists for local development
 * only; any production build (and the production bundle itself) refuses to start without an explicit,
 * non-local API URL.
 *
 * This file is imported both by `vite.config.ts` (build-time guard) and by `services/api.ts`
 * (runtime), so it must stay free of browser-only and Vite-only APIs.
 */

export const DEV_API_URL = 'http://localhost:4000/api';

export interface ApiUrlEnv {
  VITE_API_URL?: string;
  /** Explicit opt-in for `vite preview` / a local production build that really should hit a local API. */
  VITE_ALLOW_LOCAL_API?: string;
  PROD?: boolean;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

export const isLocalHost = (hostname: string): boolean =>
  LOCAL_HOSTS.has(hostname.toLowerCase()) || hostname.toLowerCase().endsWith('.localhost');

export function resolveApiBaseUrl(env: ApiUrlEnv): string {
  const configured = (env.VITE_API_URL ?? '').trim();

  if (!configured) {
    if (env.PROD) {
      throw new Error(
        'VITE_API_URL is not set. A production build must be told where the API is, e.g. ' +
          'VITE_API_URL=https://api.example.com/api (set it in the Netlify environment). ' +
          'Refusing to build a bundle that would call http://localhost.'
      );
    }
    return DEV_API_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(`VITE_API_URL is not a valid absolute URL: "${configured}"`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`VITE_API_URL must be an http(s) URL, got "${parsed.protocol}"`);
  }

  if (env.PROD && env.VITE_ALLOW_LOCAL_API !== 'true') {
    if (isLocalHost(parsed.hostname)) {
      throw new Error(
        `VITE_API_URL points at a local address (${parsed.hostname}). A production build must use the ` +
          'real API origin. For a local production preview only, set VITE_ALLOW_LOCAL_API=true.'
      );
    }
    if (parsed.protocol !== 'https:') {
      throw new Error('VITE_API_URL must use https:// in a production build (tokens are sent on every request).');
    }
  }

  // No trailing slash, so `${base}/auth/me` never becomes `//auth/me`.
  return configured.replace(/\/+$/, '');
}
