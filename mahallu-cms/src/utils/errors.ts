/**
 * User-facing error copy.
 *
 * The product used to render `err.response?.data?.message` straight into a
 * toast in 329 places. Backend messages are written for developers — Mongoose
 * validation text, cast errors, stack fragments — and reached the user verbatim.
 *
 * `errorMessage` maps a failure to something a person can act on, and keeps the
 * raw detail in the console where it belongs.
 *
 * Copy rules applied here:
 *   - say what happened, then what to do
 *   - never "fetch"; never "Failed to …" with no next step
 *   - no apologies, no blame, no exception text
 */

/** Backend messages safe to show: short, sentence-like, no technical tokens. */
function looksHumanReadable(message: unknown, maxLength = 160): message is string {
  if (typeof message !== 'string') return false;
  const text = message.trim();
  if (text.length === 0 || text.length > maxLength) return false;
  // Reject anything carrying developer vocabulary or object/stack syntax.
  return !/(cast to|objectid|validationerror|econnrefused|enotfound|mongo|prisma|undefined|null|\bat\s+\w+\.\w+|[{}[\]<>]|https?:\/\/|\bError:)/i.test(
    text
  );
}

/**
 * The API message, but only when it reads like something written for a person.
 * Use where a page deliberately surfaces server-side validation detail — bulk
 * imports, for example — instead of passing the raw string through untouched.
 */
export function safeApiMessage(error: unknown, fallback: string, maxLength = 160): string {
  const raw = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return looksHumanReadable(raw, maxLength) ? raw : fallback;
}

/**
 * True when the server refused with 409: the record changed (or was already
 * processed) since the screen loaded. Callers show the server message and
 * refresh the list instead of treating it as a crash.
 */
export function isConflict(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 409;
}

/**
 * A 403 that is about the ACCOUNT, not about this one action: the Mahallu is suspended, or the account is
 * not linked to a Mahallu / institute. The server's own sentence says exactly that and what to do next;
 * the generic "you don't have permission" line would send the person to the wrong place.
 */
const ACCOUNT_STATUS_CODES = ['TENANT_SUSPENDED', 'NO_TENANT', 'NO_INSTITUTE'];
function accountStatusMessage(body: unknown): string | null {
  const data = body as { code?: unknown; message?: unknown } | undefined;
  if (typeof data?.code !== 'string' || !ACCOUNT_STATUS_CODES.includes(data.code)) return null;
  return looksHumanReadable(data.message, 200) ? data.message : null;
}

export interface ErrorCopyOptions {
  /** What the user was doing, e.g. "save this family". Used to build the fallback. */
  action?: string;
  /** Plural entity, e.g. "families". Used for load failures. */
  entity?: string;
}

export function errorMessage(error: unknown, options: ErrorCopyOptions = {}): string {
  const err = error as {
    response?: { status?: number; data?: { message?: unknown; error?: unknown } };
    code?: string;
    message?: string;
  };

  // Keep the real cause where an engineer can find it.
  if (import.meta.env.DEV) console.error('[api]', error);

  const status = err?.response?.status;

  // The server flags a half-finished action that needs an administrator (`reconciliationRequired`). Its
  // message says not to retry, so it must reach the person as written, not as "please try again".
  const body = err?.response?.data as { reconciliationRequired?: unknown; message?: unknown; code?: unknown } | undefined;
  if (body?.reconciliationRequired === true && typeof body.message === 'string' && body.message.trim()) {
    return body.message;
  }

  if (!err?.response) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'You appear to be offline. Please check your connection and try again.';
    }
    return "We couldn't reach the server. Please check your connection and try again.";
  }

  switch (status) {
    case 400:
    case 422: {
      const raw = err.response?.data?.message ?? err.response?.data?.error;
      // A 400 usually carries a real validation message worth showing.
      return looksHumanReadable(raw)
        ? raw
        : 'Some details are missing or incorrect. Please check the form and try again.';
    }
    case 401: {
      // Not every 401 is an expired session. Sign-in checks answer 401 to say
      // the code or password is wrong, and telling someone their session ended
      // while they are mid-sign-in reads as a bug. A message written for a
      // person is shown as sent; anything else falls back to the session copy.
      const raw = err.response?.data?.message;
      return looksHumanReadable(raw) ? raw : 'Your session has ended. Please sign in again to continue.';
    }
    case 403: {
      const accountProblem = accountStatusMessage(err.response?.data);
      if (accountProblem) return accountProblem;
      return "You don't have permission to do this. Please contact your Mahallu admin.";
    }
    case 404:
      return options.entity
        ? 'That ' + singular(options.entity) + ' no longer exists. It may have been removed.'
        : 'That record no longer exists. It may have been removed.';
    case 409: {
      // Another request is issuing this very certificate; nothing is wrong, the person just retries.
      if (body?.code === 'CERTIFICATE_BEING_ISSUED') {
        return 'This certificate is being issued right now. Please wait a few seconds and try again.';
      }
      const raw = err.response?.data?.message;
      return looksHumanReadable(raw)
        ? raw
        : 'This conflicts with an existing record. Please check for a duplicate.';
    }
    case 413:
      return 'That file is too large. Please choose a file under 5 MB.';
    case 429:
      return 'Too many attempts. Please wait a minute and try again.';
    default:
      if (status && status >= 500) {
        return options.action
          ? "We couldn't " + options.action + '. Something went wrong on our side — please try again in a moment.'
          : 'Something went wrong on our side. Please try again in a moment.';
      }
      return options.action
        ? "We couldn't " + options.action + '. Please try again.'
        : 'Something went wrong. Please try again.';
  }
}

