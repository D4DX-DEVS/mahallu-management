/**
 * Phone-number helpers shared by every auth path.
 *
 * Accounts store phones in several shapes ("9876543210", "919876543210",
 * "+919876543210"). Matching is therefore done on the canonical form: the last
 * ten digits of an Indian mobile number.
 */
export const getPhoneVariants = (input: string): string[] => {
  const variants = new Set<string>();
  const raw = (input || '').trim();

  if (raw) {
    variants.add(raw);
  }

  const digits = raw.replace(/\D/g, '');
  if (digits) {
    variants.add(digits);
  }

  let local = digits;
  if (local.startsWith('91') && local.length === 12) {
    local = local.slice(2);
  }

  if (local.length === 10) {
    variants.add(local);
    variants.add(`91${local}`);
    variants.add(`+91${local}`);
  }

  return Array.from(variants);
};

/** The comparable form of a phone: its last ten digits (or all digits when shorter). */
export const canonicalPhone = (input: string | undefined | null): string => {
  const digits = String(input ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

export const samePhone = (a: string | undefined | null, b: string | undefined | null): boolean => {
  const ca = canonicalPhone(a);
  const cb = canonicalPhone(b);
  return ca.length >= 10 && ca === cb;
};

/** `98******10` — enough to recognise a number in a log line, not to reuse it. */
export const maskPhone = (input: string | undefined | null): string => {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 2)}${'*'.repeat(Math.max(digits.length - 4, 2))}${digits.slice(-2)}`;
};
