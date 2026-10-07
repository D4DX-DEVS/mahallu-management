import type { CorsOptions } from 'cors';
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import net from 'net';
import { isDevelopmentEnvironment } from '../utils/env';

/**
 * HTTP-surface security configuration, kept free of Express wiring so it can be unit tested.
 * Everything here is driven by environment variable NAMES documented in docs/OPS_RUNBOOK.md; no value
 * is ever baked in.
 */

// ───────────────────────────── CORS ─────────────────────────────

/**
 * `CORS_ORIGINS`: comma-separated list of browser origins allowed to call the API, e.g.
 * `https://cms.example.com,https://*.netlify.app`.
 *
 * Accepted entries (everything else is INVALID and never matches):
 *  - `scheme://host[:port]` with scheme `http` or `https`, a DNS host name (letters, digits, hyphens),
 *    optional port. Case is ignored and a trailing slash is tolerated; a path, query, user-info or
 *    IPv6 literal is not.
 *  - a wildcard host `scheme://*.base.tld`: matches one or more subdomain labels under `base.tld` over
 *    the SAME scheme and port. The base must have at least two labels (`*.com` is refused) and must not
 *    be a well-known multi-label public suffix (`*.co.uk`). This is a heuristic, not the full Public
 *    Suffix List: do not list a wildcard over a domain you do not control (shared hosts such as
 *    `*.netlify.app` let every tenant of that host call the API from a browser; the Bearer token is
 *    still required, but prefer exact origins in production).
 *  - a bare `*`, `null`, scheme-less entries (`cms.example.com`) and malformed text are invalid.
 *
 * Fail-closed: if the variable is unset/blank outside development, no browser origin is allowed. If it
 * is set but contains NO valid entry, no browser origin is allowed in ANY environment (a typo must
 * never fall back to "open"). `checkBootEnvironment` turns invalid entries into a fatal error outside
 * development. Requests that carry no `Origin` header (mobile app, curl, server-to-server) are not
 * browser CORS requests and are unaffected.
 */
export interface ParsedOrigin {
  scheme: 'http' | 'https';
  host: string;
  /** Explicit port, normalised: the scheme's default port is dropped. */
  port: string;
  wildcard: boolean;
}

const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.in', 'net.in', 'org.in', 'ac.in', 'gov.in', 'edu.in', 'res.in', 'firm.in', 'gen.in', 'ind.in',
  'co.nz', 'org.nz', 'net.nz', 'co.za', 'org.za', 'com.br', 'net.br', 'org.br',
  'com.cn', 'net.cn', 'org.cn', 'co.jp', 'ne.jp', 'or.jp', 'com.sg', 'com.my', 'com.pk', 'com.bd',
  'com.sa', 'com.eg', 'com.tr', 'com.mx', 'com.ar', 'co.id', 'co.kr', 'co.il', 'com.hk', 'com.tw',
]);

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const ORIGIN_PATTERN = new RegExp(`^(https?)://((?:\\*\\.)?)((?:${LABEL}\\.)*${LABEL})(?::(\\d{1,5}))?/*$`);
const MAX_ENTRY_LENGTH = 300;

/** Parses one origin or origin pattern. Returns a reason string when it is not acceptable. */
export const parseOriginEntry = (raw: string, allowWildcard: boolean): ParsedOrigin | string => {
  const entry = String(raw).trim().toLowerCase();
  if (!entry) return 'is empty';
  if (entry === '*') return 'a bare "*" would allow every origin';
  if (entry.length > MAX_ENTRY_LENGTH) return 'is too long';
  if (!entry.includes('://')) return 'has no scheme (use https://host)';
  const match = ORIGIN_PATTERN.exec(entry);
  if (!match) return 'is not a valid scheme://host[:port] origin';
  const [, scheme, star, host, port] = match;
  if (host.length > 253) return 'host name is too long';
  if (port !== undefined && (Number(port) < 1 || Number(port) > 65535)) return 'port is out of range';
  const wildcard = star === '*.';
  if (wildcard) {
    if (!allowWildcard) return 'is not an origin';
    if (host.split('.').length < 2) return 'wildcard spans a public suffix (need at least two labels after "*.")';
    if (MULTI_LABEL_PUBLIC_SUFFIXES.has(host)) return 'wildcard spans a public suffix';
  }
  const defaultPort = scheme === 'https' ? '443' : '80';
  return {
    scheme: scheme as 'http' | 'https',
    host,
    port: port === undefined || String(Number(port)) === defaultPort ? '' : String(Number(port)),
    wildcard,
  };
};

