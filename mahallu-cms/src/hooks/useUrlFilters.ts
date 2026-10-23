import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const RESERVED = ['q', 'page', 'pageSize'];

export interface UseUrlFiltersOptions {
  /** Default page size when the URL has none. */
  pageSize?: number;
  /** Debounce for the search box (ms). */
  debounceMs?: number;
}

export type FilterRecord = Record<string, string>;

/**
 * Keeps a list page's search / filters / sort / page / pageSize in the URL query string so a reload,
 * a shared link and back/forward all restore the same view.
 *
 * - `defaults` lists the filter keys and their default values (defaults are omitted from the URL).
 * - Search text is local while typing and written to `?q=` after a debounce.
 * - Changing any filter or the search resets the page to 1.
 */
export function useUrlFilters<D extends FilterRecord>(defaults: D, options: UseUrlFiltersOptions = {}) {
  const { pageSize: defaultPageSize = 10, debounceMs = 400 } = options;
  const [params, setParams] = useSearchParams();
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  // Always-fresh copy so several writes in one tick don't clobber each other.
  const latest = useRef(params);
  latest.current = params;

  const write = useCallback(
    (mutate: (next: URLSearchParams) => void, replace = false) => {
      const next = new URLSearchParams(latest.current);
      mutate(next);
      latest.current = next;
      setParams(next, { replace });
    },
    [setParams]
  );

  const values = useMemo(() => {
    const out: FilterRecord = {};
    Object.keys(defaultsRef.current).forEach((k) => {
      out[k] = params.get(k) ?? defaultsRef.current[k];
    });
    return out as D;
  }, [params]);

  const search = params.get('q') ?? '';
  const rawPage = parseInt(params.get('page') || '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawSize = parseInt(params.get('pageSize') || '', 10);
  const pageSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, 200) : defaultPageSize;

  // Search box: instant locally, debounced into the URL.
  const [searchInput, setSearchInput] = useState(search);
  const lastWritten = useRef(search);
  useEffect(() => {
    if (search !== lastWritten.current) {
      lastWritten.current = search;
      setSearchInput(search);
    }
  }, [search]);
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => {
      lastWritten.current = searchInput;
      write((n) => {
        if (searchInput) n.set('q', searchInput);
        else n.delete('q');
        n.delete('page');
      }, true);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [searchInput, search, debounceMs, write]);

  const setFilter = useCallback(
    (key: string, value: string, opts?: { replace?: boolean }) => {
      write((n) => {
        if (value === '' && defaultsRef.current[key] !== '') n.set(key, '');
        else if (value === defaultsRef.current[key]) n.delete(key);
        else n.set(key, value);
        n.delete('page');
      }, opts?.replace);
    },
    [write]
  );

  /** Put one filter (or the search, key "q") back to its default. */
  const resetFilter = useCallback(
    (key: string) => {
      if (key === 'q') {
        lastWritten.current = '';
        setSearchInput('');
      }
      write((n) => {
        n.delete(key);
        n.delete('page');
      });
    },
    [write]
  );

  const setPage = useCallback(
    (p: number) => {
      write((n) => {
        if (p <= 1) n.delete('page');
        else n.set('page', String(p));
      });
    },
    [write]
  );

  const setPageSize = useCallback(
    (size: number) => {
      write((n) => {
        if (size === defaultPageSize) n.delete('pageSize');
        else n.set('pageSize', String(size));
        n.delete('page');
      });
    },
    [write, defaultPageSize]
  );

  /** Replace every filter (and search) with the given record; missing keys fall back to defaults. */
  const apply = useCallback(
    (record: FilterRecord) => {
      write((n) => {
        Object.keys(defaultsRef.current).forEach((k) => n.delete(k));
        n.delete('q');
        n.delete('page');
        Object.entries(record).forEach(([k, v]) => {
          if (k === 'q') {
            if (v) n.set('q', v);
          } else if (k in defaultsRef.current && v !== defaultsRef.current[k]) n.set(k, v);
        });
      });
    },
    [write]
  );

  const clear = useCallback(() => apply({}), [apply]);

  const activeFilters = useMemo(() => {
    const out: FilterRecord = {};
    if (search) out.q = search;
    Object.keys(defaultsRef.current).forEach((k) => {
      if (values[k] !== defaultsRef.current[k]) out[k] = values[k];
    });
    return out;
  }, [values, search]);

  return {
    values,
    search: searchInput,
    setSearch: setSearchInput,
    /** The committed (debounced) search that lives in the URL. Use this in API calls. */
    debouncedSearch: search,
    page,
    setPage,
    pageSize,
    setPageSize,
    setFilter,
    resetFilter,
    apply,
    clear,
    activeFilters,
    activeCount: Object.keys(activeFilters).length,
    reserved: RESERVED,
  };
}

export type UrlFilters<D extends FilterRecord = FilterRecord> = ReturnType<typeof useUrlFilters<D>>;
