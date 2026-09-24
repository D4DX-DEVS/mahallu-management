/**
 * Parses a date of birth. A bare 'YYYY-MM-DD' (what the CMS date picker
 * sends) is read as LOCAL midnight, not UTC: `new Date('2026-09-03')` is
 * 05:30 local in IST, which makes a birth recorded early that morning look
 * like it is in the future.
 */
export function parseDateOnly(value: Date | string | null | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** True when the date falls after today (compared by calendar day, not clock time). */
export function isFutureDate(value: Date | string | null | undefined): boolean {
  const parsed = parseDateOnly(value);
  if (!parsed) return false;

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return parsed > endOfToday;
}

/**
 * Age in completed years on `asOf` (default: now), or undefined when the date
 * of birth is missing/unparseable or lies in the future.
 *
 * Members can be recorded with only an age (common during door-to-door
 * surveys), so `age` stays a stored field; whenever a date of birth IS known
 * it wins, and this keeps the stored age in step with it on every write.
 */
export function calculateAge(dateOfBirth: Date | string | null | undefined, asOf: Date = new Date()): number | undefined {
  const dob = parseDateOnly(dateOfBirth);
  if (!dob) return undefined;

  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age < 0 ? undefined : age;
}
