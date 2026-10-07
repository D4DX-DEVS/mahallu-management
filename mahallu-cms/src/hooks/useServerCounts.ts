import { useEffect, useRef, useState } from 'react';

/** A list call made with `limit: 1`: only the `pagination.total` of its answer is read. */
type CountLoader = () => Promise<{ pagination?: { total?: number } | null }>;

/**
 * Whole-list counts for stat cards ("Active", "Suspended", "Published"...), read from the server's
 * `pagination.total` of a one-row request per card, instead of counting the rows of the page on screen
 * (which showed "Active: 7" on a list of 120 with 10 rows a page).
 *
 * A count that fails, or that the server does not return, is simply left out, so a card can fall back
 * to the page's own count. Reloads when `deps` change (the filters that shape the list); an answer for
 * older filters that arrives late is ignored.
 */
export function useServerCounts<K extends string>(
  loaders: Record<K, CountLoader>,
  deps: unknown[]
): Partial<Record<K, number>> {
  const [counts, setCounts] = useState<Partial<Record<K, number>>>({});
  const latest = useRef(0);

  useEffect(() => {
    const requestId = ++latest.current;
    const keys = Object.keys(loaders) as K[];
    Promise.all(
      keys.map(async (key) => {
        try {
          const result = await loaders[key]();
          const total = result?.pagination?.total;
          return [key, typeof total === 'number' ? total : undefined] as const;
        } catch {
          return [key, undefined] as const;
        }
      })
    ).then((entries) => {
      if (requestId !== latest.current) return;
      const next: Partial<Record<K, number>> = {};
      for (const [key, total] of entries) if (total !== undefined) next[key] = total;
      setCounts(next);
    });
    // The loaders are rebuilt on every render; `deps` says when the filters actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return counts;
}
