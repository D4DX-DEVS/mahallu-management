import { useCallback } from 'react';
import { create } from 'zustand';
import { toast } from '@/store/toastStore';
import { withSilentApiToasts } from '@/services/mutationTracker';
import { getFriendlyError } from '@/utils/apiMessages';

/**
 * Undoable (deferred) destructive actions.
 *
 * run() hides the item immediately, shows "<label> · Undo" and only calls the API after `delay`
 * (default 6s). Undo cancels the timer and shows the item again, so nothing is ever sent.
 *
 * The registry is module-level, so the timer survives route changes (navigating away never loses
 * or silently cancels a delete). On tab close / reload, pending commits are flushed immediately.
 *
 *   const { run, filterHidden } = useUndoableAction('committee');
 *   run({ id, label: 'Committee deleted', commit: () => committeeService.delete(id) });
 *   const visible = filterHidden(rows, (r) => r.id);
 */

interface Pending {
  timer: ReturnType<typeof setTimeout>;
  commit: () => Promise<unknown>;
  settle: () => void;
}

const pending = new Map<string, Pending>();

interface HiddenState {
  hidden: Set<string>;
  add: (key: string) => void;
  remove: (key: string) => void;
}

/** Keys of items hidden from lists: pending deletes plus ones already committed this session. */
export const useHiddenStore = create<HiddenState>((set) => ({
  hidden: new Set<string>(),
  add: (key) => set((s) => ({ hidden: new Set(s.hidden).add(key) })),
  remove: (key) =>
    set((s) => {
      const next = new Set(s.hidden);
      next.delete(key);
      return { hidden: next };
    }),
}));

let unloadBound = false;
const bindUnload = () => {
  if (unloadBound || typeof window === 'undefined') return;
  unloadBound = true;
  const flush = () => flushPendingUndoables();
  window.addEventListener('beforeunload', flush);
  window.addEventListener('pagehide', flush);
};

/** Commit every pending action right now (used on unload; safe to call anytime). */
export function flushPendingUndoables() {
  Array.from(pending.entries()).forEach(([, p]) => {
    clearTimeout(p.timer);
    p.settle();
  });
}

export interface UndoableOptions {
  /** Item id, unique within `kind`. */
  id: string;
  /** Toast text, e.g. "Committee deleted". */
  label: string;
  /** The real API call, made after the undo window. */
  commit: () => Promise<unknown>;
  /** Called after a successful commit (e.g. to refetch counts). */
  onCommitted?: () => void;
  /** Called when the user undoes. */
  onUndo?: () => void;
  /** Error toast fallback when the API call fails (the item reappears). */
  errorMessage?: string;
  /** Undo window in ms (default 6000). */
  delay?: number;
}

export const UNDO_DELAY_MS = 6000;

export function useUndoableAction(kind: string) {
  const hidden = useHiddenStore((s) => s.hidden);

  const run = useCallback(
    ({ id, label, commit, onCommitted, onUndo, errorMessage, delay = UNDO_DELAY_MS }: UndoableOptions) => {
      bindUnload();
      const key = `${kind}:${id}`;
      const store = useHiddenStore.getState();
      if (pending.has(key)) return;
      store.add(key);

      let done = false;
      const settle = () => {
        if (done) return;
        done = true;
        pending.delete(key);
        withSilentApiToasts(commit)
          .then(() => onCommitted?.())
          .catch((err: any) => {
            useHiddenStore.getState().remove(key);
            toast.error(getFriendlyError(err, errorMessage || "Couldn't complete that action. Please try again."));
          });
      };

      const timer = setTimeout(settle, delay);
      pending.set(key, { timer, commit, settle });

      toast.show('info', label, {
        duration: delay,
        action: {
          label: 'Undo',
          onClick: () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            pending.delete(key);
            useHiddenStore.getState().remove(key);
            onUndo?.();
          },
        },
      });
    },
    [kind]
  );

  const isHidden = useCallback((id: string) => hidden.has(`${kind}:${id}`), [hidden, kind]);

  /** Drop items that are pending deletion (or already deleted this session) from a fetched list. */
  const filterHidden = useCallback(
    <T,>(rows: T[], getId: (row: T) => string): T[] => rows.filter((r) => !hidden.has(`${kind}:${getId(r)}`)),
    [hidden, kind]
  );

  return { run, isHidden, filterHidden };
}
