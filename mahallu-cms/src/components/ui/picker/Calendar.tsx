import { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { toHijri } from '@/utils/hijri';
import {
  MONTHS_LONG, MONTHS_SHORT, WEEKDAYS_LONG, WEEKDAYS_SHORT, addDaysISO, addMonthsISO, formatDisplayLong, formatISODate,
  normalizeISODate, splitISO, todayISO, ymdToISO, daysInMonth, weekdayOf,
} from '@/utils/dates';

export interface CalendarProps {
  /** Selected ISO date. */
  value?: string;
  /** Range highlight (ISO dates; either may be empty while picking). */
  range?: { from: string; to: string };
  onSelect: (iso: string) => void;
  min?: string;
  max?: string;
  disabledDate?: (iso: string) => boolean;
  /** 0 = Sunday (default) … 6. */
  weekStart?: number;
  showHijri?: boolean;
  phone?: boolean;
  /** Footer buttons. */
  onClear?: () => void;
  showToday?: boolean;
  /** Month to show when there is no value. */
  initial?: string;
  /** Header summary line (defaults to the selected date as 'dd MMM yyyy'). */
  summary?: string;
  autoFocus?: boolean;
}

const hijriOf = (y: number, m: number, d: number) => toHijri(new Date(Date.UTC(y, m - 1, d, 6, 30)));

const hijriMonthLabel = (y: number, m: number) => {
  const a = hijriOf(y, m, 1);
  const b = hijriOf(y, m, daysInMonth(y, m));
  return a.month === b.month ? `${a.monthName} ${a.year}` : `${a.monthName} – ${b.monthName} ${b.year}`;
};

const btnBase =
  'inline-flex items-center justify-center rounded-lg text-[#3A4741] transition-colors hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 dark:text-surface-text dark:hover:bg-surface-hover dark:focus-visible:ring-brand-lime';

export default function Calendar({
  value, range, onSelect, min, max, disabledDate, weekStart = 0, showHijri, phone, onClear, showToday = true, initial, summary, autoFocus = true,
}: CalendarProps) {
  const today = todayISO();
  const selected = normalizeISODate(value);
  const clamp = (iso: string) => (min && iso < min ? min : max && iso > max ? max : iso);
  const start = selected || normalizeISODate(range?.from) || normalizeISODate(initial) || clamp(today);
  const [focusISO, setFocusISO] = useState(start);
  const [view, setView] = useState(() => {
    const p = splitISO(start)!;
    return { y: p.y, m: p.m };
  });
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days');
  const gridRef = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(autoFocus);
  const yearsRef = useRef<HTMLDivElement>(null);

  const isDisabled = (iso: string) => !!((min && iso < min) || (max && iso > max) || (disabledDate && disabledDate(iso)));

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m - 1, 1);
    const offset = (first.getDay() - weekStart + 7) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const dt = new Date(view.y, view.m - 1, 1 - offset + i);
      return { iso: formatISODate(dt), d: dt.getDate(), m: dt.getMonth() + 1, y: dt.getFullYear(), other: dt.getMonth() + 1 !== view.m };
    });
  }, [view, weekStart]);

  const goto = (iso: string, focus: boolean) => {
    const p = splitISO(iso);
    if (!p) return;
    wantFocus.current = focus;
    setFocusISO(iso);
    setView({ y: p.y, m: p.m });
  };

  const shiftMonth = (n: number) => {
    const next = addMonthsISO(focusISO, n);
    goto(next, false);
  };

  useEffect(() => {
    if (mode !== 'days' || !wantFocus.current) return;
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-iso="${focusISO}"]`);
    el?.focus({ preventScroll: true });
  }, [focusISO, view, mode]);

  // year list: scroll the current year into the middle
  useEffect(() => {
    if (mode !== 'years') return;
    const box = yearsRef.current;
    const cur = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (box && cur) box.scrollTop = cur.offsetTop - box.clientHeight / 2 + cur.clientHeight / 2;
    cur?.focus({ preventScroll: true });
  }, [mode, view.y]);

  const onGridKey = (e: React.KeyboardEvent) => {
    let next: string | null = null;
    switch (e.key) {
      case 'ArrowLeft': next = addDaysISO(focusISO, -1); break;
      case 'ArrowRight': next = addDaysISO(focusISO, 1); break;
      case 'ArrowUp': next = addDaysISO(focusISO, -7); break;
      case 'ArrowDown': next = addDaysISO(focusISO, 7); break;
      case 'PageUp': next = e.shiftKey ? addMonthsISO(focusISO, -12) : addMonthsISO(focusISO, -1); break;
      case 'PageDown': next = e.shiftKey ? addMonthsISO(focusISO, 12) : addMonthsISO(focusISO, 1); break;
      case 'Home': next = addDaysISO(focusISO, -((weekdayOf(focusISO) - weekStart + 7) % 7)); break;
      case 'End': next = addDaysISO(focusISO, 6 - ((weekdayOf(focusISO) - weekStart + 7) % 7)); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isDisabled(focusISO)) onSelect(focusISO);
        return;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    goto(next, true);
  };

  const yearBounds = useMemo(() => {
    const ty = splitISO(today)!.y;
    const lo = min ? splitISO(min)!.y : Math.min(ty - 110, view.y);
    const hi = max ? splitISO(max)!.y : Math.max(ty + 30, view.y);
    return { lo: Math.min(lo, view.y), hi: Math.max(hi, view.y) };
  }, [min, max, today, view.y]);

  const weekdays = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  const sum = summary ?? (selected ? formatDisplayLong(selected) : 'Select a date');
  const cell = phone ? 'h-11 text-[15px]' : showHijri ? 'h-10 text-[13px]' : 'h-9 text-[13px]';
  const hasRange = !!(range && range.from && range.to);
  const lo = hasRange ? (range!.from < range!.to ? range!.from : range!.to) : '';
  const hi = hasRange ? (range!.from < range!.to ? range!.to : range!.from) : '';

  const todayDisabled = isDisabled(today);

  return (
    <div className="select-none">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <span className="text-[13px] font-bold text-primary-700 dark:text-brand-lime">{sum}</span>
        {showHijri && selected && (() => {
          const p = splitISO(selected)!;
          const h = hijriOf(p.y, p.m, p.d);
          return <span className="text-[12px] text-[#7B8983] dark:text-surface-muted">{h.day} {h.monthName} {h.year} AH</span>;
        })()}
      </div>

      <div className="mb-1 flex items-center gap-1">
        <button type="button" aria-label="Previous month" onClick={() => (mode === 'days' ? shiftMonth(-1) : setView((v) => ({ ...v, y: v.y - (mode === 'years' ? 12 : 1) })))} className={cn(btnBase, phone ? 'h-11 w-11' : 'h-8 w-8')}>
          <FiChevronLeft />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
          <button type="button" aria-label="Choose month" aria-expanded={mode === 'months'} onClick={() => setMode(mode === 'months' ? 'days' : 'months')} className={cn(btnBase, 'px-2 text-[13px] font-bold', phone ? 'h-11' : 'h-8')}>
            {MONTHS_LONG[view.m - 1]}
          </button>
          <button type="button" aria-label="Choose year" aria-expanded={mode === 'years'} onClick={() => setMode(mode === 'years' ? 'days' : 'years')} className={cn(btnBase, 'px-2 text-[13px] font-bold', phone ? 'h-11' : 'h-8')}>
            {view.y}
          </button>
        </div>
        <button type="button" aria-label="Next month" onClick={() => (mode === 'days' ? shiftMonth(1) : setView((v) => ({ ...v, y: v.y + (mode === 'years' ? 12 : 1) })))} className={cn(btnBase, phone ? 'h-11 w-11' : 'h-8 w-8')}>
          <FiChevronRight />
        </button>
      </div>
      <div aria-live="polite" className="sr-only">{MONTHS_LONG[view.m - 1]} {view.y}</div>
      {showHijri && mode === 'days' && (
        <div className="mb-1.5 text-center text-[12px] text-[#7B8983] dark:text-surface-muted">{hijriMonthLabel(view.y, view.m)} AH</div>
      )}

      {mode === 'months' && (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {MONTHS_SHORT.map((n, i) => {
            const cur = i + 1 === view.m;
            return (
              <button
                key={n}
                type="button"
                aria-current={cur ? 'true' : undefined}
                onClick={() => {
                  const day = Math.min(splitISO(focusISO)!.d, daysInMonth(view.y, i + 1));
                  setMode('days');
                  goto(ymdToISO(view.y, i + 1, day), false);
                }}
                className={cn(btnBase, phone ? 'h-12' : 'h-10', 'text-[13px] font-medium', cur && 'bg-primary-700 !text-white hover:bg-primary-700 dark:bg-brand-lime dark:!text-brand-night dark:hover:bg-brand-lime')}
              >
                {n}
              </button>
            );
          })}
        </div>
      )}

      {mode === 'years' && (
        <div ref={yearsRef} role="listbox" aria-label="Year" className={cn('grid grid-cols-4 gap-1.5 overflow-y-auto overscroll-contain py-1', phone ? 'max-h-[300px]' : 'max-h-[232px]')}>
          {Array.from({ length: yearBounds.hi - yearBounds.lo + 1 }, (_, i) => yearBounds.lo + i).map((y) => {
            const cur = y === view.y;
            return (
              <button
                key={y}
                type="button"
                role="option"
                aria-selected={cur}
                aria-current={cur ? 'true' : undefined}
                onClick={() => {
                  const day = Math.min(splitISO(focusISO)!.d, daysInMonth(y, view.m));
                  setMode('days');
                  goto(ymdToISO(y, view.m, day), false);
                }}
                className={cn(btnBase, phone ? 'h-11' : 'h-9', 'text-[13px] font-medium', cur && 'bg-primary-700 !text-white hover:bg-primary-700 dark:bg-brand-lime dark:!text-brand-night dark:hover:bg-brand-lime')}
              >
                {y}
              </button>
            );
          })}
        </div>
      )}

      {mode === 'days' && (
        <div ref={gridRef} role="grid" aria-label={`${MONTHS_LONG[view.m - 1]} ${view.y}`} onKeyDown={onGridKey}>
          <div role="row" className="grid grid-cols-7">
            {weekdays.map((w) => (
              <div key={w} role="columnheader" aria-label={WEEKDAYS_LONG[w]} className="py-1 text-center text-[12px] font-semibold uppercase tracking-wide text-[#7B8983] dark:text-surface-muted">
                {WEEKDAYS_SHORT[w]}
              </div>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, r) => (
            <div key={r} role="row" className="grid grid-cols-7 gap-y-0.5">
              {cells.slice(r * 7, r * 7 + 7).map((c) => {
                const isSel = c.iso === selected || (hasRange && (c.iso === lo || c.iso === hi));
                const inRange = hasRange && c.iso > lo && c.iso < hi;
                const dis = isDisabled(c.iso);
                const isToday = c.iso === today;
                const label = `${c.d} ${MONTHS_LONG[c.m - 1]} ${c.y}`;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    role="gridcell"
                    data-iso={c.iso}
                    aria-selected={isSel}
                    aria-disabled={dis || undefined}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={label}
                    tabIndex={c.iso === focusISO ? 0 : -1}
                    onClick={() => {
                      if (dis) return;
                      wantFocus.current = false;
                      onSelect(c.iso);
                    }}
                    className={cn(
                      'relative mx-auto flex w-full flex-col items-center justify-center rounded-lg font-medium leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 dark:focus-visible:ring-brand-lime',
                      cell,
                      c.other ? 'text-[#A9B5AF] dark:text-surface-muted/50' : 'text-[#18231E] dark:text-surface-text',
                      !dis && !isSel && 'hover:bg-primary-50 dark:hover:bg-surface-hover',
                      inRange && 'rounded-none bg-primary-100/70 dark:bg-brand-lime/15',
                      isToday && !isSel && 'ring-1 ring-inset ring-primary-600 dark:ring-brand-lime',
                      isSel && 'bg-primary-700 font-bold !text-white dark:bg-brand-lime dark:!text-brand-night',
                      dis && 'cursor-not-allowed opacity-35'
                    )}
                  >
                    <span>{c.d}</span>
                    {showHijri && (
                      <span className={cn('mt-0.5 text-[9px] font-normal', isSel ? 'text-white/80 dark:text-brand-night/80' : 'text-[#7B8983] dark:text-surface-muted')}>
                        {hijriOf(c.y, c.m, c.d).day}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {(onClear || showToday) && (
        <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2 dark:border-surface-border">
          {onClear ? (
            <button type="button" onClick={onClear} className={cn(btnBase, 'px-3 text-[12px] font-semibold', phone ? 'h-11' : 'h-8')}>Clear</button>
          ) : <span />}
          {showToday && (
            <button
              type="button"
              disabled={todayDisabled}
              onClick={() => onSelect(today)}
              className={cn(btnBase, 'px-3 text-[12px] font-semibold text-primary-700 disabled:opacity-40 dark:text-brand-lime', phone ? 'h-11' : 'h-8')}
            >
              Today
            </button>
          )}
        </div>
      )}
    </div>
  );
}