const canonical = (parsed: ParsedOrigin): string =>
  `${parsed.scheme}://${parsed.wildcard ? '*.' : ''}${parsed.host}${parsed.port ? `:${parsed.port}` : ''}`;

const isLocalHost = (host: string) => host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1';

const SHARED_HOST_SUFFIXES = [
  'netlify.app', 'vercel.app', 'pages.dev', 'github.io', 'herokuapp.com', 'onrender.com',
  'web.app', 'firebaseapp.com', 'azurewebsites.net', 'workers.dev',
];

export interface CorsOriginAnalysis {
  /** Canonical (lower-cased, slash-less) valid entries. */
  valid: string[];
  invalid: Array<{ entry: string; reason: string }>;
  /** Valid but worth a human look (plain http outside localhost, wildcards over shared hosts). */
  warnings: string[];
  /** True when the variable has any non-blank entry (even if all are invalid). */
  configured: boolean;
}

export const analyzeCorsOrigins = (raw: string | undefined): CorsOriginAnalysis => {
  const entries = String(raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: CorsOriginAnalysis['invalid'] = [];
  const warnings: string[] = [];
  for (const entry of entries) {
    const parsed = parseOriginEntry(entry, true);
    if (typeof parsed === 'string') {
      invalid.push({ entry, reason: parsed });
      continue;
    }
    const name = canonical(parsed);
    if (!valid.includes(name)) valid.push(name);
    if (parsed.scheme === 'http' && !isLocalHost(parsed.host)) {
      warnings.push(`CORS_ORIGINS entry "${entry}" uses plain http. Use https:// in production.`);
    }
    if (parsed.wildcard && SHARED_HOST_SUFFIXES.some((suffix) => parsed.host === suffix || parsed.host.endsWith(`.${suffix}`))) {
      warnings.push(
        `CORS_ORIGINS entry "${entry}" is a wildcard over a shared hosting domain: any site hosted there may call the API from a browser. Prefer exact origins.`
      );
    }
  }
  return { valid, invalid, warnings, configured: entries.length > 0 };
};

/** Valid, canonical entries only (invalid ones, including a bare `*`, are dropped). */
export const parseAllowedOrigins = (raw: string | undefined): string[] => analyzeCorsOrigins(raw).valid;

/**
 * Never throws and never builds a regular expression from configuration: entries are parsed into
 * (scheme, host, port, wildcard) and compared structurally.
 */
export const isOriginAllowed = (origin: string, allowed: string[]): boolean => {
  const candidate = parseOriginEntry(String(origin ?? ''), false);
  if (typeof candidate === 'string') return false; // "null", garbage, paths, wildcards: never allowed
  return allowed.some((entry) => {
    const pattern = parseOriginEntry(entry, true);
    if (typeof pattern === 'string') return false;
    if (pattern.scheme !== candidate.scheme || pattern.port !== candidate.port) return false;
    if (!pattern.wildcard) return pattern.host === candidate.host;
    return candidate.host.length > pattern.host.length + 1 && candidate.host.endsWith(`.${pattern.host}`);
  });
};

export const buildCorsOptions = (
  env: Record<string, string | undefined> = process.env,
  development: boolean = isDevelopmentEnvironment()
): CorsOptions => {
  const analysis = analyzeCorsOrigins(env.CORS_ORIGINS);
  const allowed = analysis.valid;
  return {
    origin: (origin, callback) => {
      // No Origin header: not a cross-origin browser request.
      if (!origin) return callback(null, true);
      if (allowed.length > 0) return callback(null, isOriginAllowed(origin, allowed));
      // Set but nothing usable ("*", a typo): closed everywhere. The boot check reports it.
      if (analysis.configured) return callback(null, false);
      // Nothing configured: open for local development, closed everywhere else.
      return callback(null, development);
    },
    // Authentication is a Bearer header, never a cookie, so credentialed CORS is not needed.
    credentials: false,
    // Lets browser JS read the export endpoint's truncation flag (a non-safelisted response header).
    exposedHeaders: ['X-Export-Truncated'],
    maxAge: 600,
  };
};

// ───────────────────────────── trust proxy ─────────────────────────────

/**
 * `TRUST_PROXY`: how many reverse proxies sit in front of the API (e.g. `1` for a single Nginx or a
 * PaaS load balancer), or a comma-separated list of Express keywords (`loopback`, `linklocal`,
 * `uniquelocal`), IP addresses and CIDR ranges (`loopback, 10.0.0.0/8`). Unset = trust none, which is
 * correct when the API is exposed directly.
 *
 * IP-SPOOFING WARNING: `req.ip` (used by the rate limiter and the audit log) is taken from
 * X-Forwarded-For only for hops the API trusts. Trusting more hops than really exist, or a range that
 * contains clients, lets any caller choose the IP those controls see (evading the rate limit, forging
 * the audit trail). So this parser refuses, with a warning, and falls back to "trust none":
 *  - `true` / anything that trusts every address (`0.0.0.0/0`, `::/0`, CIDR prefixes shorter than /8
 *    for IPv4 or /7 for IPv6; fc00::/7 is the smallest legitimate private range),
 *  - hop counts above MAX_TRUST_PROXY_HOPS, negative or fractional numbers, mixed lists such as `1,2`,
 *    and any token that is not a keyword, IP or CIDR.
 * A hop count above 5 is honoured but warned about: very few deployments have that many proxies.
 * The opposite mistake (unset behind a proxy) is not spoofable but makes every client share one
 * rate-limit bucket; see docs/EDGE_RATE_LIMITING.md.
 */
export const MAX_TRUST_PROXY_HOPS = 20;
const WARN_TRUST_PROXY_HOPS = 5;
const TRUST_KEYWORDS = new Set(['loopback', 'linklocal', 'uniquelocal']);

export interface TrustProxyAnalysis {
  value: number | string | false;
  warnings: string[];
}

export const analyzeTrustProxy = (raw: string | undefined): TrustProxyAnalysis => {
  const value = String(raw ?? '').trim();
  const shown = value.length > 80 ? `${value.slice(0, 80)}...` : value;
  const refuse = (why: string): TrustProxyAnalysis => ({
    value: false,
    warnings: [`TRUST_PROXY="${shown}" ${why}; it is ignored and NO proxy is trusted.`],
  });
  if (!value || /^(false|0)$/i.test(value)) return { value: false, warnings: [] };
  if (/^true$/i.test(value)) {
    return refuse('would trust every forwarded address, so any client could choose the IP that rate limiting and the audit log see (use a hop count such as 1)');
  }
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (!Number.isSafeInteger(hops) || hops > MAX_TRUST_PROXY_HOPS) {
      return refuse(`is not a believable number of proxies (maximum ${MAX_TRUST_PROXY_HOPS}); trusting that many hops lets clients pick their own IP`);
    }
    if (hops === 0) return { value: false, warnings: [] };
    return {
      value: hops,
      warnings:
        hops > WARN_TRUST_PROXY_HOPS
          ? [`TRUST_PROXY=${hops} trusts ${hops} proxy hops. Confirm that many proxies really sit in front of the API; every extra hop lets clients spoof their IP.`]
          : [],
    };
  }
  const tokens = value.split(',').map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) return refuse('lists no address');
  const normalised: string[] = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (TRUST_KEYWORDS.has(lower)) {
      normalised.push(lower);
      continue;
    }
    const [address, prefix, extra] = token.split('/');
    const family = net.isIP(address);
    if (family === 0 || extra !== undefined) {
      return refuse(`contains "${token.slice(0, 40)}", which is not a hop count, keyword, IP address or CIDR range`);
    }
    if (prefix !== undefined) {
      if (!/^\d{1,3}$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)) {
        return refuse(`contains "${token.slice(0, 60)}" with an invalid prefix length`);
      }
      if (Number(prefix) < (family === 4 ? 8 : 7)) {
        return refuse(`contains "${token.slice(0, 60)}", a range so large it trusts (nearly) every address`);
      }
    }
    normalised.push(token);
  }
  return { value: normalised.join(', '), warnings: [] };
};

