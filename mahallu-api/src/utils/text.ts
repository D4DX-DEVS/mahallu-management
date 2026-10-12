/** Normalisation helpers shared by duplicate detection. */

/** trim, lowercase, collapse internal whitespace, drop dots/commas. */
export const normalizeName = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Phone normalisation: keep digits only, then strip a leading +91 / 91 / 0
 * so "+91 98765 43210", "098765 43210" and "9876543210" all compare equal.
 * Returns '' when nothing usable is left.
 */
export const normalizePhone = (value: unknown): string => {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  digits = digits.replace(/^0+/, '');
  return digits;
};
