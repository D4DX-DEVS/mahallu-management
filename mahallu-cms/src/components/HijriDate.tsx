import { useMemo } from 'react';
import { formatHijri, toHijri } from '@/utils/hijri';
import { cn } from '@/utils/cn';

export interface HijriDateProps {
  /** Defaults to today */
  date?: Date | string | number;
  lang?: 'en' | 'ml';
  /** Show the Gregorian date before the Hijri one: "12 Oct 2026 · 29 Rabi' al-awwal 1448 AH" */
  withGregorian?: boolean;
  /** "29 Rabi' al-awwal" without the year */
  short?: boolean;
  className?: string;
}

/**
 * Hijri (Umm al-Qura) date. Dates are calculated, not sighted: Eid and Ramadan can differ by
 * a day locally, so the tooltip says so.
 */
export default function HijriDate({ date, lang = 'en', withGregorian = false, short = false, className }: HijriDateProps) {
  const text = useMemo(() => {
    const d = date === undefined ? new Date() : date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const h = toHijri(d);
    const hijri = short ? `${h.day} ${lang === 'ml' ? h.monthNameMl : h.monthName}` : formatHijri(d, lang);
    if (!withGregorian) return hijri;
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${hijri}`;
  }, [date, lang, withGregorian, short]);
  if (!text) return null;
  return (
    <span className={cn('whitespace-nowrap', lang === 'ml' && 'font-malayalam', className)} title="Hijri date (Umm al-Qura calendar, may differ by a day from local moon sighting)">
      {text}
    </span>
  );
}
