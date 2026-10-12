import { toast, ToastType } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

/**
 * The one way to notify the user. Every call lands in the single global toast (components/ui/Toaster.tsx).
 *
 *   notify.saved('Committee')                      // "Committee saved"
 *   notify.deleted('Committee', { undo })          // "Committee deleted" + Undo
 *   notify.error(err, { fallback: "Couldn't save the committee. Check the details and try again." })
 *   notify.promise(api.post(...), { loading: 'Sending...', success: 'Announcement sent', error: "Couldn't send it. Try again." })
 *
 * Successful API writes already get an automatic "<Thing> created/saved/deleted" toast from the axios
 * interceptor when the page shows none, so pages only need these helpers for richer messages.
 */

export interface NotifyOptions {
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
  sticky?: boolean;
}

const show = (type: ToastType, title: string, options?: NotifyOptions) => toast.show(type, title, options);

const lower = (s: string) => s;

const crud = (verb: string) => (label: string, options?: NotifyOptions) => show('success', `${lower(label)} ${verb}`, options);

export const notify = {
  success: (title: string, options?: NotifyOptions) => show('success', title, options),
  info: (title: string, options?: NotifyOptions) => show('info', title, options),
  warning: (title: string, options?: NotifyOptions) => show('warning', title, options),
  /** Accepts a message or a caught error (turned into friendly copy). */
  error: (titleOrError: unknown, options?: NotifyOptions & { fallback?: string }) => {
    const title = typeof titleOrError === 'string' ? titleOrError : getFriendlyError(titleOrError, options?.fallback);
    return show('error', title, options);
  },

  saved: crud('saved'),
  created: crud('created'),
  updated: crud('updated'),
  archived: crud('archived'),
  restored: crud('restored'),
  cancelled: crud('cancelled'),
  approved: crud('approved'),
  rejected: crud('rejected'),
  sent: crud('sent'),
  deleted: (label: string, options?: NotifyOptions & { undo?: () => void }) =>
    show('success', `${label} deleted`, {
      ...options,
      action: options?.undo ? { label: 'Undo', onClick: options.undo } : options?.action,
    }),

  dismiss: (id: number) => toast.dismiss(id),

  /** Loading -> success/error toast around a promise. Resolves/rejects exactly like the original promise. */
  promise: async <T,>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((value: T) => string);
      error?: string | ((err: unknown) => string);
    }
  ): Promise<T> => {
    const id = toast.show('info', msgs.loading, { sticky: true });
    try {
      const value = await promise;
      toast.dismiss(id);
      toast.show('success', typeof msgs.success === 'function' ? msgs.success(value) : msgs.success);
      return value;
    } catch (err) {
      toast.dismiss(id);
      toast.show('error', typeof msgs.error === 'function' ? msgs.error(err) : getFriendlyError(err, msgs.error));
      throw err;
    }
  },
};

export default notify;
