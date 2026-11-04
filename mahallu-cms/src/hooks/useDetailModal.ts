import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

export interface UseDetailModalOptions {
  /** Query-string key. Default `view`. */
  param?: string;
}

/** Marker kept in router history state so close() knows it can simply go Back. */
const HISTORY_FLAG = 'detailModalOpened';

/**
 * Quick-view modal state that lives in the URL (`?view=<id>`), next to the list's own filters.
 *
 * - `ids` is the ordered list of row ids on the CURRENT page; it powers prev / next and "n of N".
 * - open(id) pushes a history entry, so the browser Back button closes the modal.
 * - next() / prev() replace the entry (stepping through rows must not fill the history).
 * - close() goes Back when this session opened the modal, otherwise it just removes the param
 *   (e.g. a shared link). Other query params (search, filters, page) are never touched.
 * - A refresh or shared link with `?view=` reopens the modal. If the id is not on the current page,
 *   index is -1 and the stepper is hidden (the modal still works).
 */
export function useDetailModal(ids: readonly string[], options: UseDetailModalOptions = {}) {
  const { param = 'view' } = options;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const viewId = params.get(param) || null;
  const index = viewId ? ids.indexOf(viewId) : -1;
  const total = ids.length;

  const write = useCallback(
    (id: string | null, replace: boolean) => {
      const next = new URLSearchParams(window.location.search);
      if (id) next.set(param, id);
      else next.delete(param);
      setParams(next, { replace, state: id ? { [HISTORY_FLAG]: true } : undefined });
    },
    [param, setParams]
  );

  const open = useCallback((id: string) => write(String(id), false), [write]);

  const close = useCallback(() => {
    const state = (location.state ?? null) as Record<string, unknown> | null;
    if (state && state[HISTORY_FLAG]) navigate(-1);
    else write(null, true);
  }, [location.state, navigate, write]);

  const goTo = useCallback((id: string) => write(String(id), true), [write]);

  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < total - 1;
  const next = useCallback(() => {
    if (index >= 0 && index < ids.length - 1) goTo(ids[index + 1]);
  }, [goTo, ids, index]);
  const prev = useCallback(() => {
    if (index > 0) goTo(ids[index - 1]);
  }, [goTo, ids, index]);

  return useMemo(
    () => ({ viewId, isOpen: viewId !== null, open, close, next, prev, goTo, hasNext, hasPrev, index, total, ids }),
    [viewId, open, close, next, prev, goTo, hasNext, hasPrev, index, total, ids]
  );
}

export type DetailModalController = ReturnType<typeof useDetailModal>;
