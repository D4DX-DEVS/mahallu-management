/**
 * Shared rupee formatter. Indian digit grouping (12,34,567), no decimals by
 * default. Use this everywhere a rupee amount is shown instead of ad-hoc
 * `₹${n.toLocaleString()}` (which groups in the 3-digit western style).
 */
export interface FormatINROptions {
  /** Show 2 decimals (e.g. receipts). Default false. */
  decimals?: boolean;
  /** Short form for tight spaces: 1.2K, 3.4L (lakh), 1.1Cr. Default false. */
  compact?: boolean;
  /** Prefix with the rupee sign. Default true. */
  symbol?: boolean;
}

const full = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fullDecimals = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function compactNumber(abs: number): string {
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (abs >= 1e7) return `${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${trim(abs / 1e3)}K`;
  return full.format(abs);
}

export function formatINR(value: number | string | null | undefined, options: FormatINROptions = {}): string {
  const { decimals = false, compact = false, symbol = true } = options;
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(safe);
  const body = compact ? compactNumber(abs) : decimals ? fullDecimals.format(abs) : full.format(abs);
  return `${safe < 0 ? '-' : ''}${symbol ? '₹' : ''}${body}`;
}

export default formatINR;
