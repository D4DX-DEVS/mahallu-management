import { forwardRef } from 'react';
import { FiCalendar } from 'react-icons/fi';
import PickerField, { PickerCommonProps } from './picker/PickerField';
import Calendar from './picker/Calendar';
import TimeColumns from './picker/TimeColumns';
import { formatDisplay, normalizeDateTime, normalizeISODate, parseDateText, parseTimeText, todayISO } from '@/utils/dates';

export interface DateTimeInputProps extends PickerCommonProps {
  showHijri?: boolean;
  weekStart?: number;
}

const fmt = (v: string) => (v ? `${formatDisplay(v.slice(0, 10))} ${v.slice(11, 16)}` : '');
const parse = (text: string) => {
  const m = /^(\S+)\s+(\S+)$/.exec(text.trim());
  if (!m) return null;
  const d = parseDateText(m[1]);
  const t = parseTimeText(m[2]);
  return d && t ? `${d}T${t}` : null;
};
/** Digits-only mask: 121020261430 -> 12/10/2026 14:30 */
const mask = (raw: string, prev: string) => {
  if (/[A-Za-z]/.test(raw)) return raw;
  const d = raw.replace(/\D/g, '').slice(0, 12);
  let out = d.slice(0, 2);
  if (d.length > 2 || (raw.length > prev.length && d.length === 2)) out += '/' + d.slice(2, 4);
  if (d.length > 4 || (raw.length > prev.length && d.length === 4)) out += '/' + d.slice(4, 8);
  if (d.length > 8 || (raw.length > prev.length && d.length === 8)) out += ' ' + d.slice(8, 10);
  if (d.length > 10 || (raw.length > prev.length && d.length === 10)) out += ':' + d.slice(10, 12);
  return out;
};

/** ZAAD date + time field replacing datetime-local. Value 'YYYY-MM-DDTHH:mm', display 'dd/MM/yyyy HH:mm'. */
const DateTimeInput = forwardRef<HTMLInputElement, DateTimeInputProps>(({ showHijri, weekStart = 0, placeholder = 'dd/mm/yyyy hh:mm', min, max, ...rest }, ref) => {
  const lo = normalizeDateTime(min) || undefined;
  const hi = normalizeDateTime(max) || undefined;
  return (
    <PickerField
      {...rest}
      min={lo}
      max={hi}
      innerRef={ref}
      placeholder={placeholder}
      normalize={normalizeDateTime}
      format={fmt}
      parse={parse}
      mask={mask}
      fullLength={16}
      icon={<FiCalendar className="h-4 w-4" />}
      ariaLabel="Choose date and time"
      invalidMessage="Enter a valid date and time (dd/mm/yyyy hh:mm)"
      popoverWidth={304}
    >
      {(ctx) => {
        const date = normalizeISODate(ctx.iso.slice(0, 10));
        const time = ctx.iso.slice(11, 16);
        return (
          <div>
            <Calendar
              value={date}
              min={lo?.slice(0, 10)}
              max={hi?.slice(0, 10)}
              weekStart={weekStart}
              showHijri={showHijri}
              phone={ctx.phone}
              showToday={false}
              summary={ctx.iso ? fmt(ctx.iso) : 'Select date and time'}
              onSelect={(d) => ctx.commit(`${d}T${time || '09:00'}`, false)}
            />
            <div className="mt-2 border-t border-line-soft pt-2 dark:border-surface-border">
              <TimeColumns value={time} onChange={(t) => ctx.commit(`${date || todayISO()}T${t}`, false)} phone={ctx.phone} />
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2 dark:border-surface-border">
              {ctx.canClear ? <button type="button" onClick={ctx.clear} className="h-8 rounded-lg px-3 text-[12px] font-semibold text-[#3A4741] hover:bg-primary-50 max-sm:h-11 dark:text-surface-text dark:hover:bg-surface-hover">Clear</button> : <span />}
              <button type="button" onClick={ctx.close} className="h-8 rounded-lg px-3 text-[12px] font-semibold text-primary-700 hover:bg-primary-50 max-sm:h-11 dark:text-brand-lime dark:hover:bg-surface-hover">Done</button>
            </div>
          </div>
        );
      }}
    </PickerField>
  );
});
DateTimeInput.displayName = 'DateTimeInput';
export default DateTimeInput;
