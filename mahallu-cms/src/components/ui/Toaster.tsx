import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { toast as toastApi } from '@/store/toastStore';
import { SESSION_NOTICE_KEY, SESSION_MESSAGE } from '@/services/apiToasts';
import { useToastStore, Toast, ToastType, TOAST_MAX_VISIBLE } from '@/store/toastStore';

/**
 * The one toast UI for the whole app (rendered once in App.tsx). Everything that notifies the user goes
 * through '@/store/toastStore' (toast.*) or '@/utils/notify' (notify.*) and shows up here.
 *
 * - bottom-right on desktop, bottom-center (16px gutters + safe area) on phones
 * - lifts itself above the nearest sticky action bar / modal footer so it never covers a primary button
 * - max 3 visible, the rest queue; pauses on hover and keyboard focus; progress bar shows the time left
 */

const ICON_BG: Record<ToastType, string> = {
  success: 'bg-brand-lime-bright text-[#0F1F19]',
  error: 'bg-[#E5484D] text-white',
  warning: 'bg-brand-gold text-[#0F1F19]',
  info: 'bg-[#8FA3B8] text-[#0F1F19]',
};
const BAR: Record<ToastType, string> = {
  success: 'bg-brand-lime-bright',
  error: 'bg-[#E5484D]',
  warning: 'bg-brand-gold',
  info: 'bg-[#8FA3B8]',
};

function StatusIcon({ type }: { type: ToastType }) {
  return (
    <span aria-hidden="true" className={`mt-px flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${ICON_BG[type]}`}>
      {type === 'success' ? (
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 10.5l3.2 3.2L15 6.8" />
        </svg>
      ) : type === 'info' ? (
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M10 9v5M10 5.8v.1" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M10 5.5v5.5M10 14.2v.1" />
        </svg>
      )}
    </span>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);
  const [barKey, setBarKey] = useState(0);

  useEffect(() => {
    if (!toast.duration || paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), Math.max(remaining.current, 50));
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, toast.id, toast.duration, onDismiss]);

  // restart the bar animation from the remaining time whenever pause toggles
  useEffect(() => setBarKey((k) => k + 1), [paused]);

  const assertive = toast.type === 'error';

  return (
    <div
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      data-toast={toast.type}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="zaad-toast pointer-events-auto relative w-full overflow-hidden rounded-xl bg-[#0F1F19] text-white shadow-[0_14px_28px_-12px_rgba(0,0,0,0.5)] dark:border dark:border-surface-border-strong dark:bg-[#1E2824] sm:w-[380px]"
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <StatusIcon type={toast.type} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13px] font-semibold leading-5">{toast.message}</p>
          {toast.description && <p className="mt-0.5 break-words text-xs leading-[18px] text-white/65">{toast.description}</p>}
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[13px] font-bold text-brand-lime-bright hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime-bright"
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="-mr-1 flex-shrink-0 rounded p-0.5 text-white/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime-bright"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>
      {toast.duration > 0 && (
        <span
          key={barKey}
          aria-hidden="true"
          className={`zaad-toast-bar absolute bottom-0 left-0 h-[3px] w-full origin-left ${BAR[toast.type]}`}
          style={{ animationDuration: `${Math.max(remaining.current, 50)}ms`, animationPlayState: paused ? 'paused' : 'running' }}
        />
      )}
    </div>
  );
}

/** Height of the lowest sticky/fixed bar touching the bottom of the viewport (modal footer, action bar). */
function measureBottomBar(): number {
  const vh = window.innerHeight;
  let max = 0;
  const nodes = document.querySelectorAll<HTMLElement>('[data-toast-offset], .sticky.bottom-0, .fixed.bottom-0, [role="dialog"] footer');
  nodes.forEach((el) => {
    if (el.closest('[data-toaster]')) return;
    const r = el.getBoundingClientRect();
    if (r.height < 24 || r.height > 220 || r.width < 120) return;
    if (r.bottom < vh - 72 || r.top > vh) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    max = Math.max(max, vh - r.top);
  });
  return Math.ceil(max);
}

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const hostRef = useRef<HTMLDivElement>(null);
  const count = toasts.length;

  // A 401 reloads the page via the login redirect; show the notice once the app is back.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_NOTICE_KEY)) {
        sessionStorage.removeItem(SESSION_NOTICE_KEY);
        toastApi.warning(SESSION_MESSAGE);
      }
    } catch { /* ignore */ }
  }, []);

  const apply = useCallback(() => {
    const host = hostRef.current;
    if (host) host.style.setProperty('--toast-lift', `${measureBottomBar()}px`);
  }, []);

  useEffect(() => {
    if (!count) return;
    apply();
    const t = setInterval(apply, 400);
    window.addEventListener('resize', apply);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', apply);
    };
  }, [count, apply]);

  if (count === 0) return null;
  const visible = toasts.slice(0, TOAST_MAX_VISIBLE);

  return createPortal(
    <div
      ref={hostRef}
      data-toaster
      className="pointer-events-none fixed inset-x-4 z-[200] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--toast-lift, 0px) + 16px)' }}
    >
      {visible.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>,
    document.body
  );
}
