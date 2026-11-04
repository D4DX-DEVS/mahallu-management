/** Tiny counter of successful write API calls; ModalRoutes uses it to refetch the page behind a closed modal. */
let count = 0;

export const getMutationCount = () => count;

export const noteMutation = (method?: string, url?: string) => {
  const m = (method || 'get').toLowerCase();
  if (m === 'get' || m === 'head' || m === 'options') return;
  if (url && /\/auth\//.test(url)) return;
  count += 1;
};

/**
 * While > 0, the axios interceptor shows no automatic toasts. Used by flows that own their own messaging
 * (e.g. useUndoableAction already toasted "<Thing> deleted - Undo" before the API call is made).
 */
let silenced = 0;
export const isApiToastSilenced = () => silenced > 0;
export async function withSilentApiToasts<T>(fn: () => Promise<T>): Promise<T> {
  silenced += 1;
  try {
    return await fn();
  } finally {
    // keep silent a little longer: the response handler runs just after the promise settles
    setTimeout(() => {
      silenced = Math.max(0, silenced - 1);
    }, 1200);
  }
}
