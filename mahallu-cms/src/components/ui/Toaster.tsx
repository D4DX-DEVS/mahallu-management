import { FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle, FiX } from 'react-icons/fi';
import {
  useToastStore,
  ToastType,
} from '@/store/toastStore'; /* Toast tones share the four semantic tokens with Alert and StatusBadge, so a * success is the same green in a toast, a badge and an inline message. */
const STYLES: Record<
  ToastType,
  { wrap: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  success: { wrap: 'border-success/30 bg-card', tone: 'text-success', icon: FiCheckCircle },
  error: { wrap: 'border-destructive/30 bg-card', tone: 'text-destructive', icon: FiAlertCircle },
  warning: { wrap: 'border-warning/30 bg-card', tone: 'text-warning', icon: FiAlertTriangle },
  info: { wrap: 'border-info/30 bg-card', tone: 'text-info', icon: FiInfo },
};
export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const failures = toasts.filter((t) => t.type === 'error' || t.type === 'warning');
  const rest = toasts.filter((t) => t.type !== 'error' && t.type !== 'warning');
  if (toasts.length === 0) return null;
  const render = (toast: (typeof toasts)[number]) => {
    const { wrap, icon: Icon, tone } = STYLES[toast.type];
    return (
      <div
        key={toast.id}
        className={
          'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border px-3 py-2.5 text-card-foreground shadow-md ' +
          wrap
        }
      >
        <Icon className={'mt-0.5 h-4 w-4 flex-shrink-0 ' + tone} aria-hidden="true" />
        <p className="flex-1 text-sm">{toast.message}</p>
        <button
          type="button"
          onClick={() => dismiss(toast.id)}
          aria-label="Dismiss notification"
          className="flex-shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end">
      {/* Failures interrupt; confirmations do not. Announcing an error politely
          means a screen-reader user may never hear that the save failed. */}
      <div role="alert" aria-live="assertive" className="contents">
        {failures.map(render)}
      </div>
      <div role="status" aria-live="polite" className="contents">
        {rest.map(render)}
      </div>
    </div>
  );
}
