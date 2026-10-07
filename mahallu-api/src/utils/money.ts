/**
 * Money helpers shared by the validators and the finance controllers.
 *
 * Amounts in this product are rupees with at most two decimal places and never
 * larger than MAX_AMOUNT. Floating point sums (0.1 + 0.2) leave noise beyond
 * the second decimal, so every stored total is passed through round2.
 */

/** The largest money value this product handles. Keeps `1e308` out of a Number field. */
export const MAX_AMOUNT = 100_000_000;

/** Plain decimal text with at most two decimals: `10`, `10.5`, `10.55`. No sign, no exponent. */
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Round to two decimals, immune to binary noise (1.005 style cases are rounded half away from zero). */
export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * The numeric value of a money input, or null when the input is not a plain
 * non-negative decimal with at most two decimals.
 *
 * Accepts a finite JS number or a numeric string such as '10.50'. Rejects NaN,
 * Infinity, exponent forms ('1e3', 1e21), booleans, arrays, objects, signs and
 * anything with a third decimal. The upper bound is the caller's to apply.
 */
export const parseMoney = (value: unknown): number | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    // String(number) is the shortest round-trip form: 0.001 -> '0.001', 1e21 -> '1e+21', 1e-7 -> '1e-7'.
    return MONEY_PATTERN.test(String(value)) ? value : null;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    return MONEY_PATTERN.test(text) ? Number(text) : null;
  }
  return null;
};

/** parseMoney plus the 0..MAX_AMOUNT range, with an optional minimum. */
export const parseAmountInRange = (value: unknown, min = 0): number | null => {
  const amount = parseMoney(value);
  if (amount === null || amount < min || amount > MAX_AMOUNT) return null;
  return amount;
};
