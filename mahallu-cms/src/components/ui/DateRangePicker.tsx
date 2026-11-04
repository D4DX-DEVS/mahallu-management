import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FiCalendar, FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { controlClasses, controlErrorClasses, labelClasses } from './controlStyles';
import PickerPopover from './picker/PickerPopover';
import { maskGroups } from './picker/PickerField';
import Calendar from './picker/Calendar';
import { useIsPhone } from '@/hooks/useMediaQuery';
import { RANGE_PRESETS, RangePresetKey, formatDisplay, normalizeISODate, parseDateText, rangeForPreset } from '@/utils/dates';

export interface DateRangePickerProps {
  /** ISO 'YYYY-MM-DD' or '' */
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  label?: string;
  error?: string;
  helperText?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  showHijri?: boolean;
  weekStart?: number;
  /** Which presets to offer (default: all six). Pass [] to hide. */
  presets?: RangePresetKey[];
  placeholder?: string;
  className?: string;
  id?: string;
}

const chip =
  'rounded-lg px-2.5 text-left text-[12px] font-semibold text-[#3A4741] transition-colors hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 dark:text-surface-text dark:hover:bg-surface-hover dark:focus-visible:ring-brand-lime';

const smallInput =
  'h-9 w-full rounded-lg border border-line-strong bg-white px-2.5 text-[13px] text-[#18231E] focus:outline-none focus:border-primary-600 dark:border-surface-border-strong dark:bg-surface-raised dark:text-surface-text dark:focus:border-brand-lime max-sm:h-11';

/**
 * ZAAD date-range filter: one field, popover with presets (Today, Yesterday, Last 7 days, This month,
 * Last month, This financial year Apr-Mar), two typed From/To inputs and a range calendar. It keeps the
 * two ISO values the page already stores: onChange(from, to).
 */
