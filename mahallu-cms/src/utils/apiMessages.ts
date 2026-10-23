/**
 * User-centred copy for API outcomes. Nothing in here ever returns raw axios/server technical text.
 *   getFriendlyError(err, "Couldn't save the committee. Check the details and try again.")
 *   describeWrite('post', '/committees')  ->  { message: 'Committee created', silent: false }
 */

export const MESSAGES = {
  offline: 'You seem to be offline. Your changes were not saved. Check your connection and try again.',
  offlineRead: 'You seem to be offline. Check your connection and try again.',
  validation: 'Some details need fixing. Check the highlighted fields.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to do this. Ask your mahallu admin if you need access.',
  notFound: 'We could not find that record. It may have been removed.',
  conflict: 'This conflicts with existing data. Check for a duplicate and try again.',
  locked: 'This period is closed, so changes are not allowed. Ask an admin to reopen it first.',
  tooMany: 'Too many attempts. Please wait a moment and try again.',
  server: 'Something went wrong on our side. Your data is safe. Please try again in a moment.',
  unknown: 'Something went wrong. Please try again.',
} as const;

// ---------------------------------------------------------------- error copy

const TECHNICAL =
  /request failed|status code|network error|timeout of|internal server|stack|^\s*at\s|\bundefined\b|\bnull\b|cannot read|is not a function|is not defined|unexpected token|json|econn|enotfound|etimedout|e11000|cast to|objectid|path `|validation failed|mongo|sequelize|prisma|typeerror|referenceerror|syntaxerror|axios|\bnan\b|[{}<>]|\w+\.\w+\.\w+|_id\b|\bkey\b.*\bdup/i;
const CAMEL_CODE = /\b[a-z]+[A-Z][a-z]+[A-Z]\w*\b/;

/** True when a server/JS message is safe and sensible to show to a person. */
export function isReadableMessage(msg: unknown): msg is string {
  if (typeof msg !== 'string') return false;
  const m = msg.trim();
  if (m.length < 4 || m.length > 180) return false;
  if (TECHNICAL.test(m) || CAMEL_CODE.test(m)) return false;
  // snake_case / SCREAMING_CASE codes
  if (/^[A-Z0-9_]+$/.test(m) || /\b[a-z]+_[a-z_]+\b/.test(m)) return false;
  return /[\u0D00-\u0D7Fa-zA-Z]/.test(m);
}

const sentence = (s: string) => {
  const t = s.trim();
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?।]$/.test(cap) ? cap : `${cap}.`;
};

/** The parts of an axios-style error these helpers read. Every field is optional: any thrown value may arrive here. */
interface ApiErrorLike {
  response?: { status?: number; data?: string | { message?: unknown; error?: unknown; errors?: unknown; details?: unknown } };
  config?: { method?: string; url?: string };
  code?: string;
  name?: string;
  message?: string;
  isAxiosError?: boolean;
}

/** Pull the most useful human message out of an API error body (never the raw axios message). */
export function serverMessage(raw: unknown): string | undefined {
  const error = raw as ApiErrorLike | null | undefined;
  const d = error?.response?.data;
  if (!d) return undefined;
  const candidates: unknown[] = [];
  if (typeof d === 'string') candidates.push(d);
  else {
    candidates.push(d.message, d.error);
    const list = d.errors ?? d.details;
    if (Array.isArray(list)) list.forEach((e) => candidates.push(typeof e === 'string' ? e : e?.message ?? e?.msg));
  }
  const found = candidates.find(isReadableMessage);
  return found ? sentence(found as string) : undefined;
}

export const isOfflineError = (raw: unknown): boolean => {
  const error = raw as ApiErrorLike | null | undefined;
  if (error?.response) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const code = error?.code;
  return code === 'ERR_NETWORK' || code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /network error|timeout/i.test(error?.message || '');
};

export const isCancelledError = (raw: unknown): boolean => {
  const error = raw as ApiErrorLike | null | undefined;
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';
};

/**
 * Friendly, plain-words message for any caught error. `fallback` is used when the status has no
 * specific copy and the server gave nothing readable (e.g. "Couldn't save the committee. Try again.").
 * Technical detail is logged to the console, never shown.
 */
export function getFriendlyError(error: unknown, fallback?: string): string {
  const err = error as ApiErrorLike | null | undefined;
  if (err && (err.response || err.isAxiosError || err.code)) {
    console.error('[api]', err.config?.method?.toUpperCase?.(), err.config?.url, err.response?.status, err.response?.data ?? err.message);
  } else if (err) {
    console.error('[app]', err);
  }
  if (!err) return fallback || MESSAGES.unknown;
  if (isOfflineError(err)) return err.config && err.config.method && err.config.method.toLowerCase() !== 'get' ? MESSAGES.offline : MESSAGES.offlineRead;
  const status: number | undefined = err.response?.status;
  const own = serverMessage(err);
  if (status) {
    if (status === 401) return MESSAGES.unauthorized;
    if (status === 403) return MESSAGES.forbidden;
    if (status === 404) return MESSAGES.notFound;
    if (status === 429) return MESSAGES.tooMany;
    if (status === 423) return own || MESSAGES.locked;
    if (status === 409) return own || MESSAGES.conflict;
    if (status === 400 || status === 422) return own || fallback || MESSAGES.validation;
    if (status >= 500) return MESSAGES.server;
    return own || fallback || MESSAGES.unknown;
  }
  // Plain JS Error thrown by our own code (e.g. new Error('Select a member first')).
  if (isReadableMessage(err.message)) return sentence(err.message);
  return fallback || MESSAGES.unknown;
}

// ---------------------------------------------------------------- success copy

const NOUNS: Array<[RegExp, string]> = [
  [/^collectibles\/varisangya/, 'Varisangya receipt'],
  [/^collectibles\/zakat/, 'Zakat payment'],
  [/^collectibles\/payment-requests/, 'Payment request'],
  [/^collectibles\/dues/, 'Reminder'],
  [/^welfare\/applications/, 'Welfare application'],
  [/^welfare\/schemes/, 'Welfare scheme'],
  [/^madrasa\/classes/, 'Class'],
  [/^madrasa\/enrollments/, 'Enrollment'],
  [/^master-accounts\/categories/, 'Category'],
  [/^master-accounts\/ledger-items/, 'Ledger entry'],
  [/^master-accounts\/ledgers/, 'Ledger'],
  [/^master-accounts\/mahallu-accounts/, 'Account'],
  [/^master-accounts\/institute/, 'Institute account'],
  [/^master-accounts\/wallets/, 'Wallet'],
  [/^registrations\/nikah/, 'Nikah registration'],
  [/^registrations\/death/, 'Death registration'],
  [/^registrations\/noc/, 'NOC'],
  [/^social\/banners/, 'Banner'],
  [/^social\/feeds/, 'Feed post'],
  [/^social\/support/, 'Support ticket'],
  [/^relief\/cases/, 'Relief case'],
  [/^qard\/loans/, 'Loan'],
  [/^cash-closings/, 'Day closing'],
  [/^cluster-visits/, 'Visit'],
  [/^class-attendance/, 'Attendance'],
  [/^periods/, 'Financial year'],
  [/^petty-cash/, 'Petty cash'],
  [/^mosque-profile/, 'Mosque profile'],
  [/^salary-payments/, 'Salary payment'],
  [/^locality-facilities/, 'Facility'],
  [/^grave-records/, 'Grave record'],
  [/^tenants/, 'Mahallu'],
  [/^surveys/, 'Survey'],
  [/^campaigns\/[^/]+\/udhiya/, 'Udhiya booking'],
  [/^campaigns\/[^/]+\/contributions/, 'Contribution'],
  [/^campaigns\/contributions/, 'Contribution'],
  [/^campaigns/, 'Campaign'],
];

const ACTION_WORDS: Record<string, string> = {
  approve: 'approved',
  reject: 'rejected',
  cancel: 'cancelled',
  verify: 'verified',
  disburse: 'disbursed',
  archive: 'archived',
  restore: 'restored',
  reopen: 'reopened',
  close: 'closed',
  activate: 'activated',
  suspend: 'suspended',
  send: 'sent',
  split: 'split',
  complete: 'completed',
  publish: 'published',
  issue: 'issued',
  return: 'returned',
};

/** Full messages for endpoints whose last segment says what happened. */
const ACTION_MESSAGES: Record<string, string> = {
  'mark-paid': 'Marked as paid',
  pay: 'Payment recorded',
  expense: 'Expense recorded',
  replenish: 'Petty cash replenished',
  notes: 'Note added',
  status: 'Status updated',
  results: 'Results saved',
  head: 'Family head updated',
  contributions: 'Contribution recorded',
};

/** Endpoints that never get an automatic "saved" toast (read-only POSTs, background calls, controls with their own state). */
export const SILENT_SUCCESS: RegExp[] = [
  /^auth\//,
  /(^|\/)(send-otp|verify-otp|login|logout|refresh|register-device|change-password|select-account)(\/|$)/,
  /^upload(s)?\//,
  /(^|\/)(import|bulk-import|bulk)(\/|$)/,
  /(^|\/)(search|filter|query|lookup|autocomplete|suggest)(\/|$)/,
  /(^|\/)(preview|calculate|validate|check|estimate)(\/|$)/,
  /(^|\/)(print-log|print|export|download)(\/|$)/,
  /(^|\/)(analytics|activity|activity-logs|track|tracking|events|logs?|audit|heartbeat|telemetry)(\/|$)/,
  /(^|\/)(read|read-all|mark-read|seen|viewed)(\/|$)/,
  /^assistant\//,
  /^notifications\/[^/]+\/read/,
  /^notifications\/read-all/,
];

/** Endpoints that never get an automatic error toast (their screen shows the failure inline). */
export const SILENT_ERROR: RegExp[] = [
  /^auth\//,
  /(^|\/)(send-otp|verify-otp|login|register-device)(\/|$)/,
  /^assistant\//,
  /(^|\/)(preview|print-log|analytics|activity|track|tracking|events|heartbeat|telemetry|autocomplete|suggest)(\/|$)/,
  /^notifications\/[^/]+\/read/,
  /^notifications\/read-all/,
];

const ID_SEGMENT = /^(\d+|[0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\$\{.*\}|:.+|undefined|null)$/i;

/** '/api/families/abc123/restore?x=1' -> ['families','abc123','restore'] */
export function pathSegments(url?: string): string[] {
  if (!url) return [];
  let p = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0].split('#')[0];
  p = p.replace(/^\/?api(\/v\d+)?\//, '/');
  return p.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
}

export function cleanPath(url?: string): string {
  return pathSegments(url).join('/');
}

const singular = (w: string): string => {
  if (/ies$/i.test(w)) return w.replace(/ies$/i, 'y');
  if (/(ss|us|is)$/i.test(w)) return w;
  if (/(sses|xes|ches|shes)$/i.test(w)) return w.replace(/es$/i, '');
  if (/s$/i.test(w)) return w.slice(0, -1);
  return w;
};

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Noun for the resource a URL works on: '/committees/123' -> 'Committee'. */
export function resourceNoun(url?: string): string {
  const segs = pathSegments(url);
  const meaningful = segs.filter((s) => !ID_SEGMENT.test(s));
  const matchPath = segs.map((s) => (ID_SEGMENT.test(s) ? 'x' : s)).join('/');
  for (const [re, noun] of NOUNS) if (re.test(matchPath)) return noun;
  const last = [...meaningful].reverse().find((s) => !ACTION_WORDS[s] && !ACTION_MESSAGES[s]) || meaningful[0];
  if (!last) return '';
  return titleCase(singular(last.replace(/[-_]+/g, ' ')));
}

export interface WriteDescription {
  /** The toast title, or undefined when this write should stay silent. */
  message?: string;
  silent: boolean;
}

/** Decide the automatic success message for a successful write request. */
export function describeWrite(method?: string, url?: string): WriteDescription {
  const m = (method || 'get').toLowerCase();
  const path = cleanPath(url);
  if (!path || SILENT_SUCCESS.some((re) => re.test(path))) return { silent: true };
  const segs = pathSegments(url).filter((s) => !ID_SEGMENT.test(s));
  const last = segs[segs.length - 1];
  const noun = resourceNoun(url);
  if (last && ACTION_MESSAGES[last] && segs.length > 1) return { silent: false, message: ACTION_MESSAGES[last] };
  if (last && ACTION_WORDS[last] && segs.length > 1) {
    return { silent: false, message: noun ? `${noun} ${ACTION_WORDS[last]}` : titleCase(ACTION_WORDS[last]) };
  }
  if (!noun) return { silent: false, message: m === 'delete' ? 'Deleted' : m === 'post' ? 'Created' : 'Saved' };
  if (m === 'post') return { silent: false, message: `${noun} created` };
  if (m === 'delete') return { silent: false, message: `${noun} deleted` };
  return { silent: false, message: `${noun} saved` };
}

export const isSilentErrorPath = (url?: string) => {
  const path = cleanPath(url);
  return SILENT_ERROR.some((re) => re.test(path));
};