export const parseTrustProxy = (raw: string | undefined): number | string | false => {
  const { value, warnings } = analyzeTrustProxy(raw);
  warnings.forEach((warning) => console.warn(`[security] ${warning}`));
  return value;
};

// ───────────────────────────── API docs ─────────────────────────────

export type DocsPolicy = { mount: false; reason: string } | { mount: true; protectedByBasicAuth: boolean };

/**
 * Swagger UI maps every endpoint, so it is open in development only. In any other environment it is
 * mounted only when `ENABLE_API_DOCS=true` AND `API_DOCS_USER` / `API_DOCS_PASSWORD` are set, and then
 * behind HTTP Basic auth.
 */
export const decideDocsPolicy = (
  env: Record<string, string | undefined> = process.env,
  development: boolean = isDevelopmentEnvironment()
): DocsPolicy => {
  if (development) return { mount: true, protectedByBasicAuth: false };
  if (env.ENABLE_API_DOCS !== 'true') return { mount: false, reason: 'API docs are disabled outside development' };
  if (!env.API_DOCS_USER || !env.API_DOCS_PASSWORD) {
    return { mount: false, reason: 'ENABLE_API_DOCS is set but API_DOCS_USER / API_DOCS_PASSWORD are not' };
  }
  return { mount: true, protectedByBasicAuth: true };
};

