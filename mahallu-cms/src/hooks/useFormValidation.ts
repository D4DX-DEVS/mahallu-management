import { useCallback, useState } from 'react';
import { FieldErrors, FieldRule, checkField, validateForm } from '@/utils/validation';

/**
 * Field-level validation for the pages built on `useState` rather than
 * react-hook-form.
 *
 * Those pages checked a couple of fields inside the submit handler and put a
 * single sentence in a banner at the top — so a form with four problems showed
 * one of them, nothing marked the field it belonged to, and length, format and
 * range went unchecked entirely. This gives them what the react-hook-form pages
 * already had, without rewriting how they hold their state.
 *
 *   const { errors, validate, clearField } = useFormValidation(RULES);
 *
 *   const handleSubmit = (e) => {
 *     e.preventDefault();
 *     if (!validate(form)) return;   // errors are now on screen, per field
 *     …
 *   };
 *
 * `clearField` is called as the user edits, so a message disappears when the
 * thing it complained about is fixed rather than sitting there until resubmit.
 */
export function useFormValidation<T extends Record<string, unknown>>(
  rules: Partial<Record<keyof T & string, FieldRule>>
) {
  const [errors, setErrors] = useState<FieldErrors>({});

  /** Checks everything, shows every message, and says whether the form may go. */
  const validate = useCallback(
    (values: T): boolean => {
      const found = validateForm(values, rules);
      setErrors(found);
      return Object.keys(found).length === 0;
    },
    [rules]
  );

  /** Re-checks one field — for onBlur, where a message is helpful early. */
  const validateField = useCallback(
    (field: keyof T & string, values: T) => {
      const rule = rules[field];
      if (!rule) return;
      const message = checkField(values[field], rule, values);
      setErrors((current) => {
        const next = { ...current };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
    },
    [rules]
  );

  /** Drops a field's message, for onChange. */
  const clearField = useCallback((field: keyof T & string) => {
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, validate, validateField, clearField, clearAll, setErrors };
}
