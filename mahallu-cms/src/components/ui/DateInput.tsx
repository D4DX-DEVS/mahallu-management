import { forwardRef } from 'react';
import { FiCalendar } from 'react-icons/fi';
import PickerField, { PickerCommonProps, maskGroups } from './picker/PickerField';
import Calendar from './picker/Calendar';
import { formatDisplay, normalizeISODate, parseDateText } from '@/utils/dates';

export interface DateInputProps extends PickerCommonProps {
  /** Secondary Hijri (Umm al-Qura) labels under the day numbers and in the header. Default off. */
  showHijri?: boolean;
  /** First weekday: 0 = Sunday (default) … 6 = Saturday. */
  weekStart?: number;
  /** Extra disabled days, in addition to min / max. */
  disabledDate?: (iso: string) => boolean;
}

/**
 * ZAAD single-date field. Value is the ISO string 'YYYY-MM-DD'; the field shows dd/MM/yyyy and accepts
 * typing (12/10/2026, 12-10-2026, 12102026, '12 oct 2026'). A hidden real <input> (ref, name, onChange,
 * onBlur) carries the ISO value and receives real input/change events, so react-hook-form's register()
 * and controlled value/onChange both work unchanged.
 */
const DateInput = forwardRef<HTMLInputElement, DateInputProps>(({ showHijri, weekStart = 0, disabledDate, placeholder = 'dd/mm/yyyy', min, max, ...rest }, ref) => {
  const lo = normalizeISODate(min) || undefined;
  const hi = normalizeISODate(max) || undefined;
  return (
    <PickerField
      {...rest}
      min={lo}
      max={hi}
      innerRef={ref}
      placeholder={placeholder}
      normalize={normalizeISODate}
      format={formatDisplay}
      parse={parseDateText}
      mask={(raw, prev) => maskGroups(raw, prev, [2, 2, 4], '/')}
      fullLength={10}
      icon={<FiCalendar className="h-4 w-4" />}
      ariaLabel="Choose date"
      invalidMessage="Enter a valid date (dd/mm/yyyy)"
      bounds={disabledDate ? (p) => (disabledDate(p) ? 'This date is not available' : null) : undefined}
    >
      {(ctx) => (
        <Calendar
          value={ctx.iso}
          min={lo}
          max={hi}
          disabledDate={disabledDate}
          weekStart={weekStart}
          showHijri={showHijri}
          phone={ctx.phone}
          onSelect={(d) => ctx.commit(d)}
          onClear={ctx.canClear ? ctx.clear : undefined}
        />
      )}
    </PickerField>
  );
});
DateInput.displayName = 'DateInput';
export default DateInput;