const safeEqual = (a: string, b: string): boolean => {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

export const docsBasicAuth =
  (user: string, password: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator > 0 && safeEqual(decoded.slice(0, separator), user) && safeEqual(decoded.slice(separator + 1), password)) {
        return next();
      }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Mahallu API docs"');
    return res.status(401).send('Authentication required');
  };

// ───────────────────────────── boot-time checks ─────────────────────────────

const KNOWN_ENVIRONMENTS = new Set(['development', 'test', 'production', 'staging']);
const PLACEHOLDER_SECRETS = new Set(['your-secret-key', 'secret', 'changeme', 'change-me', 'jwt-secret', 'test-secret', 'password']);

export interface BootCheck {
  fatal: string[];
  warnings: string[];
}

/** Pure so it can be tested: what is wrong with this environment, without exiting the process. */
export const checkBootEnvironment = (env: NodeJS.ProcessEnv): BootCheck => {
  const fatal: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = String(env.NODE_ENV ?? '');
  const secret = String(env.JWT_SECRET ?? '');
  const development = nodeEnv === 'development' || nodeEnv === 'test';

  if (!KNOWN_ENVIRONMENTS.has(nodeEnv)) {
    warnings.push(
      `NODE_ENV="${nodeEnv}" is not one of development, test, staging or production. It is treated as production (development-only behaviour is off).`
    );
  }

  const cors = analyzeCorsOrigins(env.CORS_ORIGINS);
  if (cors.invalid.length > 0) {
    const detail = cors.invalid.map(({ entry, reason }) => `"${entry.slice(0, 60)}" (${reason})`).join('; ');
    const message = `CORS_ORIGINS has invalid entries: ${detail}. List exact origins such as https://cms.example.com.`;
    // Outside development a bad entry means the CMS is silently blocked, or (for "*") that someone
    // expected an open policy: refuse to start instead of guessing. Never "open" either way.
    if (development) warnings.push(`${message} They are ignored.`);
    else fatal.push(message);
  }
  const trustProxy = analyzeTrustProxy(env.TRUST_PROXY);
  warnings.push(...trustProxy.warnings);

  if (!development) {
    if (PLACEHOLDER_SECRETS.has(secret.toLowerCase())) {
      fatal.push('JWT_SECRET is a well-known placeholder. Set a long random secret before starting outside development.');
    } else if (secret.length < 32) {
      warnings.push('JWT_SECRET is shorter than 32 characters. Use a long random value (for example 48 random bytes, base64).');
    }
    if (!cors.configured) {
      warnings.push('CORS_ORIGINS is not set: browsers on other origins (the CMS) will be blocked until it lists the allowed origins.');
    }
    warnings.push(...cors.warnings);
  }
  return { fatal, warnings };
};
