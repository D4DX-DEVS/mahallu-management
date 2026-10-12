import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  /** Title line (what happened). */
  message: string;
  /** Optional second line (what to do next). */
  description?: string;
  /** Optional inline action (e.g. Undo, Retry, View). Clicking it runs onClick and dismisses the toast. */
  action?: { label: string; onClick: () => void };
  /** Auto-dismiss delay in ms. 0 = stays until dismissed. */
  duration: number;
  createdAt: number;
}

export interface ToastOptions {
  /** Auto-dismiss delay in ms. Defaults: success 3500, info 4000, warning 6000, error 8000. 0 = sticky. */
  duration?: number;
  /** Stay until the user dismisses it (errors that need an action). */
  sticky?: boolean;
  description?: string;
  action?: Toast['action'];
}

/** Default auto-dismiss durations (ms). */
export const TOAST_DURATIONS: Record<ToastType, number> = { success: 3500, info: 4000, warning: 6000, error: 8000 };
/** Identical toasts inside this window are shown once. */
export const TOAST_DEDUPE_MS = 2000;
/** Toasts visible at once; the rest wait in a queue. */
export const TOAST_MAX_VISIBLE = 3;

interface ToastState {
  toasts: Toast[];
  push: (type: ToastType, message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;
let lastShownAt = 0;

/** Timestamp (ms) of the last toast pushed by anyone. The API interceptor uses it to avoid double toasts. */
export const getLastToastAt = () => lastShownAt;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (type, message, options) => {
    const now = Date.now();
    lastShownAt = now;
    const dup = get().toasts.find(
      (t) => t.type === type && t.message === message && t.description === options?.description && now - t.createdAt < TOAST_DEDUPE_MS
    );
    if (dup) return dup.id;
    const id = nextId++;
    const duration = options?.sticky ? 0 : options?.duration ?? TOAST_DURATIONS[type];
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, description: options?.description, action: options?.action, duration, createdAt: now }],
    }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Fire-and-forget notifications. Usable outside React (services, handlers):
 *   toast.success('Application created')
 *   toast.show('info', 'Committee deleted', { action: { label: 'Undo', onClick } })
 * Prefer the richer helpers in '@/utils/notify' (notify.saved, notify.error, ...) in new code.
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => useToastStore.getState().push('success', message, options),
  error: (message: string, options?: ToastOptions) => useToastStore.getState().push('error', message, options),
  info: (message: string, options?: ToastOptions) => useToastStore.getState().push('info', message, options),
  warning: (message: string, options?: ToastOptions) => useToastStore.getState().push('warning', message, options),
  /** Any type with an optional action button and custom duration. Returns the toast id. */
  show: (type: ToastType, message: string, options?: ToastOptions) => useToastStore.getState().push(type, message, options),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
};
