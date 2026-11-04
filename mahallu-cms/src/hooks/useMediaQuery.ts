import { useEffect, useState } from 'react';

/** Subscribes to a CSS media query. SSR-safe; returns `initial` until mounted. */
export function useMediaQuery(query: string, initial = false): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : initial);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** True below the `sm` breakpoint (phones, < 640px). */
export const useIsPhone = () => useMediaQuery('(max-width: 639px)');
