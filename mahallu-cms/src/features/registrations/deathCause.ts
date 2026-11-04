/**
 * Cause of Death on a death registration.
 *
 * The API stores it as plain text (`causeOfDeath: string`, no enum), so the two choices are stored as
 * their own readable wording and certificates, exports and lists show them as they are. Registrations
 * saved before this was a dropdown hold whatever was typed ("Illness", "accident", ...): those are
 * never rewritten. A value that is not one of the two choices is offered as an extra, last option so
 * opening and saving an old record keeps it.
 */

export const CAUSE_OF_DEATH_CHOICES = ['Accident', 'Normal Death'] as const;

export interface CauseOption {
  value: string;
  label: string;
}

const BASE_OPTIONS: CauseOption[] = CAUSE_OF_DEATH_CHOICES.map((value) => ({ value, label: value }));

/** An old value that differs only in case or spacing from a choice ("accident ") is that choice. */
export const canonicalCause = (value: string | undefined | null): string => {
  const text = (value ?? '').trim();
  if (!text) return '';
  const match = CAUSE_OF_DEATH_CHOICES.find((choice) => choice.toLowerCase() === text.toLowerCase());
  return match ?? text;
};

/** The dropdown options: a prompt, the two choices, and the record's own older wording when it has some. */
export const causeOfDeathOptions = (current?: string | null): CauseOption[] => {
  const prompt: CauseOption = { value: '', label: 'Select cause of death...' };
  const value = canonicalCause(current);
  const legacy = value && !CAUSE_OF_DEATH_CHOICES.includes(value as (typeof CAUSE_OF_DEATH_CHOICES)[number]);
  return [prompt, ...BASE_OPTIONS, ...(legacy ? [{ value, label: value }] : [])];
};
