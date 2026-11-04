/** Shared helpers for form inputs: Indian mobile numbers and amounts with lakh/crore grouping. */

/** Strips formatting, a leading +91 / 91 / 0 and caps at 10 digits. */
export function normalizeIndianMobile(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** 10 digits starting 6-9 (valid Indian mobile). */
export const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

export const PHONE_HINT = '10-digit mobile number, e.g. 9876543210';
export const PHONE_ERROR = 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9';

/** Returns an error message, or undefined when empty/valid. */
export function validateIndianMobile(value?: string): string | undefined {
  if (!value) return undefined;
  return INDIAN_MOBILE_RE.test(value) ? undefined : PHONE_ERROR;
}

/** 125000 -> "1,25,000" (keeps up to 2 decimals). Returns '' for blank/invalid input. */
export function formatIndianNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

/** "1,25,000" -> "125000" (plain numeric string, safe to submit). */
export function stripAmount(value: string): string {
  return (value || '').replace(/,/g, '').replace(/[^\d.]/g, '');
}
