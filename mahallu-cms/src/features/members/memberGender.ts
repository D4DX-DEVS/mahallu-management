import { z } from 'zod';

/*
 * Gender on a NEW member. The API refuses a new member without one (Male + Female must add up to the member
 * total), so the forms ask for it up front instead of sending a request that is certain to fail. These rules
 * mirror the API; the API stays the authority. Editing an older member who has no gender recorded is not
 * affected: EditMember keeps its own optional field.
 */
export const GENDER_VALUES = ['male', 'female'] as const;
export type Gender = (typeof GENDER_VALUES)[number];

export const GENDER_REQUIRED_MESSAGE = 'Please choose the gender.';

/** For the create forms: a blank or unknown choice is an error, never "unspecified". */
export const requiredGenderSchema = z.enum(GENDER_VALUES, {
  errorMap: () => ({ message: GENDER_REQUIRED_MESSAGE }),
});

/**
 * One gender cell of a CSV import: trimmed and lower-cased ("  MALE " -> "male"). Anything else is an error
 * - "M", "F", "boy" and a blank are NOT guessed at, because a wrong guess would silently skew the member counts.
 */
export const normalizeGenderCell = (raw: string): { value: string } | { error: string } => {
  const value = raw.trim().toLowerCase();
  if ((GENDER_VALUES as readonly string[]).includes(value)) return { value };
  return { error: `Gender must be "male" or "female" (found "${raw.trim()}").` };
};
