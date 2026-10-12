import { forwardRef } from 'react';
import Input, { InputProps } from './Input';
import { normalizeIndianMobile, PHONE_HINT } from '@/utils/formFields';

/**
 * 10-digit Indian mobile input. Digits only; pasted "+91 98765 43210" or "098765..." is normalised
 * to 10 digits. Works with react-hook-form's register() (value is normalised before onChange fires).
 */
const PhoneInput = forwardRef<HTMLInputElement, InputProps>(({ onChange, onBlur, helperText, placeholder, ...props }, ref) => (
  <Input
    ref={ref}
    type="tel"
    inputMode="numeric"
    autoComplete="tel-national"
    maxLength={20}
    placeholder={placeholder ?? '98765 43210'}
    helperText={helperText ?? PHONE_HINT}
    onChange={(e) => {
      e.target.value = normalizeIndianMobile(e.target.value);
      onChange?.(e);
    }}
    onBlur={(e) => {
      e.target.value = normalizeIndianMobile(e.target.value);
      onBlur?.(e);
    }}
    {...props}
  />
));
PhoneInput.displayName = 'PhoneInput';
export default PhoneInput;
