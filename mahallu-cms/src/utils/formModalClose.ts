/**
 * Where a create/edit modal should land when it is closed.
 *
 * `navigate(-1)` is only right when the previous history entry is a page of this
 * app. On a deep link, a refresh into a form, or a form opened in a new tab there
 * is no such entry: -1 either does nothing or leaves the app. In that case the
 * modal goes to the form's parent list, derived from its own URL.
 */

const FALLBACK_PATH = '/dashboard';

/** A route param that is a record id: Mongo ObjectId, UUID, or a plain number. */
const ID_SEGMENT = /^(?:[0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

/**
 * `/members/create` -> `/members`; `/members/65f.../edit` -> `/members`;
 * `/settings/edit` -> `/settings`; a legacy modal route that is only
 * `/zakat/beneficiaries/<id>` -> `/zakat/beneficiaries`. Anything that reduces
 * to nothing falls back to the dashboard.
 */
export function parentListPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];

  if (last && /^create$/i.test(last)) {
    segments.pop();
  } else if (last && /^edit$/i.test(last)) {
    segments.pop();
    if (segments.length > 0 && ID_SEGMENT.test(segments[segments.length - 1])) segments.pop();
  } else if (last && ID_SEGMENT.test(last)) {
    segments.pop();
  }

  return segments.length > 0 ? '/' + segments.join('/') : FALLBACK_PATH;
}

/**
 * True when going back one entry stays inside the app. React Router stamps every
 * entry it creates with `history.state.idx`; 0 means this is the first entry the
 * app has seen in this tab. Without that stamp, fall back to a same-origin
 * referrer.
 */
export function hasInAppHistory(
  historyState: unknown = typeof window !== 'undefined' ? window.history.state : null,
  referrer: string = typeof document !== 'undefined' ? document.referrer : '',
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): boolean {
  const idx = (historyState as { idx?: unknown } | null)?.idx;
  if (typeof idx === 'number') return idx > 0;
  return Boolean(referrer) && Boolean(origin) && referrer.startsWith(origin);
}
