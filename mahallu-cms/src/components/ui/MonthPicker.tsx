import { forwardRef, useState } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import PickerField, { PickerCommonProps, maskGroups } from './picker/PickerField';
import { MONTHS_SHORT, formatMonthDisplay, normalizeMonth, parseMonthText, todayISO } from '@/utils/dates';

export type MonthPickerProps = PickerCommonProps;

const arrow = 'inline-flex items-center justify-center rounded-lg text-[#3A4741] hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 dark:text-surface-text dark:hover:bg-surface-hover dark:focus-visible:ring-brand-lime';

function MonthGrid({ value, min, max, phone, onPick, onClear }: { value: string; min?: string; max?: string; phone: boolean; onPick: (m: string) => void; onClear?: () => void }) {
  const thisMonth = todayISO().slice(0, 7);
  const [year, setYear] = useState(+(value || thisMonth).slice(0, 4));
  const dis = (m: string) => !!((min && m < min) || (max && m > max));
  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <button type="button" aria-label="Previous year" onClick={() => setYear((y) => y - 1)} className={cn(arrow, phone ? 'h-11 w-11' : 'h-8 w-8')}><FiChevronLeft /></button>
        <div className="flex-1 text-center text-[13px] font-bold" aria-live="polite">{year}</div>
        <button type="button" aria-label="Next year" onClick={() => setYear((y) => y + 1)} className={cn(arrow, phone ? 'h-11 w-11' : 'h-8 w-8')}><FiChevronRight /></button>
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="listbox" aria-label="Month">
        {MONTHS_SHORT.map((n, i) => {
          const m = `${year}-${String(i + 1).padStart(2, '0')}`;
          const sel = m === value;
          return (
            <button
              key={m}
              type="button"
              role="option"
              aria-selected={sel}
              aria-current={m === thisMonth ? 'date' : undefined}
              disabled={dis(m)}
              onClick={() => onPick(m)}
              className={cn(
                'rounded-lg text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-35 dark:focus-visible:ring-brand-lime',
                phone ? 'h-12' : 'h-10',
                sel ? 'bg-primary-700 font-bold text-white dark:bg-brand-lime dark:text-brand-night' : 'text-[#18231E] hover:bg-primary-50 dark:text-surface-text dark:hover:bg-surface-hover',
                m === thisMonth && !sel && 'ring-1 ring-inset ring-primary-600 dark:ring-brand-lime'
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2 dark:border-surface-border">
        {onClear ? <button type="button" onClick={onClear} className={cn(arrow, 'px-3 text-[12px] font-semibold', phone ? 'h-11' : 'h-8')}>Clear</button> : <span />}
        <button type="button" disabled={dis(thisMonth)} onClick={() => onPick(thisMonth)} className={cn(arrow, 'px-3 text-[12px] font-semibold text-primary-700 disabled:opacity-40 dark:text-brand-lime', phone ? 'h-11' : 'h-8')}>This month</button>
      </div>
    </div>
  );
}

/** ZAAD month + year field. Value 'YYYY-MM', display 'Oct 2026'; typing accepts 10/2026, 2026-10, 'oct 2026'. */
const MonthPicker = forwardRef<HTMLInputElement, MonthPickerProps>(({ placeholder = 'mm/yyyy', min, max, ...rest }, ref) => {
  const lo = normalizeMonth(min) || undefined;
  const hi = normalizeMonth(max) || undefined;
  return (
    <PickerField
      {...rest}
      min={lo}
      max={hi}
      innerRef={ref}
      placeholder={placeholder}
      normalize={normalizeMonth}
      format={formatMonthDisplay}
      parse={parseMonthText}
      mask={(raw, prev) => (/^\d{4}-/.test(raw) ? raw : maskGroups(raw, prev, [2, 4], '/'))}
      fullLength={7}
      icon={<FiCalendar className="h-4 w-4" />}
      ariaLabel="Choose month"
      invalidMessage="Enter a valid month (mm/yyyy)"
      popoverWidth={264}
    >
      {(ctx) => <MonthGrid value={ctx.iso} min={lo} max={hi} phone={ctx.phone} onPick={(m) => ctx.commit(m)} onClear={ctx.canClear ? ctx.clear : undefined} />}
    </PickerField>
  );
});
MonthPicker.displayName = 'MonthPicker';
export default MonthPicker;
