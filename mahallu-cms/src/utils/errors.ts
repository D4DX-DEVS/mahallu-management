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
function looksHumanReadable(message: unknown): message is string {
  if (typeof message !== 'string') return false;
  const text = message.trim();
  if (text.length === 0 || text.length > 160) return false;
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
export function safeApiMessage(error: unknown, fallback: string): string {
  const raw = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return looksHumanReadable(raw) ? raw : fallback;
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
    case 403:
      return "You don't have permission to do this. Please contact your Mahallu admin.";
    case 404:
      return options.entity
        ? 'That ' + singular(options.entity) + ' no longer exists. It may have been removed.'
        : 'That record no longer exists. It may have been removed.';
    case 409: {
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
  const status = err?.response?.status;
  if (status === 403) {
    return "You don't have permission to view " + entity + '. Please contact your Mahallu admin.';
  }
  if (!err?.response) {
    return "We couldn't load " + entity + '. Please check your connection and try again.';
  }
  // A 400 usually means the request is missing something the user can fix
  // themselves — e.g. a super admin who hasn't picked a Mahallu yet. That
  // message is worth showing verbatim instead of a generic "try again".
  if (status === 400) {
    const raw = err.response?.data?.message ?? err.response?.data?.error;
    if (looksHumanReadable(raw)) return raw;
  }
  return "We couldn't load " + entity + '. Please try again in a moment.';
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
