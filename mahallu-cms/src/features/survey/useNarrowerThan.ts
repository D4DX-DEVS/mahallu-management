import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Whether the element the ref is on is narrower than `threshold` pixels. It follows the element,
 * not the window, so the builder's phone preview gets the same layout as a real phone.
 */
export function useNarrowerThan<T extends HTMLElement>(threshold: number) {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (width: number) => setNarrow(width < threshold);
    update(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, narrow] as const;
}
