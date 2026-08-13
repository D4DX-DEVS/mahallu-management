import { FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle, FiX } from 'react-icons/fi';
import { useToastStore, ToastType } from '@/store/toastStore';

const STYLES: Record<ToastType, { wrap: string; icon: React.ComponentType<{ className?: string }> }> = {
  success: { wrap: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: FiCheckCircle },
  error: { wrap: 'bg-red-50 border-red-200 text-red-800', icon: FiAlertCircle },
  warning: { wrap: 'bg-amber-50 border-amber-200 text-amber-800', icon: FiAlertTriangle },
  info: { wrap: 'bg-slate-50 border-slate-200 text-slate-800', icon: FiInfo },
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const { wrap, icon: Icon } = STYLES[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg ${wrap}`}
          >
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="flex-1 text-sm">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="flex-shrink-0 opacity-60 hover:opacity-100"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
