import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

const PREFIX = 'mahallu:draft:';

interface StoredDraft {
  values: Record<string, unknown>;
  step?: number;
  savedAt: number;
}

function read(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

/**
 * localStorage draft for long forms. When `ready` flips true (e.g. after an edit record has loaded)
 * a stored draft is restored once. Restored values count as dirty (defaults are kept).
 */
export function useFormDraft<T extends FieldValues>(
  key: string,
  form: UseFormReturn<T>,
  opts: { ready?: boolean; onRestore?: (step?: number) => void } = {}
) {
  const { ready = true, onRestore } = opts;
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const baseRef = useRef<T | null>(null);
  const doneRef = useRef(false);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  useEffect(() => {
    if (!ready || doneRef.current) return;
    doneRef.current = true;
    baseRef.current = form.getValues();
    const draft = read(key);
    if (draft?.values) {
      form.reset({ ...baseRef.current, ...draft.values } as T, { keepDefaultValues: true });
      setRestored(true);
      setSavedAt(draft.savedAt);
      onRestoreRef.current?.(draft.step);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  const saveDraft = useCallback(
    (step?: number) => {
      try {
        const payload: StoredDraft = { values: form.getValues() as Record<string, unknown>, step, savedAt: Date.now() };
        localStorage.setItem(PREFIX + key, JSON.stringify(payload));
        setSavedAt(payload.savedAt);
        return true;
      } catch {
        return false;
      }
    },
    [form, key]
  );

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
    setRestored(false);
    setSavedAt(null);
  }, [key]);

  /** Removes the draft and puts the form back to its pre-draft values. */
  const discardDraft = useCallback(() => {
    clearDraft();
    if (baseRef.current) form.reset(baseRef.current);
  }, [clearDraft, form]);

  return { restored, savedAt, saveDraft, clearDraft, discardDraft, dismissRestored: () => setRestored(false) };
}
