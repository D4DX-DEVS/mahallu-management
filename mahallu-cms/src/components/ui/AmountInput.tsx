import { forwardRef, useState } from 'react';
import Input, { InputProps } from './Input';
import { formatIndianNumber, stripAmount } from '@/utils/formFields';

/**
 * Amount field: shows Indian grouping (1,25,000) once the field loses focus, but the underlying
 * value stays a plain numeric string (form state / submit). Works with register() (uncontrolled,
 * optionally valueAsNumber) and with controlled value/onChange.
 */
const AmountInput = forwardRef<HTMLInputElement, InputProps>(({ onChange, onBlur, onFocus, value, ...props }, ref) => {
  const [focused, setFocused] = useState(false);
  const controlled = value !== undefined;
  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      {...(controlled ? { value: focused ? String(value) : formatIndianNumber(value as string | number) } : {})}
      onChange={(e) => {
        e.target.value = stripAmount(e.target.value);
        onChange?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        if (!controlled) e.target.value = stripAmount(e.target.value);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        const plain = stripAmount(e.target.value);
        e.target.value = plain;
        onBlur?.(e); // react-hook-form reads the plain value here
        if (!controlled) e.target.value = formatIndianNumber(plain);
      }}
      {...props}
    />
  );
});
AmountInput.displayName = 'AmountInput';
export default AmountInput;
