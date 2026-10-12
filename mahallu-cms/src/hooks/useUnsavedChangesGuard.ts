import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { modalNav } from './useModalContext';

type Pending = { kind: 'to'; to: string } | { kind: 'delta'; delta: number };

/**
 * Warns before leaving a dirty form. The app uses <BrowserRouter> (not a data router), so
 * react-router's useBlocker is unavailable; instead this intercepts
 *  - clicks on internal <a> links (sidebar, breadcrumbs, links in the page),
 *  - browser back/forward (popstate is reverted and held until the user decides),
 *  - tab close / reload via beforeunload.
 * Programmatic navigate() calls made by the form itself (successful submit) are not intercepted.
 * Use `guardedNavigate` for Cancel buttons so they show the same dialog.
 */
export function useUnsavedChangesGuard(rawDirty: boolean) {
  const navigate = useNavigate();
  // Many forms report isDirty=true within moments of mounting (native <select> first options, defaults
  // registered after mount...). Dirtiness only counts once the user interacts with a field, or when it
  // appears well after mount (a programmatic change from a button, e.g. a chip picker).
  const [armed, setArmed] = useState(false);
  const mountedAt = useRef(Date.now());
  const isDirty = rawDirty && armed;
  useEffect(() => {
    if (!rawDirty || armed) return;
    if (Date.now() - mountedAt.current > 1500) {
      setArmed(true);
      return;
    }
    const arm = (e: Event) => {
      if (!e.isTrusted) return;
      if (e.type === 'click') {
        const t = e.target as Element | null;
        if (!t?.closest?.('input,select,textarea,label,[role="option"],[role="checkbox"],[role="radio"],[role="switch"]')) return;
      }
      setArmed(true);
    };
    const evs = ['input', 'change', 'click', 'paste'] as const;
    evs.forEach((n) => document.addEventListener(n, arm, true));
    return () => evs.forEach((n) => document.removeEventListener(n, arm, true));
  }, [rawDirty, armed]);
  const [pending, setPending] = useState<Pending | null>(null);
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const bypassRef = useRef(false);
  const ignoreNextPop = useRef(false);
  const lastIdx = useRef<number>((window.history.state as any)?.idx ?? 0);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || bypassRef.current || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.dataset.noGuard !== undefined) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending({ kind: 'to', to: url.pathname + url.search + url.hash });
    };
    // Capture phase on window runs before react-router's own popstate listener.
    const onPop = (e: PopStateEvent) => {
      const idx: number | undefined = (window.history.state as any)?.idx;
      if (modalNav.bypassGuard) {
        lastIdx.current = idx ?? lastIdx.current;
        return;
      }
      if (ignoreNextPop.current) {
        ignoreNextPop.current = false;
        e.stopImmediatePropagation();
        return;
      }
      if (!dirtyRef.current || bypassRef.current) {
        lastIdx.current = idx ?? lastIdx.current;
        return;
      }
      const delta = idx !== undefined ? idx - lastIdx.current : -1;
      if (delta === 0) return;
      e.stopImmediatePropagation();
      ignoreNextPop.current = true;
      window.history.go(-delta);
      setPending({ kind: 'delta', delta });
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop, true);
    };
  }, []);

  const guardedNavigate = useCallback(
    (to: string) => {
      if (dirtyRef.current) setPending({ kind: 'to', to });
      else navigate(to);
    },
    [navigate]
  );

  const stay = useCallback(() => setPending(null), []);

  const discard = useCallback(() => {
    const p = pending;
    setPending(null);
    if (!p) return;
    bypassRef.current = true;
    if (p.kind === 'to') navigate(p.to);
    else window.history.go(p.delta);
    // allow the navigation to settle before re-arming (component normally unmounts)
    setTimeout(() => {
      bypassRef.current = false;
    }, 300);
  }, [pending, navigate]);

  return { isBlocked: pending !== null, stay, discard, guardedNavigate };
}

export type UnsavedChangesGuard = ReturnType<typeof useUnsavedChangesGuard>;