export default function DateRangePicker({
  from, to, onChange, label, error, helperText, min, max, disabled, required, clearable, showHijri, weekStart = 0,
  presets = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'thisFY'], placeholder = 'Select date range', className, id,
}: DateRangePickerProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const f = normalizeISODate(from);
  const t = normalizeISODate(to);
  // first click of a custom range waits for the second
  const [pending, setPending] = useState<string>('');
  const [fromText, setFromText] = useState(formatDisplay(f));
  const [toText, setToText] = useState(formatDisplay(t));
  const [fieldErr, setFieldErr] = useState('');
  const lo = normalizeISODate(min) || undefined;
  const hi = normalizeISODate(max) || undefined;

  useEffect(() => {
    setFromText(formatDisplay(f));
    setToText(formatDisplay(t));
    setFieldErr('');
  }, [f, t]);

  // closing the popover drops any half-typed or rejected text, so it never reopens showing a stale error
  useEffect(() => {
    if (!open) {
      setFromText(formatDisplay(f));
      setToText(formatDisplay(t));
      setFieldErr('');
    }
  }, [open, f, t]);

  const close =useCallback((refocus: boolean) => {
    setOpen(false);
    setPending('');
    if (refocus) btnRef.current?.focus({ preventScroll: true });
  }, []);

  const apply = (a: string, b: string, closeIt = true) => {
    const [x, y] = a && b && a > b ? [b, a] : [a, b];
    onChange(x, y);
    if (closeIt) close(true);
  };

  const active = presets.find((k) => {
    const r = rangeForPreset(k);
    return r.from === f && r.to === t;
  });
  const shown = f || t ? `${f ? formatDisplay(f) : '…'}  –  ${t ? formatDisplay(t) : '…'}` : '';
  const canClear = (clearable ?? !required) && !disabled && !!(f || t);

  const typed = (txt: string, which: 'from' | 'to') => {
    if (!txt.trim()) {
      apply(which === 'from' ? '' : f, which === 'to' ? '' : t, false);
      return;
    }
    const p = parseDateText(txt);
    if (!p) return setFieldErr('Not a valid date. Use dd/mm/yyyy, for example 17/10/2026');
    if ((lo && p < lo) || (hi && p > hi)) return setFieldErr('Date is outside the allowed range');
    const nf = which === 'from' ? p : f;
    const nt = which === 'to' ? p : t;
    // Typed dates are never swapped behind the user's back: say what is wrong instead.
    if (nf && nt && nf > nt) {
      return setFieldErr(which === 'from' ? 'Start date is after the end date. Change the end date first.' : 'End date is before the start date.');
    }
    setFieldErr('');
    apply(nf, nt, false);
  };

  const dateField = (which: 'from' | 'to') => {
    const txt = which === 'from' ? fromText : toText;
    const set = which === 'from' ? setFromText : setToText;
    return (
      <label className="block min-w-0 flex-1">
        <span className="mb-1 block text-[12px] font-semibold text-[#7B8983] dark:text-surface-muted">{which === 'from' ? 'From' : 'To'}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/yyyy"
          value={txt}
          onChange={(e) => {
            const v = maskGroups(e.target.value, txt, [2, 2, 4], '/');
            set(v);
            setFieldErr('');
            if (v.length >= 10) typed(v, which);
          }}
          onBlur={() => typed(txt, which)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              typed(txt, which);
            }
          }}
          aria-label={which === 'from' ? 'From date' : 'To date'}
          className={smallInput}
        />
      </label>
    );
  };

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className={labelClasses}>
          {label}
          {required && <span className="ml-0.5 text-[#D9534F]">*</span>}
        </label>
      )}
      <div ref={anchorRef} className="relative">
        <button
          ref={btnRef}
          id={inputId}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          onClick={() => (open ? close(true) : setOpen(true))}
          className={cn(controlClasses, 'flex h-9 items-center gap-2 pr-9 text-left max-sm:h-11', canClear && 'pr-16', error && controlErrorClasses, className)}
        >
          <FiCalendar className="h-4 w-4 flex-shrink-0 text-[#7B8983] dark:text-surface-muted" />
          <span className={cn('min-w-0 flex-1 truncate', !shown && 'text-[#98A59F] dark:text-surface-muted')}>{shown || placeholder}</span>
        </button>
        {canClear && (
          <button
            type="button"
            aria-label="Clear dates"
            onClick={() => {
              apply('', '', false);
            }}
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#7B8983] hover:bg-primary-50 hover:text-[#18231E] max-sm:h-9 max-sm:w-9 dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-surface-text"
          >
            <FiX className="h-3.5 w-3.5" />
          </button>
        )}
        <PickerPopover open={open} anchorRef={anchorRef} onClose={close} width={phone ? 304 : presets.length ? 490 : 304} label="Choose date range">
          <div className={cn(!phone && presets.length ? 'flex gap-3' : 'block')}>
            {presets.length > 0 && (
              <div
                className={cn(
                  phone ? '-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1' : 'flex w-[150px] flex-shrink-0 whitespace-nowrap flex-col gap-0.5 border-r border-line-soft pr-3 dark:border-surface-border'
                )}
              >
                {RANGE_PRESETS.filter((p) => presets.includes(p.key)).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      const r = rangeForPreset(p.key);
                      apply(r.from, r.to);
                    }}
                    aria-pressed={active === p.key}
                    className={cn(
                      chip,
                      phone ? 'h-11 flex-shrink-0 whitespace-nowrap border border-line-strong dark:border-surface-border-strong' : 'h-8',
                      active === p.key && 'bg-primary-700 !text-white hover:bg-primary-700 dark:bg-brand-lime dark:!text-brand-night dark:hover:bg-brand-lime'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={!active && !!(f || t)}
                  onClick={() => setPending('')}
                  className={cn(chip, phone ? 'h-11 flex-shrink-0 border border-line-strong dark:border-surface-border-strong' : 'h-8', !active && !!(f || t) && 'bg-primary-50 dark:bg-surface-hover')}
                >
                  Custom
                </button>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex gap-2">
                {dateField('from')}
                {dateField('to')}
              </div>
              {fieldErr && <p role="alert" className="mb-1 text-[12px] font-medium text-[#B3261E] dark:text-red-300">{fieldErr}</p>}
              <Calendar
                value={pending}
                range={pending ? { from: pending, to: pending } : { from: f, to: t }}
                min={lo}
                max={hi}
                weekStart={weekStart}
                showHijri={showHijri}
                phone={phone}
                showToday={false}
                summary={pending ? `${formatDisplay(pending)} – pick end date` : f || t ? `${formatDisplay(f) || '…'} – ${formatDisplay(t) || '…'}` : 'Pick a start date'}
                initial={f || t}
                onSelect={(d) => {
                  if (!pending) {
                    setPending(d);
                    return;
                  }
                  apply(pending, d);
                }}
                onClear={canClear ? () => apply('', '') : undefined}
              />
            </div>
          </div>
        </PickerPopover>
      </div>
      {error && <p role="alert" className="mt-1.5 text-[12px] font-medium text-[#B3261E] dark:text-red-300">{error}</p>}
      {helperText && !error && <p className="mt-1.5 text-[12px] text-[#7B8983] dark:text-surface-muted">{helperText}</p>}
    </div>
  );
}
