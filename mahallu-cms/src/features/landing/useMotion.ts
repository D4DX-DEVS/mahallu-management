import { useEffect, useRef, useState, type RefObject } from 'react';

/** The visitor asked the OS for less motion: skip JavaScript-driven effects. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface InViewOptions {
  threshold?: number;
  rootMargin?: string;
}

/** True once the element has entered the viewport; it stays true afterwards. */
export function useInView<T extends HTMLElement>(options: InViewOptions = {}): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const { threshold = 0.15, rootMargin = '0px 0px -8% 0px' } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    // A block taller than the viewport can never show `threshold` of itself at
    // once on a phone, so the bar is lowered to "about 40% of the screen".
    const height = el.getBoundingClientRect().height;
    const effectiveThreshold = height > 0 ? Math.min(threshold, (window.innerHeight * 0.4) / height) : threshold;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: effectiveThreshold, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}

/** Counts from 0 to `target` once `active`, easing out. */
export function useCountUp(target: number, active: boolean, duration = 1400): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);

  return value;
}

/**
 * Calls `onFrame` with the current scroll position on the animation frame
 * after each scroll or resize, and once on mount. One listener, no state.
 */
export function useScrollFrame(onFrame: (scrollY: number) => void): void {
  const callback = useRef(onFrame);

  useEffect(() => {
    callback.current = onFrame;
  });

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      callback.current(window.scrollY);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}

/** Drifts the element a fraction of its distance from the viewport centre. */
export function useParallax<T extends HTMLElement>(strength = 0.1): RefObject<T> {
  const ref = useRef<T>(null);

  useScrollFrame(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.transform = '';
      return;
    }
    const rect = el.getBoundingClientRect();
    const fromCentre = rect.top + rect.height / 2 - window.innerHeight / 2;
    el.style.transform = `translate3d(0, ${(-fromCentre * strength).toFixed(1)}px, 0)`;
  });

  return ref;
}
