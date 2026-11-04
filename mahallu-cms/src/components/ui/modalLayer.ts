import { useEffect, useRef, useState } from 'react';

/**
 * Shared pop-up infrastructure: one scroll lock for every overlay and a stack so that only the top-most
 * dialog reacts to Escape / Tab (nested and stacked modals).
 *
 * - The app shell scrolls inside #main-content (not the window), so both <html>/<body> and #main-content are locked.
 * - The width the scrollbar used to take is added back as padding, so the page does not jump sideways.
 * - iOS Safari ignores overflow:hidden on body for touch scrolling: body becomes position:fixed (scroll position restored on close).
 * - Everything is restored when the last overlay closes. A counter makes nested/stacked overlays safe.
 */

interface Entry {
  id: symbol;
  el: HTMLElement | null;
}
const stack: Entry[] = [];
let saved: Record<string, string> | null = null;
let savedScrollY = 0;
let ios = false;
const listeners = new Set<() => void>();

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function lock() {
  const html = document.documentElement;
  const body = document.body;
  const main = document.getElementById('main-content');
  const htmlGutter = Math.max(0, window.innerWidth - html.clientWidth);
  const mainGutter = main ? Math.max(0, main.offsetWidth - main.clientWidth) : 0;
  saved = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    mainOverflow: main?.style.overflow ?? '',
    mainPaddingRight: main?.style.paddingRight ?? '',
  };
  savedScrollY = window.scrollY;
  ios = isIOS();
  if (htmlGutter > 0) body.style.paddingRight = `${(parseFloat(getComputedStyle(body).paddingRight) || 0) + htmlGutter}px`;
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  if (ios) {
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.width = '100%';
  }
  if (main) {
    if (mainGutter > 0) main.style.paddingRight = `${(parseFloat(getComputedStyle(main).paddingRight) || 0) + mainGutter}px`;
    main.style.overflow = 'hidden';
  }
  html.setAttribute('data-scroll-locked', '');
}

function unlock() {
  if (!saved) return;
  const html = document.documentElement;
  const body = document.body;
  const main = document.getElementById('main-content');
  html.style.overflow = saved.htmlOverflow;
  body.style.overflow = saved.bodyOverflow;
  body.style.paddingRight = saved.bodyPaddingRight;
  body.style.position = saved.bodyPosition;
  body.style.top = saved.bodyTop;
  body.style.width = saved.bodyWidth;
  if (main) {
    main.style.overflow = saved.mainOverflow;
    main.style.paddingRight = saved.mainPaddingRight;
  }
  html.removeAttribute('data-scroll-locked');
  if (ios) window.scrollTo(0, savedScrollY);
  saved = null;
}

function sync() {
  // Only the top-most overlay is interactive; everything below it (and the app) is inert.
  stack.forEach((e, i) => {
    if (!e.el) return;
    if (i === stack.length - 1) e.el.removeAttribute('inert');
    else e.el.setAttribute('inert', '');
  });
  const root = document.getElementById('root');
  if (root) {
    if (stack.length) root.setAttribute('inert', '');
    else root.removeAttribute('inert');
  }
  listeners.forEach((l) => l());
}

export function registerOverlay(id: symbol, el: HTMLElement | null) {
  if (stack.length === 0) lock();
  stack.push({ id, el });
  sync();
}
export function unregisterOverlay(id: symbol) {
  const i = stack.findIndex((e) => e.id === id);
  if (i >= 0) stack.splice(i, 1);
  if (stack.length === 0) unlock();
  sync();
}
export const isTopOverlay = (id: symbol) => stack.length > 0 && stack[stack.length - 1].id === id;

/**
 * Registers an overlay while `active`. Returns a stable symbol identifying it (for isTopOverlay) and
 * a callback-ref for the overlay root (which becomes inert while another overlay is above it).
 */
export function useOverlay(active: boolean) {
  const idRef = useRef<symbol>();
  if (!idRef.current) idRef.current = Symbol('overlay');
  const elRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) return;
    const id = idRef.current!;
    registerOverlay(id, elRef.current);
    return () => unregisterOverlay(id);
  }, [active]);
  return { id: idRef.current, setEl: (el: HTMLElement | null) => (elRef.current = el) };
}

/** Plain scroll lock for non-dialog overlays (mobile navigation drawer). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const id = Symbol('lock');
    // no `inert` for the drawer: it lives inside #root
    if (stack.length === 0) lock();
    stack.push({ id, el: null });
    return () => {
      const i = stack.findIndex((e) => e.id === id);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) unlock();
    };
  }, [active]);
}

/**
 * Tracks the visual viewport so a dialog can shrink above the on-screen keyboard.
 * Returns an inline style for the overlay (or undefined while the keyboard is closed).
 */
export function useKeyboardInset(active: boolean) {
  const [style, setStyle] = useState<{ top: number; height: number; bottom: 'auto' } | undefined>();
  useEffect(() => {
    if (!active || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const keyboard = window.innerHeight - vv.height - vv.offsetTop > 80;
      setStyle(keyboard ? { top: vv.offsetTop, height: vv.height, bottom: 'auto' } : undefined);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);
  return style;
}

/** Keep the focused field visible when the virtual keyboard opens (call from the dialog body's onFocus). */
export function scrollFocusedIntoView(e: React.FocusEvent<HTMLElement>) {
  const t = e.target as HTMLElement;
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) return;
  window.setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280);
}
