import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { toast, getLastToastAt } from '@/store/toastStore';
import { describeWrite, getFriendlyError, isCancelledError, isOfflineError, isSilentErrorPath, MESSAGES } from '@/utils/apiMessages';
import { isApiToastSilenced } from './mutationTracker';

/**
 * Global "saved" / friendly-error toasts for API writes, driven from the axios interceptor.
 * A page's own toast always wins: if any toast was shown within PAGE_TOAST_WAIT_MS of the response,
 * nothing extra is shown, so the user never sees two.
 *
 * Per-request options (axios config):
 *   silent: true / skipSuccessToast: true   no automatic success toast
 *   skipErrorToast: true                    no automatic error toast (silent: true also skips it)
 *   toastMessage: 'Receipt sent'            show this success message (even on otherwise silent endpoints)
 */
declare module 'axios' {
  interface AxiosRequestConfig {
    silent?: boolean;
    skipSuccessToast?: boolean;
    skipErrorToast?: boolean;
    toastMessage?: string;
  }
}

export const PAGE_TOAST_WAIT_MS = 700;
const isWrite = (m?: string) => !['get', 'head', 'options', undefined, ''].includes((m || '').toLowerCase());

const pageToasted = (since: number) => getLastToastAt() >= since - 50;

export function handleWriteSuccess(response: AxiosResponse) {
  const cfg = response.config as InternalAxiosRequestConfig;
  if (!cfg || !isWrite(cfg.method)) return;
  if (cfg.silent || cfg.skipSuccessToast) return;
  if (isApiToastSilenced()) return;
  const custom = cfg.toastMessage;
  const desc = custom ? { silent: false, message: custom } : describeWrite(cfg.method, cfg.url);
  if (desc.silent || !desc.message) return;
  const at = Date.now();
  setTimeout(() => {
    if (pageToasted(at) || isApiToastSilenced()) return;
    toast.success(desc.message as string);
  }, PAGE_TOAST_WAIT_MS);
}

let lastReadErrorAt = 0;

export function handleApiError(error: AxiosError, retry: (cfg: InternalAxiosRequestConfig) => Promise<unknown>) {
  const cfg = error.config as InternalAxiosRequestConfig | undefined;
  if (!cfg || isCancelledError(error) || cfg.silent || cfg.skipErrorToast) return;
  if (isApiToastSilenced() || isSilentErrorPath(cfg.url)) return;
  const status = error.response?.status;
  const write = isWrite(cfg.method);
  // Reads: only permission problems are surfaced globally; pages handle their own empty/error states.
  if (!write && status !== 403) return;
  if (status === 401) return; // the interceptor signs the user out and shows the session notice after redirect
  if (!write) {
    const now = Date.now();
    if (now - lastReadErrorAt < 10000) return;
    lastReadErrorAt = now;
  }
  const at = Date.now();
  const message = getFriendlyError(error);
  const offline = isOfflineError(error);
  setTimeout(() => {
    if (pageToasted(at)) return;
    if (offline && write) {
      toast.error(message, { sticky: true, action: { label: 'Retry', onClick: () => void retry(cfg).catch(() => undefined) } });
    } else {
      toast.error(message, status === 403 || status === 423 ? { sticky: true } : undefined);
    }
  }, PAGE_TOAST_WAIT_MS);
}

export const SESSION_NOTICE_KEY = 'zaad:sessionExpired';
export const SESSION_MESSAGE = MESSAGES.unauthorized;
