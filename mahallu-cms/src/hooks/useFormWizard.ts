import { useCallback, useState } from 'react';
import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';

export interface WizardStep<T extends FieldValues> {
  id: string;
  label: string;
  /** Fields validated (via trigger) before moving past this step. */
  fields: FieldPath<T>[];
}

/** Step state + per-step validation for multi-step forms. All steps stay mounted; hide inactive ones. */
export function useFormWizard<T extends FieldValues>(form: UseFormReturn<T>, steps: WizardStep<T>[]) {
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const last = steps.length - 1;

  const go = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(i, last));
      setStep(clamped);
      setMaxVisited((m) => Math.max(m, clamped));
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    },
    [last]
  );

  const validateCurrent = useCallback(async () => {
    const fields = steps[step].fields;
    if (!fields.length) return true;
    const ok = await form.trigger(fields, { shouldFocus: true });
    return ok;
  }, [form, steps, step]);

  const next = useCallback(async () => {
    if (step >= last) return false;
    if (!(await validateCurrent())) return false;
    go(step + 1);
    return true;
  }, [step, last, validateCurrent, go]);

  const back = useCallback(() => go(step - 1), [go, step]);

  /** Jump via the stepper: backwards is free, forwards validates every step in between. */
  const goTo = useCallback(
    async (target: number) => {
      if (target <= step) return go(target);
      for (let i = step; i < target; i++) {
        const fields = steps[i].fields;
        if (fields.length && !(await form.trigger(fields))) {
          go(i);
          await form.trigger(fields, { shouldFocus: true });
          return;
        }
      }
      go(target);
    },
    [form, steps, step, go]
  );

  /** Step index holding the first field with an error (used after a failed final submit). */
  const stepOfFirstError = useCallback(
    (errors: Record<string, unknown>) => steps.findIndex((s) => s.fields.some((f) => String(f).split('.')[0] in errors)),
    [steps]
  );

  return { step, setStep: go, maxVisited, isFirst: step === 0, isLast: step === last, next, back, goTo, stepOfFirstError };
}
