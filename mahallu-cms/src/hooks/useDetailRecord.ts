import { useCallback, useEffect, useRef, useState } from 'react';
import { getFriendlyError } from '@/utils/apiMessages';

/** Loads one record for a quick view. `signal` aborts the request when the user moves on. */
export type DetailFetcher<T> = (id: string, signal?: AbortSignal) => Promise<T>;

interface CacheEntry {
  data: unknown;
  at: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
/** Entries younger than this are shown as-is with no refetch. Older ones show instantly, then revalidate. */
const FRESH_MS = 30_000;
const MAX_ENTRIES = 80;

const k = (key: string, id: string) => `${key}:${id}`;

function remember(ck: string, data: unknown) {
  cache.delete(ck);
  cache.set(ck, { data, at: Date.now() });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

/** Drop cached records (after an edit elsewhere). Omit `id` to clear the whole collection. */
export function invalidateDetail(key: string, id?: string) {
  if (id) cache.delete(k(key, id));
  else Array.from(cache.keys()).forEach((c) => c.startsWith(`${key}:`) && cache.delete(c));
}

function prefetch<T>(key: string, id: string, fetcher: DetailFetcher<T>) {
  const ck = k(key, id);
  const hit = cache.get(ck);
  if ((hit && Date.now() - hit.at < FRESH_MS) || inflight.has(ck)) return;
  const p = fetcher(id)
    .then((data) => remember(ck, data))
    .catch(() => undefined)
    .finally(() => inflight.delete(ck));
  inflight.set(ck, p);
}

export interface UseDetailRecordOptions<T> {
  /** Cache namespace, e.g. 'family'. Records of different kinds must not share a key. */
  key: string;
  /** The record to show (the `?view=` id). null = nothing to load. */
  id: string | null;
  fetcher: DetailFetcher<T>;
  /** Ids to warm in the background (previous / next rows) so stepping feels instant. */
  prefetchIds?: Array<string | undefined>;
}

/**
 * Fetch-by-id with a small in-memory cache, background prefetch and abort of stale requests.
 * Cached data renders immediately (no spinner); old data is revalidated silently.
 */
export function useDetailRecord<T>({ key, id, fetcher, prefetchIds = [] }: UseDetailRecordOptions<T>) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: false,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const ck = k(key, id);
    const hit = cache.get(ck) as CacheEntry | undefined;
    const retrying = nonce > 0;
    if (hit) setState({ data: hit.data as T, loading: false, error: null });
    else setState({ data: null, loading: true, error: null });
    if (hit && !retrying && Date.now() - hit.at < FRESH_MS) return;

    const ctrl = new AbortController();
    let cancelled = false;
    const pending = inflight.get(ck) as Promise<T> | undefined;
    const run: Promise<T> = pending ?? fetcherRef.current(id, ctrl.signal);
    run
      .then((data) => {
        if (cancelled) return;
        remember(ck, data);
        setState({ data: (cache.get(ck)?.data ?? data) as T, loading: false, error: null });
      })
      .catch((err: { name?: string; code?: string } | null | undefined) => {
        if (cancelled || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
        // Keep stale data on screen if we have it; only surface the error when there is nothing to show.
        setState((s) => (s.data ? { ...s, loading: false } : { data: null, loading: false, error: getFriendlyError(err, "Couldn't load this record. Refresh the page or try again.") }));
      });
    return () => {
      cancelled = true;
      if (!pending) ctrl.abort();
    };
  }, [key, id, nonce]);

  const prefetchKey = prefetchIds.filter(Boolean).join('|');
  useEffect(() => {
    prefetchIds.forEach((p) => p && prefetch(key, p, fetcherRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, prefetchKey, state.data]);

  const retry = useCallback(() => {
    if (id) cache.delete(k(key, id));
    setNonce((n) => n + 1);
  }, [id, key]);

  return { ...state, retry };
}
