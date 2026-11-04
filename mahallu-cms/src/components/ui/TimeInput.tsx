import { forwardRef } from 'react';
import { FiClock } from 'react-icons/fi';
import PickerField, { PickerCommonProps, maskGroups } from './picker/PickerField';
import TimeColumns from './picker/TimeColumns';
import { normalizeTime, parseTimeText } from '@/utils/dates';

export interface TimeInputProps extends PickerCommonProps {
  /** Minute step in the picker list (default 5; any minute can still be typed). */
  minuteStep?: number;
}

/** ZAAD time field. Value 'HH:mm' (24h); typing accepts 0930, 9:30, 09.30. */
const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(({ placeholder = 'hh:mm', minuteStep = 5, ...rest }, ref) => (
  <PickerField
    {...rest}
    innerRef={ref}
    placeholder={placeholder}
    normalize={normalizeTime}
    format={(v) => v}
    parse={parseTimeText}
    mask={(raw, prev) => maskGroups(raw, prev, [2, 2], ':')}
    fullLength={5}
    icon={<FiClock className="h-4 w-4" />}
    ariaLabel="Choose time"
    invalidMessage="Enter a valid time (hh:mm, 24-hour)"
    popoverWidth={200}
  >
    {(ctx) => (
      <div>
        <TimeColumns value={ctx.iso} onChange={(t) => ctx.commit(t, false)} step={minuteStep} phone={ctx.phone} autoFocus />
        <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2 dark:border-surface-border">
          {ctx.canClear ? <button type="button" onClick={ctx.clear} className="h-8 rounded-lg px-3 text-[12px] font-semibold text-[#3A4741] hover:bg-primary-50 max-sm:h-11 dark:text-surface-text dark:hover:bg-surface-hover">Clear</button> : <span />}
          <button type="button" onClick={ctx.close} className="h-8 rounded-lg px-3 text-[12px] font-semibold text-primary-700 hover:bg-primary-50 max-sm:h-11 dark:text-brand-lime dark:hover:bg-surface-hover">Done</button>
        </div>
      </div>
    )}
  </PickerField>
));
TimeInput.displayName = 'TimeInput';
export default TimeInput;