/** "Couldn't load families." — the standard load-failure line. */
export function loadErrorMessage(error: unknown, entity: string): string {
  const err = error as { response?: { status?: number; data?: { message?: unknown; error?: unknown } } };
  if (err?.response?.status === 403) {
    const accountProblem = accountStatusMessage((err.response as { data?: unknown }).data);
    if (accountProblem) return accountProblem;
    return "You don't have permission to view " + entity + '. Please contact your Mahallu admin.';
  }
  if (err?.response?.status === 400 || err?.response?.status === 422) {
    const raw = err.response.data?.message ?? err.response.data?.error;
    if (looksHumanReadable(raw)) return raw;
  }
  if (!err?.response) {
    return "We couldn't load " + entity + '. Please check your connection and try again.';
  }
  return "We couldn't load " + entity + '. Please try again in a moment.';
}

export interface LoadErrorInfo {
  title: string;
  message: string;
  /** `info` for a state the user can resolve themselves; `error` for a real failure. */
  variant: 'error' | 'info';
}

/**
 * Same job as `loadErrorMessage`, but also says whether this is a genuine
 * failure or an expected prerequisite the user can resolve themselves —
 * most often a super admin viewing tenant-scoped data (a report, a
 * dashboard) before picking a Mahallu from the tenant switcher in the
 * header. The backend answers that with a 400 and a message naming the
 * Mahallu/tenant, which is not a bug and not the user's fault; it read as
 * one anyway because every page showed it inside a red "Couldn't load X"
 * box. `loadErrorMessage` already returns that message verbatim instead of
 * a generic line — this only adds the presentation hint so a page can swap
 * to a calm `info` Alert instead of `error` for that one case, without
 * touching the ~50 existing call sites that only want the string.
 */
export function loadErrorInfo(error: unknown, entity: string): LoadErrorInfo {
  const err = error as { response?: { status?: number; data?: { message?: unknown; error?: unknown } } };
  const status = err?.response?.status;
  if (status === 400) {
    const raw = err.response?.data?.message ?? err.response?.data?.error;
    if (
      typeof raw === 'string' &&
      /mahallu|tenant/i.test(raw) &&
      /select|choose|pick/i.test(raw)
    ) {
      // Callers pass entity either bare ("report") or pre-articled ("the
      // dashboard") depending on how it reads in loadErrorMessage's own
      // "We couldn't load X" sentence — strip a leading "the" so it still
      // reads naturally after "view this".
      const bareEntity = entity.replace(/^the\s+/i, '');
      return {
        title: 'Select a Mahallu to continue',
        message: 'Please select a Mahallu from the top menu to view this ' + bareEntity + '.',
        variant: 'info',
      };
    }
  }
  return { title: "Couldn't load " + entity, message: loadErrorMessage(error, entity), variant: 'error' };
}

/** "Family saved." — the standard success line. No "successfully". */
export function savedMessage(entity: string): string {
  return capitalise(singular(entity)) + ' saved';
}

export function deletedMessage(entity: string): string {
  return capitalise(singular(entity)) + ' deleted';
}

function singular(entity: string): string {
  if (entity.endsWith('ies')) return entity.slice(0, -3) + 'y';
  if (entity.endsWith('ses')) return entity.slice(0, -2);
  if (entity.endsWith('s')) return entity.slice(0, -1);
  return entity;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Pluralises a countable noun for message copy: 1 family / 3 families. */
export function pluralise(count: number, singularNoun: string, pluralNoun?: string): string {
  const plural =
    pluralNoun ?? (singularNoun.endsWith('y') ? singularNoun.slice(0, -1) + 'ies' : singularNoun + 's');
  return count + ' ' + (count === 1 ? singularNoun : plural);
}
